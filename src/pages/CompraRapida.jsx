import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import * as XLSX from "xlsx";
import AsignarBoton from "../components/AsignarBoton.jsx";
import CompraCard from "../components/CompraCard.jsx";
import DetalleItem from "../components/DetalleItem.jsx";
import Modal from "../components/Modal.jsx";
import Paginador from "../components/Paginador.jsx";
import RecomendarBoton from "../components/RecomendarBoton.jsx";
import { authFetch, getClaims } from "../lib/api.js";
import { normalizarCodigo, pareceCodigoValido } from "../lib/codigos.js";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// "todas" -> /listar (cacheado, cartera completa de Mercado Publico,
// paginada). "filtro" -> /compra/agil?... (Puerta 2, acotado ademas por
// el perfil de la empresa -- rubro/palabras clave/region). Ver
// CompraAgilService.buscar() en compra-service.
const ENDPOINT_POR_VISTA = {
    todas: "/compra/agil/listar",
    filtro: "/compra/agil",
    // Mismo cache/ventana de 48h que "todas", pero acotado a las que ya
    // pasaron a un 2do llamado (el primero no recibio suficientes
    // ofertas y Mercado Publico republico con plazo extendido). Ver
    // CompraAgilController.listarSegundoLlamado.
    segundoLlamado: "/compra/agil/segundo-llamado",
};

// Renderiza un .docx dentro de un iframe (usando docx-preview para convertirlo
// a HTML/CSS en el momento, inyectado directo en el documento del iframe).
function DocxIframeViewer({ blob, title }) {
    const iframeRef = useRef(null);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        let cancelado = false;

        const renderContenido = () => {
            const doc = iframe.contentDocument;
            if (!doc || cancelado) return;
            doc.open();
            doc.write(
                "<!DOCTYPE html><html><head><meta charset='utf-8'><style>body{font-family:sans-serif;padding:20px;margin:0;}</style></head><body></body></html>"
            );
            doc.close();
            renderAsync(blob, doc.body).catch((err) => {
                console.error("Error renderizando docx:", err);
            });
        };

        iframe.onload = renderContenido;
        iframe.src = "about:blank";

        return () => {
            cancelado = true;
        };
    }, [blob]);

    return (
        <iframe
            ref={iframeRef}
            title={title}
            width="100%"
            height="600px"
            style={{ border: "1px solid #ddd" }}
        />
    );
}

// Renderiza la primera hoja de un .xlsx como tabla HTML dentro de un iframe
// (usando SheetJS para convertir la hoja a HTML).
function XlsxIframeViewer({ blob, title }) {
    const [html, setHtml] = useState(null);

    useEffect(() => {
        let cancelado = false;
        blob.arrayBuffer().then((buffer) => {
            if (cancelado) return;
            const workbook = XLSX.read(buffer, { type: "array" });
            const nombreHoja = workbook.SheetNames[0];
            const hoja = workbook.Sheets[nombreHoja];
            const tablaHtml = XLSX.utils.sheet_to_html(hoja);
            setHtml(
                `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
                    body{font-family:sans-serif;padding:12px;margin:0;}
                    table{border-collapse:collapse;width:100%;}
                    td,th{border:1px solid #ccc;padding:4px 8px;font-size:13px;text-align:left;}
                </style></head><body>${tablaHtml}</body></html>`
            );
        });
        return () => {
            cancelado = true;
        };
    }, [blob]);

    if (!html) {
        return <p>Cargando hoja de cálculo...</p>;
    }

    return (
        <iframe
            srcDoc={html}
            title={title}
            width="100%"
            height="600px"
            style={{ border: "1px solid #ddd" }}
        />
    );
}

