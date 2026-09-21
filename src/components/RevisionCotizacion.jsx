import { useEffect, useState } from "react";
import { authFetch } from "../lib/api.js";
import { formatearMonto } from "./CotizacionCompraAgil.jsx";

// Compartido entre PendientesRevision.jsx (Mi Empresa/Administracion) y
// MisActivas.jsx (Home, cuando la fila es "ajena" -- de otro usuario, ahi
// para que un admin la revise) -- mismo contenido, 2 lugares distintos
// donde se puede abrir el detalle de una asignacion pendiente de revision.

// Resumen de solo lectura de la cotizacion ya guardada (ver
// CotizacionCompraAgil.jsx, que arma este mismo objeto al guardar) -- a
// diferencia de ese componente, acá no se edita nada, es lo que el admin
// necesita ver para decidir si aprueba o devuelve a Desarrollo.
export function ResumenCotizacion({ cotizacion }) {
    if (!cotizacion) {
        return <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>Todavía no hay una cotización guardada.</p>;
    }
    const moneda = cotizacion.moneda || "CLP";
    const formaEnvioTexto = Array.isArray(cotizacion.formaEnvio) ? (cotizacion.formaEnvio[0] || "—") : (cotizacion.formaEnvio || "—");
    return (
        <div>
            {(cotizacion.lineas || []).map((l, i) => (
                <div key={i} className="card border mb-2" style={{ background: "var(--bg-elevated-2)", borderColor: "var(--border)" }}>
                    <div className="card-body p-2">
                        <div className="d-flex flex-wrap justify-content-between gap-2" style={{ fontSize: "0.85rem" }}>
                            <span style={{ color: "var(--text-h)" }}>{l.nombre}</span>
                            <span className="text-muted text-nowrap">{l.cantidad} {l.unidadMedida}</span>
                        </div>
                        <div className="d-flex flex-wrap justify-content-between gap-2 mt-1" style={{ fontSize: "0.8rem" }}>
                            <span className="text-muted">Valor unitario: {formatearMonto(l.valorUnitario, moneda)}</span>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>Subtotal: {formatearMonto(l.subtotal, moneda)}</span>
                        </div>
                        {l.detalleDescripcion && (
                            <div className="text-muted mt-1" style={{ fontSize: "0.78rem" }}>{l.detalleDescripcion}</div>
                        )}
                    </div>
                </div>
            ))}

            <div className="p-2 mb-3" style={{ background: "var(--bg-elevated-2)", borderRadius: "8px", fontSize: "0.85rem" }}>
                <div className="d-flex justify-content-between"><span className="text-muted">Neto</span><span>{formatearMonto(cotizacion.valorNeto, moneda)}</span></div>
                <div className="d-flex justify-content-between"><span className="text-muted">Exento</span><span>{formatearMonto(cotizacion.montoExento, moneda)}</span></div>
                <div className="d-flex justify-content-between"><span className="text-muted">IVA</span><span>{formatearMonto(cotizacion.montoIva, moneda)}</span></div>
                <div className="d-flex justify-content-between fw-semibold"><span>Total</span><span>{formatearMonto(cotizacion.montoTotal, moneda)}</span></div>
            </div>

            <div className="row g-2 mb-2" style={{ fontSize: "0.8rem" }}>
                <div className="col-6 col-md-4"><span className="text-muted">Moneda: </span>{moneda}</div>
                <div className="col-6 col-md-4"><span className="text-muted">Tiempo envío: </span>{cotizacion.tiempoEnvio ? `${cotizacion.tiempoEnvio} días` : "—"}</div>
                <div className="col-6 col-md-4"><span className="text-muted">Forma envío: </span>{formaEnvioTexto}</div>
                <div className="col-6 col-md-4"><span className="text-muted">Plazo crédito: </span>{cotizacion.plazoCredito === "0" ? "Sin crédito" : (cotizacion.plazoCredito ? `${cotizacion.plazoCredito} días` : "—")}</div>
                <div className="col-6 col-md-4"><span className="text-muted">Validez: </span>{cotizacion.validez ? `${cotizacion.validez} días` : "—"}</div>
                {cotizacion.tipoCambio && <div className="col-6 col-md-4"><span className="text-muted">Tipo de cambio: </span>{cotizacion.tipoCambio}</div>}
                {cotizacion.telefonoContacto && <div className="col-6 col-md-4"><span className="text-muted">Teléfono: </span>{cotizacion.telefonoContacto}</div>}
            </div>

            {cotizacion.notaAnalisis && (
                <div className="mb-0" style={{ fontSize: "0.8rem" }}>
                    <span className="text-muted">Nota: </span>{cotizacion.notaAnalisis}
                </div>
            )}
        </div>
    );
}

// Documentos subidos a mano en la fase ANALISIS (ver
// AsignacionDocumentoController) -- misma idea que el listado de
// CotizacionCompraAgil.jsx, pero de solo lectura (sin subir/eliminar).
export function DocumentosRevision({ asignacionId }) {
    const [documentos, setDocumentos] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        setDocumentos(null);
        setError(null);
        authFetch(`/auth/asignaciones/${asignacionId}/documentos`)
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then(setDocumentos)
            .catch(() => setError("No se pudo cargar la lista de documentos"));
    }, [asignacionId]);

    async function descargar(documento) {
        try {
            const res = await authFetch(`/auth/documentos/${documento.id}`);
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const enlace = window.document.createElement("a");
            enlace.href = url;
            enlace.download = documento.nombreArchivo;
            enlace.click();
            URL.revokeObjectURL(url);
        } catch {
            setError("No se pudo descargar el archivo");
        }
    }

    if (error) return <p className="text-danger mb-0" style={{ fontSize: "0.8rem" }}>{error}</p>;
    if (documentos === null) return <p className="text-muted mb-0" style={{ fontSize: "0.8rem" }}>Cargando...</p>;
    if (documentos.length === 0) return <p className="text-muted mb-0" style={{ fontSize: "0.8rem" }}>Sin documentos subidos.</p>;

    return (
        <div className="d-flex flex-wrap gap-2">
            {documentos.map((d) => (
                <button key={d.id} type="button" className="btn btn-outline-secondary btn-sm" onClick={() => descargar(d)}>
                    <i className="bi bi-file-earmark-arrow-down me-1" />{d.nombreArchivo}
                </button>
            ))}
        </div>
    );
}
