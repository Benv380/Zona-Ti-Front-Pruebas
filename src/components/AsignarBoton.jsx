import { useEffect, useState } from "react";
import { authFetch, getClaims } from "../lib/api.js";

// Asignar directamente a un usuario puntual -- exclusivo GLOBAL/EMPRESA
// (ver AsignacionController.asignar en auth-service, @PreAuthorize
// hasAnyRole('GLOBAL','EMPRESA')). Distinto de RecomendarBoton: acá el
// que decide es un admin ("de arriba hacia abajo", origen=ADMIN), no el
// propio usuario recomendandose a si mismo o a un compañero. GLOBAL ve
// TODOS los usuarios del sistema; EMPRESA solo los de su propia empresa
// (el backend igual lo re-valida, esto es solo la UI).
export default function AsignarBoton({ codigoExterno, tipo }) {
    const claims = getClaims();
    const [usuarios, setUsuarios] = useState([]);
    const [usuarioId, setUsuarioId] = useState("");
    const [abierto, setAbierto] = useState(false);
    const [asignando, setAsignando] = useState(false);
    const [asignado, setAsignado] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!abierto || usuarios.length > 0) return;
        const endpoint = claims?.alcance === "GLOBAL"
            ? `/auth/usuarios`
            : `/auth/empresas/${claims?.empresaId}/usuarios`;
        authFetch(endpoint)
            .then((r) => (r.ok ? r.json() : []))
            .then(setUsuarios)
            .catch(() => setUsuarios([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [abierto]);

    async function asignar() {
        if (!usuarioId) return;
        setAsignando(true);
        setError(null);
        try {
            const res = await authFetch(`/auth/usuarios/${usuarioId}/asignaciones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigoExterno, tipo }),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            setAsignado(true);
            setAbierto(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setAsignando(false);
        }
    }

    if (asignado) {
        return (
            <span className="badge badge-rol-global">
                <i className="bi bi-check-circle-fill me-1"></i>
                Asignada
            </span>
        );
    }

    if (!abierto) {
        return (
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setAbierto(true)}>
                <i className="bi bi-person-plus-fill me-1"></i>
                Asignar a un usuario
            </button>
        );
    }

    return (
        <div className="d-flex flex-wrap align-items-center gap-2">
            <select
                className="form-control form-control-sm" style={{ maxWidth: "220px" }}
                value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}
            >
                <option value="">Seleccione un usuario...</option>
                {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                ))}
            </select>
            <button type="button" className="btn btn-sm btn-primary" disabled={!usuarioId || asignando} onClick={asignar}>
                {asignando ? "Asignando..." : "Confirmar"}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAbierto(false)}>
                Cancelar
            </button>
            {error && <span className="text-danger" style={{ fontSize: "0.8rem" }}>{error}</span>}
        </div>
    );
}
