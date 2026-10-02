import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../lib/api.js";
import Modal from "../components/Modal.jsx";
import EmpresaForm, { EMPRESA_VACIA, TAMANOS_EMPRESA, archivoABase64 } from "../components/EmpresaForm.jsx";

// Panel exclusivo de rol GLOBAL (ADMIN) -- ver Sidebar.jsx, solo aparece
// el link si claims.alcance === "GLOBAL". A diferencia de MiEmpresa.jsx
// (que un ADMIN_EMPRESA administra, acotado a SU empresa), esto ve y
// gestiona TODO el sistema: cualquier empresa, cualquier usuario,
// cualquier rol (incluido crear otro ADMIN). El backend
// (@PreAuthorize hasRole('GLOBAL') en EmpresaController/UsuarioController/
// RoleController) rechaza con 403 a cualquiera que no sea GLOBAL, aunque
// entre a la URL a mano.
export default function Administracion() {
    useEffect(() => {
        document.title = "Administración";
    }, []);

    return (
        <div className="flex-min-w-0">
            <h1>Administración</h1>
            <p>Gestión general de empresas, usuarios y roles de todo el sistema.</p>

            <SeccionMonitoreo />
            <SeccionEmpresas />
            <SeccionUsuarios />
        </div>
    );
}

// ---------------------------------------------------------------------
// Monitoreo: salud de los scheduler que sincronizan con APIs externas
// (Mercado Publico, el scraper Python) -- ver SyncController.salud() en
// compra-service. Antes esta info solo vivia en los logs de Docker
// (docker-compose logs backend | grep ...), sin forma de verla desde la
// app; ahora GLOBAL puede vigilarla desde acá. Auto-refresh cada 15s
// mientras la pagina este abierta -- se corta solo al desmontar.
// ---------------------------------------------------------------------
const ETIQUETA_JOB = {
    "compra-agil-detalle": "Compra Ágil — detalle",
    "compra-agil-adjuntos": "Compra Ágil — adjuntos",
    "licitacion-adjuntos": "Licitación — adjuntos",
    "reclamos-token": "Token de reclamos (comprador)",
    "limpieza-cache": "Limpieza de caché vieja",
};

const INTERVALO_REFRESCO_MS = 15000;

// "hace X" en vez de la fecha completa -- lo que importa acá es qué tan
// reciente es, no el timestamp exacto. Las fechas vienen sin zona horaria
// explicita del backend (LocalDateTime tal cual, ver FechaParser) pero
// SIEMPRE representan la hora del SERVIDOR (no UTC como en
// CompraAgilDto/LicitacionDto) -- por eso acá se parsean como locales,
// sin el fix de "Z" que sí aplica a esos otros DTOs.
function haceCuanto(fechaSinZona) {
    if (!fechaSinZona) return "nunca";
    const entonces = new Date(fechaSinZona);
    if (Number.isNaN(entonces.getTime())) return "-";
    const segundos = Math.max(0, Math.round((Date.now() - entonces.getTime()) / 1000));
    if (segundos < 60) return `hace ${segundos}s`;
    const minutos = Math.round(segundos / 60);
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    return `hace ${Math.round(horas / 24)} d`;
}

// Centralizado acá (en vez de repetir el if/else en cada lugar que
// necesita el color/texto) -- lo usan tanto la tarjeta chica como el
// modal ampliado.
function estadoDeJob(job) {
    const sinDatosTodavia = !job.ultimoExitoEn && !job.ultimoErrorEn;
    // Rojo: el ciclo actual tuvo SOLO fallos (y al menos uno). Amarillo:
    // hubo fallos pero tambien algun exito en el mismo ciclo (parcial).
    // Verde: todo bien o sin datos todavia (no penalizar un scheduler que
    // recien arranca).
    if (!sinDatosTodavia && job.erroresCicloActual > 0) {
        return job.exitosCicloActual === 0
            ? { color: "var(--danger)", texto: "Fallando" }
            : { color: "var(--warning)", texto: "Parcial" };
    }
    if (sinDatosTodavia) {
        return { color: "var(--text-muted)", texto: "Sin datos aún" };
    }
    return { color: "var(--success)", texto: "OK" };
}

