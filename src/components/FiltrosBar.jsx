import { REGIONES } from "../lib/regionesComunas.js";
import { FILTROS_VACIOS, hayFiltrosActivos } from "../lib/filtros.js";

// "V - Valparaíso" -> "Valparaíso" -- Licitacion filtra por texto libre
// contra region_unidad (Mercado Publico no expone ahi un codigo de region
// propio, a diferencia de Compra Agil v2), asi que se le manda el nombre
// pelado, no el codigo con el numeral romano.
function nombrePelado(nombreRegion) {
    return nombreRegion.replace(/^[IVXR]+\s*-\s*/, "");
}

// Panel de filtros compartido por CompraRapida.jsx/Licitacion.jsx -- antes
// cada pagina tenia solo 2-3 botones sueltos ("Ver todo"/"Ver mi filtro"/
// "En 2do llamado") sin forma de ordenar ni acotar por region/monto/fecha.
// "vistas" arma el selector de arriba (Compra Agil manda 3, Licitacion 2 --
// no hay "2do llamado" en Licitacion). El resto de los filtros se aplican
// SOBRE la vista activa, no la reemplazan.
//
// "onCambiarFiltros" actualiza el borrador en vivo (liga los inputs);
// "onAplicar" es quien realmente dispara el refetch -- separados para no
// pegarle al backend en cada tecla escrita en monto/fecha.
export default function FiltrosBar({ vistas, vistaActual, onCambiarVista, filtros, onCambiarFiltros, onAplicar, tipoRegion }) {
    function actualizar(campo, valor) {
        onCambiarFiltros({ ...filtros, [campo]: valor });
    }

    function limpiar() {
        onCambiarFiltros(FILTROS_VACIOS);
        onAplicar(FILTROS_VACIOS);
    }

    return (
        <div className="card-panel mb-3 w-100">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
                <span className="text-muted" style={{ fontSize: "0.8rem" }}>Vista:</span>
                <div className="btn-group btn-group-sm flex-wrap" role="group">
                    {vistas.map((v) => (
                        <button
                            key={v.valor}
                            type="button"
                            className={`btn ${vistaActual === v.valor ? "btn-primary" : "btn-outline-secondary"}`}
                            onClick={() => onCambiarVista(v.valor)}
                        >
                            {v.etiqueta}
                        </button>
                    ))}
                </div>
            </div>

            <div className="row g-2 align-items-end">
                <div className="col-6 col-md-2">
                    <label className="form-label mb-1" style={{ fontSize: "0.72rem" }}>Ordenar por</label>
                    <select
                        className="form-control form-control-sm"
                        value={filtros.ordenarPor}
                        onChange={(e) => actualizar("ordenarPor", e.target.value)}
                    >
                        <option value="cierre">Fecha de cierre</option>
                        <option value="publicacion">Fecha de publicación</option>
                        <option value="monto">Monto</option>
                        <option value="nombre">Nombre</option>
                    </select>
                </div>
                <div className="col-6 col-md-2">
                    <label className="form-label mb-1" style={{ fontSize: "0.72rem" }}>Dirección</label>
                    <select
                        className="form-control form-control-sm"
                        value={filtros.direccion}
                        onChange={(e) => actualizar("direccion", e.target.value)}
                    >
                        <option value="asc">Ascendente</option>
                        <option value="desc">Descendente</option>
                    </select>
                </div>
                <div className="col-6 col-md-2">
                    <label className="form-label mb-1" style={{ fontSize: "0.72rem" }}>Región</label>
                    <select
                        className="form-control form-control-sm"
                        value={filtros.region}
                        onChange={(e) => actualizar("region", e.target.value)}
                    >
                        <option value="">Todas</option>
                        {REGIONES.map((r) => (
                            <option key={r.codigo} value={tipoRegion === "nombre" ? nombrePelado(r.nombre) : r.codigo}>
                                {r.nombre}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-6 col-md-2">
                    <label className="form-label mb-1" style={{ fontSize: "0.72rem" }}>Monto mín.</label>
                    <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        placeholder="$"
                        value={filtros.montoMin}
                        onChange={(e) => actualizar("montoMin", e.target.value)}
                    />
                </div>
                <div className="col-6 col-md-2">
                    <label className="form-label mb-1" style={{ fontSize: "0.72rem" }}>Monto máx.</label>
                    <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        placeholder="$"
                        value={filtros.montoMax}
                        onChange={(e) => actualizar("montoMax", e.target.value)}
                    />
                </div>
                <div className="col-6 col-md-2">
                    <label className="form-label mb-1" style={{ fontSize: "0.72rem" }}>Cierra desde</label>
                    <input
                        type="date"
                        className="form-control form-control-sm"
                        value={filtros.cierreDesde}
                        onChange={(e) => actualizar("cierreDesde", e.target.value)}
                    />
                </div>
                <div className="col-6 col-md-2">
                    <label className="form-label mb-1" style={{ fontSize: "0.72rem" }}>Cierra hasta</label>
                    <input
                        type="date"
                        className="form-control form-control-sm"
                        value={filtros.cierreHasta}
                        onChange={(e) => actualizar("cierreHasta", e.target.value)}
                    />
                </div>
                <div className="col-12 col-md-2 d-flex gap-2">
                    <button type="button" className="btn btn-primary btn-sm flex-grow-1" onClick={() => onAplicar(filtros)}>
                        Aplicar
                    </button>
                    {hayFiltrosActivos(filtros) && (
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={limpiar} title="Limpiar filtros">
                            <i className="bi bi-x-lg"></i>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
