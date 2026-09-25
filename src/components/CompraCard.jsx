import AsignacionesCompaneroBadge from "./AsignacionesCompaneroBadge.jsx";
import BadgeCierre from "./BadgeCierre.jsx";

// CLP sin decimales -- cualquier otra moneda (dolares, UF, UTM, etc.) con
// 2 decimales fijos, mismo criterio que formatearMonto en DetalleItem.jsx/
// CotizacionCompraAgil.jsx (la tarjeta resumen no importa esos componentes,
// se duplica la funcion como ya se hace entre esos dos).
function formatearMonto(monto, moneda) {
    if (monto === null || monto === undefined || monto === "" || Number.isNaN(Number(monto))) return null;
    const esClp = !moneda || moneda.trim().toUpperCase() === "CLP";
    const numero = Number(monto).toLocaleString("es-CL", esClp
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return esClp ? `$${numero}` : `${numero} ${moneda}`;
}

// Equivalente a LicitacionCard.jsx pero para un item de Compra Agil --
// se usa en Home (sin onClick) y en CompraRapida.jsx (clickeable, abre
// el modal de detalle). Nombres de campo en snake_case porque
// /compra/agil/listar devuelve el JSON de Mercado Publico casi tal cual
// (ver CompraAgilDto.java).
export default function CompraCard({ item, onClick, asignadaAMi, otrosUsuarios }) {
    const monto = formatearMonto(
        item.montos?.monto_disponible_clp ?? item.montos?.monto_disponible,
        item.montos?.moneda
    );

    // "fecha_cierre" (el campo general que manda Mercado Publico) queda
    // pisado con la fecha del 1er llamado cuando la compra pasa a un 2do
    // llamado -- no se actualiza sola. Sin este fallback, cualquier compra
    // en 2do llamado se veia siempre como "Cerrada" (BadgeCierre comparaba
    // contra una fecha ya pasada por definicion, aunque siga vigente por
    // el 2do llamado) -- ver CompraAgilRepository.findEnSegundoLlamadoDesde,
    // que ya filtra por la fecha correcta del lado del backend.
    const fechaCierre = item.fechas?.fecha_cierre_segundo_llamado || item.fechas?.fecha_cierre;

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
                    {item.estado?.glosa || "Sin estado"}
                </span>
                <BadgeCierre fecha={fechaCierre} />
                {asignadaAMi && (
                    <span className="badge badge-rol-global">
                        <i className="bi bi-check-circle-fill me-1"></i>
                        Asignada a mí
                    </span>
                )}
                <AsignacionesCompaneroBadge usuarios={otrosUsuarios} />
            </div>
            <h6 className="mb-1" style={{ color: "var(--text-h)" }}>{item.nombre}</h6>
            <p className="mb-1" style={{ fontSize: "0.85rem" }}>
                {item.convocatoria?.descripcion || "Sin convocatoria"}
            </p>
            <p className="mb-1" style={{ fontSize: "0.85rem" }}>
                Cierre: {fechaCierre || "-"}
            </p>
            {monto && (
                <p className="mb-0 fw-bold" style={{ fontSize: "1rem", color: "var(--accent)" }}>
                    {monto}
                </p>
            )}
        </div>
    );
}
