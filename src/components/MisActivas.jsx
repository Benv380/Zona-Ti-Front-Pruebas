import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api.js";
import { fechaCierreDe } from "../lib/fechas.js";
import BadgeCierre from "./BadgeCierre.jsx";
import CotizacionCompraAgil from "./CotizacionCompraAgil.jsx";
import DetalleDesarrollo from "./DetalleDesarrollo.jsx";
import DetalleItem from "./DetalleItem.jsx";
import { FilePreviewPanel, descargarBlob, resolverPreview } from "./FilePreview";
import GenerarCotizacionBoton from "./GenerarCotizacionBoton.jsx";
import Modal from "./Modal.jsx";
import RecomendarBoton from "./RecomendarBoton.jsx";
import { DocumentosRevision, ResumenCotizacion } from "./RevisionCotizacion.jsx";

const ESTADOS = [
    { valor: "ASIGNADO", etiqueta: "Asignado" },
    { valor: "ANALISIS", etiqueta: "Análisis" },
    { valor: "DESARROLLO", etiqueta: "Desarrollo" },
    { valor: "COMPLETADO", etiqueta: "Completado" },
    { valor: "DESCARTADO", etiqueta: "Descartado" },
];

// "Mis activas" (arriba) muestra lo que todavia se esta trabajando --
// Desarrollo ya no entra ahi, se saca a "Listas" (abajo) para no mostrar
// el mismo item en los 2 lugares.
const EN_CURSO = ["ASIGNADO", "ANALISIS"];
// Usado solo para decidir a quienes hay que precargarles el detalle
// (fecha de cierre) -- cubre "Mis activas" y "Listas". Las COMPLETADO con
// pendienteRevision en true tambien necesitan el detalle: siguen
// apareciendo en "Listas" (ver esaEnListas mas abajo) hasta que un admin
// las revise.
const ACTIVOS = ["ASIGNADO", "ANALISIS", "DESARROLLO"];
function necesitaDetalle(a) {
    return ACTIVOS.includes(a.estado) || a.pendienteRevision;
}

// DESARROLLO, o COMPLETADO todavia esperando que un admin la revise (ver
// Asignacion.pendienteRevision) -- este segundo caso solo se da cuando el
// propio usuario (marcado con "requiere supervisión", algo que el nunca
// ve directamente) completo su propio trabajo: en vez de desaparecer de
// su vista apenas la termina, se queda en "Listas" un poco mas, IGUAL que
// cualquier otra Completado -- sin ningun distintivo (ni texto ni icono)
// que delate que esta esperando la revision de otra persona.
function esaEnListas(a) {
    return a.estado === "DESARROLLO" || (a.estado === "COMPLETADO" && a.pendienteRevision);
}

const TIPO_ETIQUETA = { LICITACION: "Licitación", COMPRA_AGIL: "Compra Ágil" };

// El backend guarda la cotizacion como texto plano (JSON opaco para
// auth-service, ver Asignacion.cotizacionJson) -- null mientras no se
// haya guardado nada, o si el texto quedo corrupto por algun motivo no
// se rompe el modal, solo arranca de cero.
function parsearCotizacion(cotizacionJson) {
    if (!cotizacionJson) return null;
    try {
        return JSON.parse(cotizacionJson);
    } catch {
        return null;
    }
}

function endpointsPorTipo(tipo, codigo) {
    const base = tipo === "LICITACION" ? "/compra/licitacion" : "/compra/agil";
    return {
        detalle: `${base}/${encodeURIComponent(codigo)}`,
        adjuntos: `${base}/${encodeURIComponent(codigo)}/adjuntos`,
        adjuntoBase: `${base}/adjuntos`,
    };
}

