import BadgeCierre from "./BadgeCierre.jsx";

// Reemplaza el <pre>{JSON.stringify(item)}</pre> crudo que se mostraba en
// las tarjetas expandidas de Licitación/Compra Ágil/Mis Activas -- LICITACION
// viene en PascalCase (LicitacionDto), COMPRA_AGIL en snake_case
// (CompraAgilDto): son 2 formatos distintos que entrega Mercado Público,
// no algo que inventamos acá. Contempla tanto el shape "resumen" (listado)
// como el "detalle completo" (búsqueda por código) -- según el caso,
// algunos campos vienen vacíos y el componente los omite en vez de
// mostrar "-" por todos lados.

function Campo({ etiqueta, valor }) {
    if (valor === null || valor === undefined || valor === "") return null;
    return (
        <div className="mb-1" style={{ fontSize: "0.85rem" }}>
            <span className="text-muted">{etiqueta}: </span>
            {/* Color explicito (no heredado) -- el valor es el dato que
                importa, tiene que ser mas legible que la etiqueta, no al
                revés. */}
            <span style={{ color: "var(--text-h)" }}>{valor}</span>
        </div>
    );
}

// Mercado Público manda fechas como ISO ("2026-08-04T00:00:00") -- se
// muestra solo la parte de fecha, en formato chileno, en vez del ISO
// crudo. Si no se puede parsear, se devuelve tal cual vino (mejor
// mostrar algo raro que nada).
function formatearFecha(iso) {
    if (!iso) return null;
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString("es-CL");
}

