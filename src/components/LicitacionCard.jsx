import AsignacionesCompaneroBadge from "./AsignacionesCompaneroBadge.jsx";
import BadgeCierre from "./BadgeCierre.jsx";

// CLP sin decimales -- cualquier otra moneda (dolares, UF, UTM, etc.) con
// 2 decimales fijos, mismo criterio que formatearMonto en CompraCard.jsx/
// DetalleItem.jsx/CotizacionCompraAgil.jsx (se duplica la funcion, igual
// que ya se hace entre esos).
function formatearMonto(monto, moneda) {
    if (monto === null || monto === undefined || monto === "" || Number.isNaN(Number(monto))) return null;
    const esClp = !moneda || moneda.trim().toUpperCase() === "CLP";
    const numero = Number(monto).toLocaleString("es-CL", esClp
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return esClp ? `$${numero}` : `${numero} ${moneda}`;
}

// Tarjeta resumen de una licitacion -- se usa tanto en Home (solo vista
// rapida, sin onClick) como en Licitacion.jsx (clickeable: abre el modal
// de detalle, ver Modal.jsx). Los nombres de campo son PascalCase porque
// /compra/licitacion/listar devuelve el JSON de Mercado Publico casi tal
// cual (ver LicitacionDto.java).
export default function LicitacionCard({ item, onClick, asignadaAMi, otrosUsuarios }) {
    const monto = formatearMonto(item.MontoEstimado, item.Moneda);

    return (
        <div
            className={`card-panel h-100${onClick ? " card-clickeable" : ""}`}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-1">
                <span
                    className="badge"
                    style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
                >
                    {item.Estado || "Sin estado"}
                </span>
                <BadgeCierre fecha={item.Fechas?.FechaCierre} />
                {asignadaAMi && (
                    <span className="badge badge-rol-global">
                        <i className="bi bi-check-circle-fill me-1"></i>
                        Asignada a mí
                    </span>
                )}
                <AsignacionesCompaneroBadge usuarios={otrosUsuarios} />
            </div>
            <h6 className="mb-1" style={{ color: "var(--text-h)" }}>{item.Nombre}</h6>
            <p className="mb-1" style={{ fontSize: "0.85rem" }}>
                {item.Comprador?.NombreOrganismo || "Sin organismo"}
            </p>
            <p className="mb-1" style={{ fontSize: "0.85rem" }}>
                Cierre: {item.Fechas?.FechaCierre || "-"}
            </p>
            {monto && (
                <p className="mb-0 fw-bold" style={{ fontSize: "1rem", color: "var(--accent)" }}>
                    {monto}
                </p>
            )}
        </div>
    );
}
