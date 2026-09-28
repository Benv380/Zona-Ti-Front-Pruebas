function formatearMonto(monto, moneda) {
    if (monto === null || monto === undefined) return "-";
    const esClp = !moneda || moneda.trim().toUpperCase() === "CLP";
    const numero = Number(monto).toLocaleString("es-CL", esClp
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return moneda ? `${moneda} ${numero}` : numero;
}

// Tarjeta separada (a la derecha, junto a PerfilVendedorPanel) con TODOS
// los proveedores que cotizaron una compra agil ya resuelta -- no solo el
// ganador -- ver CompraAgilResueltas.jsx. Antes esto vivia adentro de
// DetalleItem.jsx mezclado con el resto del detalle; se separo a pedido
// explicito (2026-09-25): el resultado (quien cotizo, a que precio) tenia
// que salir en su propia tarjeta, no enterrado dentro de la otra.
export default function ProveedoresCotizandoPanel({ proveedores, moneda }) {
    if (!proveedores || proveedores.length === 0) return null;

    return (
        <div className="card-panel">
            <h6 className="mb-3">
                <i className="bi bi-people-fill me-1"></i>
                Proveedores que cotizaron
            </h6>
            <div className="table-responsive">
                <table className="table table-sm mb-0" style={{ fontSize: "0.8rem" }}>
                    <thead>
                        <tr><th>Proveedor</th><th>Monto total</th><th>Productos cotizados</th></tr>
                    </thead>
                    <tbody>
                        {proveedores.map((p) => (
                            <tr
                                key={p.id_cotizacion}
                                style={p.proveedor_seleccionado === 1 ? { background: "var(--accent-bg)" } : undefined}
                            >
                                <td>
                                    {p.proveedor_seleccionado === 1 && <i className="bi bi-trophy-fill me-1" style={{ color: "var(--success)" }}></i>}
                                    {p.razon_social || "-"}
                                    <div className="text-muted" style={{ fontSize: "0.72rem" }}>{p.rut_proveedor || "-"}</div>
                                </td>
                                <td>{formatearMonto(p.monto_total, moneda)}</td>
                                <td>
                                    {(p.productos_cotizados || []).map((pc, i) => (
                                        <div key={i} className="text-muted" style={{ fontSize: "0.72rem" }}>
                                            {pc.nombre_producto || "-"} — {pc.cantidad ?? "-"} × {formatearMonto(pc.precio_unitario, moneda)}
                                        </div>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
