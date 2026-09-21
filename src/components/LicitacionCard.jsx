import BadgeCierre from "./BadgeCierre.jsx";

// Tarjeta resumen de una licitacion -- se usa tanto en Home (solo vista
// rapida, sin onClick) como en Licitacion.jsx (clickeable: abre el modal
// de detalle, ver Modal.jsx). Los nombres de campo son PascalCase porque
// /compra/licitacion/listar devuelve el JSON de Mercado Publico casi tal
// cual (ver LicitacionDto.java).
export default function LicitacionCard({ item, onClick, asignadaAMi }) {
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
            </div>
            <h6 className="mb-1" style={{ color: "var(--text-h)" }}>{item.Nombre}</h6>
            <p className="mb-1" style={{ fontSize: "0.85rem" }}>
                {item.Comprador?.NombreOrganismo || "Sin organismo"}
            </p>
            <p className="mb-0" style={{ fontSize: "0.85rem" }}>
                Cierre: {item.Fechas?.FechaCierre || "-"} · {item.MontoEstimado ?? "-"} {item.Moneda || ""}
            </p>
        </div>
    );
}
