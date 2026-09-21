// Timeout por request -- sin esto, si algo del otro lado se cuelga
// (backend lento, un servicio interno sin responder), el fetch queda
// pendiente para siempre: el "loading" del componente nunca se apaga, y
// si el usuario navega y vuelve a entrar a la misma pagina se dispara
// OTRO fetch que tambien puede colgarse, acumulando pedidos pendientes
// hasta agotar el limite de conexiones simultaneas por origen del
// navegador -- eso es lo que se vio como "hay que recargar toda la
// pagina para que ande de nuevo".
const TIMEOUT_MS = 15000;

// "timeoutMs" es un campo propio (no de fetch()) -- se saca de options
// antes de pasarlo al fetch real. Sirve para pedidos que sabemos que
// pueden tardar mas de lo normal (ej. el detalle de una licitacion/compra
// que compra-service todavia no tiene cacheado y tiene que pedirle en
// vivo a Mercado Publico, ver Licitacion.jsx/CompraRapida.jsx) sin bajarle
// la paciencia al resto de los pedidos, que son internos y rapidos.
function fetchConTimeout(url, options) {
    const { timeoutMs = TIMEOUT_MS, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { ...fetchOptions, signal: controller.signal })
        .catch((err) => {
            if (err.name === "AbortError") {
                throw new Error("El servidor no respondió a tiempo (timeout)");
            }
            throw err;
        })
        .finally(() => clearTimeout(timeoutId));
}

// Evita disparar varios POST /auth/refresh en paralelo si varios fetch
// fallan con 401 al mismo tiempo (ej. Home.jsx pide licitaciones y
// compras a la vez con Promise.all). El refresh token ROTA en cada uso
// (ver RefreshTokenService.validarYRotar en auth-service): 2 llamadas
// simultaneas con el mismo refresh token harian que la segunda falle (la
// primera ya lo habria invalidado), deslogueando a alguien con sesión
// valida por una condición de carrera. Todo lo que llegue mientras hay
// una renovación en curso espera la MISMA promesa en vez de arrancar otra.
let renovacionEnCurso = null;

// Exportado tambien para RequireAuth: cuando el access token ya vencio,
// intenta renovarlo con el refresh token ANTES de mandar a /login (si no,
// se perderia la sesión cada 1h en vez de cada 7 dias).
export function renovarAccessToken() {
    if (!renovacionEnCurso) {
        renovacionEnCurso = fetch("/auth/refresh", { method: "POST", credentials: "include" })
            .then(async (res) => {
                if (!res.ok) return false;
                const { token } = await res.json();
                localStorage.setItem("token", token);
                return true;
            })
            .catch(() => false)
            .finally(() => {
                renovacionEnCurso = null;
            });
    }
    return renovacionEnCurso;
}

// Wrapper sobre fetch() que agrega el header Authorization con el access
// token guardado (JWT, dura 1h, ver Login.jsx) y, si el backend responde
// 401 (vencido), intenta renovarlo solo con el refresh token -- una
// cookie httpOnly que este JS ni puede leer, el navegador la manda sola
// (ver /auth/refresh en auth-service) -- y reintenta la request original
// una vez. Si la renovación también falla (refresh token vencido/
// revocado), se limpia el access token viejo y se deja pasar el 401 tal
// cual: el caller ya sabe mostrar el error, y RequireAuth manda a /login
// en la próxima navegación.
export async function authFetch(url, options = {}, _reintentando = false) {
    const token = localStorage.getItem("token");
    const headers = { ...(options.headers || {}) };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetchConTimeout(url, { ...options, headers });

    if (res.status === 401 && !_reintentando) {
        const renovado = await renovarAccessToken();
        if (renovado) {
            return authFetch(url, options, true);
        }
        localStorage.removeItem("token");
    }

    return res;
}

// Revoca el refresh token en el servidor (ver AuthService.cerrarSesion) y
// limpia el access token local. Sin esto, "cerrar sesión" solo borraba el
// access token del navegador pero el refresh token seguía vigente en el
// servidor -- alguien con la cookie todavía podría haber pedido un access
// token nuevo.
export async function logout() {
    try {
        await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } catch {
        // Si el logout en el servidor falla (red caída, etc.) igual se
        // limpia el lado del cliente -- no dejar a alguien "atrapado"
        // logueado por un error de red.
    } finally {
        localStorage.removeItem("token");
    }
}

// Decodifica el payload del JWT guardado (segundo segmento, base64) sin
// verificar la firma -- eso ya lo hace el backend en cada request, esto es
// solo para que el FRONT sepa que hay adentro (rol, alcance, empresaId,
// exp) y decida que mostrar. null si no hay token o esta corrupto.
function decodeToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        return JSON.parse(atob(token.split(".")[1]));
    } catch {
        return null;
    }
}

// Si el token ya vencio (o no existe/esta corrupto), false. Ojo: esto es
// solo un chequeo SINCRONICO y rapido para RequireAuth -- si da false, no
// significa necesariamente "no hay sesión": puede que el access token haya
// vencido pero el refresh token (cookie httpOnly) siga vigente. Por eso
// RequireAuth intenta un refresh antes de mandar a /login si esto da
// false, en vez de redirigir directo.
export function tokenVigente() {
    const payload = decodeToken();
    if (!payload) return false;
    if (!payload.exp) return true;
    return payload.exp * 1000 > Date.now();
}

// Claims utiles para la UI (Sidebar, MiEmpresa.jsx) -- { rol, alcance,
// empresaId, username } o null si no hay sesion valida. "alcance" es lo
// que determina que se puede ver/hacer (ver Alcance.java en los backends),
// no el nombre del rol.
export function getClaims() {
    const payload = decodeToken();
    if (!payload) return null;
    return {
        username: payload.sub ?? null,
        rol: payload.role ?? null,
        alcance: payload.alcance ?? null,
        empresaId: payload.empresaId ?? null,
    };
}
