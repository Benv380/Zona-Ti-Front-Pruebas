import { useState } from "react";

// Controles de paginación compartidos por Licitación y Compra Ágil -- el
// backend devuelve el mismo shape en los dos ("Paginacion" en
// LicitacionResponse, "paginacion" dentro de payload en Compra Ágil, con
// los mismos 4 campos snake_case), así que un solo componente les sirve
// a ambos.
//
// Además de Anterior/Siguiente, muestra números de página clicleables
// alrededor de la actual (con "..." cuando hay muchas) y un campo para
// saltar directo a cualquier página escribiendo el número -- antes solo
// se podía ir de a una, y con varias páginas era lento llegar a una
// puntual.
export default function Paginador({ paginacion, onCambiar }) {
    const [saltoInput, setSaltoInput] = useState("");

    if (!paginacion || !paginacion.total_paginas || paginacion.total_paginas <= 1) {
        return null;
    }

    const { numero_pagina: pagina, total_paginas: totalPaginas, total_resultados: totalResultados } = paginacion;

    function irA(numero) {
        const destino = Math.min(Math.max(numero, 1), totalPaginas);
        if (destino !== pagina) onCambiar(destino);
    }

    function enviarSalto(e) {
        e.preventDefault();
        const numero = Number(saltoInput);
        if (Number.isInteger(numero) && numero >= 1 && numero <= totalPaginas) {
            irA(numero);
        }
        setSaltoInput("");
    }

    // Ventana de páginas visibles: siempre la 1 y la última, más 1 antes/
    // después de la actual -- el resto se resume con "...". Evita
    // renderizar cientos de botones cuando hay muchas páginas.
    const numeros = [];
    for (let n = 1; n <= totalPaginas; n++) {
        if (n === 1 || n === totalPaginas || Math.abs(n - pagina) <= 1) {
            numeros.push(n);
        } else if (numeros[numeros.length - 1] !== "...") {
            numeros.push("...");
        }
    }

    return (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
            <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                Página {pagina} de {totalPaginas} · {totalResultados} resultados
            </span>
            <div className="d-flex flex-wrap align-items-center gap-2">
                <div className="btn-group">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={pagina <= 1}
                        onClick={() => onCambiar(pagina - 1)}
                    >
                        Anterior
                    </button>
                    {numeros.map((n, i) =>
                        n === "..." ? (
                            <span key={`ellipsis-${i}`} className="btn btn-sm btn-outline-secondary disabled" style={{ pointerEvents: "none" }}>
                                …
                            </span>
                        ) : (
                            <button
                                key={n}
                                type="button"
                                className={`btn btn-sm ${n === pagina ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => irA(n)}
                            >
                                {n}
                            </button>
                        )
                    )}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={pagina >= totalPaginas}
                        onClick={() => onCambiar(pagina + 1)}
                    >
                        Siguiente
                    </button>
                </div>
                <form className="d-flex align-items-center gap-1" onSubmit={enviarSalto}>
                    <input
                        type="number"
                        className="form-control form-control-sm"
                        style={{ width: "70px" }}
                        min={1}
                        max={totalPaginas}
                        placeholder="Ir a..."
                        value={saltoInput}
                        onChange={(e) => setSaltoInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-sm btn-outline-secondary">
                        Ir
                    </button>
                </form>
            </div>
        </div>
    );
}