// "ampliado" (dentro del modal, al hacer click) muestra el error completo
// sin truncar -- en la tarjeta chica de la grilla se corta con "..." y
// solo se ve entero al pasar el mouse (title), que en mobile ni sirve.
function EstadoJobCard({ job, ampliado = false, onClick }) {
    const etiqueta = ETIQUETA_JOB[job.job] || job.job;
    const { color, texto } = estadoDeJob(job);

    return (
        <div
            className={`card-panel ${onClick ? "card-clickeable" : ""}`}
            style={{ padding: "14px 16px" }}
            onClick={onClick}
        >
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                <span className="fw-semibold" style={{ fontSize: ampliado ? "1rem" : "0.85rem" }}>{etiqueta}</span>
                <span className="badge" style={{ background: color, color: "#fff" }}>{texto}</span>
            </div>
            <div className="text-muted" style={{ fontSize: ampliado ? "0.85rem" : "0.78rem" }}>
                <div>Último éxito: {haceCuanto(job.ultimoExitoEn)}</div>
                <div>Último error: {haceCuanto(job.ultimoErrorEn)}</div>
                <div>Ciclo actual: {job.exitosCicloActual} OK / {job.erroresCicloActual} fallos</div>
                {job.ultimoError && (
                    <div
                        className={`mt-2 pt-2 border-top ${ampliado ? "" : "text-truncate"}`}
                        title={ampliado ? undefined : job.ultimoError}
                        style={{ color: "var(--danger)", whiteSpace: ampliado ? "pre-wrap" : undefined }}
                    >
                        {job.ultimoError}
                    </div>
                )}
            </div>
        </div>
    );
}

