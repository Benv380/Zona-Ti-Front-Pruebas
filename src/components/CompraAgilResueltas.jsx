import { useEffect, useState } from "react";
import { authFetch, getClaims } from "../lib/api.js";
import { formatearMonto } from "./CotizacionCompraAgil.jsx";
import BadgeCierre from "./BadgeCierre.jsx";
import DetalleItem from "./DetalleItem.jsx";
import { FilePreviewPanel, descargarBlob, resolverPreview } from "./FilePreview";
import GenerarCotizacionBoton from "./GenerarCotizacionBoton.jsx";
import Modal from "./Modal.jsx";
import { DocumentosRevision } from "./RevisionCotizacion.jsx";

function endpointDetalle(codigo) {
    return `/compra/agil/${encodeURIComponent(codigo)}`;
}

function parsearCotizacion(cotizacionJson) {
    if (!cotizacionJson) return null;
    try {
        return JSON.parse(cotizacionJson);
    } catch {
        return null;
    }
}

// El proveedor marcado como ganador en el detalle de una compra agil (ver
// CompraAgilDto.ProveedorCotizando en el backend) -- puede no haber
// ninguno todavia si Mercado Publico no resolvio esta compra.
function ganadorDe(item) {
    const proveedores = item?.proveedores_cotizando || [];
    return proveedores.find((p) => p.proveedor_seleccionado === 1) || null;
}

// Compara RUTs sin importar puntos/guion/mayuscula ("76.123.456-7" ==
// "76123456-7" == "76123456-K"/"76123456-k").
function normalizarRut(rut) {
    return (rut || "").replace(/[.\-\s]/g, "").toUpperCase();
}

// Resultado de un vistazo: "Ganamos"/"No ganamos" (comparando el RUT del
// ganador contra el de la propia empresa) si ya hay ganador, "Sin
// resolver" si Mercado Publico todavia no decide.
function BadgeResultado({ ganador, rutPropio }) {
    if (!ganador) {
        return <span className="badge badge-cierre-lejana">Sin resolver</span>;
    }
    const ganamos = rutPropio && normalizarRut(ganador.rut_proveedor) === normalizarRut(rutPropio);
    return ganamos
        ? <span className="badge" style={{ background: "var(--success)", color: "#fff" }}><i className="bi bi-trophy-fill me-1" />Ganamos</span>
        : <span className="badge badge-cierre-vencida">No ganamos</span>;
}

