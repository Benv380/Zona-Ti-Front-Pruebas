import { useState } from "react";

const LIMITE = 255;

// Espacio de trabajo de la fase DESARROLLO -- por ahora solo este campo
// de texto libre (mismo campo/limite que la pantalla real de Mercado
// Publico), independiente de la cotizacion de ANALISIS. Mismo patron de
// "Guardar" + feedback que CotizacionCompraAgil.jsx.
export default function DetalleDesarrollo({ valorInicial, onGuardar }) {
    const [texto, setTexto] = useState(valorInicial || "");
    const [guardando, setGuardando] = useState(false);
    const [guardadoOk, setGuardadoOk] = useState(false);
    const [error, setError] = useState(null);

    async function guardar() {
        setGuardando(true);
        setError(null);
        try {
            await onGuardar(texto);
            setGuardadoOk(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="mt-3 pt-3 border-top">
            <h6 className="mb-3">Detalle de la cotización</h6>
            <div className="row g-3 align-items-start">
                <div className="col-md-4">
                    <div className="fw-semibold" style={{ color: "var(--text-h)" }}>Detalle de la cotización</div>
                    <p className="text-muted mb-0" style={{ fontSize: "0.8rem" }}>
                        Ingresa información breve que describa y complemente tu cotización.
                    </p>
                </div>
                <div className="col-md-8">
                    <textarea
                        className="form-control form-control-sm"
                        rows={4}
                        maxLength={LIMITE}
                        value={texto}
                        onChange={(e) => {
                            setGuardadoOk(false);
                            setTexto(e.target.value);
                        }}
                    />
                    <div className="text-end text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                        {texto.length}/{LIMITE}
                    </div>
                </div>
            </div>

            <div className="d-flex align-items-center gap-2 mt-2">
                <button type="button" className="btn btn-sm btn-primary" onClick={guardar} disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar detalle"}
                </button>
                {guardadoOk && <span className="text-success" style={{ fontSize: "0.85rem" }}>Guardado.</span>}
                {error && <span className="text-danger" style={{ fontSize: "0.85rem" }}>{error}</span>}
            </div>
        </div>
    );
}
