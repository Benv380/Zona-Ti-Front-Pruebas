import BadgeCierre from "./BadgeCierre.jsx";

// Equivalente a LicitacionCard.jsx pero para un item de Compra Agil --
// se usa en Home (sin onClick) y en CompraRapida.jsx (clickeable, abre
// el modal de detalle). Nombres de campo en snake_case porque
// /compra/agil/listar devuelve el JSON de Mercado Publico casi tal cual
// (ver CompraAgilDto.java).
export default function CompraCard({ item, onClick, asignadaAMi }) {
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
                <BadgeCierre fecha={item.fechas?.fecha_cierre} />
                {asignadaAMi && (
                    <span className="badge badge-rol-global">
                        <i className="bi bi-check-circle-fill me-1"></i>
                        Asignada a mí
                    </span>
                )}
            </div>
            <h6 className="mb-1" style={{ color: "var(--text-h)" }}>{item.nombre}</h6>
            <p className="mb-1" style={{ fontSize: "0.85rem" }}>
                {item.convocatoria?.descripcion || "Sin convocatoria"}
            </p>
            <p className="mb-0" style={{ fontSize: "0.85rem" }}>
                Cierre: {item.fechas?.fecha_cierre || "-"} · {item.montos?.monto_disponible_clp ?? item.montos?.monto_disponible ?? "-"}
            </p>
        </div>
    );
}