function SeccionMonitoreo() {
    const [salud, setSalud] = useState(null);
    const [error, setError] = useState(null);
    const [cargando, setCargando] = useState(true);
    // Se guarda solo la KEY (no el objeto job entero) -- así, mientras el
    // modal está abierto y el auto-refresh de cada 15s trae datos nuevos,
    // el detalle ampliado se sigue actualizando solo en vez de quedar
    // congelado con la foto del momento en que se hizo click.
    const [jobSeleccionadoKey, setJobSeleccionadoKey] = useState(null);
    const jobSeleccionado = salud?.jobs?.find((j) => j.job === jobSeleccionadoKey) || null;

    // No pide datos nuevos -- solo fuerza un re-render cada 1s para que
    // haceCuanto() recalcule contra Date.now() y el "hace Xs" se vea
    // contando en vivo, en vez de quedar pegado hasta el proximo fetch real
    // (cada INTERVALO_REFRESCO_MS). El valor en si no se usa para nada.
    const [, forzarTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forzarTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    // Acá (a diferencia de Api-Prueba, un solo servicio) hay que juntar 2
    // endpoints -- compra-service (con el chequeo en vivo de Mercado
    // Publico) y licitacion-service (solo jobs, sin chequeo en vivo propio,
    // ver SyncController.salud() ahí) -- cada uno vive en un servicio
    // separado detrás del gateway. Si uno de los 2 falla, igual se
    // muestra lo que sí respondió (no todo o nada).
    async function cargar() {
        try {
            const [resCompra, resLicitacion] = await Promise.all([
                authFetch(`/compra/sync/salud`),
                authFetch(`/compra/sync/salud-licitacion`),
            ]);
            if (!resCompra.ok && !resLicitacion.ok) {
                throw new Error(`El servidor respondió con estado ${resCompra.status}`);
            }
            const saludCompra = resCompra.ok ? await resCompra.json() : { jobs: [], apiMercadoPublico: null };
            const jobsLicitacion = resLicitacion.ok ? await resLicitacion.json() : [];
            setSalud({
                jobs: [...saludCompra.jobs, ...jobsLicitacion],
                apiMercadoPublico: saludCompra.apiMercadoPublico,
            });
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargar();
        const id = setInterval(cargar, INTERVALO_REFRESCO_MS);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const api = salud?.apiMercadoPublico;

    return (
        <div className="card-panel mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-activity" style={{ color: "var(--accent)" }}></i>
                    Monitoreo
                </h5>
                <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                    Se actualiza solo cada {INTERVALO_REFRESCO_MS / 1000}s
                </span>
            </div>

            {cargando && <p className="text-muted mb-0">Cargando...</p>}
            {error && <div className="alert alert-danger mb-0">{error}</div>}

            {api && (
                <div className="d-flex align-items-center gap-2 mb-3 pb-3 border-bottom">
                    <span
                        className="d-inline-block rounded-circle flex-shrink-0"
                        style={{ width: 12, height: 12, background: api.disponible ? "var(--success)" : "var(--danger)" }}
                    ></span>
                    <span style={{ fontSize: "0.85rem" }}>
                        API Mercado Público (Compra Ágil):{" "}
                        <strong>{api.disponible ? "Respondiendo" : "No responde"}</strong>
                        {api.disponible && ` — ${api.latenciaMs}ms`}
                    </span>
                    {!api.disponible && api.error && (
                        <span className="text-muted text-truncate" style={{ fontSize: "0.78rem" }} title={api.error}>
                            ({api.error})
                        </span>
                    )}
                </div>
            )}

            {salud && salud.jobs.length === 0 && (
                <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                    Todavía no corrió ningún ciclo de sincronización desde que arrancó el backend.
                </p>
            )}

            {salud && salud.jobs.length > 0 && (
                <div className="row g-3">
                    {salud.jobs.map((job) => (
                        <div className="col-md-6" key={job.job}>
                            <EstadoJobCard job={job} onClick={() => setJobSeleccionadoKey(job.job)} />
                        </div>
                    ))}
                </div>
            )}

            <Modal
                show={!!jobSeleccionadoKey}
                onClose={() => setJobSeleccionadoKey(null)}
                titulo={jobSeleccionadoKey ? (ETIQUETA_JOB[jobSeleccionadoKey] || jobSeleccionadoKey) : ""}
            >
                {jobSeleccionado && <EstadoJobCard job={jobSeleccionado} ampliado />}
            </Modal>
        </div>
    );
}

// ---------------------------------------------------------------------
// Empresas: CRUD completo, sin acotar a ninguna en particular.
// ---------------------------------------------------------------------
function SeccionEmpresas() {
    const navigate = useNavigate();
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [logoUrls, setLogoUrls] = useState({}); // { [empresaId]: blobUrl }

    // Ya no hay edición inline acá -- "Editar" navega al panel de detalle
    // de la empresa (ver EmpresaDetalle.jsx), que además de los mismos
    // campos muestra sus usuarios y en qué están trabajando. Este form
    // solo se usa para "+ Nueva empresa" (crear no tiene detalle previo
    // que mostrar).
    const [mostrarForm, setMostrarForm] = useState(false);
    const [form, setForm] = useState(EMPRESA_VACIA);
    const [logoPreview, setLogoPreview] = useState(null); // preview del archivo recien elegido, antes de guardar
    const [guardando, setGuardando] = useState(false);
    const [errorForm, setErrorForm] = useState(null);

    async function cargar() {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`/auth/empresas`);
            if (!res.ok) throw new Error(`El servidor respondió con estado ${res.status}`);
            const lista = await res.json();
            setEmpresas(lista);

            // Los logos se piden aparte (blob, requiere el JWT -- un <img
            // src="/auth/..."> directo no manda el header Authorization),
            // uno por cada empresa que tenga tieneLogo=true.
            lista.filter((e) => e.tieneLogo).forEach((e) => {
                authFetch(`/auth/empresas/${e.id}/logo`)
                    .then((r) => (r.ok ? r.blob() : null))
                    .then((blob) => {
                        if (blob) setLogoUrls((prev) => ({ ...prev, [e.id]: URL.createObjectURL(blob) }));
                    })
                    .catch(() => {});
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function abrirCreacion() {
        setForm(EMPRESA_VACIA);
        setLogoPreview(null);
        setErrorForm(null);
        setMostrarForm(true);
    }

    async function elegirLogo(file) {
        if (!file) return;
        const base64 = await archivoABase64(file);
        setForm((f) => ({ ...f, logoBase64: base64, logoTipoContenido: file.type }));
        setLogoPreview(URL.createObjectURL(file));
    }

    async function guardar(e) {
        e.preventDefault();
        setGuardando(true);
        setErrorForm(null);
        try {
            // Solo crea -- editar ya no pasa por acá (ver comentario de
            // arriba, ahora vive en EmpresaDetalle.jsx).
            const res = await authFetch(`/auth/empresas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            setMostrarForm(false);
            await cargar();
        } catch (err) {
            setErrorForm(err.message);
        } finally {
            setGuardando(false);
        }
    }

    async function eliminar(empresa) {
        if (!window.confirm(`¿Eliminar la empresa "${empresa.nombre}"?`)) return;
        try {
            const res = await authFetch(`/auth/empresas/${empresa.id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 204) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargar();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="card-panel mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-buildings-fill" style={{ color: "var(--accent)" }}></i>
                    Empresas
                </h5>
                <button type="button" className="btn btn-primary btn-sm" onClick={abrirCreacion}>
                    + Nueva empresa
                </button>
            </div>

            {loading && <p className="text-muted mb-0">Cargando empresas...</p>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                empresas.length === 0 ? (
                    <p className="text-muted mb-0">Todavía no hay empresas creadas.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-sm align-middle" style={{ color: "var(--text)" }}>
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>Nombre</th>
                                    {/* Menos criticas en pantallas chicas -- se ocultan para no
                                        forzar scroll horizontal (ver el mismo criterio en las
                                        demas tablas de esta pagina/MiEmpresa.jsx). */}
                                    <th className="d-none d-md-table-cell">RUT</th>
                                    <th className="d-none d-md-table-cell">Rubro</th>
                                    <th className="d-none d-md-table-cell">Tamaño</th>
                                    <th className="d-none d-md-table-cell">ChileProveedores</th>
                                    <th>Estado</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {empresas.map((e) => (
                                    <tr key={e.id}>
                                        <td>
                                            {logoUrls[e.id] ? (
                                                <img src={logoUrls[e.id]} alt="" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4 }} />
                                            ) : (
                                                <span
                                                    className="d-flex align-items-center justify-content-center"
                                                    style={{ width: 28, height: 28, borderRadius: 4, background: "var(--bg-elevated-2)" }}
                                                >
                                                    <i className="bi bi-building" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}></i>
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {e.nombre}
                                            {e.nombreFantasia && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{e.nombreFantasia}</div>}
                                        </td>
                                        <td className="d-none d-md-table-cell">{e.rut || "-"}</td>
                                        <td className="d-none d-md-table-cell">{e.rubro || "-"}</td>
                                        <td className="d-none d-md-table-cell">{TAMANOS_EMPRESA.find((t) => t.valor === e.tamanoEmpresa)?.etiqueta || "-"}</td>
                                        <td className="d-none d-md-table-cell">
                                            {e.chileproveedoresRegistrado ? (
                                                <span className="badge badge-rol-empresa">Inscrita</span>
                                            ) : (
                                                <span className="text-muted" style={{ fontSize: "0.8rem" }}>No inscrita</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge ${e.estado === "INACTIVA" ? "badge-rol-usuario" : "badge-rol-global"}`}>
                                                {e.estado === "INACTIVA" ? "Inactiva" : "Activa"}
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            <button type="button" className="btn btn-sm btn-outline-secondary me-2"
                                                onClick={() => navigate(`/administracion/empresas/${e.id}`)}>
                                                Editar
                                            </button>
                                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => eliminar(e)}>
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {mostrarForm && (
                <form className="mt-3 pt-3 border-top" onSubmit={guardar}>
                    <h6>Nueva empresa</h6>
                    <EmpresaForm form={form} setForm={setForm} logoPreview={logoPreview} onElegirLogo={elegirLogo} />

                    {errorForm && <div className="alert alert-danger mt-2 mb-0">{errorForm}</div>}
                    <div className="mt-2 d-flex gap-2">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
                            {guardando ? "Guardando..." : "Guardar"}
                        </button>
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setMostrarForm(false)}>
                            Cancelar
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------
// Usuarios: TODOS los del sistema, con rol y empresa editables -- es lo
// que permite, por ejemplo, crear otro ADMIN o mover a alguien de
// una empresa a otra.
// ---------------------------------------------------------------------
function SeccionUsuarios() {
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [mostrarForm, setMostrarForm] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState({ name: "", lastName: "", email: "", username: "", password: "", rolNombre: "", empresaId: "" });
    const [guardando, setGuardando] = useState(false);
    const [errorForm, setErrorForm] = useState(null);

    async function cargar() {
        setLoading(true);
        setError(null);
        try {
            const [resUsuarios, resRoles, resEmpresas] = await Promise.all([
                authFetch(`/auth/usuarios`),
                authFetch(`/auth/roles`),
                authFetch(`/auth/empresas`),
            ]);
            if (!resUsuarios.ok) throw new Error(`Usuarios: el servidor respondió con estado ${resUsuarios.status}`);
            if (!resRoles.ok) throw new Error(`Roles: el servidor respondió con estado ${resRoles.status}`);
            if (!resEmpresas.ok) throw new Error(`Empresas: el servidor respondió con estado ${resEmpresas.status}`);
            setUsuarios(await resUsuarios.json());
            setRoles(await resRoles.json());
            setEmpresas(await resEmpresas.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { cargar(); }, []);

    // El rol elegido en el form determina si hace falta empresa (alcance
    // EMPRESA/USUARIO) o no (GLOBAL) -- evita mandar un empresaId
    // inconsistente con el rol.
    const rolSeleccionado = roles.find((r) => r.nombre === form.rolNombre);
    const necesitaEmpresa = rolSeleccionado ? rolSeleccionado.alcance !== "GLOBAL" : false;

    // Recarga empresas/roles al abrir el form, no solo al montar la página:
    // "Empresas" es una sección hermana con su propio estado (ver
    // SeccionEmpresas más arriba) -- si se crea una empresa ahí y después se
    // abre "+ Nuevo usuario" sin recargar la página entera, esta lista
    // quedaba desactualizada y la empresa nueva no aparecía en el select.
    function abrirCreacion() {
        cargar();
        setEditando(null);
        setForm({ name: "", lastName: "", email: "", username: "", password: "", rolNombre: roles[0]?.nombre || "", empresaId: "" });
        setErrorForm(null);
        setMostrarForm(true);
    }

    function abrirEdicion(usuario) {
        cargar();
        setEditando(usuario.id);
        setForm({
            name: usuario.name || "", lastName: usuario.lastName || "", email: usuario.email || "",
            username: usuario.username, password: "", rolNombre: usuario.rol, empresaId: usuario.empresaId || "",
        });
        setErrorForm(null);
        setMostrarForm(true);
    }

    async function guardar(e) {
        e.preventDefault();
        setGuardando(true);
        setErrorForm(null);
        try {
            const esEdicion = editando !== null;
            const url = esEdicion ? `/auth/usuarios/${editando}` : "/auth/usuarios";
            const body = {
                name: form.name,
                lastName: form.lastName,
                email: form.email,
                rolNombre: form.rolNombre,
                empresaId: necesitaEmpresa && form.empresaId ? Number(form.empresaId) : null,
                ...(esEdicion ? {} : { username: form.username }),
                ...(form.password ? { password: form.password } : {}),
            };

            const res = await authFetch(url, {
                method: esEdicion ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            setMostrarForm(false);
            await cargar();
        } catch (err) {
            setErrorForm(err.message);
        } finally {
            setGuardando(false);
        }
    }

    async function eliminar(usuario) {
        if (!window.confirm(`¿Eliminar a "${usuario.username}"? Esto no se puede deshacer.`)) return;
        try {
            const res = await authFetch(`/auth/usuarios/${usuario.id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 204) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargar();
        } catch (err) {
            setError(err.message);
        }
    }

    function nombreEmpresa(empresaId) {
        return empresas.find((e) => e.id === empresaId)?.nombre || "-";
    }

    // Color del badge segun el ALCANCE del rol (ver .badge-rol-* en
    // index.css), no el nombre puntual -- consistente con como el resto
    // del sistema distingue permisos.
    function claseBadgeRol(nombreRol) {
        const alcance = roles.find((r) => r.nombre === nombreRol)?.alcance;
        if (alcance === "GLOBAL") return "badge-rol-global";
        if (alcance === "EMPRESA") return "badge-rol-empresa";
        return "badge-rol-usuario";
    }

    return (
        <div className="card-panel mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-people-fill" style={{ color: "var(--accent)" }}></i>
                    Usuarios
                </h5>
                <button type="button" className="btn btn-primary btn-sm" onClick={abrirCreacion}>
                    + Nuevo usuario
                </button>
            </div>

            {loading && <p className="text-muted mb-0">Cargando...</p>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                usuarios.length === 0 ? (
                    <p className="text-muted mb-0">Todavía no hay usuarios.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-sm align-middle" style={{ color: "var(--text)" }}>
                            <thead>
                                <tr>
                                    {/* Nombre/Empresa se ocultan en mobile (ver mismo criterio en
                                        SeccionEmpresas) -- Usuario (el identificador de login) y
                                        Rol alcanzan para reconocer la fila sin scroll horizontal. */}
                                    <th className="d-none d-md-table-cell">Nombre</th>
                                    <th>Usuario</th>
                                    <th>Rol</th>
                                    <th className="d-none d-md-table-cell">Empresa</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map((u) => (
                                    <tr key={u.id}>
                                        <td className="d-none d-md-table-cell">{[u.name, u.lastName].filter(Boolean).join(" ") || "-"}</td>
                                        <td>{u.username}</td>
                                        <td>
                                            <span className={`badge ${claseBadgeRol(u.rol)}`}>{u.rol}</span>
                                        </td>
                                        <td className="d-none d-md-table-cell">{u.empresaId ? nombreEmpresa(u.empresaId) : "-"}</td>
                                        <td className="text-end">
                                            <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => abrirEdicion(u)}>
                                                Editar
                                            </button>
                                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => eliminar(u)}>
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {mostrarForm && (
                <form className="mt-3 pt-3 border-top" onSubmit={guardar}>
                    <h6>{editando !== null ? "Editar usuario" : "Nuevo usuario"}</h6>
                    <div className="row g-2">
                        <div className="col-md-6">
                            <input className="form-control" placeholder="Nombre" value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                            <input className="form-control" placeholder="Apellido" value={form.lastName}
                                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                            {/* Obligatorio: el login es por email, no por usuario (ver
                                AuthService.authenticate en auth-service) -- sin esto el
                                usuario nuevo queda sin forma de entrar. */}
                            <input type="email" className="form-control" placeholder="Email" value={form.email} required
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                        </div>
                        {editando === null && (
                            <div className="col-md-6">
                                <input className="form-control" placeholder="Usuario" value={form.username} required
                                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
                            </div>
                        )}
                        <div className="col-md-6">
                            <input type="password" className="form-control"
                                placeholder={editando !== null ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}
                                value={form.password} required={editando === null}
                                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label" style={{ fontSize: "0.85rem" }}>Rol</label>
                            <select className="form-control" value={form.rolNombre}
                                onChange={(e) => setForm((f) => ({ ...f, rolNombre: e.target.value }))}>
                                {roles.map((r) => (
                                    <option key={r.nombre} value={r.nombre}>{r.nombre}</option>
                                ))}
                            </select>
                        </div>
                        {necesitaEmpresa && (
                            <div className="col-md-6">
                                <label className="form-label" style={{ fontSize: "0.85rem" }}>Empresa</label>
                                <select className="form-control" value={form.empresaId} required
                                    onChange={(e) => setForm((f) => ({ ...f, empresaId: e.target.value }))}>
                                    <option value="">Seleccione una empresa...</option>
                                    {empresas.map((emp) => (
                                        <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    {errorForm && <div className="alert alert-danger mt-2 mb-0">{errorForm}</div>}
                    <div className="mt-2 d-flex gap-2">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
                            {guardando ? "Guardando..." : "Guardar"}
                        </button>
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setMostrarForm(false)}>
                            Cancelar
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