// Una fila (una asignacion), reusada tal cual en la columna de compras y
// en la de licitaciones -- se define AFUERA de MisActivas (no como
// funcion anidada) para que React no la desmonte/remonte entera en cada
// cambio de estado del padre, solo porque la referencia de la funcion
// cambiaria en cada render. "Ver más" ya no expande la misma fila -- abre
// el detalle en una ventana modal (mismo componente que usan Consulta
// Licitación/Compra Ágil), ver "abrirModal" en MisActivas.
function Fila({ a, onVerMas }) {
    return (
        <div className="card border" style={{
            background: "var(--bg-elevated-2)",
            // "esAjena" = no es mia, la trae un admin para revisar (ver
            // Home.jsx) -- borde izquierdo de color + badge "Por revisar"
            // para que se note a simple vista entre el resto de "Listas",
            // que siempre es trabajo propio.
            borderColor: a.esAjena ? "var(--warning)" : "var(--border)",
            borderLeftWidth: a.esAjena ? 3 : 1,
        }}>
            <div className="card-body p-3">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                    <div>
                        <div className="d-flex flex-wrap gap-1">
                            <span className="badge badge-rol-usuario">{ESTADOS.find((es) => es.valor === a.estado)?.etiqueta || a.estado}</span>
                            <BadgeCierre fecha={a.fechaCierreDetectada} />
                            {a.esAjena && (
                                <span className="badge" style={{ background: "var(--warning)", color: "#000" }}>
                                    <i className="bi bi-eye-fill me-1" />Por revisar
                                </span>
                            )}
                        </div>
                        <div className="mt-1" style={{ color: "var(--text-h)" }}>{a.codigoExterno}</div>
                        {/* "esAjena": con varios usuarios marcados a la vez, el
                            nombre tiene que notarse de entrada, no quedar como
                            letra chica -- mismo tamaño/color que el código, no
                            texto muted como el resto de las leyendas de acá. */}
                        {a.esAjena ? (
                            <div className="d-flex align-items-center gap-1" style={{ color: "var(--text-h)", fontWeight: 600 }}>
                                <i className="bi bi-person-fill" />{a.username}
                            </div>
                        ) : a.recomendadoPorUsername && (
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>Recomendado por {a.recomendadoPorUsername}</div>
                        )}
                    </div>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onVerMas(a)}>
                        Ver más
                    </button>
                </div>
            </div>
        </div>
    );
}

// Una columna (Compras Ágiles o Licitaciones): encabezado con icono,
// titulo y contador, mas la lista de filas o el estado vacio. Tambien
// afuera de MisActivas por el mismo motivo que Fila.
function Columna({ icono, color, titulo, lista, onVerMas }) {
    return (
        <div className="card-panel h-100">
            <div className="d-flex align-items-center gap-2 mb-3">
                <span
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 32, height: 32, borderRadius: 8, background: `${color}22`, color }}
                >
                    <i className={`bi ${icono}`}></i>
                </span>
                <h6 className="mb-0 flex-grow-1">{titulo}</h6>
                <span className="badge badge-rol-usuario">{lista.length}</span>
            </div>
            {lista.length === 0 ? (
                <div className="estado-vacio">
                    <i className="bi bi-inbox"></i>
                    <span>Nada por acá.</span>
                </div>
            ) : (
                <div className="mis-activas-lista d-flex flex-column gap-2">
                    {lista.map((a) => (
                        <Fila key={a.id} a={a} onVerMas={onVerMas} />
                    ))}
                </div>
            )}
        </div>
    );
}

