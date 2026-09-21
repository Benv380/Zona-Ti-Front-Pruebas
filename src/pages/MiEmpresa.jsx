import { useEffect, useState } from "react";
import { authFetch, getClaims } from "../lib/api.js";
import { fechaCierreDe } from "../lib/fechas.js";
import PendientesRevision from "../components/PendientesRevision.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import TablaAsignaciones, { TIPOS_ASIGNACION } from "../components/TablaAsignaciones.jsx";

// Mismo mapeo que endpointsPorTipo en MisActivas.jsx -- se duplica acá
// (una funcion de 4 lineas) en vez de compartirla, mismo criterio que el
// resto de los helpers chicos de este proyecto.
function endpointDetalle(tipo, codigo) {
    const base = tipo === "LICITACION" ? "/compra/licitacion" : "/compra/agil";
    return `${base}/${encodeURIComponent(codigo)}`;
}

// Estados que todavia cuentan como "trabajo en curso" para el panel de
// Asignaciones y recomendaciones -- COMPLETADO/DESCARTADO ya no se
// muestran ahi (quedan solo en la lista de Pendientes de revisión cuando
// corresponda, ver mas abajo).
const ASIGNACION_ACTIVA = ["ASIGNADO", "ANALISIS", "DESARROLLO"];

// Panel exclusivo de ADMIN_EMPRESA (ver Sidebar.jsx, solo aparece el link
// si claims.alcance === "EMPRESA"). No hace falta re-chequear el rol aca a
// mano: si alguien sin alcance EMPRESA entra a la URL igual, el backend
// (@PreAuthorize en auth-service) rechaza cada request con 403 -- esta
// pagina simplemente no tendria empresaId para pedir nada.
export default function MiEmpresa() {
    const claims = getClaims();
    const empresaId = claims?.empresaId;

    useEffect(() => {
        document.title = "Mi Empresa";
    }, []);

    return (
        <div className="flex-min-w-0">
            <h1>Mi Empresa</h1>
            <p>Gestión de usuarios, filtros de búsqueda y asignaciones de tu empresa.</p>

            {!empresaId ? (
                <div className="alert alert-danger">
                    Tu usuario no tiene una empresa asignada, así que no se puede administrar nada acá.
                </div>
            ) : (
                <>
                    <SeccionUsuarios empresaId={empresaId} />
                    <SeccionFiltroBusqueda empresaId={empresaId} />
                    <SeccionBaseCotizacion empresaId={empresaId} />
                    <SeccionAsignaciones empresaId={empresaId} />
                    <SeccionDocumentacionPendiente />
                </>
            )}
        </div>
    );
}

// Usuarios: CRUD completo (crear/editar/eliminar) de los usuarios de la
// empresa. POST/PUT/DELETE en auth-service ya fuerzan rol USER + esta
// empresa del lado del servidor -- acá no hace falta repetir esa
// restricción, solo no se ofrece la opción de elegir otro rol/empresa.

