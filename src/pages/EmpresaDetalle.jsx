import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authFetch } from "../lib/api.js";
import SectionHeader from "../components/SectionHeader.jsx";
import TablaAsignaciones from "../components/TablaAsignaciones.jsx";
import EmpresaForm, { archivoABase64 } from "../components/EmpresaForm.jsx";

// Panel de detalle de UNA empresa -- exclusivo GLOBAL (el backend rechaza
// con 403 a cualquiera que no lo sea en los 3 endpoints que usa esta
// página, aunque se entre a la URL a mano, mismo criterio que el resto de
// Administracion.jsx). Reemplaza la edición inline que antes vivía en la
// tabla de "Empresas": ahora "Editar" trae acá, que además de los mismos
// campos del formulario muestra los usuarios de la empresa y en qué están
// trabajando -- antes había que ir a otras 2 pantallas y filtrar a mano
// para armarse esa misma vista.
export default function EmpresaDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [empresa, setEmpresa] = useState(null);
    const [usuarios, setUsuarios] = useState([]);
    const [asignaciones, setAsignaciones] = useState([]);
    const [logoUrl, setLogoUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [form, setForm] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [errorForm, setErrorForm] = useState(null);

    async function cargar() {
        setLoading(true);
        setError(null);
        try {
            const [resEmpresa, resUsuarios, resAsignaciones] = await Promise.all([
                authFetch(`/auth/empresas/${id}`),
                authFetch(`/auth/empresas/${id}/usuarios`),
                authFetch(`/auth/empresas/${id}/asignaciones`),
            ]);
            if (!resEmpresa.ok) throw new Error(`Empresa: el servidor respondió con estado ${resEmpresa.status}`);
            if (!resUsuarios.ok) throw new Error(`Usuarios: el servidor respondió con estado ${resUsuarios.status}`);
            if (!resAsignaciones.ok) throw new Error(`Asignaciones: el servidor respondió con estado ${resAsignaciones.status}`);

            const datosEmpresa = await resEmpresa.json();
            setEmpresa(datosEmpresa);
            setUsuarios(await resUsuarios.json());
            setAsignaciones(await resAsignaciones.json());

            setForm({
                nombre: datosEmpresa.nombre || "",
                rut: datosEmpresa.rut || "",
                rubro: datosEmpresa.rubro || "",
                representanteLegal: datosEmpresa.representanteLegal || "",
                direccion: datosEmpresa.direccion || "",
                comuna: datosEmpresa.comuna || "",
                region: datosEmpresa.region || "",
                telefono: datosEmpresa.telefono || "",
                email: datosEmpresa.email || "",
                nombreFantasia: datosEmpresa.nombreFantasia || "",
                giro: datosEmpresa.giro || "",
                rutRepresentanteLegal: datosEmpresa.rutRepresentanteLegal || "",
                tamanoEmpresa: datosEmpresa.tamanoEmpresa || "",
                chileproveedoresRegistrado: !!datosEmpresa.chileproveedoresRegistrado,
                chileproveedoresCodigo: datosEmpresa.chileproveedoresCodigo || "",
                sitioWeb: datosEmpresa.sitioWeb || "",
                estado: datosEmpresa.estado || "ACTIVA",
                logoBase64: null,
                logoTipoContenido: null,
            });

            if (datosEmpresa.tieneLogo) {
                authFetch(`/auth/empresas/${id}/logo`)
                    .then((r) => (r.ok ? r.blob() : null))
                    .then((blob) => { if (blob) setLogoUrl(URL.createObjectURL(blob)); })
                    .catch(() => {});
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

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
            const res = await authFetch(`/auth/empresas/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargar();
        } catch (err) {
            setErrorForm(err.message);
        } finally {
            setGuardando(false);
        }
    }

    // Mismos 3 handlers que SeccionAsignaciones en Administracion.jsx (ver
    // ese archivo) -- acá acotados a esta empresa, así que no hace falta
    // pedir /auth/asignaciones completo ni filtrar client-side.
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
            await cargar();
        } catch (err) {
            setError(err.message);
        }
    }

    async function quitarAsignacion(asignacion) {
        try {
            const res = await authFetch(`/auth/asignaciones/${asignacion.id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 204) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargar();
        } catch (err) {
            setError(err.message);
        }
    }

    async function aprobarRevision(asignacion) {
        try {
            const res = await authFetch(`/auth/asignaciones/${asignacion.id}/revision`, { method: "PATCH" });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargar();
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        document.title = empresa ? `${empresa.nombre} · Administración` : "Administración";
    }, [empresa]);

    if (loading) return <p className="text-muted">Cargando...</p>;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!empresa || !form) return null;

    return (
        <div className="flex-min-w-0">
            <button type="button" className="btn btn-link ps-0 mb-2" onClick={() => navigate("/administracion")}>
                <i className="bi bi-arrow-left me-1"></i>Volver a Administración
            </button>

            <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
                {logoUrl ? (
                    <img src={logoUrl} alt="" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 6, background: "var(--bg-elevated-2)" }} />
                ) : (
                    <span className="d-flex align-items-center justify-content-center"
                        style={{ width: 48, height: 48, borderRadius: 6, background: "var(--bg-elevated-2)" }}>
                        <i className="bi bi-building" style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}></i>
                    </span>
                )}
                <div>
                    <h1 className="mb-0">{empresa.nombre}</h1>
                    <div className="d-flex align-items-center gap-2 mt-1">
                        <span className={`badge ${empresa.estado === "INACTIVA" ? "badge-rol-usuario" : "badge-rol-global"}`}>
                            {empresa.estado === "INACTIVA" ? "Inactiva" : "Activa"}
                        </span>
                        {empresa.rut && <span className="text-muted" style={{ fontSize: "0.85rem" }}>{empresa.rut}</span>}
                    </div>
                </div>
            </div>

            <div className="card-panel mb-4">
                <SectionHeader icono="bi-building-gear" titulo="Información de la empresa" />
                <form onSubmit={guardar}>
                    <EmpresaForm form={form} setForm={setForm} logoPreview={logoPreview || logoUrl} onElegirLogo={elegirLogo} />
                    {errorForm && <div className="alert alert-danger mt-2 mb-0">{errorForm}</div>}
                    <div className="mt-3">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
                            {guardando ? "Guardando..." : "Guardar cambios"}
                        </button>
                    </div>
                </form>
            </div>

            <div className="card-panel mb-4">
                <SectionHeader icono="bi-people-fill" titulo="Usuarios" subtitulo={`${usuarios.length} en esta empresa`} />
                {usuarios.length === 0 ? (
                    <p className="text-muted mb-0">Todavía no tiene usuarios.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-sm align-middle">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Usuario</th>
                                    <th className="d-none d-md-table-cell">Email</th>
                                    <th>Rol</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map((u) => (
                                    <tr key={u.id}>
                                        <td>{[u.name, u.lastName].filter(Boolean).join(" ") || "-"}</td>
                                        <td>{u.username}</td>
                                        <td className="d-none d-md-table-cell">{u.email || "-"}</td>
                                        <td><span className="badge badge-rol-usuario">{u.rol}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="card-panel mb-4">
                <SectionHeader icono="bi-link-45deg" titulo="En qué están trabajando" subtitulo="Asignaciones y recomendaciones de esta empresa" />
                <TablaAsignaciones
                    asignaciones={asignaciones}
                    onCambiarEstado={cambiarEstado}
                    onEliminar={quitarAsignacion}
                    onAprobarRevision={aprobarRevision}
                />
            </div>
        </div>
    );
}