// Dashboard personal: lo que tengo asignado/recomendado (mío o de otro
// para mí), en 2 bloques -- "Mis activas" (Asignado/Análisis, lo que
// todavía se está trabajando) y "Listas" (Desarrollo, ya con su
// cotización si es Compra Ágil, esperando alguna acción) -- cada uno
// separado en 2 columnas (Compras Ágiles / Licitaciones). Un item vive en
// un solo bloque a la vez, nunca en los 2. "Ver más" abre el detalle en
// la misma ventana modal que usan Consulta Licitación/Compra Ágil
// (detalle completo + archivos + acciones), en vez de expandir la fila.
// Se muestra en Home.jsx para cualquier rol que tenga algo -- queda vacío
// (no se renderiza nada) si no hay ninguna asignación en absoluto (salvo
// que "extras" traiga algo, ver mas abajo).
//
// "extras": para un admin, las asignaciones de OTRA gente que estan
// pendientes de revision (ver Home.jsx) -- se mezclan directo adentro de
// "Listas", junto con las propias en Desarrollo, en vez de vivir en una
// caja aparte. Se marcan con "esAjena" para que el modal sepa mostrar el
// detalle de revision (cotizacion + documentos + Aprobar/Devolver) en vez
// del formulario de edicion propio.
export default function MisActivas({ extras = [], onAprobarExtra, onDevolverExtra }) {
    const [asignaciones, setAsignaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [verTodas, setVerTodas] = useState(false);
    const [accionandoExtra, setAccionandoExtra] = useState(false);

    const extrasMarcadas = useMemo(() => extras.map((e) => ({ ...e, esAjena: true })), [extras]);

    const [detalles, setDetalles] = useState({}); // { [asignacionId]: { item, archivos, cargando, error } }

    // Asignacion actualmente abierta en el modal (null = cerrado). Solo
    // puede haber una a la vez, así que "preview" no necesita distinguir
    // de cuál fila viene (a diferencia de antes, cuando varias filas
    // podían estar expandidas juntas).
    const [modalAsignacion, setModalAsignacion] = useState(null);
    const [preview, setPreview] = useState(null);
    const [cargandoArchivo, setCargandoArchivo] = useState(null);

    async function cargarAsignaciones() {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`/auth/me/asignaciones/detalle`);
            if (!res.ok) throw new Error(`El servidor respondió con estado ${res.status}`);
            const datos = await res.json();
            setAsignaciones(datos);
            return datos;
        } catch (err) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargarAsignaciones();
    }, []);

    useEffect(() => {
        return () => {
            if (preview?.url) URL.revokeObjectURL(preview.url);
        };
    }, [preview]);

    // Pide el detalle (sin archivos, eso solo hace falta al abrir el
    // modal) de cada activa apenas se cargan -- es lo unico que trae la
    // fecha de cierre, y sin eso no se puede priorizar "la que cierra
    // primero arriba" (ver ordenarPorCierre mas abajo). Se cachea en el
    // mismo "detalles" que usa abrirModal, asi no se pide 2 veces.
    //
    // OJO con el paralelismo: esto puede ser bastante mas de un puñado de
    // pedidos a la vez (una por cada activa), y el navegador limita las
    // conexiones simultaneas por origen -- sin tope, este barrido de
    // fondo se queda con todas esas conexiones y una peticion explicita
    // del usuario (ej. apretar "Ver mas") queda haciendo cola detras de
    // el en vez de salir al toque. CONCURRENCIA acota cuantas corren en
    // paralelo, dejando conexiones libres para lo que el usuario pida en
    // el momento.
    useEffect(() => {
        const CONCURRENCIA = 3;
        // Incluye "extrasMarcadas" -- tambien necesitan la fecha de cierre
        // para el badge, igual que cualquier otra fila de "Listas".
        const pendientes = [...asignaciones, ...extrasMarcadas].filter(
            (a) => necesitaDetalle(a) && detalles[a.id]?.item === undefined
        );
        if (pendientes.length === 0) return;

        let cancelado = false;
        const cola = [...pendientes];

        async function trabajador() {
            while (!cancelado && cola.length > 0) {
                const a = cola.shift();
                const { detalle } = endpointsPorTipo(a.tipo, a.codigoExterno);
                try {
                    const r = await authFetch(detalle);
                    const json = r.ok ? await r.json() : null;
                    const item = a.tipo === "LICITACION" ? json?.Listado?.[0] : json?.payload;
                    if (!cancelado) {
                        setDetalles((prev) => ({ ...prev, [a.id]: { ...(prev[a.id] || {}), item } }));
                    }
                } catch {
                    // Si esta puntual falla/da timeout, se queda sin fecha
                    // de cierre (el badge simplemente no aparece) -- no
                    // hace falta reintentar ni cortar el resto de la cola.
                }
            }
        }

        const trabajadores = Array.from({ length: Math.min(CONCURRENCIA, pendientes.length) }, trabajador);
        Promise.all(trabajadores);

        return () => {
            cancelado = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asignaciones, extrasMarcadas]);

    // Se dispara al hacer click en "Ver más" -- pide detalle completo +
    // archivos (o los reusa si ya estaban cacheados por el useEffect de
    // arriba) y abre el modal.
    async function abrirModal(asignacion) {
        setModalAsignacion(asignacion);
        setPreview(null);

        const cacheado = detalles[asignacion.id];
        if (cacheado?.archivos) return; // ya tiene item Y archivos, no hace falta pedir de nuevo

        setDetalles((prev) => ({ ...prev, [asignacion.id]: { ...(prev[asignacion.id] || {}), cargando: true } }));
        const { detalle, adjuntos } = endpointsPorTipo(asignacion.tipo, asignacion.codigoExterno);
        try {
            const [item, archivos] = await Promise.all([
                cacheado?.item
                    ? Promise.resolve(cacheado.item)
                    // timeoutMs mas generoso -- si no esta cacheado con el
                    // detalle completo, el backend le pega en vivo a la API
                    // externa antes de responder (ver mismo timeout en
                    // CompraRapida.jsx/Licitacion.jsx).
                    : authFetch(detalle, { timeoutMs: 25000 }).then((r) => (r.ok ? r.json() : null)).then((json) =>
                        asignacion.tipo === "LICITACION" ? json?.Listado?.[0] : json?.payload),
                authFetch(adjuntos).then((r) => (r.ok ? r.json() : null)).then((json) => json?.payload?.files || []),
            ]);
            setDetalles((prev) => ({ ...prev, [asignacion.id]: { cargando: false, item, archivos } }));
        } catch (err) {
            setDetalles((prev) => ({ ...prev, [asignacion.id]: { cargando: false, error: err.message } }));
        }
    }

    function cerrarModal() {
        setModalAsignacion(null);
        setPreview(null);
    }

    async function verArchivo(asignacion, archivo) {
        const { adjuntoBase } = endpointsPorTipo(asignacion.tipo, asignacion.codigoExterno);
        setCargandoArchivo(archivo.id);
        try {
            const res = await authFetch(`${adjuntoBase}/${archivo.id}`);
            if (!res.ok) throw new Error("No se pudo obtener el archivo");
            const blob = await res.blob();
            const resultado = resolverPreview(blob, archivo.nombreArchivo);
            if (resultado) {
                setPreview(resultado);
            } else {
                descargarBlob(blob, archivo.nombreArchivo);
                setPreview(null);
            }
        } catch (err) {
            setError(`Error al abrir "${archivo.nombreArchivo}": ${err.message}`);
        } finally {
            setCargandoArchivo(null);
        }
    }

    async function cambiarEstado(asignacion, nuevoEstado, motivoDescarte) {
        try {
            const res = await authFetch(`/auth/asignaciones/${asignacion.id}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevoEstado, motivoDescarte }),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            // El PATCH ya devuelve la fila completa y actualizada -- no
            // hace falta pedir TODA la lista de nuevo (eso era un segundo
            // viaje de ida y vuelta al servidor, y de paso disparaba el
            // "Cargando..." de toda la pantalla por el vuelto de
            // cargarAsignaciones). Se actualiza solo esa fila, tanto en la
            // lista como en el modal si sigue abierto con la misma.
            const actualizada = await res.json();
            setAsignaciones((prev) => prev.map((x) => (x.id === actualizada.id ? actualizada : x)));
            if (modalAsignacion?.id === actualizada.id) {
                setModalAsignacion(actualizada);
            }
        } catch (err) {
            setError(err.message);
        }
    }

    function cancelar(asignacion) {
        const motivo = window.prompt("¿Por qué se cancela? (obligatorio)");
        if (!motivo || !motivo.trim()) return;
        cambiarEstado(asignacion, "DESCARTADO", motivo);
    }

    // Guarda el borrador de cotizacion (ver CotizacionCompraAgil.jsx) --
    // el objeto ya viene calculado del componente, aca solo se
    // serializa y se persiste. Al volver, se actualiza tanto la lista
    // completa como el modal abierto para que quede reflejado sin tener
    // que cerrar y volver a abrir.
    async function guardarCotizacion(asignacion, cotizacionObjeto) {
        const res = await authFetch(`/auth/asignaciones/${asignacion.id}/cotizacion`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cotizacionJson: JSON.stringify(cotizacionObjeto) }),
        });
        if (!res.ok) {
            const texto = await res.text().catch(() => "");
            throw new Error(texto || `El servidor respondió con estado ${res.status}`);
        }
        const actualizada = await res.json();
        setAsignaciones((prev) => prev.map((x) => (x.id === actualizada.id ? actualizada : x)));
        if (modalAsignacion?.id === actualizada.id) {
            setModalAsignacion(actualizada);
        }
    }

    // Guarda el detalle de texto libre de la fase DESARROLLO (ver
    // DetalleDesarrollo.jsx) -- mismo patron que guardarCotizacion, pero
    // el valor ya es el texto tal cual (no hace falta JSON.stringify).
    async function guardarDetalleDesarrollo(asignacion, texto) {
        const res = await authFetch(`/auth/asignaciones/${asignacion.id}/detalle-desarrollo`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ detalleDesarrollo: texto }),
        });
        if (!res.ok) {
            const mensaje = await res.text().catch(() => "");
            throw new Error(mensaje || `El servidor respondió con estado ${res.status}`);
        }
        const actualizada = await res.json();
        setAsignaciones((prev) => prev.map((x) => (x.id === actualizada.id ? actualizada : x)));
        if (modalAsignacion?.id === actualizada.id) {
            setModalAsignacion(actualizada);
        }
    }

    // Las que cierran antes van arriba -- las que todavia no tienen el
    // detalle cargado (o no traen fecha de cierre) quedan al final, no
    // arriba, para no desordenar todo mientras se van cargando.
    function ordenarPorCierre(lista) {
        return [...lista].sort((a, b) => {
            const fechaA = fechaCierreDe(a.tipo, detalles[a.id]?.item);
            const fechaB = fechaCierreDe(b.tipo, detalles[b.id]?.item);
            if (!fechaA && !fechaB) return 0;
            if (!fechaA) return 1;
            if (!fechaB) return -1;
            return new Date(fechaA) - new Date(fechaB);
        });
    }

    // Separadas en 2 columnas (compras/licitaciones) en vez de una sola
    // lista mezclada -- cada una ordenada por cierre de forma independiente.
    // Se le pega la fecha de cierre ya resuelta a cada asignacion
    // (fechaCierreDetectada) para que Fila la use directo en el badge sin
    // tener que recibir "detalles" completo como prop.
    //
    // Lo que vive en "Listas" (Desarrollo, o Completado pendiente de
    // revisión) se excluye siempre de acá (incluso con "Ver todas") -- un
    // item vive en un solo bloque a la vez, nunca en los 2.
    const base = (verTodas ? asignaciones : asignaciones.filter((a) => EN_CURSO.includes(a.estado)))
        .filter((a) => !esaEnListas(a));
    const visiblesCompra = useMemo(
        () => ordenarPorCierre(base.filter((a) => a.tipo === "COMPRA_AGIL")).map((a) => ({ ...a, fechaCierreDetectada: fechaCierreDe(a.tipo, detalles[a.id]?.item) })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [asignaciones, verTodas, detalles]
    );
    const visiblesLicitacion = useMemo(
        () => ordenarPorCierre(base.filter((a) => a.tipo === "LICITACION")).map((a) => ({ ...a, fechaCierreDetectada: fechaCierreDe(a.tipo, detalles[a.id]?.item) })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [asignaciones, verTodas, detalles]
    );

    // "Listas" -- ya pasaron por Analisis (con su cotizacion, si es Compra
    // Agil) y estan en Desarrollo, esperando alguna accion; o ya las
    // completo un usuario marcado y estan esperando que un admin las
    // revise (ver esaEnListas). Fijo por estado, no se ve afectado por
    // "Ver todas" (eso es para historial de completadas/descartadas, no
    // aplica al concepto de "listas"). "extrasMarcadas" (ajenas, de otra
    // gente, para que un admin las revise) se suman directo acá -- viven
    // en el mismo bloque que las propias en Desarrollo, no en uno aparte.
    const listas = [...asignaciones.filter(esaEnListas), ...extrasMarcadas];
    const listasCompra = useMemo(
        () => ordenarPorCierre(listas.filter((a) => a.tipo === "COMPRA_AGIL")).map((a) => ({ ...a, fechaCierreDetectada: fechaCierreDe(a.tipo, detalles[a.id]?.item) })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [asignaciones, extrasMarcadas, detalles]
    );
    const listasLicitacion = useMemo(
        () => ordenarPorCierre(listas.filter((a) => a.tipo === "LICITACION")).map((a) => ({ ...a, fechaCierreDetectada: fechaCierreDe(a.tipo, detalles[a.id]?.item) })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [asignaciones, extrasMarcadas, detalles]
    );

    if (!loading && asignaciones.length === 0 && extrasMarcadas.length === 0) {
        return null;
    }

    const detalleModal = modalAsignacion ? detalles[modalAsignacion.id] : null;

    return (
        <div className="mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-clipboard-check-fill" style={{ color: "var(--accent)" }}></i>
                    Mis activas
                </h5>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setVerTodas((v) => !v)}>
                    {verTodas ? "Ver solo activas" : "Ver todas (incluye completadas/descartadas)"}
                </button>
            </div>

            {loading && <p className="text-muted mb-0">Cargando...</p>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && (
                <div className="row g-3">
                    <div className="col-md-6">
                        <Columna icono="bi-cart-fill" color="var(--accent-2)" titulo="Compras Ágiles" lista={visiblesCompra} onVerMas={abrirModal} />
                    </div>
                    <div className="col-md-6">
                        <Columna icono="bi-file-earmark-text-fill" color="var(--accent)" titulo="Licitaciones" lista={visiblesLicitacion} onVerMas={abrirModal} />
                    </div>
                </div>
            )}

            {!loading && (
                <div className="mt-4">
                    <h5 className="mb-3 d-flex align-items-center gap-2">
                        <i className="bi bi-hourglass-split" style={{ color: "var(--warning)" }}></i>
                        Listas — esperando acción
                    </h5>
                    <div className="row g-3">
                        <div className="col-md-6">
                            <Columna icono="bi-cart-fill" color="var(--accent-2)" titulo="Compras Ágiles" lista={listasCompra} onVerMas={abrirModal} />
                        </div>
                        <div className="col-md-6">
                            <Columna icono="bi-file-earmark-text-fill" color="var(--accent)" titulo="Licitaciones" lista={listasLicitacion} onVerMas={abrirModal} />
                        </div>
                    </div>
                </div>
            )}

            <Modal
                show={!!modalAsignacion}
                onClose={cerrarModal}
                titulo={modalAsignacion
                    ? `${TIPO_ETIQUETA[modalAsignacion.tipo] || modalAsignacion.tipo} ${modalAsignacion.codigoExterno}${modalAsignacion.esAjena ? ` · ${modalAsignacion.username}` : ""}`
                    : ""}
            >
                {modalAsignacion && (
                    <>
                        {/* Acciones arriba, antes del detalle. "esAjena" = no es mia,
                            un admin la esta revisando (ver extras/onAprobarExtra):
                            ahi no tiene sentido dejarla tocar estado/cancelar/
                            recomendar como si fuera su propio trabajo, solo
                            Aprobar o Devolver a Desarrollo. */}
                        {modalAsignacion.esAjena ? (
                            <div className="d-flex flex-wrap gap-2 mb-3 pb-3 border-bottom">
                                <button type="button" className="btn btn-sm btn-success" disabled={accionandoExtra}
                                    onClick={async () => { setAccionandoExtra(true); try { await onAprobarExtra(modalAsignacion); cerrarModal(); } finally { setAccionandoExtra(false); } }}>
                                    Aprobar
                                </button>
                                <button type="button" className="btn btn-sm btn-outline-warning" disabled={accionandoExtra}
                                    onClick={async () => { setAccionandoExtra(true); try { await onDevolverExtra(modalAsignacion); cerrarModal(); } finally { setAccionandoExtra(false); } }}>
                                    Devolver a Desarrollo
                                </button>
                            </div>
                        ) : (
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
                                <select
                                    className="form-control form-control-sm"
                                    style={{ maxWidth: "160px" }}
                                    value={modalAsignacion.estado}
                                    onChange={(e) => cambiarEstado(modalAsignacion, e.target.value)}
                                >
                                    {ESTADOS.filter((es) => es.valor !== "DESCARTADO").map((es) => (
                                        <option key={es.valor} value={es.valor}>{es.etiqueta}</option>
                                    ))}
                                </select>
                                {modalAsignacion.estado !== "DESCARTADO" && (
                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => cancelar(modalAsignacion)}>
                                        Cancelar
                                    </button>
                                )}
                                {/* yaAsignada siempre true aca -- lo que aparece en "Mis
                                    activas" YA es una asignacion propia. "Recomendar a
                                    alguien" sigue teniendo sentido (sumar a un compañero
                                    al mismo item). */}
                                <RecomendarBoton codigoExterno={modalAsignacion.codigoExterno} tipo={modalAsignacion.tipo} yaAsignada />
                            </div>
                        )}

                        {modalAsignacion.motivoDescarte && (
                            <div className="alert alert-danger py-2" style={{ fontSize: "0.85rem" }}>
                                Descartado {modalAsignacion.etapaDescarte && `(estaba en ${ESTADOS.find((es) => es.valor === modalAsignacion.etapaDescarte)?.etiqueta || modalAsignacion.etapaDescarte})`}: {modalAsignacion.motivoDescarte}
                            </div>
                        )}

                        {detalleModal?.cargando && <p className="text-muted mb-0">Cargando...</p>}
                        {detalleModal?.error && <div className="alert alert-danger">{detalleModal.error}</div>}
                        {detalleModal?.item && <DetalleItem tipo={modalAsignacion.tipo} item={detalleModal.item} />}

                        {/* Ajena (revision de otra persona): en vez del espacio de
                            trabajo propio, se muestra el resumen de solo lectura de
                            la cotizacion ya guardada y los documentos subidos -- lo
                            que hace falta para decidir si se aprueba o se devuelve. */}
                        {modalAsignacion.esAjena && (
                            <>
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
                                    <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Documentos subidos</p>
                                    <DocumentosRevision asignacionId={modalAsignacion.id} />
                                </div>
                            </>
                        )}

                        {/* Espacio de trabajo por fase -- por ahora solo Compra Agil
                            tiene pantalla propia, distinta en ANALISIS (cotizacion) y
                            en DESARROLLO (detalle de texto libre, independiente de la
                            cotizacion). Licitacion se queda solo con el detalle de
                            arriba hasta que se defina que necesita. "key" fuerza que
                            el formulario arranque de cero al cambiar de asignacion.
                            Nunca se dispara para "esAjena" -- esas estan siempre en
                            COMPLETADO, ninguna de las 2 condiciones de abajo aplica. */}
                        {modalAsignacion.tipo === "COMPRA_AGIL" && modalAsignacion.estado === "ANALISIS" && (
                            <CotizacionCompraAgil
                                key={modalAsignacion.id}
                                asignacionId={modalAsignacion.id}
                                productos={detalleModal?.item?.productos_solicitados}
                                valorInicial={parsearCotizacion(modalAsignacion.cotizacionJson)}
                                onGuardar={(objeto) => guardarCotizacion(modalAsignacion, objeto)}
                            />
                        )}
                        {modalAsignacion.tipo === "COMPRA_AGIL" && modalAsignacion.estado === "DESARROLLO" && (
                            <>
                                <div className="mt-3 pt-3 border-top">
                                    <GenerarCotizacionBoton
                                        codigoExterno={modalAsignacion.codigoExterno}
                                        cotizacion={parsearCotizacion(modalAsignacion.cotizacionJson)}
                                        institucion={detalleModal?.item?.institucion}
                                        onGenerado={(blob, nombre) => setPreview(resolverPreview(blob, nombre))}
                                    />
                                </div>
                                <DetalleDesarrollo
                                    key={modalAsignacion.id}
                                    valorInicial={modalAsignacion.detalleDesarrollo}
                                    onGuardar={(texto) => guardarDetalleDesarrollo(modalAsignacion, texto)}
                                />
                            </>
                        )}

                        <div className="mt-3 pt-3 border-top">
                            <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Documentos adjuntos</p>
                            {detalleModal?.archivos ? (
                                detalleModal.archivos.length === 0 ? (
                                    <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>Sin archivos adjuntos.</p>
                                ) : (
                                    <div className="d-flex flex-wrap gap-2">
                                        {detalleModal.archivos.map((f) => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                className="btn btn-outline-secondary btn-sm"
                                                disabled={cargandoArchivo === f.id}
                                                onClick={() => verArchivo(modalAsignacion, f)}
                                            >
                                                {cargandoArchivo === f.id ? "Cargando..." : f.nombreArchivo}
                                            </button>
                                        ))}
                                    </div>
                                )
                            ) : (
                                <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>Cargando adjuntos...</p>
                            )}
                            <FilePreviewPanel preview={preview} onClose={() => setPreview(null)} />
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
}