// Arma el bloque de preview (pdf/imagen/docx/xlsx) para un objeto `preview`
// dado, con un encabezado comun que incluye el boton para cerrarla. Se
// reusa tanto en la busqueda por codigo como dentro del modal de detalle
// -- por eso recibe "onClose" en vez de asumir cual estado hay que limpiar.
function VisorArchivo({ preview, onClose }) {
    if (!preview) return null;

    let cuerpo = null;
    if (preview.modo === "pdf") {
        cuerpo = <iframe src={preview.url} width="100%" height="600px" title={preview.nombre} style={{ border: "1px solid #ddd" }} />;
    } else if (preview.modo === "imagen") {
        cuerpo = <img src={preview.url} alt={preview.nombre} style={{ maxWidth: "100%" }} />;
    } else if (preview.modo === "docx") {
        cuerpo = <DocxIframeViewer blob={preview.blob} title={preview.nombre} />;
    } else if (preview.modo === "xlsx") {
        cuerpo = <XlsxIframeViewer blob={preview.blob} title={preview.nombre} />;
    } else {
        return null;
    }

    return (
        <div className="card-panel mt-2">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h6 className="mb-0 text-truncate" style={{ minWidth: 0 }}>{preview.nombre}</h6>
                <button type="button" className="btn btn-sm btn-outline-secondary flex-shrink-0" onClick={onClose}>
                    Cerrar
                </button>
            </div>
            {cuerpo}
        </div>
    );
}