function SeccionUsuarios({ empresaId }) {
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [mostrarForm, setMostrarForm] = useState(false);
    const [editando, setEditando] = useState(null); // id del usuario en edicion, o null = form de creacion
    const [form, setForm] = useState({ name: "", lastName: "", email: "", username: "", password: "", requiereSupervision: false });
    const [guardando, setGuardando] = useState(false);
    const [errorForm, setErrorForm] = useState(null);

    async function cargar() {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`/auth/empresas/${empresaId}/usuarios`);
            if (!res.ok) throw new Error(`El servidor respondió con estado ${res.status}`);
            setUsuarios(await res.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
    }, [empresaId]);

    function abrirCreacion() {
        setEditando(null);
        setForm({ name: "", lastName: "", email: "", username: "", password: "", requiereSupervision: false });
        setErrorForm(null);
        setMostrarForm(true);
    }

    function abrirEdicion(usuario) {
        setEditando(usuario.id);
        setForm({
            name: usuario.name || "", lastName: usuario.lastName || "", email: usuario.email || "",
            username: usuario.username, password: "", requiereSupervision: usuario.requiereSupervision || false,
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
            const body = esEdicion
                ? { name: form.name, lastName: form.lastName, email: form.email, password: form.password || undefined, requiereSupervision: form.requiereSupervision }
                : { name: form.name, lastName: form.lastName, email: form.email, username: form.username, password: form.password };

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

            {loading && <p className="text-muted mb-0">Cargando usuarios...</p>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && (
                usuarios.length === 0 ? (
                    <p className="text-muted mb-0">Todavía no hay usuarios en tu empresa.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-sm align-middle" style={{ color: "var(--text)" }}>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Usuario</th>
                                    {/* Menos critico en mobile -- se oculta para no forzar scroll
                                        horizontal (mismo criterio que Administracion.jsx). */}
                                    <th className="d-none d-md-table-cell">Email</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map((u) => (
                                    <tr key={u.id}>
                                        <td>
                                            {[u.name, u.lastName].filter(Boolean).join(" ") || "-"}
                                            {u.requiereSupervision && (
                                                <i className="bi bi-eye-fill ms-2" style={{ color: "var(--accent)" }}
                                                    title="Requiere supervisión"></i>
                                            )}
                                        </td>
                                        <td>{u.username}</td>
                                        <td className="d-none d-md-table-cell">{u.email || "-"}</td>
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
                    </div>

                    {editando !== null && (
                        <div className="form-check mb-2">
                            <input type="checkbox" className="form-check-input" id={`supervision-${editando}`}
                                checked={form.requiereSupervision}
                                onChange={(e) => setForm((f) => ({ ...f, requiereSupervision: e.target.checked }))} />
                            <label className="form-check-label" htmlFor={`supervision-${editando}`} style={{ fontSize: "0.85rem" }}>
                                Requiere supervisión
                            </label>
                            <p className="text-muted mb-0" style={{ fontSize: "0.75rem" }}>
                                Mientras esté marcado, cuando este usuario complete una de sus compras ágiles va a aparecer en
                                "Pendientes de revisión" (más abajo) hasta que un administrador la revise. El propio usuario nunca lo ve.
                            </p>
                        </div>
                    )}

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

// Filtro de búsqueda de la empresa (rubro/palabras clave/región). Ya
// funciona de verdad (PUT /auth/empresas/{id}/perfil) -- lo único
// pendiente es que se llene solo con un LLM en vez de a mano, ver nota.

function SeccionFiltroBusqueda({ empresaId }) {
    const [form, setForm] = useState({ rubro: "", palabrasClave: "", regionCodigo: "", regionNombre: "" });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [guardadoOk, setGuardadoOk] = useState(false);

    useEffect(() => {
        let cancelado = false;
        async function cargar() {
            setLoading(true);
            setError(null);
            try {
                const res = await authFetch(`/auth/perfil/me`);
                if (!res.ok) throw new Error(`El servidor respondió con estado ${res.status}`);
                const json = await res.json();
                if (!cancelado) {
                    setForm({
                        rubro: json.rubro || "",
                        palabrasClave: json.palabrasClave || "",
                        regionCodigo: json.regionCodigo || "",
                        regionNombre: json.regionNombre || "",
                    });
                }
            } catch (err) {
                if (!cancelado) setError(err.message);
            } finally {
                if (!cancelado) setLoading(false);
            }
        }
        cargar();
        return () => { cancelado = true; };
    }, [empresaId]);

    async function guardar(e) {
        e.preventDefault();
        setGuardando(true);
        setError(null);
        setGuardadoOk(false);
        try {
            const res = await authFetch(`/auth/empresas/${empresaId}/perfil`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            setGuardadoOk(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="card-panel mb-4">
            <SectionHeader icono="bi-funnel-fill" titulo="Filtro de búsqueda" subtitulo="Rubro, palabras clave y región" />
            <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                Define qué licitaciones y compras ágiles va a ver tu empresa (rubro, palabras clave, región).
                Por ahora se configura a mano acá. Más adelante un asistente lo va a completar solo a partir
                de una descripción libre de tu negocio (pendiente).
            </p>

            {loading ? (
                <p className="text-muted mb-0">Cargando...</p>
            ) : (
                <form onSubmit={guardar}>
                    <div className="row g-2">
                        <div className="col-md-6">
                            <label className="form-label" style={{ fontSize: "0.85rem" }}>Rubro</label>
                            <input className="form-control" placeholder="Ej: Construcción" value={form.rubro} required
                                onChange={(e) => setForm((f) => ({ ...f, rubro: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label" style={{ fontSize: "0.85rem" }}>Palabras clave</label>
                            <input className="form-control" placeholder="Ej: materiales electricos" value={form.palabrasClave} required
                                onChange={(e) => setForm((f) => ({ ...f, palabrasClave: e.target.value }))} />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label" style={{ fontSize: "0.85rem" }}>Código de región</label>
                            <input className="form-control" placeholder="Ej: 13" value={form.regionCodigo} required
                                onChange={(e) => setForm((f) => ({ ...f, regionCodigo: e.target.value }))} />
                        </div>
                        <div className="col-md-9">
                            <label className="form-label" style={{ fontSize: "0.85rem" }}>Nombre de la región</label>
                            <input className="form-control" placeholder="Ej: Metropolitana" value={form.regionNombre}
                                onChange={(e) => setForm((f) => ({ ...f, regionNombre: e.target.value }))} />
                        </div>
                    </div>
                    {error && <div className="alert alert-danger mt-2 mb-0">{error}</div>}
                    {guardadoOk && <div className="alert alert-success mt-2 mb-0">Guardado.</div>}
                    <button type="submit" className="btn btn-primary btn-sm mt-2" disabled={guardando}>
                        {guardando ? "Guardando..." : "Guardar filtro"}
                    </button>
                </form>
            )}
        </div>
    );
}

// FileReader.readAsDataURL da "data:image/png;base64,AAAA..." -- el
// backend (ActualizarMarcaCotizacionRequest.logoBase64) espera solo la
// parte de despues de la coma, sin el prefijo.
function archivoABase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Limites del logo -- deben coincidir con MarcaCotizacionService (ANCHO_MAX_PX/
// ALTO_MAX_PX/PESO_MAX_BYTES) para poder avisar ANTES de mandar el archivo,
// sin esperar el rechazo del servidor. El servidor sigue siendo quien
// valida de verdad -- esto es solo para no hacerle perder tiempo al
// usuario subiendo algo que va a rebotar.
const LOGO_ANCHO_MAX = 400;
const LOGO_ALTO_MAX = 200;
const LOGO_PESO_MAX = 300_000; // 300 KB

function validarImagenParaLogo(file) {
    return new Promise((resolve, reject) => {
        if (file.size > LOGO_PESO_MAX) {
            reject(new Error(`El logo pesa demasiado (máx. ${LOGO_PESO_MAX / 1000} KB)`));
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            if (img.naturalWidth > LOGO_ANCHO_MAX || img.naturalHeight > LOGO_ALTO_MAX) {
                reject(new Error(
                    `El logo es demasiado grande (máx. ${LOGO_ANCHO_MAX}x${LOGO_ALTO_MAX} píxeles, `
                    + `esta imagen es ${img.naturalWidth}x${img.naturalHeight})`));
                return;
            }
            resolve();
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("El archivo no es una imagen válida"));
        };
        img.src = url;
    });
}

// Membrete/pie que va a llevar cada cotizacion en PDF que se genere desde
// esta empresa (ver GenerarCotizacionBoton.jsx) -- nombre/RUT/dirección/
// teléfono se muestran de referencia (son los datos oficiales de la
// empresa, se reusan tal cual, no se editan acá); lo único propio de la
// cotización es el logo y las condiciones comerciales. Solo esta página
// (exclusiva ADMIN_EMPRESA) puede editarlo -- GET /marca-cotizacion
// también lo puede pedir cualquier USUARIO de la misma empresa (lo usa el
// generador de PDF), pero PUT está restringido a GLOBAL/EMPRESA (ver
// MarcaCotizacionController).
// Paleta fija -- no un selector de color libre. Mismos valores que
// MarcaCotizacionService.COLORES_PERMITIDOS en el backend; si se agrega o
// saca un color hay que tocar los 2 lugares.
const COLORES_COTIZACION = [
    { valor: "#A61928", etiqueta: "Rojo" },
    { valor: "#15438A", etiqueta: "Azul" },
    { valor: "#1B5E20", etiqueta: "Verde" },
    { valor: "#333333", etiqueta: "Gris oscuro" },
    { valor: "#6A1B9A", etiqueta: "Morado" },
];

function SeccionBaseCotizacion({ empresaId }) {
    const [datos, setDatos] = useState(null);
    const [direccion, setDireccion] = useState("");
    const [telefono, setTelefono] = useState("");
    const [colorPrincipal, setColorPrincipal] = useState(COLORES_COTIZACION[0].valor);
    const [condicionesComerciales, setCondicionesComerciales] = useState("");
    const [banco, setBanco] = useState("");
    const [tipoCuenta, setTipoCuenta] = useState("");
    const [numeroCuenta, setNumeroCuenta] = useState("");
    const [logoUrl, setLogoUrl] = useState(null); // logo YA guardado
    const [logoPreview, setLogoPreview] = useState(null); // archivo recien elegido, todavia sin guardar
    const [logoBase64Pendiente, setLogoBase64Pendiente] = useState(null);
    const [logoTipoContenidoPendiente, setLogoTipoContenidoPendiente] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [errorLogo, setErrorLogo] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [guardadoOk, setGuardadoOk] = useState(false);

    useEffect(() => {
        let cancelado = false;
        async function cargar() {
            setLoading(true);
            setError(null);
            try {
                const res = await authFetch(`/auth/empresas/${empresaId}/marca-cotizacion`);
                if (!res.ok) throw new Error(`El servidor respondió con estado ${res.status}`);
                const json = await res.json();
                if (cancelado) return;
                setDatos(json);
                setDireccion(json.direccion || "");
                setTelefono(json.telefono || "");
                setColorPrincipal(json.colorPrincipal || COLORES_COTIZACION[0].valor);
                setCondicionesComerciales(json.condicionesComerciales || "");
                setBanco(json.banco || "");
                setTipoCuenta(json.tipoCuenta || "");
                setNumeroCuenta(json.numeroCuenta || "");
                if (json.tieneLogo) {
                    const resLogo = await authFetch(`/auth/empresas/${empresaId}/marca-cotizacion/logo`);
                    const blob = resLogo.ok ? await resLogo.blob() : null;
                    if (!cancelado && blob) setLogoUrl(URL.createObjectURL(blob));
                }
            } catch (err) {
                if (!cancelado) setError(err.message);
            } finally {
                if (!cancelado) setLoading(false);
            }
        }
        cargar();
        return () => { cancelado = true; };
    }, [empresaId]);

    async function elegirLogo(file) {
        if (!file) return;
        setErrorLogo(null);
        try {
            await validarImagenParaLogo(file);
        } catch (err) {
            setErrorLogo(err.message);
            return;
        }
        const base64 = await archivoABase64(file);
        setLogoBase64Pendiente(base64);
        setLogoTipoContenidoPendiente(file.type);
        setLogoPreview(URL.createObjectURL(file));
        setGuardadoOk(false);
    }

    async function guardar(e) {
        e.preventDefault();
        setGuardando(true);
        setError(null);
        setGuardadoOk(false);
        try {
            const res = await authFetch(`/auth/empresas/${empresaId}/marca-cotizacion`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    logoBase64: logoBase64Pendiente,
                    logoTipoContenido: logoTipoContenidoPendiente,
                    condicionesComerciales,
                    direccion,
                    telefono,
                    colorPrincipal,
                    banco,
                    tipoCuenta,
                    numeroCuenta,
                }),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            setGuardadoOk(true);
            setLogoBase64Pendiente(null);
            setLogoTipoContenidoPendiente(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="card-panel mb-4">
            <SectionHeader icono="bi-file-earmark-richtext-fill" titulo="Base de cotización" subtitulo="Logo, dirección, teléfono y condiciones comerciales para el PDF" />
            <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                Esto es lo que va a llevar cada cotización que se genere en PDF para Compra Ágil
                (ver "Generar cotización" en la fase Desarrollo de una asignación).
            </p>

            {loading && <p className="text-muted mb-0">Cargando...</p>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && datos && (
                <form onSubmit={guardar}>
                    <div className="row g-2 mb-3" style={{ fontSize: "0.85rem" }}>
                        <div className="col-md-6"><strong>Nombre:</strong> {datos.nombre || "-"}</div>
                        <div className="col-md-6"><strong>RUT:</strong> {datos.rut || "-"}</div>
                    </div>
                    <p className="text-muted mb-3" style={{ fontSize: "0.78rem" }}>
                        Nombre y RUT son los oficiales de tu empresa. Se editan desde Administración, no acá.
                    </p>

                    <div className="row g-2 mb-3">
                        <div className="col-md-6">
                            <label className="form-label" style={{ fontSize: "0.85rem" }}>Dirección</label>
                            <input type="text" className="form-control form-control-sm" value={direccion}
                                onChange={(e) => { setGuardadoOk(false); setDireccion(e.target.value); }} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label" style={{ fontSize: "0.85rem" }}>Teléfono</label>
                            <input type="text" className="form-control form-control-sm" value={telefono}
                                onChange={(e) => { setGuardadoOk(false); setTelefono(e.target.value); }} />
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label" style={{ fontSize: "0.85rem" }}>Logo</label>
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                            {(logoPreview || logoUrl) && (
                                <img src={logoPreview || logoUrl} alt="" style={{ maxWidth: 120, maxHeight: 60, objectFit: "contain", background: "var(--bg-elevated-2)", borderRadius: 6, padding: 4 }} />
                            )}
                            <input type="file" accept="image/*" className="form-control form-control-sm" style={{ maxWidth: 260 }}
                                onChange={(e) => elegirLogo(e.target.files?.[0])} />
                        </div>
                        <p className="text-muted mt-1 mb-0" style={{ fontSize: "0.75rem" }}>
                            Máx. {LOGO_ANCHO_MAX}x{LOGO_ALTO_MAX} píxeles y {LOGO_PESO_MAX / 1000} KB, porque es un membrete chico, no una imagen grande.
                        </p>
                        {errorLogo && <div className="alert alert-danger py-1 mt-2 mb-0" style={{ fontSize: "0.8rem" }}>{errorLogo}</div>}
                    </div>

                    <div className="mb-3">
                        <label className="form-label" style={{ fontSize: "0.85rem" }}>Color principal</label>
                        <div className="d-flex align-items-center gap-2">
                            <span style={{ width: 20, height: 20, borderRadius: 4, background: colorPrincipal, flexShrink: 0, border: "1px solid var(--border)" }}></span>
                            <select className="form-control form-control-sm" style={{ maxWidth: 200 }} value={colorPrincipal}
                                onChange={(e) => { setGuardadoOk(false); setColorPrincipal(e.target.value); }}>
                                {COLORES_COTIZACION.map((c) => (
                                    <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row g-2 mb-3">
                        <div className="col-12">
                            <label className="form-label mb-1" style={{ fontSize: "0.85rem" }}>Datos bancarios</label>
                            <p className="text-muted mb-2" style={{ fontSize: "0.75rem" }}>
                                Van al pie de cada cotización generada en PDF.
                            </p>
                        </div>
                        <div className="col-md-4">
                            <input type="text" className="form-control form-control-sm" placeholder="Banco" value={banco}
                                onChange={(e) => { setGuardadoOk(false); setBanco(e.target.value); }} />
                        </div>
                        <div className="col-md-4">
                            <input type="text" className="form-control form-control-sm" placeholder="Tipo de cuenta (ej: Cuenta Corriente)" value={tipoCuenta}
                                onChange={(e) => { setGuardadoOk(false); setTipoCuenta(e.target.value); }} />
                        </div>
                        <div className="col-md-4">
                            <input type="text" className="form-control form-control-sm" placeholder="N° de cuenta" value={numeroCuenta}
                                onChange={(e) => { setGuardadoOk(false); setNumeroCuenta(e.target.value); }} />
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label" style={{ fontSize: "0.85rem" }}>Condiciones comerciales</label>
                        <textarea className="form-control" rows={5} maxLength={2000} value={condicionesComerciales}
                            onChange={(e) => { setGuardadoOk(false); setCondicionesComerciales(e.target.value); }}
                            placeholder="Términos de pago, forma de facturación, entrega, etc. Van al pie de cada cotización." />
                        <div className="text-end text-muted" style={{ fontSize: "0.75rem" }}>{condicionesComerciales.length}/2000</div>
                    </div>

                    {error && <div className="alert alert-danger mb-2">{error}</div>}
                    {guardadoOk && <div className="alert alert-success mb-2">Guardado.</div>}
                    <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
                        {guardando ? "Guardando..." : "Guardar base de cotización"}
                    </button>
                </form>
            )}
        </div>
    );
}

// Asignaciones Y recomendaciones de TODA la empresa en un solo lugar (ver
// GET /auth/empresas/{id}/asignaciones) -- así el supervisor ve de un
// vistazo lo que sus usuarios recomendaron, sin entrar uno por uno.
// Abajo sigue estando el formulario para asignar algo puntual a un
// usuario elegido (el flujo "de arriba hacia abajo" de siempre).
function SeccionAsignaciones({ empresaId }) {
    const [asignaciones, setAsignaciones] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fecha de cierre real (Mercado Público) de cada activa, para sacar de
    // la lista las que ya cerraron por tiempo aunque acá sigan en un
    // estado "en curso" -- undefined mientras no se sabe todavia (no se
    // esconde nada hasta confirmar que de verdad cerró).
    const [fechaCierrePorId, setFechaCierrePorId] = useState({});

    const [usuarioId, setUsuarioId] = useState("");
    const [nuevoCodigo, setNuevoCodigo] = useState("");
    const [nuevoTipo, setNuevoTipo] = useState("LICITACION");
    const [asignando, setAsignando] = useState(false);

    async function cargarTodo() {
        setLoading(true);
        setError(null);
        try {
            const [resAsig, resUsuarios] = await Promise.all([
                authFetch(`/auth/empresas/${empresaId}/asignaciones`),
                authFetch(`/auth/empresas/${empresaId}/usuarios`),
            ]);
            if (!resAsig.ok) throw new Error(`El servidor respondió con estado ${resAsig.status}`);
            setAsignaciones(await resAsig.json());
            setUsuarios(resUsuarios.ok ? await resUsuarios.json() : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargarTodo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId]);

    // Pide en segundo plano la fecha de cierre real de cada activa que
    // todavia no se conoce -- mismo patron (y mismo tope de paralelismo)
    // que MisActivas.jsx, para no acaparar las conexiones simultaneas del
    // navegador con un barrido de fondo.
    useEffect(() => {
        const CONCURRENCIA = 3;
        const pendientes = asignaciones.filter(
            (a) => ASIGNACION_ACTIVA.includes(a.estado) && fechaCierrePorId[a.id] === undefined
        );
        if (pendientes.length === 0) return;

        let cancelado = false;
        const cola = [...pendientes];

        async function trabajador() {
            while (!cancelado && cola.length > 0) {
                const a = cola.shift();
                try {
                    const r = await authFetch(endpointDetalle(a.tipo, a.codigoExterno));
                    const json = r.ok ? await r.json() : null;
                    const item = a.tipo === "LICITACION" ? json?.Listado?.[0] : json?.payload;
                    if (!cancelado) {
                        setFechaCierrePorId((prev) => ({ ...prev, [a.id]: fechaCierreDe(a.tipo, item) }));
                    }
                } catch {
                    // Si falla, se deja sin dato -- sigue apareciendo en la
                    // lista (mejor mostrar de mas que esconder algo vigente).
                }
            }
        }

        const trabajadores = Array.from({ length: Math.min(CONCURRENCIA, pendientes.length) }, trabajador);
        Promise.all(trabajadores);

        return () => {
            cancelado = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asignaciones]);

    async function asignar(e) {
        e.preventDefault();
        if (!usuarioId || !nuevoCodigo.trim()) return;
        setAsignando(true);
        setError(null);
        try {
            const res = await authFetch(`/auth/usuarios/${usuarioId}/asignaciones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigoExterno: nuevoCodigo.trim(), tipo: nuevoTipo }),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            setNuevoCodigo("");
            await cargarTodo();
        } catch (err) {
            setError(err.message);
        } finally {
            setAsignando(false);
        }
    }

    // Al pasar a DESCARTADO se pide el motivo -- el backend lo exige (ver
    // AsignacionService.actualizarEstado), sin esto la request fallaría.
    async function cambiarEstado(asignacion, nuevoEstado) {
        let motivoDescarte;
        if (nuevoEstado === "DESCARTADO") {
            motivoDescarte = window.prompt("¿Por qué se descarta? (obligatorio)");
            if (!motivoDescarte || !motivoDescarte.trim()) return;
        }
        try {
            const res = await authFetch(`/auth/asignaciones/${asignacion.id}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevoEstado, motivoDescarte }),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargarTodo();
        } catch (err) {
            setError(err.message);
        }
    }

    async function quitar(asignacion) {
        try {
            const res = await authFetch(`/auth/asignaciones/${asignacion.id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 204) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargarTodo();
        } catch (err) {
            setError(err.message);
        }
    }

    // La completo el mismo usuario marcado con "requiere supervisión" (ver
    // Asignacion.pendienteRevision) -- apaga la marca, el estado ya estaba
    // en COMPLETADO desde antes.
    async function aprobarRevision(asignacion) {
        try {
            const res = await authFetch(`/auth/asignaciones/${asignacion.id}/revision`, { method: "PATCH" });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargarTodo();
        } catch (err) {
            setError(err.message);
        }
    }

    const pendientesRevision = asignaciones.filter((a) => a.pendienteRevision);

    // Se sacan del listado principal: ya terminadas (COMPLETADO/DESCARTADO)
    // o cerradas por tiempo en Mercado Público aunque acá sigan en un
    // estado "en curso" -- se quedan solo mientras hay trabajo real
    // pendiente, sin tener que ir borrandolas a mano.
    function estaCerradaPorTiempo(fechaCierreIso) {
        if (!fechaCierreIso) return false;
        const cierre = new Date(fechaCierreIso);
        return !Number.isNaN(cierre.getTime()) && cierre.getTime() <= Date.now();
    }
    const asignacionesActivas = asignaciones.filter((a) =>
        ASIGNACION_ACTIVA.includes(a.estado) && !estaCerradaPorTiempo(fechaCierrePorId[a.id])
    );

    return (
        <div className="card-panel mb-4">
            <SectionHeader icono="bi-link-45deg" titulo="Asignaciones y recomendaciones" subtitulo="De toda tu empresa" />
            <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                Aquí aparece tanto lo que se le asigna a un usuario como lo que un usuario recomienda.
                Sin paso de aprobación, queda visible apenas se crea. Solo se muestra lo que sigue activo:
                lo completado, descartado o ya cerrado por tiempo se saca solo de esta lista.
            </p>

            {loading && <p className="text-muted">Cargando...</p>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && pendientesRevision.length > 0 && (
                <div className="mb-4">
                    <p className="mb-2 fw-semibold" style={{ fontSize: "0.85rem" }}>
                        <i className="bi bi-eye-fill me-1" />Pendientes de revisión
                    </p>
                    <PendientesRevision pendientes={pendientesRevision}
                        onAprobar={aprobarRevision} onDevolver={(a) => cambiarEstado(a, "DESARROLLO")} />
                </div>
            )}

            {!loading && (
                <TablaAsignaciones asignaciones={asignacionesActivas} onCambiarEstado={cambiarEstado}
                    onEliminar={quitar} onAprobarRevision={aprobarRevision} />
            )}

            <form className="d-flex gap-2 pt-3 border-top" onSubmit={asignar}>
                <select className="form-control" style={{ maxWidth: "200px" }} value={usuarioId} required
                    onChange={(e) => setUsuarioId(e.target.value)}>
                    <option value="">Asignar a...</option>
                    {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                </select>
                <select className="form-control" style={{ maxWidth: "180px" }} value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value)}>
                    {TIPOS_ASIGNACION.map((t) => (
                        <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                    ))}
                </select>
                <input className="form-control" placeholder="Código externo (ej: 1234-5-LE26)"
                    value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} />
                <button type="submit" className="btn btn-primary" disabled={asignando}>
                    {asignando ? "Asignando..." : "Asignar"}
                </button>
            </form>
        </div>
    );
}

// Placeholder -- funcionalidad real pendiente de definir + del LLM (ver
// conversacion). Se deja el recuadro reservado, deshabilitado, para no
// reacomodar el layout despues.

function SeccionDocumentacionPendiente() {
    return (
        <div className="card-panel mb-4" style={{ opacity: 0.6 }}>
            <SectionHeader icono="bi-file-earmark-lock2-fill" titulo="Documentación pendiente" />
            <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                Próximamente. Depende del asistente (LLM) que todavía no está conectado.
            </p>
        </div>
    );
}
