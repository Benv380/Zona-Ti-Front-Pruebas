import { useEffect, useState } from "react";
import { authFetch } from "../lib/api.js";

// Selector del catalogo de productos de Mercado Publico (clasificacion ONU)
// para los filtros de la empresa (ver CatalogoService en compra-service).
// Pedido 2026-10-15: los filtros no pueden traer "falsos positivos" -- con
// el catalogo, una compra aparece solo si pide un producto de lo elegido
// (codigo exacto), sin interpretar palabras.
//
// "seleccion" es una lista de { nivel: "FAMILIA" | "CLASE" | "PRODUCTO",
// clave, nombre }: se puede elegir una familia completa (todas sus clases y
// productos), una clase, o productos puntuales.

const ETIQUETA_NIVEL = { FAMILIA: "Familia", CLASE: "Clase", PRODUCTO: "Producto" };
const COLOR_NIVEL = { FAMILIA: "bg-primary", CLASE: "bg-info text-dark", PRODUCTO: "bg-secondary" };
const MIN_CARACTERES = 3;

function Grupo({ titulo, items, nivel, detalle, seleccion, onAgregar }) {
    if (!items.length) return null;
    return (
        <div className="mb-2">
            <div className="text-muted mb-1" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>{titulo}</div>
            <ul className="list-group">
                {items.map((item) => {
                    const yaElegido = seleccion.some((s) => s.nivel === nivel && s.clave === item.clave);
                    return (
                        <li key={item.clave} className="list-group-item d-flex justify-content-between align-items-center gap-2 py-1"
                            style={{ background: "var(--bg-elevated-2)", fontSize: "0.85rem" }}>
                            <div style={{ minWidth: 0 }}>
                                <div>{item.nombre}</div>
                                <div className="text-muted" style={{ fontSize: "0.75rem" }}>{detalle(item)}</div>
                            </div>
                            <button type="button" className="btn btn-sm btn-outline-primary flex-shrink-0" disabled={yaElegido}
                                onClick={() => onAgregar({ nivel, clave: item.clave, nombre: item.nombre })}>
                                {yaElegido ? "Agregado" : "Agregar"}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default function SelectorCatalogo({ seleccion, onChange }) {
    const [texto, setTexto] = useState("");
    const [resultados, setResultados] = useState(null);
    const [buscando, setBuscando] = useState(false);
    const [error, setError] = useState(null);

    // Busca solo cuando se deja de escribir (350 ms) y con al menos 3 letras.
    useEffect(() => {
        const consulta = texto.trim();
        if (consulta.length < MIN_CARACTERES) {
            setResultados(null);
            return undefined;
        }
        let vigente = true;
        const temporizador = setTimeout(async () => {
            setBuscando(true);
            setError(null);
            try {
                const res = await authFetch(`/compra/catalogo/buscar?q=${encodeURIComponent(consulta)}`);
                if (!res.ok) throw new Error(`El servidor respondió con estado ${res.status}`);
                const datos = await res.json();
                if (vigente) setResultados(datos);
            } catch (err) {
                if (vigente) setError(err.message);
            } finally {
                if (vigente) setBuscando(false);
            }
        }, 350);
        return () => {
            vigente = false;
            clearTimeout(temporizador);
        };
    }, [texto]);

    function agregar(item) {
        onChange([...seleccion, item]);
    }

    function quitar(item) {
        onChange(seleccion.filter((s) => !(s.nivel === item.nivel && s.clave === item.clave)));
    }

    const sinResultados = resultados
        && !resultados.familias.length && !resultados.clases.length && !resultados.productos.length;

    return (
        <div>
            {seleccion.length > 0 ? (
                <div className="d-flex flex-wrap gap-1 mb-2">
                    {seleccion.map((s) => (
                        <span key={`${s.nivel}-${s.clave}`} className="badge rounded-pill d-inline-flex align-items-center gap-1"
                            style={{ background: "var(--bg-elevated-2)", color: "var(--text-h)", border: "1px solid var(--border)", fontWeight: 500 }}>
                            <span className={`badge ${COLOR_NIVEL[s.nivel]}`}>{ETIQUETA_NIVEL[s.nivel]}</span>
                            {s.nombre}
                            <button type="button" className="btn-close btn-close-sm ms-1" style={{ fontSize: "0.6rem" }}
                                aria-label={`Quitar ${s.nombre}`} onClick={() => quitar(s)} />
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-muted mb-2" style={{ fontSize: "0.8rem" }}>
                    Todavía no eligió productos del catálogo.
                </p>
            )}

            <input className="form-control form-control-sm" placeholder="Buscar en el catálogo (ej: notebook, tóner, cemento)"
                value={texto} onChange={(e) => setTexto(e.target.value)} />

            {buscando && <p className="text-muted mt-2 mb-0" style={{ fontSize: "0.8rem" }}>Buscando...</p>}
            {error && <div className="alert alert-danger mt-2 mb-0 py-1">{error}</div>}
            {sinResultados && !buscando && (
                <p className="text-muted mt-2 mb-0" style={{ fontSize: "0.8rem" }}>No se encontró nada con ese texto en el catálogo.</p>
            )}
            {resultados && !sinResultados && (
                <div className="mt-2" style={{ maxHeight: "320px", overflowY: "auto" }}>
                    <Grupo titulo="Familias (incluyen todas sus clases y productos)" items={resultados.familias} nivel="FAMILIA"
                        detalle={(f) => `${f.segmento} · ${f.productos} productos`} seleccion={seleccion} onAgregar={agregar} />
                    <Grupo titulo="Clases" items={resultados.clases} nivel="CLASE"
                        detalle={(c) => `${c.familia} · ${c.productos} productos`} seleccion={seleccion} onAgregar={agregar} />
                    <Grupo titulo="Productos" items={resultados.productos} nivel="PRODUCTO"
                        detalle={(p) => `Clase: ${p.clase}`} seleccion={seleccion} onAgregar={agregar} />
                </div>
            )}
        </div>
    );
}
