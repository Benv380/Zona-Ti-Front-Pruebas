import { useState } from "react";
import { authFetch } from "../lib/api.js";
import DetalleItem from "./DetalleItem.jsx";
import Modal from "./Modal.jsx";
import { DocumentosRevision, ResumenCotizacion } from "./RevisionCotizacion.jsx";

const TIPO_ETIQUETA = { LICITACION: "Licitación", COMPRA_AGIL: "Compra Ágil" };

function endpointDetalle(tipo, codigo) {
    const base = tipo === "LICITACION" ? "/compra/licitacion" : "/compra/agil";
    return `${base}/${encodeURIComponent(codigo)}`;
}

function parsearCotizacion(cotizacionJson) {
    if (!cotizacionJson) return null;
    try {
        return JSON.parse(cotizacionJson);
    } catch {
        return null;
    }
}

// Fila compacta de la lista -- "Ver más" abre el modal con el detalle real
// (item + cotizacion + documentos), que es lo que hace falta para decidir
// si se aprueba o se devuelve.
function Fila({ a, mostrarEmpresa, onVerMas }) {
    return (
        <div className="card border" style={{ background: "var(--bg-elevated-2)", borderColor: "var(--border)" }}>
            <div className="card-body p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                    <div style={{ color: "var(--text-h)" }}>{a.username}{mostrarEmpresa && a.empresaNombre ? ` · ${a.empresaNombre}` : ""}</div>
                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                        {TIPO_ETIQUETA[a.tipo] || a.tipo} · {a.codigoExterno}
                    </div>
                </div>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onVerMas(a)}>Ver más</button>
            </div>
        </div>
    );
}

// Lista de asignaciones COMPLETADO con pendienteRevision en true -- a
// diferencia de mostrarlas en TablaAsignaciones (solo Usuario/Código/
// Estado, sin forma de ver nada mas), acá "Ver más" trae el detalle real
// de la licitacion/compra, la cotizacion guardada y los documentos
// subidos: eso es lo que un admin necesita para decidir si aprueba o
// devuelve a Desarrollo, no solo un botón "Aprobar" a ciegas.
export default function PendientesRevision({ pendientes, mostrarEmpresa = false, onAprobar, onDevolver }) {
    const [modalAsignacion, setModalAsignacion] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const [accionando, setAccionando] = useState(false);

    async function abrirModal(asignacion) {
        setModalAsignacion(asignacion);
        setDetalle(null);
        setError(null);
        setCargando(true);
        try {
            const res = await authFetch(endpointDetalle(asignacion.tipo, asignacion.codigoExterno), { timeoutMs: 25000 });
            const json = res.ok ? await res.json() : null;
            const item = asignacion.tipo === "LICITACION" ? json?.Listado?.[0] : json?.payload;
            setDetalle(item);
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    }

    function cerrarModal() {
        setModalAsignacion(null);
        setDetalle(null);
        setError(null);
    }

    async function aprobar() {
        setAccionando(true);
        try {
            await onAprobar(modalAsignacion);
            cerrarModal();
        } finally {
            setAccionando(false);
        }
    }

    async function devolver() {
        setAccionando(true);
        try {
            await onDevolver(modalAsignacion);
            cerrarModal();
        } finally {
            setAccionando(false);
        }
    }

    return (
        <>
            <div className="d-flex flex-column gap-2">
                {pendientes.map((a) => (
                    <Fila key={a.id} a={a} mostrarEmpresa={mostrarEmpresa} onVerMas={abrirModal} />
                ))}
            </div>

            <Modal
                show={!!modalAsignacion}
                onClose={cerrarModal}
                titulo={modalAsignacion ? `${TIPO_ETIQUETA[modalAsignacion.tipo] || modalAsignacion.tipo} ${modalAsignacion.codigoExterno} · ${modalAsignacion.username}` : ""}
            >
                {modalAsignacion && (
                    <>
                        <div className="d-flex flex-wrap gap-2 mb-3 pb-3 border-bottom">
                            <button type="button" className="btn btn-sm btn-success" disabled={accionando} onClick={aprobar}>
                                Aprobar
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-warning" disabled={accionando} onClick={devolver}>
                                Devolver a Desarrollo
                            </button>
                        </div>

                        {cargando && <p className="text-muted mb-0">Cargando...</p>}
                        {error && <div className="alert alert-danger">{error}</div>}
                        {detalle && <DetalleItem tipo={modalAsignacion.tipo} item={detalle} />}

                        <div className="mt-3 pt-3 border-top">
                            <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Cotización</p>
                            <ResumenCotizacion cotizacion={parsearCotizacion(modalAsignacion.cotizacionJson)} />
                        </div>

                        {modalAsignacion.detalleDesarrollo && (
                            <div className="mt-3 pt-3 border-top">
                                <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Detalle de desarrollo</p>
                                <p className="mb-0" style={{ fontSize: "0.85rem" }}>{modalAsignacion.detalleDesarrollo}</p>
                            </div>
                        )}

                        <div className="mt-3 pt-3 border-top">
                            <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Documentos adjuntos</p>
                            <DocumentosRevision asignacionId={modalAsignacion.id} />
                        </div>
                    </>
                )}
            </Modal>
        </>
    );
}
