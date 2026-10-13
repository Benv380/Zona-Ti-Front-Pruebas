import { useEffect, useRef, useState } from "react";
import { authFetch, getClaims } from "../lib/api.js";
import { armarCotizacionPdf, blobADataUrl } from "../lib/armarCotizacionPdf.js";

// Pedido explicito 2026-10-05: pantalla dedicada para enviar cotizaciones
// de Compra Agil a Mercado Publico via la extension de navegador ZonaTi
// (reemplaza el flujo de Power Automate Desktop) -- ver auth-service/
// AsignacionController.listasParaEnviar/prepararEnvio, y extension/
// (README.md ahi mismo explica el protocolo completo de mensajes).
//
// La extension inyecta bridge.js en esta pagina (ver manifest.json,
// content_scripts) y marca document.documentElement.dataset.zonatiExt --
// asi sabemos si esta instalada sin tener que mandarle un mensaje.
function extensionInstalada() {
    return Boolean(document.documentElement.dataset.zonatiExt);
}

// crypto.randomUUID() solo existe en contexto seguro (HTTPS o localhost) --
// LAB01 todavia se sirve por HTTP plano (sin certificado, ver
// [[pendiente-tls-https]]), asi que ahi no esta disponible. Solo hace
// falta que sea unico para emparejar la respuesta de este pedido puntual,
// no que sea criptograficamente aleatorio.
function generarRequestId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// El PDF de la cotizacion que la extension adjunta en "Adjuntar archivos"
// del formulario de MP. Se arma aca (y no en la extension) porque el
// generador (jsPDF + membrete de la empresa) vive en el Front. Los
// documentos que subio el usuario NO viajan por aca: la extension los baja
// directo del backend (pueden pesar hasta 10 MB cada uno).
// La institucion (organismo comprador) sale del detalle cacheado de la
// compra; si no se puede leer, el PDF igual se arma con "—" en esos datos.
async function prepararPdfCotizacion(asignacion) {
    let cotizacion;
    try {
        cotizacion = JSON.parse(asignacion.cotizacionJson);
    } catch {
        throw new Error("La cotización guardada no es válida.");
    }

    let institucion = null;
    const resDetalle = await authFetch(`/compra/agil/${encodeURIComponent(asignacion.codigoExterno)}`);
    if (resDetalle.ok) {
        institucion = (await resDetalle.json())?.payload?.institucion ?? null;
    }

    const { blob, nombre } = await armarCotizacionPdf({
        codigoExterno: asignacion.codigoExterno,
        cotizacion,
        institucion,
        empresaId: asignacion.empresaId,
    });
    const dataUrl = await blobADataUrl(blob);
    return { nombre, tipo: "application/pdf", base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

// Dispara el envio y espera la respuesta final de la extension (puede
// tardar minutos: el usuario tiene que iniciar sesion a mano en el popup de
// Mercado Publico). Protocolo documentado en extension/src/bridge.js.
function enviarCotizacion(asignacionId, pdfCotizacion) {
    return new Promise((resolve, reject) => {
        const token = localStorage.getItem("token");
        if (!token) {
            reject(new Error("No hay sesión activa."));
            return;
        }

        const requestId = generarRequestId();

        function onMensaje(event) {
            if (event.source !== window) return;
            if (event.data?.__zonatiResp && event.data.requestId === requestId) {
                window.removeEventListener("message", onMensaje);
                resolve(event.data.respuesta);
            }
        }
        window.addEventListener("message", onMensaje);

        window.postMessage({
            __zonati: true,
            requestId,
            type: "ENVIAR_COTIZACION",
            jwt: token,
            asignacionId,
            pdfCotizacion,
        }, "*");
    });
}

// Estado de cada fila mientras espera, se envia o despues del intento.
const ESTADOS = {
    cola: { clase: "bg-secondary", texto: "En cola" },
    enviando: { clase: "bg-primary", texto: "Enviando..." },
    enviada: { clase: "bg-success", texto: "Enviada" },
    prueba: { clase: "bg-info text-dark", texto: "Modo prueba" },
    incierta: { clase: "bg-warning text-dark", texto: "Por verificar en MP" },
    error: { clase: "bg-danger", texto: "Error" },
};

// Traduce la respuesta de la extension al estado de la fila.
// "incierta": se presiono "Enviar" en MP pero no se pudo confirmar si quedo
// enviada -- hay que revisar en MP antes de reintentar (podria duplicarse).
// "prueba": la extension esta en modo prueba (rellena sin enviar).
function estadoDesdeRespuesta(respuesta, avisoPdf) {
    const tipo = respuesta?.success ? "enviada" : respuesta?.incierto ? "incierta" : respuesta?.prueba ? "prueba" : "error";
    const texto = [respuesta?.reply || (respuesta?.success ? "Cotización enviada." : "No se pudo enviar."), avisoPdf]
        .filter(Boolean).join(" ");
    return { tipo, texto };
}

// Una sola cotizacion: arma el PDF (opcional: si no se puede, se envia sin
// el y se avisa) y espera el resultado final de la extension.
async function enviarUna(asignacion) {
    let pdfCotizacion = null;
    let avisoPdf = null;
    try {
        pdfCotizacion = await prepararPdfCotizacion(asignacion);
    } catch (err) {
        avisoPdf = `No se adjuntó el PDF de la cotización (${err.message}).`;
    }
    const respuesta = await enviarCotizacion(asignacion.id, pdfCotizacion);
    return estadoDesdeRespuesta(respuesta, avisoPdf);
}

function Fila({ a, mostrarEmpresa, seleccionada, bloqueada, estado, onCambiar }) {
    const info = estado ? ESTADOS[estado.tipo] : null;
    return (
        <label
            className="card border mb-0"
            style={{ background: "var(--bg-elevated-2)", borderColor: "var(--border)", cursor: bloqueada ? "default" : "pointer" }}
        >
            <div className="card-body p-3 d-flex align-items-start gap-3">
                <input
                    type="checkbox"
                    className="form-check-input mt-1 flex-shrink-0"
                    checked={seleccionada}
                    disabled={bloqueada}
                    onChange={() => onCambiar(a.id)}
                />
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div style={{ color: "var(--text-h)" }}>
                            {a.codigoExterno}
                            {mostrarEmpresa && a.empresaNombre ? ` · ${a.empresaNombre}` : ""}
                        </div>
                        {info && <span className={`badge ${info.clase}`}>{info.texto}</span>}
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>Completada por {a.username}</div>
                    {estado?.texto && (
                        <div className="mt-1" style={{ fontSize: "0.85rem" }}>{estado.texto}</div>
                    )}
                </div>
            </div>
        </label>
    );
}

export default function EnviarMercadoPublico() {
    const mostrarEmpresa = getClaims()?.alcance === "GLOBAL";

    const [lista, setLista] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [seleccion, setSeleccion] = useState(() => new Set());
    // id -> { tipo: clave de ESTADOS, texto }
    const [estados, setEstados] = useState({});
    const [enviando, setEnviando] = useState(false);
    const [resumen, setResumen] = useState(null); // { tipo: "success"|"warning"|"info"|"danger", texto }
    // "Detener" corta el lote DESPUES de la cotizacion en curso: la que ya
    // esta en la ventana de MP no se interrumpe a la mitad.
    const detenerRef = useRef(false);
    const [deteniendo, setDeteniendo] = useState(false);

    async function cargar() {
        setCargando(true);
        setError(null);
        try {
            const res = await authFetch("/auth/asignaciones/listas-para-enviar");
            if (!res.ok) throw new Error(`El servidor respondió con estado ${res.status}`);
            setLista(await res.json());
            setSeleccion(new Set());
            setEstados({});
            setResumen(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        document.title = "Enviar a Mercado Público";
        cargar();
    }, []);

    // Las ya enviadas quedan a la vista con su estado, pero no se pueden
    // volver a seleccionar.
    const seleccionables = lista.filter((a) => estados[a.id]?.tipo !== "enviada");
    const todasMarcadas = seleccionables.length > 0 && seleccionables.every((a) => seleccion.has(a.id));
    const cantidad = seleccionables.filter((a) => seleccion.has(a.id)).length;

    function cambiar(id) {
        setSeleccion((prev) => {
            const siguiente = new Set(prev);
            if (siguiente.has(id)) siguiente.delete(id);
            else siguiente.add(id);
            return siguiente;
        });
    }

    function cambiarTodas() {
        setSeleccion(todasMarcadas ? new Set() : new Set(seleccionables.map((a) => a.id)));
    }

    function ponerEstado(id, estado) {
        setEstados((prev) => ({ ...prev, [id]: estado }));
    }

    // Se envian de a una, en el orden de la lista: una sola ventana de MP a
    // la vez, y despues del primer inicio de sesion con Clave Unica las
    // siguientes encuentran la sesion abierta. Si una falla ANTES de enviar
    // (sin sesion a tiempo, empresa distinta, ventana cerrada...), el lote se
    // detiene: lo mas probable es que a las siguientes les pase lo mismo.
    // "Por verificar" no detiene el lote: la duda es sobre ESA compra, no
    // sobre las demas.
    async function enviarSeleccionadas() {
        const aEnviar = seleccionables.filter((a) => seleccion.has(a.id));
        if (aEnviar.length === 0) return;

        const porVerificar = aEnviar.filter((a) => estados[a.id]?.tipo === "incierta");
        if (porVerificar.length && !window.confirm(
            `El intento anterior de ${porVerificar.map((a) => a.codigoExterno).join(", ")} no se pudo confirmar. `
            + "¿Revisó en Mercado Público que NO quedaron enviadas? Si ya se enviaron, reintentar las duplicaría.")) {
            return;
        }

        detenerRef.current = false;
        setDeteniendo(false);
        setEnviando(true);
        setResumen(null);
        setEstados((prev) => {
            const siguiente = { ...prev };
            aEnviar.forEach((a) => { siguiente[a.id] = { tipo: "cola" }; });
            return siguiente;
        });

        const cuenta = { enviada: 0, prueba: 0, incierta: 0, error: 0 };
        let motivoCorte = null;

        for (let i = 0; i < aEnviar.length; i++) {
            const a = aEnviar[i];
            if (detenerRef.current) {
                motivoCorte = "Envío detenido.";
                break;
            }
            ponerEstado(a.id, { tipo: "enviando" });
            let estado;
            try {
                estado = await enviarUna(a);
            } catch (err) {
                estado = { tipo: "error", texto: err.message };
            }
            ponerEstado(a.id, estado);
            cuenta[estado.tipo] += 1;
            if (estado.tipo === "enviada") {
                setSeleccion((prev) => {
                    const siguiente = new Set(prev);
                    siguiente.delete(a.id);
                    return siguiente;
                });
            }
            if (estado.tipo === "error" && i < aEnviar.length - 1) {
                motivoCorte = `Se detuvo el envío porque ${a.codigoExterno} falló; las siguientes no se intentaron.`;
                break;
            }
        }

        // Las que quedaron "en cola" por un corte vuelven a estar disponibles
        // (siguen seleccionadas, para reintentar con un clic).
        setEstados((prev) => {
            const siguiente = { ...prev };
            aEnviar.forEach((a) => { if (siguiente[a.id]?.tipo === "cola") delete siguiente[a.id]; });
            return siguiente;
        });

        const partes = [
            cuenta.enviada && `${cuenta.enviada} enviada(s)`,
            cuenta.prueba && `${cuenta.prueba} en modo prueba`,
            cuenta.incierta && `${cuenta.incierta} por verificar en Mercado Público`,
            cuenta.error && `${cuenta.error} con error`,
        ].filter(Boolean);
        setResumen({
            tipo: cuenta.error || motivoCorte ? "danger" : cuenta.incierta ? "warning" : cuenta.prueba ? "info" : "success",
            texto: [motivoCorte, partes.length ? `Resultado: ${partes.join(", ")}.` : null].filter(Boolean).join(" "),
        });
        setEnviando(false);
        setDeteniendo(false);
    }

    return (
        <div className="d-flex flex-column align-items-center p-4">
            <h1>Enviar a Mercado Público</h1>
            <p className="text-muted text-center" style={{ maxWidth: "640px" }}>
                Compras Ágiles completadas y aprobadas, listas para subir su cotización a Mercado Público.
                Seleccione las que quiere enviar: la extensión de navegador ZonaTi las envía de a una, en una ventana
                donde usted inicia sesión (solo la primera vez). Se adjuntan el PDF de la cotización (si se puede
                generar) y los documentos cargados en cada asignación.
            </p>

            {!extensionInstalada() && (
                <div className="alert alert-warning" style={{ maxWidth: "640px", width: "100%" }}>
                    No se detectó la extensión ZonaTi — Mercado Público en este navegador. Instálela para poder enviar.
                </div>
            )}

            {resumen && (
                <div className={`alert alert-${resumen.tipo}`} style={{ maxWidth: "640px", width: "100%" }}>
                    {resumen.texto}
                </div>
            )}

            {error && (
                <div className="alert alert-danger" style={{ maxWidth: "640px", width: "100%" }}>
                    {error}
                </div>
            )}

            {cargando && <p className="text-muted">Cargando...</p>}

            {!cargando && !error && lista.length === 0 && (
                <p className="text-muted">No hay compras ágiles listas para enviar por ahora.</p>
            )}

            {lista.length > 0 && (
                <div className="d-flex flex-column gap-2 w-100" style={{ maxWidth: "640px" }}>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
                        <div className="form-check mb-0">
                            <input
                                id="seleccionar-todas"
                                type="checkbox"
                                className="form-check-input"
                                checked={todasMarcadas}
                                disabled={enviando || seleccionables.length === 0}
                                onChange={cambiarTodas}
                            />
                            <label htmlFor="seleccionar-todas" className="form-check-label">
                                Seleccionar todas ({seleccionables.length})
                            </label>
                        </div>
                        {enviando ? (
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                disabled={deteniendo}
                                onClick={() => { detenerRef.current = true; setDeteniendo(true); }}
                            >
                                {deteniendo ? "Se detendrá al terminar la actual..." : "Detener"}
                            </button>
                        ) : (
                            <div className="d-flex gap-2">
                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={cargar}>
                                    Actualizar lista
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    disabled={cantidad === 0 || !extensionInstalada()}
                                    onClick={enviarSeleccionadas}
                                >
                                    Enviar seleccionadas ({cantidad})
                                </button>
                            </div>
                        )}
                    </div>

                    {lista.map((a) => (
                        <Fila
                            key={a.id}
                            a={a}
                            mostrarEmpresa={mostrarEmpresa}
                            seleccionada={seleccion.has(a.id)}
                            bloqueada={enviando || estados[a.id]?.tipo === "enviada"}
                            estado={estados[a.id]}
                            onCambiar={cambiar}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
