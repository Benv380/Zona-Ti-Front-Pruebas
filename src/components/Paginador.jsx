// Controles de paginación compartidos por Licitación y Compra Ágil -- el
// backend devuelve el mismo shape en los dos ("Paginacion" en
// LicitacionResponse, "paginacion" dentro de payload en Compra Ágil, con
// los mismos 4 campos snake_case), así que un solo componente les sirve
// a ambos.
export default function Paginador({ paginacion, onCambiar }) {
    if (!paginacion || !paginacion.total_paginas || paginacion.total_paginas <= 1) {
        return null;
    }

    const { numero_pagina: pagina, total_paginas: totalPaginas, total_resultados: totalResultados } = paginacion;

    return (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
            <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                Página {pagina} de {totalPaginas} · {totalResultados} resultados
            </span>
            <div className="btn-group">
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={pagina <= 1}
                    onClick={() => onCambiar(pagina - 1)}
                >
                    Anterior
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={pagina >= totalPaginas}
                    onClick={() => onCambiar(pagina + 1)}
                >
                    Siguiente
                </button>
            </div>
        </div>
    );
}
