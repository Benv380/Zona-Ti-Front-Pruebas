import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../lib/api.js";
import PendientesRevision from "../components/PendientesRevision.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import TablaAsignaciones, { ESTADOS, TIPOS_ASIGNACION } from "../components/TablaAsignaciones.jsx";
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

            <SeccionEmpresas />
            <SeccionUsuarios />
            <SeccionAsignaciones />
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

// ---------------------------------------------------------------------
// Asignaciones: panel GLOBAL de TODA la plataforma -- a diferencia de
// MiEmpresa.jsx (acotado a una sola empresa), acá se ven todas las
// empresas juntas (GET /auth/asignaciones) y se filtra client-side por
// empresa/usuario/tipo/estado. El filtro de empresa acota en cascada las
// opciones del filtro de usuario, para poder ir de "todas las empresas"
// a "una empresa puntual" a "un usuario puntual" sin perder de vista el
// resto. Reusa TablaAsignaciones (mismo componente que MiEmpresa.jsx) con
// mostrarEmpresa=true, ya que acá sí hace falta distinguir de qué empresa
// es cada fila.
// ---------------------------------------------------------------------
function SeccionAsignaciones() {
    const [usuarios, setUsuarios] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [asignaciones, setAsignaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filtroEmpresa, setFiltroEmpresa] = useState("");
    const [filtroUsuario, setFiltroUsuario] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("");
    const [filtroEstado, setFiltroEstado] = useState("");

    const [usuarioAsignar, setUsuarioAsignar] = useState("");
    const [nuevoCodigo, setNuevoCodigo] = useState("");
    const [nuevoTipo, setNuevoTipo] = useState("LICITACION");
    const [asignando, setAsignando] = useState(false);

    async function cargarTodo() {
        setLoading(true);
        setError(null);
        try {
            const [resAsig, resUsuarios, resEmpresas] = await Promise.all([
                authFetch(`/auth/asignaciones`),
                authFetch(`/auth/usuarios`),
                authFetch(`/auth/empresas`),
            ]);
            if (!resAsig.ok) throw new Error(`El servidor respondió con estado ${resAsig.status}`);
            setAsignaciones(await resAsig.json());
            setUsuarios(resUsuarios.ok ? await resUsuarios.json() : []);
            setEmpresas(resEmpresas.ok ? await resEmpresas.json() : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { cargarTodo(); }, []);

    // Cambiar de empresa resetea el filtro de usuario -- si no, podría
    // quedar seleccionado un usuario que no pertenece a la empresa nueva
    // y el filtro de usuario no haría nada visible.
    function cambiarFiltroEmpresa(id) {
        setFiltroEmpresa(id);
        setFiltroUsuario("");
    }

    // Usuarios que aparecen en el selector de filtro: todos, o solo los
    // de la empresa filtrada -- así el segundo select siempre queda
    // acotado a lo que tiene sentido elegir.
    const usuariosFiltroEmpresa = useMemo(() => {
        if (!filtroEmpresa) return usuarios;
        return usuarios.filter((u) => String(u.empresaId) === filtroEmpresa);
    }, [usuarios, filtroEmpresa]);

    const asignacionesFiltradas = useMemo(() => {
        return asignaciones.filter((a) => {
            if (filtroEmpresa && String(a.empresaId) !== filtroEmpresa) return false;
            if (filtroUsuario && String(a.usuarioId) !== filtroUsuario) return false;
            if (filtroTipo && a.tipo !== filtroTipo) return false;
            if (filtroEstado && a.estado !== filtroEstado) return false;
            return true;
        });
    }, [asignaciones, filtroEmpresa, filtroUsuario, filtroTipo, filtroEstado]);

    function nombreEmpresa(empresaId) {
        return empresas.find((e) => e.id === empresaId)?.nombre;
    }

    async function asignar(e) {
        e.preventDefault();
        if (!usuarioAsignar || !nuevoCodigo.trim()) return;
        setAsignando(true);
        setError(null);
        try {
            const res = await authFetch(`/auth/usuarios/${usuarioAsignar}/asignaciones`, {
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
    // AsignacionService.actualizarEstado).
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

    // Mismo criterio que MiEmpresa.jsx (ver esa) -- apaga
    // Asignacion.pendienteRevision, el estado ya estaba en COMPLETADO.
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

    // Sin filtrar (ni por los selects de arriba ni por "verTodas") -- antes
    // solo aparecia mezclada adentro de la tabla grande de abajo (con
    // mostrarEmpresa+badge inline, facil de perder de vista entre el resto
    // de filas); ahora tiene su propia lista arriba de todo, igual que en
    // MiEmpresa.jsx.
    const pendientesRevision = asignaciones.filter((a) => a.pendienteRevision);

    return (
        <div className="card-panel mb-4">
            <SectionHeader icono="bi-link-45deg" titulo="Asignaciones" subtitulo="De todas las empresas" />
            <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                Todo lo asignado o recomendado en cualquier empresa del sistema. Filtre por empresa, usuario, tipo o estado
                para acotar la vista.
            </p>

            <div className="row g-2 mb-3">
                <div className="col-md-3">
                    <select className="form-control form-control-sm" value={filtroEmpresa}
                        onChange={(e) => cambiarFiltroEmpresa(e.target.value)}>
                        <option value="">Todas las empresas</option>
                        {empresas.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-3">
                    <select className="form-control form-control-sm" value={filtroUsuario}
                        onChange={(e) => setFiltroUsuario(e.target.value)}>
                        <option value="">Todos los usuarios</option>
                        {usuariosFiltroEmpresa.map((u) => (
                            <option key={u.id} value={u.id}>{u.username}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-3">
                    <select className="form-control form-control-sm" value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value)}>
                        <option value="">Todos los tipos</option>
                        {TIPOS_ASIGNACION.map((t) => (
                            <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-3">
                    <select className="form-control form-control-sm" value={filtroEstado}
                        onChange={(e) => setFiltroEstado(e.target.value)}>
                        <option value="">Todos los estados</option>
                        {ESTADOS.map((es) => (
                            <option key={es.valor} value={es.valor}>{es.etiqueta}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && <p className="text-muted">Cargando...</p>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && pendientesRevision.length > 0 && (
                <div className="mb-4">
                    <p className="mb-2 fw-semibold" style={{ fontSize: "0.85rem" }}>
                        <i className="bi bi-eye-fill me-1" />Pendientes de revisión
                    </p>
                    <PendientesRevision pendientes={pendientesRevision} mostrarEmpresa
                        onAprobar={aprobarRevision} onDevolver={(a) => cambiarEstado(a, "DESARROLLO")} />
                </div>
            )}

            {!loading && (
                <>
                    <p className="text-muted mb-2" style={{ fontSize: "0.8rem" }}>
                        {asignacionesFiltradas.length} de {asignaciones.length} en total
                    </p>
                    <TablaAsignaciones
                        asignaciones={asignacionesFiltradas}
                        mostrarEmpresa
                        onCambiarEstado={cambiarEstado}
                        onEliminar={quitar}
                        onAprobarRevision={aprobarRevision}
                    />
                </>
            )}

            <form className="d-flex flex-wrap gap-2 pt-3 border-top" onSubmit={asignar}>
                <select className="form-control" style={{ maxWidth: "220px" }} value={usuarioAsignar} required
                    onChange={(e) => setUsuarioAsignar(e.target.value)}>
                    <option value="">Asignar a...</option>
                    {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.username}{u.empresaId ? ` — ${nombreEmpresa(u.empresaId) || "empresa #" + u.empresaId}` : ""}
                        </option>
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