function formatearMonto(monto, moneda) {
    if (monto === null || monto === undefined) return null;
    // CLP sin decimales -- cualquier otra moneda (dolares, UF, UTM, etc.)
    // con 2 decimales fijos, igual que en la herramienta de cotizacion
    // (ver formatearMonto en CotizacionCompraAgil.jsx).
    const esClp = !moneda || moneda.trim().toUpperCase() === "CLP";
    const numero = Number(monto).toLocaleString("es-CL", esClp
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return moneda ? `${moneda} ${numero}` : numero;
}

function DetalleLicitacion({ item }) {
    const productos = item.Items?.Listado || item.items?.listado || [];
    const comprador = item.Comprador || {};
    const fechas = item.Fechas || {};
    const ubicacion = [comprador.ComunaUnidad, comprador.RegionUnidad].filter(Boolean).join(", ");

    return (
        <div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <h6 className="mb-0">{item.Nombre}</h6>
                <BadgeCierre fecha={fechas.FechaCierre || item.FechaCierre} />
            </div>
            <p className="mb-2" style={{ fontSize: "0.85rem" }}>
                {item.Estado || "Sin estado"}{item.Tipo ? ` · ${item.Tipo}` : ""}
            </p>
            {item.Descripcion && <p className="mb-2" style={{ fontSize: "0.85rem" }}>{item.Descripcion}</p>}

            <div className="row g-3">
                <div className="col-md-6">
                    <Campo etiqueta="Organismo" valor={comprador.NombreOrganismo} />
                    <Campo etiqueta="RUT entidad solicitante" valor={comprador.RutUnidad} />
                    <Campo etiqueta="Unidad" valor={comprador.NombreUnidad} />
                    <Campo etiqueta="Ubicación" valor={ubicacion || null} />
                    <Campo etiqueta="Contacto" valor={comprador.NombreUsuario ? `${comprador.NombreUsuario}${comprador.CargoUsuario ? ` (${comprador.CargoUsuario})` : ""}` : null} />
                    <Campo etiqueta="Email de contacto" valor={item.EmailResponsableContrato || comprador.EmailUsuario} />
                </div>
                <div className="col-md-6">
                    <Campo etiqueta="Publicación" valor={formatearFecha(fechas.FechaPublicacion)} />
                    <Campo etiqueta="Cierre" valor={formatearFecha(fechas.FechaCierre || item.FechaCierre)} />
                    <Campo etiqueta="Adjudicación estimada" valor={formatearFecha(fechas.FechaEstimadaAdjudicacion)} />
                    <Campo etiqueta="Monto estimado" valor={formatearMonto(item.MontoEstimado, item.Moneda)} />
                    <Campo etiqueta="Modalidad / pago" valor={[item.Modalidad, item.TipoPago].filter(Boolean).join(" · ") || null} />
                </div>
            </div>

            {productos.length > 0 && (
                <div className="mt-2">
                    <p className="mb-1 text-muted" style={{ fontSize: "0.8rem" }}>Productos/servicios solicitados</p>
                    <div className="table-responsive">
                        <table className="table table-sm" style={{ fontSize: "0.8rem" }}>
                            <thead>
                                <tr><th>Nombre</th><th>Categoría</th><th>Cantidad</th><th>Unidad</th></tr>
                            </thead>
                            <tbody>
                                {productos.map((p, i) => (
                                    <tr key={p.CodigoProducto ?? i}>
                                        <td>{p.NombreProducto || "-"}</td>
                                        <td>{p.Categoria || "-"}</td>
                                        <td>{p.Cantidad ?? "-"}</td>
                                        <td>{p.UnidadMedida || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetalleCompraAgil({ item }) {
    // El listado (Item) trae "montos"; el detalle completo (Detalle) trae
    // "presupuesto" -- distintos shapes segun de donde vino este item (ver
    // CompraAgilDto). Se usa el que haya.
    const presupuesto = item.presupuesto || item.montos || {};
    const productos = item.productos_solicitados || [];

    return (
        <div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <h6 className="mb-0">{item.nombre}</h6>
                <BadgeCierre fecha={item.fechas?.fecha_cierre} />
            </div>
            <p className="mb-2" style={{ fontSize: "0.85rem" }}>
                {item.estado?.glosa || "Sin estado"}{item.convocatoria?.descripcion ? ` · ${item.convocatoria.descripcion}` : ""}
            </p>
            {item.descripcion && <p className="mb-2" style={{ fontSize: "0.85rem" }}>{item.descripcion}</p>}

            <div className="row g-3">
                <div className="col-md-6">
                    <Campo etiqueta="Organismo" valor={item.institucion?.organismo_comprador} />
                    <Campo etiqueta="RUT entidad solicitante" valor={item.institucion?.rut} />
                    <Campo etiqueta="Unidad de compra" valor={item.institucion?.unidad_compra} />
                    <Campo etiqueta="Región" valor={item.institucion?.nombre_region} />
                    <Campo etiqueta="Dirección de entrega" valor={item.entrega?.direccion_entrega} />
                    <Campo etiqueta="Plazo de entrega" valor={item.entrega?.plazo_entrega_dias ? `${item.entrega.plazo_entrega_dias} días` : null} />
                </div>
                <div className="col-md-6">
                    <Campo etiqueta="Publicación" valor={formatearFecha(item.fechas?.fecha_publicacion)} />
                    <Campo etiqueta="Cierre" valor={formatearFecha(item.fechas?.fecha_cierre)} />
                    <Campo etiqueta="Cierre 1er llamado" valor={formatearFecha(item.fechas?.fecha_cierre_primer_llamado)} />
                    <Campo etiqueta="Cierre 2do llamado" valor={formatearFecha(item.fechas?.fecha_cierre_segundo_llamado)} />
                    <Campo etiqueta="Último cambio" valor={formatearFecha(item.fechas?.fecha_ultimo_cambio)} />
                    <Campo etiqueta="Presupuesto estimado" valor={formatearMonto(presupuesto.presupuesto_estimado, presupuesto.moneda)} />
                    <Campo etiqueta="Monto disponible" valor={formatearMonto(presupuesto.monto_disponible, presupuesto.moneda)} />
                </div>
            </div>

            {productos.length > 0 && (
                <div className="mt-2">
                    <p className="mb-1 text-muted" style={{ fontSize: "0.8rem" }}>Productos/servicios solicitados</p>
                    <div className="table-responsive">
                        <table className="table table-sm" style={{ fontSize: "0.8rem" }}>
                            <thead>
                                <tr><th>Nombre</th><th>Descripción</th><th>Cantidad</th><th>Unidad</th></tr>
                            </thead>
                            <tbody>
                                {productos.map((p, i) => (
                                    <tr key={p.codigo_producto ?? i}>
                                        <td>{p.nombre || "-"}</td>
                                        <td>{p.descripcion || "-"}</td>
                                        <td>{p.cantidad ?? "-"}</td>
                                        <td>{p.unidad_medida || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DetalleItem({ tipo, item }) {
    if (!item) return null;
    return tipo === "LICITACION" ? <DetalleLicitacion item={item} /> : <DetalleCompraAgil item={item} />;
}