function CompraRapida() {
    const [codigo, setCodigo] = useState("");
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const [vista, setVista] = useState("todas");
    const [compras, setCompras] = useState([]);
    const [listLoading, setListLoading] = useState(false);

    // Cartera completa de Mercado Público, paginada de a 15 -- ver
    // CompraAgilController.listarUltimasOchoHoras en compra-service.
    const [pagina, setPagina] = useState(1);
    const [paginacion, setPaginacion] = useState(null);

    // Al hacer click en una tarjeta se abre este modal con el detalle
    // completo + archivos, cargados recien ahi. Ver Modal.jsx.
    const [modalCodigo, setModalCodigo] = useState(null);
    const [modalDetalle, setModalDetalle] = useState(null); // { cargando, error, item, archivos }
    const [modalPreview, setModalPreview] = useState(null);
    const [modalCargandoArchivo, setModalCargandoArchivo] = useState(null);

    // "Recomendar/asignarme esto" esta disponible para cualquier rol (ver
    // Licitacion.jsx). "Asignar a un usuario puntual" es exclusivo de
    // quien administra gente (GLOBAL/EMPRESA).
    const esAdmin = ["GLOBAL", "EMPRESA"].includes(getClaims()?.alcance);

    // Codigos que YA tengo asignados -- ver el mismo comentario en
    // Licitacion.jsx.
    const [misCodigos, setMisCodigos] = useState(new Set());

    useEffect(() => {
        authFetch(`/auth/me/asignaciones?tipo=COMPRA_AGIL`)
            .then((r) => (r.ok ? r.json() : []))
            .then((codigos) => setMisCodigos(new Set(codigos)))
            .catch(() => {});
    }, []);

    const [archivos, setArchivos] = useState([]);
    const [preview, setPreview] = useState(null); // { modo, url?, blob?, nombre }
    const [cargandoArchivo, setCargandoArchivo] = useState(null);

    useEffect(() => {
        document.title = "Consulta Compra Ágil";
    }, []);

    useEffect(() => {
        return () => {
            if (preview?.url) URL.revokeObjectURL(preview.url);
        };
    }, [preview]);

    useEffect(() => {
        return () => {
            if (modalPreview?.url) URL.revokeObjectURL(modalPreview.url);
        };
    }, [modalPreview]);

    // Depende de "vista"/"pagina" -- si no, el auto-refresh seguiria
    // pegado para siempre a la vista/página que estaba seleccionada al
    // montar el componente (mismo motivo que en Licitacion.jsx).
    useEffect(() => {
        const id = setInterval(() => {
            obtenerTodasCompras(pagina);
        }, 10 * 60 *1000); // cada 10 minutos

        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vista, pagina]);

    async function handleSubmit(e) {
        e.preventDefault();
        const codigoLimpio = normalizarCodigo(codigo);
        if (!codigoLimpio) return;

        setLoading(true);
        setError(null);
        setData(null);
        setArchivos([]);
        setPreview(null);
        // Si ya habia una lista mostrada ("Ver todo"/"Ver mi filtro"), se
        // limpia -- si no, la busqueda por codigo quedaba mezclada con la
        // lista entera mostrandose debajo (ver mismo fix en Licitacion.jsx).
        setCompras([]);
        setPaginacion(null);

        try {
            const res = await authFetch(`/compra/agil/${encodeURIComponent(codigoLimpio)}`);
            if (!res.ok) {
                throw new Error(`El servidor respondió con estado ${res.status}`);
            }
            const json = await res.json();
            // Mercado Publico responde 200 igual cuando el codigo no existe
            // (success:"false", payload:null) -- sin este chequeo, la
            // pagina quedaba con un hueco vacio y los botones de asignar/
            // recomendar sueltos, sin decir claramente que no encontro nada.
            if (!json?.payload) {
                setError(`No se encontró ninguna compra ágil con el código "${codigoLimpio}".`);
                return;
            }
            setData(json);

            authFetch(`/compra/agil/${encodeURIComponent(codigoLimpio)}/adjuntos`)
                .then((r) => (r.ok ? r.json() : null))
                .then((adjuntosJson) => {
                    if (adjuntosJson?.payload?.files) {
                        setArchivos(adjuntosJson.payload.files);
                    }
                })
                .catch((err) => {
                    console.error("Error al pedir adjuntos:", err);
                });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Comun a la busqueda por codigo y al modal -- decide el modo de
    // preview segun el content-type del blob y lo entrega a quien llamó.
    async function pedirArchivo(id) {
        const res = await authFetch(`/compra/agil/adjuntos/${id}`);
        if (!res.ok) throw new Error("No se pudo obtener el archivo");
        const blob = await res.blob();
        return blob;
    }

    function resolverPreviewCompra(blob, nombre) {
        const tipo = blob.type;
        if (tipo === "application/pdf") return { modo: "pdf", url: URL.createObjectURL(blob), nombre };
        if (tipo.startsWith("image/")) return { modo: "imagen", url: URL.createObjectURL(blob), nombre };
        if (tipo === MIME_DOCX) return { modo: "docx", blob, nombre };
        if (tipo === MIME_XLSX) return { modo: "xlsx", blob, nombre };
        return null; // sin visor propio -- hay que descargarlo
    }

    async function verArchivo(id, nombre) {
        setCargandoArchivo(id);
        try {
            const blob = await pedirArchivo(id);
            const resultado = resolverPreviewCompra(blob, nombre);
            if (resultado) {
                setPreview(resultado);
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = nombre;
                a.click();
                URL.revokeObjectURL(url);
                setPreview(null);
            }
        } catch (err) {
            setError(`Error al abrir "${nombre}": ${err.message}`);
        } finally {
            setCargandoArchivo(null);
        }
    }

    async function verArchivoModal(id, nombre) {
        setModalCargandoArchivo(id);
        try {
            const blob = await pedirArchivo(id);
            const resultado = resolverPreviewCompra(blob, nombre);
            if (resultado) {
                setModalPreview(resultado);
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = nombre;
                a.click();
                URL.revokeObjectURL(url);
                setModalPreview(null);
            }
        } catch (err) {
            setModalDetalle((prev) => ({ ...prev, error: `Error al abrir "${nombre}": ${err.message}` }));
        } finally {
            setModalCargandoArchivo(null);
        }
    }

    async function obtenerTodasCompras(paginaSolicitada = pagina) {
        setListLoading(true);
        setError(null);
        try {
            const res = await authFetch(`${ENDPOINT_POR_VISTA[vista]}?pagina=${paginaSolicitada}&tamano=15`);
            if (!res.ok) {
                throw new Error(`El servidor respondió con estado ${res.status}`);
            }
            const json = await res.json();
            setCompras(json?.payload?.items || []);
            setPagina(paginaSolicitada);
            setPaginacion(json?.payload?.paginacion || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setListLoading(false);
        }
    }

    // Se dispara al hacer click en una tarjeta -- pide el detalle completo
    // (el listado solo trae "montos", el detalle completo trae ademas
    // presupuesto/entrega/productos_solicitados, ver DetalleItem.jsx) y
    // los archivos juntos, recien en ese momento.
    async function abrirModal(codigoExterno) {
        setModalCodigo(codigoExterno);
        setModalDetalle({ cargando: true });
        setModalPreview(null);
        try {
            const [resDetalle, resAdjuntos] = await Promise.all([
                // timeoutMs mas generoso -- si no esta cacheado con el
                // detalle completo (detalle_completo=true), compra-service
                // le pega en vivo a Mercado Publico (hasta 20s del lado
                // del backend, ver CompraAgilClient) antes de responder.
                // Esto es justo lo que hacia "quedar en timeout" al abrir
                // un item que solo se habia sincronizado por el listado.
                authFetch(`/compra/agil/${encodeURIComponent(codigoExterno)}`, { timeoutMs: 25000 }),
                authFetch(`/compra/agil/${encodeURIComponent(codigoExterno)}/adjuntos`),
            ]);
            const jsonDetalle = resDetalle.ok ? await resDetalle.json() : null;
            const jsonAdjuntos = resAdjuntos.ok ? await resAdjuntos.json() : null;
            setModalDetalle({
                cargando: false,
                item: jsonDetalle?.payload || null,
                archivos: jsonAdjuntos?.payload?.files || [],
            });
        } catch (err) {
            setModalDetalle({ cargando: false, error: err.message });
        }
    }

    function cerrarModal() {
        setModalCodigo(null);
        setModalDetalle(null);
        setModalPreview(null);
    }

    return (
        <div className="d-flex flex-column align-items-center p-4">
            <h1>Consulta Compra Ágil</h1>

            <p>Ingrese el código de una Compra Ágil (ej: 1234-5-COT26) para ver su detalle.</p>


            <form className="card-panel mb-4" style={{ maxWidth: "560px", width: "100%" }} onSubmit={handleSubmit}>
                <div className="d-flex flex-wrap gap-2 align-items-center" style={{ width: "100%" }}>
                    <input
                        type="text"
                        className="form-control"
                        style={{ minWidth: "220px", flex: 1 }}
                        placeholder="Código de compra ágil"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Buscando..." : "Buscar"}
                    </button>
                    {codigo.trim() && !pareceCodigoValido(normalizarCodigo(codigo)) && (
                        <p className="w-100 mb-0 text-muted" style={{ fontSize: "0.8rem" }}>
                            El código normalmente lleva guiones, ej: 1234-5-COT26.
                        </p>
                    )}
                </div>
            </form>

            {/* Resultado de la busqueda por codigo -- va JUSTO despues del
                formulario, no al final de la pagina (ver mismo fix en
                Licitacion.jsx). */}
            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}

            {archivos.length > 0 && (
                <div className="card-panel mb-4">
                    <h5>Documentos adjuntos</h5>
                    <div className="d-flex flex-wrap gap-2">
                        {archivos.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={cargandoArchivo === f.id}
                                onClick={() => verArchivo(f.id, f.nombreArchivo)}
                            >
                                {cargandoArchivo === f.id ? "Cargando..." : f.nombreArchivo}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <VisorArchivo preview={preview} onClose={() => setPreview(null)} />

            {data && (
                <div className="card-panel w-100 mb-3" style={{ maxWidth: "760px" }}>
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
                        <RecomendarBoton
                            codigoExterno={data?.payload?.codigo}
                            tipo="COMPRA_AGIL"
                            yaAsignada={misCodigos.has(data?.payload?.codigo)}
                            onAsignado={(codigo) => setMisCodigos((prev) => new Set(prev).add(codigo))}
                        />
                        {esAdmin && data?.payload?.codigo && (
                            <AsignarBoton codigoExterno={data.payload.codigo} tipo="COMPRA_AGIL" />
                        )}
                    </div>
                    <DetalleItem tipo="COMPRA_AGIL" item={data?.payload} />
                </div>
            )}

            {/* "Ver todo" = /listar (cartera completa, paginada). "Ver mi
                filtro" = Puerta 2 (/compra/agil, acotado ademas por el
                perfil de la empresa). El toggle no dispara la busqueda
                sola, hay que apretar "Mostrar" de nuevo. */}
            <div className="btn-group mb-3 flex-wrap" role="group">
                <button
                    type="button"
                    className={`btn btn-sm ${vista === "todas" ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => {
                        setVista("todas");
                        setPagina(1);
                    }}
                >
                    Ver todo
                </button>
                <button
                    type="button"
                    className={`btn btn-sm ${vista === "filtro" ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => {
                        setVista("filtro");
                        setPagina(1);
                    }}
                >
                    Ver mi filtro
                </button>
                <button
                    type="button"
                    className={`btn btn-sm ${vista === "segundoLlamado" ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => {
                        setVista("segundoLlamado");
                        setPagina(1);
                    }}
                >
                    En 2do llamado
                </button>
            </div>

            <div className="d-flex gap-2 mb-3">
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => obtenerTodasCompras(1)}
                    disabled={listLoading}
                >
                    {listLoading ? "Cargando compras..." : "Mostrar compras"}
                </button>
            </div>

            {compras.length > 0 && (
                <div className="w-100 mb-4">
                    <h5>Compras encontradas</h5>
                    <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
                        {compras.map((item) => (
                            <div className="col" key={item.codigo}>
                                <CompraCard item={item} onClick={() => abrirModal(item.codigo)} asignadaAMi={misCodigos.has(item.codigo)} />
                            </div>
                        ))}
                    </div>
                    <Paginador paginacion={paginacion} onCambiar={(nuevaPagina) => obtenerTodasCompras(nuevaPagina)} />
                </div>
            )}

            <Modal show={!!modalCodigo} onClose={cerrarModal} titulo={modalCodigo ? `Compra Ágil ${modalCodigo}` : ""}>
                {modalDetalle?.cargando && <p className="text-muted mb-0">Cargando...</p>}
                {modalDetalle?.error && <div className="alert alert-danger">{modalDetalle.error}</div>}
                {modalDetalle?.item && (
                    <>
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
                            <RecomendarBoton
                                codigoExterno={modalCodigo}
                                tipo="COMPRA_AGIL"
                                yaAsignada={misCodigos.has(modalCodigo)}
                                onAsignado={(codigo) => setMisCodigos((prev) => new Set(prev).add(codigo))}
                            />
                            {esAdmin && <AsignarBoton codigoExterno={modalCodigo} tipo="COMPRA_AGIL" />}
                        </div>

                        <DetalleItem tipo="COMPRA_AGIL" item={modalDetalle.item} />

                        <div className="mt-3 pt-3 border-top">
                            <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Documentos adjuntos</p>
                            {modalDetalle.archivos.length === 0 ? (
                                <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>Sin archivos adjuntos.</p>
                            ) : (
                                <div className="d-flex flex-wrap gap-2">
                                    {modalDetalle.archivos.map((f) => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm"
                                            disabled={modalCargandoArchivo === f.id}
                                            onClick={() => verArchivoModal(f.id, f.nombreArchivo)}
                                        >
                                            {modalCargandoArchivo === f.id ? "Cargando..." : f.nombreArchivo}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <VisorArchivo preview={modalPreview} onClose={() => setModalPreview(null)} />
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
}

export default CompraRapida;
