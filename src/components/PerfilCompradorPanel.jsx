import { useEffect, useState } from "react";
import { authFetch } from "../lib/api.js";
import MiniBarChart from "./MiniBarChart.jsx";

function formatearMonto(monto) {
    if (monto === null || monto === undefined) return "-";
    return `$${Number(monto).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}

// Panel lateral que se abre junto al detalle de una compra agil (ver
// CompraRapida.jsx) -- historial del organismo comprador armado sobre lo
// que YA esta cacheado (GET /compra/agil/organismo/perfil, ver
// CompraAgilService.perfilComprador): cuanto compra, con que frecuencia,
// "demandas"/"multa_sancion" por compra (Compra Agil), y reclamos reales
// (ChileCompra, agregado por tipo, ultimos 12 meses -- ver ReclamosClient
// del lado del backend). "reclamos" puede venir null aunque haya compras
// cacheadas (el token para pedirlo se configura a mano y vence cada ~8hs)
// -- en ese caso la seccion entera se omite, nunca se muestra "0" como si
// fuera un dato confirmado.
export default function PerfilCompradorPanel({ rutInstitucion }) {
    const [perfil, setPerfil] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!rutInstitucion) {
            setPerfil(null);
            return;
        }
        setCargando(true);
        setError(null);
        setPerfil(null);
        authFetch(`/compra/agil/organismo/perfil?rut=${encodeURIComponent(rutInstitucion)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => {
                if (!json) throw new Error();
                setPerfil(json);
            })
            .catch(() => setError("No se pudo cargar el perfil del comprador."))
            .finally(() => setCargando(false));
    }, [rutInstitucion]);

    if (!rutInstitucion) return null;

    return (
        <div className="card-panel h-100">
            <h6 className="mb-3">
                <i className="bi bi-bar-chart-fill me-1"></i>
                Perfil del comprador
            </h6>

            {cargando && <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>Cargando...</p>}
            {error && <p className="text-danger mb-0" style={{ fontSize: "0.85rem" }}>{error}</p>}

            {perfil && perfil.totalCompras === 0 && !perfil.reclamos && (
                <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                    Todavía no hay historial cacheado de este organismo.
                </p>
            )}

            {perfil && perfil.reclamos && (
                <div className="mb-3 pb-3 border-bottom">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                        <span style={{ fontSize: "0.8rem" }}>Reclamos (últimos 12 meses)</span>
                        <span className={`badge ${perfil.reclamos.total > 0 ? "bg-danger" : "bg-secondary"}`}>
                            {perfil.reclamos.total}
                        </span>
                    </div>
                    {perfil.reclamos.porTipo?.length > 0 && (
                        <MiniBarChart
                            datos={perfil.reclamos.porTipo.map((r) => ({ label: r.tipo, valor: r.cantidad }))}
                            colorVar="--danger"
                        />
                    )}
                    <p className="text-muted mb-0 mt-1" style={{ fontSize: "0.7rem" }}>
                        Fuente: ficha pública de comprador de Mercado Público.
                    </p>
                </div>
            )}

            {perfil && perfil.totalCompras > 0 && (
                <>
                    <p className="mb-1 fw-bold" style={{ fontSize: "0.9rem" }}>
                        {perfil.organismoComprador || "Organismo sin nombre"}
                    </p>
                    <p className="mb-3 text-muted" style={{ fontSize: "0.78rem" }}>
                        {perfil.totalCompras} compra{perfil.totalCompras === 1 ? "" : "s"} ágil{perfil.totalCompras === 1 ? "" : "es"} en el histórico cacheado
                    </p>

                    <div className="row g-2 mb-3">
                        <div className="col-6">
                            <div className="p-2 rounded" style={{ background: "var(--bg-elevated-2)" }}>
                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>Monto promedio</div>
                                <div className="fw-bold" style={{ fontSize: "0.92rem" }}>{formatearMonto(perfil.montoPromedio)}</div>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="p-2 rounded" style={{ background: "var(--bg-elevated-2)" }}>
                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>Monto total</div>
                                <div className="fw-bold" style={{ fontSize: "0.92rem" }}>{formatearMonto(perfil.montoTotal)}</div>
                            </div>
                        </div>
                    </div>

                    {/* "Demandas"/"multa_sancion" -- lo mas cercano a "reclamos"
                        que trae Mercado Publico por compra, ver comentario en
                        CompraAgilService.perfilComprador. */}
                    <div className="mb-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <span style={{ fontSize: "0.8rem" }}>Compras con demandas</span>
                            <span className={`badge ${perfil.comprasConDemandas > 0 ? "bg-danger" : "bg-secondary"}`}>
                                {perfil.comprasConDemandas} / {perfil.totalCompras}
                            </span>
                        </div>
                        {perfil.totalDemandas > 0 && (
                            <p className="text-muted mb-0" style={{ fontSize: "0.72rem" }}>
                                {perfil.totalDemandas} demanda{perfil.totalDemandas === 1 ? "" : "s"} acumulada{perfil.totalDemandas === 1 ? "" : "s"} en total
                            </p>
                        )}
                    </div>

                    <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                            <span style={{ fontSize: "0.8rem" }}>Compras con multa/sanción</span>
                            <span className={`badge ${perfil.comprasConMultaSancion > 0 ? "bg-warning text-dark" : "bg-secondary"}`}>
                                {perfil.comprasConMultaSancion} / {perfil.totalCompras}
                            </span>
                        </div>
                    </div>

                    {perfil.comprasPorMes?.length > 0 && (
                        <div className="mb-3">
                            <p className="mb-1 text-muted" style={{ fontSize: "0.78rem" }}>Compras por mes</p>
                            <MiniBarChart datos={perfil.comprasPorMes.map((m) => ({ label: m.mes, valor: m.cantidad }))} />
                        </div>
                    )}

                    {perfil.convocatoriasFrecuentes?.length > 0 && (
                        <div>
                            <p className="mb-1 text-muted" style={{ fontSize: "0.78rem" }}>Tipos de convocatoria más frecuentes</p>
                            <MiniBarChart
                                datos={perfil.convocatoriasFrecuentes.map((c) => ({ label: c.texto, valor: c.cantidad }))}
                                colorVar="--accent-2"
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
