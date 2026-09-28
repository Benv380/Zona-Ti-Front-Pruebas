import { useEffect, useState } from "react";
import { authFetch } from "../lib/api.js";
import MiniBarChart from "./MiniBarChart.jsx";

function formatearMonto(monto) {
    if (monto === null || monto === undefined) return "-";
    return `$${Number(monto).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}

// Panel lateral "Perfil del ganador" -- se abre junto al detalle de una
// compra agil YA RESUELTA en CompraAgilResueltas.jsx (Home.jsx): historial
// del proveedor que se adjudico esta compra, armado sobre lo que YA esta
// cacheado (GET /compra/agil/proveedor/perfil, ver
// CompraAgilService.perfilVendedor). A diferencia del perfil de
// comprador, esto solo existe para compras con detalle completo
// sincronizado -- la minoria de los casos -- asi que el universo va a ser
// mas chico.
export default function PerfilVendedorPanel({ rutProveedor }) {
    const [perfil, setPerfil] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!rutProveedor) {
            setPerfil(null);
            return;
        }
        setCargando(true);
        setError(null);
        setPerfil(null);
        authFetch(`/compra/agil/proveedor/perfil?rut=${encodeURIComponent(rutProveedor)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => {
                if (!json) throw new Error();
                setPerfil(json);
            })
            .catch(() => setError("No se pudo cargar el perfil del proveedor."))
            .finally(() => setCargando(false));
    }, [rutProveedor]);

    if (!rutProveedor) return null;

    return (
        <div className="card-panel h-100">
            <h6 className="mb-3">
                <i className="bi bi-trophy-fill me-1"></i>
                Perfil del ganador
            </h6>

            {cargando && <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>Cargando...</p>}
            {error && <p className="text-danger mb-0" style={{ fontSize: "0.85rem" }}>{error}</p>}

            {perfil && perfil.totalCotizaciones === 0 && (
                <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                    Todavía no hay historial cacheado de este proveedor.
                </p>
            )}

            {perfil && perfil.totalCotizaciones > 0 && (
                <>
                    <p className="mb-1 fw-bold" style={{ fontSize: "0.9rem" }}>
                        {perfil.razonSocial || "Proveedor sin nombre"}
                    </p>
                    <p className="mb-3 text-muted" style={{ fontSize: "0.78rem" }}>
                        {perfil.totalCotizaciones} cotizacion{perfil.totalCotizaciones === 1 ? "" : "es"} en el histórico cacheado
                    </p>

                    <div className="row g-2 mb-3">
                        <div className="col-6">
                            <div className="p-2 rounded" style={{ background: "var(--bg-elevated-2)" }}>
                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>Veces ganó</div>
                                <div className="fw-bold" style={{ fontSize: "0.92rem" }}>
                                    {perfil.vecesGanador} / {perfil.totalCotizaciones}
                                </div>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="p-2 rounded" style={{ background: "var(--bg-elevated-2)" }}>
                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>Tasa de adjudicación</div>
                                <div className="fw-bold" style={{ fontSize: "0.92rem" }}>{perfil.tasaAdjudicacion.toFixed(0)}%</div>
                            </div>
                        </div>
                    </div>

                    <div className="row g-2 mb-3">
                        <div className="col-6">
                            <div className="p-2 rounded" style={{ background: "var(--bg-elevated-2)" }}>
                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>Monto promedio ganado</div>
                                <div className="fw-bold" style={{ fontSize: "0.92rem" }}>{formatearMonto(perfil.montoPromedioGanado)}</div>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="p-2 rounded" style={{ background: "var(--bg-elevated-2)" }}>
                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>Monto total ganado</div>
                                <div className="fw-bold" style={{ fontSize: "0.92rem" }}>{formatearMonto(perfil.montoTotalGanado)}</div>
                            </div>
                        </div>
                    </div>

                    {perfil.organismosFrecuentes?.length > 0 && (
                        <div>
                            <p className="mb-1 text-muted" style={{ fontSize: "0.78rem" }}>Organismos con los que más trabaja</p>
                            <MiniBarChart
                                datos={perfil.organismosFrecuentes.map((o) => ({ label: o.texto, valor: o.cantidad }))}
                                colorVar="--accent-2"
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