// "Llegar y tomar la info": compras agiles que el equipo ya dio por
// terminadas (asignacion en COMPLETADO), en el mismo formato de tarjeta
// que "Mis activas"/"Listas" (ver Fila en MisActivas.jsx) -- estado, badge
// de cierre, y ahora ademas si ya se resolvio y si la ganamos o no. "Ver
// más" abre la cotizacion (boton para generar el PDF, listo para subir a
// Mercado Público) y los documentos subidos, para no tener que ir a
// buscarlos a otro lado.
export default function CompraAgilResueltas({ completadas }) {
    const empresaId = getClaims()?.empresaId;
    const [rutPropio, setRutPropio] = useState(null);
    const [detalles, setDetalles] = useState({}); // { [asignacionId]: item o null si fallo }
    const [modalAsignacion, setModalAsignacion] = useState(null);
    const [preview, setPreview] = useState(null);

    // Rut propio, una sola vez -- se usa para decidir "Ganamos"/"No
    // ganamos" en cada tarjeta (ver BadgeResultado). Mismo endpoint que ya
    // usa GenerarCotizacionBoton para el membrete del PDF.
    useEffect(() => {
        if (!empresaId) return;
        authFetch(`/auth/empresas/${empresaId}/marca-cotizacion`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setRutPropio(data?.rut || null))
            .catch(() => {});
    }, [empresaId]);

    useEffect(() => {
        const CONCURRENCIA = 3;
        const pendientes = completadas.filter((a) => detalles[a.id] === undefined);
        if (pendientes.length === 0) return;

        let cancelado = false;
        const cola = [...pendientes];

        async function trabajador() {
            while (!cancelado && cola.length > 0) {
                const a = cola.shift();
                try {
                    const res = await authFetch(endpointDetalle(a.codigoExterno));
                    const json = res.ok ? await res.json() : null;
                    if (!cancelado) {
                        setDetalles((prev) => ({ ...prev, [a.id]: json?.payload || null }));
                    }
                } catch {
                    if (!cancelado) {
                        setDetalles((prev) => ({ ...prev, [a.id]: null }));
                    }
                }
            }
        }

        const trabajadores = Array.from({ length: Math.min(CONCURRENCIA, pendientes.length) }, trabajador);
        Promise.all(trabajadores);

        return () => {
            cancelado = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [completadas]);

    function cerrarModal() {
        setModalAsignacion(null);
        setPreview(null);
    }

    if (completadas.length === 0) return null;

    const detalleModal = modalAsignacion ? detalles[modalAsignacion.id] : null;

    return (
        <div className="mb-4">
            <h5 className="mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-trophy-fill" style={{ color: "var(--success)" }}></i>
                Compras Ágiles listas
            </h5>
            <div className="row g-3">
                {completadas.map((a) => {
                    const item = detalles[a.id];
                    const ganador = item ? ganadorDe(item) : null;
                    const fechaCierre = item?.fechas?.fecha_cierre;

                    return (
                        <div className="col-md-6" key={a.id}>
                            <div className="card border" style={{ background: "var(--bg-elevated-2)", borderColor: "var(--border)" }}>
                                <div className="card-body p-3">
                                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                                        <div>
                                            <div className="d-flex flex-wrap gap-1">
                                                <span className="badge badge-rol-usuario">Completado</span>
                                                <BadgeCierre fecha={fechaCierre} />
                                                {item !== undefined && <BadgeResultado ganador={ganador} rutPropio={rutPropio} />}
                                            </div>
                                            <div className="mt-1" style={{ color: "var(--text-h)" }}>{item?.nombre || a.codigoExterno}</div>
                                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>{a.codigoExterno}</div>
                                            {ganador && (
                                                <div className="text-muted mt-1" style={{ fontSize: "0.78rem" }}>
                                                    Ganador: {ganador.razon_social} — {formatearMonto(ganador.monto_total, item?.presupuesto?.moneda || "CLP")}
                                                </div>
                                            )}
                                        </div>
                                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setModalAsignacion(a)}>
                                            Ver más
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <Modal
                show={!!modalAsignacion}
                onClose={cerrarModal}
                titulo={modalAsignacion ? `Compra Ágil ${modalAsignacion.codigoExterno}` : ""}
            >
                {modalAsignacion && (
                    <>
                        {detalleModal && <DetalleItem tipo="COMPRA_AGIL" item={detalleModal} />}

                        {(() => {
                            const ganador = detalleModal ? ganadorDe(detalleModal) : null;
                            return (
                                <div className="mt-3 pt-3 border-top d-flex align-items-center gap-2">
                                    <BadgeResultado ganador={ganador} rutPropio={rutPropio} />
                                    {ganador && (
                                        <span style={{ fontSize: "0.85rem" }}>
                                            {ganador.razon_social} — {formatearMonto(ganador.monto_total, detalleModal?.presupuesto?.moneda || "CLP")}
                                        </span>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="mt-3 pt-3 border-top">
                            <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Cotización (para subir a Mercado Público)</p>
                            <GenerarCotizacionBoton
                                codigoExterno={modalAsignacion.codigoExterno}
                                cotizacion={parsearCotizacion(modalAsignacion.cotizacionJson)}
                                institucion={detalleModal?.institucion}
                                onGenerado={(blob, nombre) => {
                                    const resultado = resolverPreview(blob, nombre);
                                    if (resultado) {
                                        setPreview(resultado);
                                    } else {
                                        descargarBlob(blob, nombre);
                                    }
                                }}
                            />
                            <FilePreviewPanel preview={preview} onClose={() => setPreview(null)} />
                        </div>

                        <div className="mt-3 pt-3 border-top">
                            <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Documentos subidos</p>
                            <DocumentosRevision asignacionId={modalAsignacion.id} />
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
}
