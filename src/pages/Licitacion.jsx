import { useEffect, useState } from "react";
import AsignacionesCompaneroBadge from "../components/AsignacionesCompaneroBadge.jsx";
import AsignarBoton from "../components/AsignarBoton.jsx";
import DetalleItem from "../components/DetalleItem.jsx";
import { FilePreviewPanel, descargarBlob, resolverPreview } from "../components/FilePreview";
import LicitacionCard from "../components/LicitacionCard.jsx";
import Modal from "../components/Modal.jsx";
import Paginador from "../components/Paginador.jsx";
import RecomendarBoton from "../components/RecomendarBoton.jsx";
import { authFetch, getClaims } from "../lib/api.js";
import { normalizarCodigo, pareceCodigoValido } from "../lib/codigos.js";

// "todas" -> /listar (cacheado, cartera completa de Mercado Publico,
// paginada). "filtro" -> /mi-filtro (acotado ademas por el perfil de la
// empresa -- rubro/palabras clave/region). Ver
// LicitacionService.buscarConFiltroEmpresa en compra-service.
const ENDPOINT_POR_VISTA = {
    todas: "/compra/licitacion/listar",
    filtro: "/compra/licitacion/mi-filtro",
};

function Licitacion() {
    const [codigo, setCodigo] = useState("");
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const [vista, setVista] = useState("todas");
    const [licitaciones, setLicitaciones] = useState([]);
    const [listLoading, setListLoading] = useState(false);

    // Cartera completa de Mercado Público, paginada de a 15 -- ver
    // LicitacionController.listarUltimosDias en compra-service.
    const [pagina, setPagina] = useState(1);
    const [paginacion, setPaginacion] = useState(null);

    // Al hacer click en una tarjeta se abre este modal con el detalle
    // completo + archivos, cargados recien ahi (no de arranque para las
    // 15 tarjetas de la pagina -- solo la que se abre). Ver Modal.jsx.
    const [modalCodigo, setModalCodigo] = useState(null);
    const [modalDetalle, setModalDetalle] = useState(null); // { cargando, error, item, archivos }
    const [modalPreview, setModalPreview] = useState(null);
    const [modalCargandoArchivo, setModalCargandoArchivo] = useState(null);

    // Codigos que YA tengo asignados (sea porque me los autoasigne, me los
    // recomendaron, o me los asigno un admin) -- para marcar la tarjeta y
    // arrancar el boton de RecomendarBoton ya en "Asignada a mí", sin
    // esperar a que alguien intente asignarse de nuevo y choque con la
    // validacion del backend (ver AsignacionService.verificarNoDuplicada).
    const [misCodigos, setMisCodigos] = useState(new Set());

    useEffect(() => {
        authFetch(`/auth/me/asignaciones?tipo=LICITACION`)
            .then((r) => (r.ok ? r.json() : []))
            .then((codigos) => setMisCodigos(new Set(codigos)))
            .catch(() => {});
    }, []);

    // Cruce de datos entre usuarios/admins de la misma empresa (mismo
    // criterio que CompraRapida.jsx): por cada codigo, quien MAS (aparte de
    // mi) ya lo tiene asignado. Se excluye a mi mismo -- ya se muestra
    // aparte como "Asignada a mí" via misCodigos.
    const [asignacionesCompaneros, setAsignacionesCompaneros] = useState(new Map());

    useEffect(() => {
        const miUsername = getClaims()?.username;
        authFetch(`/auth/me/empresa/asignaciones?tipo=LICITACION`)
            .then((r) => (r.ok ? r.json() : []))
            .then((filas) => {
                const mapa = new Map();
                for (const fila of filas) {
                    if (fila.username === miUsername) continue;
                    const lista = mapa.get(fila.codigoExterno) || [];
                    lista.push(fila.username);
                    mapa.set(fila.codigoExterno, lista);
                }
                setAsignacionesCompaneros(mapa);
            })
            .catch(() => {});
    }, []);

    // "Recomendar/asignarme esto" esta disponible para cualquier rol (el
    // backend ya lo permite -- ver AsignacionService.recomendar, por
    // default se autoasigna si no se elige destinatario). "Asignar a un
    // usuario puntual" en cambio es exclusivo de quien administra gente
    // (GLOBAL/EMPRESA).
    const esAdmin = ["GLOBAL", "EMPRESA"].includes(getClaims()?.alcance);

    const [archivos, setArchivos] = useState([]);
    const [preview, setPreview] = useState(null); // { modo, url?, blob?, nombre }
    const [cargandoArchivo, setCargandoArchivo] = useState(null);

    useEffect(() => {
        document.title = "Consulta Licitación";
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

    // Carga la lista sola al entrar a la pagina -- antes habia que apretar
    // "Mostrar licitaciones" a mano incluso para ver la vista por defecto
    // ("todas"). Mismo patron que CompraRapida.jsx.
    useEffect(() => {
        obtenerTodasLicitaciones(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Igual que en Compra Ágil: refresca sola la lista cada 10 minutos, sin
    // que el usuario tenga que volver a apretar el botón. Depende de
    // "vista"/"pagina" -- si no, el auto-refresh seguiría pegado para
    // siempre a la vista/página que estaba seleccionada cuando se montó el
    // componente.
    useEffect(() => {
        const id = setInterval(() => {
            obtenerTodasLicitaciones(pagina);
        }, 10 * 60 * 1000); // cada 10 minutos

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
        // limpia -- si no, la busqueda por codigo aparecia arriba pero la
        // lista entera seguia mostrandose debajo, mezclando las dos cosas.
        setLicitaciones([]);
        setPaginacion(null);

        try {
            const res = await authFetch(`/compra/licitacion/${encodeURIComponent(codigoLimpio)}`);
            if (!res.ok) {
                throw new Error(`El servidor respondió con estado ${res.status}`);
            }
            const json = await res.json();
            // Mercado Publico responde 200 igual cuando el codigo no existe
            // (Listado vacio) -- sin este chequeo, la pagina quedaba con un
            // hueco vacio y los botones de asignar/recomendar sueltos, sin
            // decir claramente que no encontro nada.
            if (!json?.Listado?.[0]) {
                setError(`No se encontró ninguna licitación con el código "${codigoLimpio}".`);
                return;
            }
            setData(json);

            authFetch(`/compra/licitacion/${encodeURIComponent(codigoLimpio)}/adjuntos`)
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

    async function verArchivo(id, nombre) {
        setCargandoArchivo(id);
        try {
            const res = await authFetch(`/compra/licitacion/adjuntos/${id}`);
            if (!res.ok) throw new Error("No se pudo obtener el archivo");

            const blob = await res.blob();
            const resultado = resolverPreview(blob, nombre, {});
            if (resultado) {
                setPreview(resultado);
            } else {
                descargarBlob(blob, nombre);
                setPreview(null);
            }
        } catch (err) {
            setError(`Error al abrir "${nombre}": ${err.message}`);
        } finally {
            setCargandoArchivo(null);
        }
    }

    // "vistaSolicitada" aparte de "vista" (por defecto la del estado actual)
    // -- la necesitan los botones de "Ver todo"/"Ver mi filtro": al hacer
    // click cambian la vista Y piden la lista en el mismo gesto (ver mas
    // abajo), y setVista() todavia no se aplico cuando se llama esta
    // funcion (React lo deja para el proximo render). Mismo patron que
    // CompraRapida.jsx.
    async function obtenerTodasLicitaciones(paginaSolicitada = pagina, vistaSolicitada = vista) {
        setListLoading(true);
        setError(null);
        try {
            const res = await authFetch(`${ENDPOINT_POR_VISTA[vistaSolicitada]}?pagina=${paginaSolicitada}&tamano=15`);
            if (!res.ok) {
                throw new Error(`El servidor respondió con estado ${res.status}`);
            }
            const json = await res.json();
            setLicitaciones(json?.Listado || []);
            setPagina(paginaSolicitada);
            setPaginacion(json?.Paginacion || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setListLoading(false);
        }
    }

    // Se dispara al hacer click en una tarjeta -- pide el detalle completo
    // (no siempre viene entero en el listado) y los archivos juntos, recien
    // en ese momento. Mismo patron que MisActivas.jsx.
    async function abrirModal(codigoExterno) {
        setModalCodigo(codigoExterno);
        setModalDetalle({ cargando: true });
        setModalPreview(null);
        try {
            const [resDetalle, resAdjuntos] = await Promise.all([
                // timeoutMs mas generoso -- si no esta cacheado con el
                // detalle completo, compra-service le pega en vivo a
                // Mercado Publico (hasta 20s del lado del backend, ver
                // LicitacionClient) antes de responder.
                authFetch(`/compra/licitacion/${encodeURIComponent(codigoExterno)}`, { timeoutMs: 25000 }),
                authFetch(`/compra/licitacion/${encodeURIComponent(codigoExterno)}/adjuntos`),
            ]);
            const jsonDetalle = resDetalle.ok ? await resDetalle.json() : null;
            const jsonAdjuntos = resAdjuntos.ok ? await resAdjuntos.json() : null;
            setModalDetalle({
                cargando: false,
                item: jsonDetalle?.Listado?.[0] || null,
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

    async function verArchivoModal(id, nombre) {
        setModalCargandoArchivo(id);
        try {
            const res = await authFetch(`/compra/licitacion/adjuntos/${id}`);
            if (!res.ok) throw new Error("No se pudo obtener el archivo");

            const blob = await res.blob();
            const resultado = resolverPreview(blob, nombre, {});
            if (resultado) {
                setModalPreview(resultado);
            } else {
                descargarBlob(blob, nombre);
                setModalPreview(null);
            }
        } catch (err) {
            setModalDetalle((prev) => ({ ...prev, error: `Error al abrir "${nombre}": ${err.message}` }));
        } finally {
            setModalCargandoArchivo(null);
        }
    }

    return (
        // Mismo patron que CompraRapida.jsx: flex column centrada -- el
        // formulario de busqueda (con maxWidth propio) queda centrado en
        // la pagina en vez de pegado a la izquierda, y los elementos con
        // w-100 (la grilla de tarjetas) igual ocupan todo el ancho porque
        // align-items:center solo afecta a los que NO tienen ancho propio.
        <div className="d-flex flex-column align-items-center flex-min-w-0 p-4">
            <h1>Consulta Licitación</h1>
            <p>Ingrese el código de una Licitación (ej: 1234-5-COT26) para ver su detalle.</p>

            <form className="card-panel d-flex flex-wrap gap-2 mb-4" style={{ maxWidth: "560px" }} onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="form-control flex-grow-1"
                    style={{ minWidth: "220px" }}
                    placeholder="Código de licitación"
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
            </form>

            {/* Resultado de la busqueda por codigo -- va JUSTO despues del
                formulario, no al final de la pagina (si no, con "Ver todo"
                listando 15 tarjetas antes, quedaba enterrado mas abajo). */}
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

            {preview && <FilePreviewPanel preview={preview} onClose={() => setPreview(null)} />}

            {data && (
                <div className="card-panel mb-3" style={{ width: "100%", maxWidth: "760px" }}>
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
                        <RecomendarBoton
                            codigoExterno={data?.Listado?.[0]?.CodigoExterno}
                            tipo="LICITACION"
                            yaAsignada={misCodigos.has(data?.Listado?.[0]?.CodigoExterno)}
                            onAsignado={(codigo) => setMisCodigos((prev) => new Set(prev).add(codigo))}
                            onQuitado={(codigo) => setMisCodigos((prev) => { const next = new Set(prev); next.delete(codigo); return next; })}
                        />
                        <AsignacionesCompaneroBadge usuarios={asignacionesCompaneros.get(data?.Listado?.[0]?.CodigoExterno)} />
                        {esAdmin && data?.Listado?.[0]?.CodigoExterno && (
                            <AsignarBoton codigoExterno={data.Listado[0].CodigoExterno} tipo="LICITACION" />
                        )}
                    </div>
                    <DetalleItem tipo="LICITACION" item={data?.Listado?.[0]} />
                </div>
            )}

            {/* "Ver todo" = /listar (cartera completa, paginada).
                "Ver mi filtro" = /mi-filtro (acotado ademas por el perfil de
                la empresa -- rubro/palabras clave/region). Cada boton ya
                dispara la carga solo -- no hace falta un "Mostrar
                licitaciones" aparte (antes exigia ese segundo click incluso
                para la vista por defecto). */}
            <div className="btn-group mb-3" role="group">
                <button
                    type="button"
                    className={`btn btn-sm ${vista === "todas" ? "btn-primary" : "btn-outline-secondary"}`}
                    disabled={listLoading}
                    onClick={() => {
                        setVista("todas");
                        setPagina(1);
                        obtenerTodasLicitaciones(1, "todas");
                    }}
                >
                    Ver todo
                </button>
                <button
                    type="button"
                    className={`btn btn-sm ${vista === "filtro" ? "btn-primary" : "btn-outline-secondary"}`}
                    disabled={listLoading}
                    onClick={() => {
                        setVista("filtro");
                        setPagina(1);
                        obtenerTodasLicitaciones(1, "filtro");
                    }}
                >
                    Ver mi filtro
                </button>
            </div>

            {listLoading && licitaciones.length === 0 && <p className="text-muted">Cargando licitaciones...</p>}

            {licitaciones.length > 0 && (
                <div className="w-100 mb-4">
                    <h5>Licitaciones encontradas</h5>
                    <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
                        {licitaciones.map((item) => (
                            <div className="col" key={item.CodigoExterno}>
                                <LicitacionCard
                                    item={item}
                                    onClick={() => abrirModal(item.CodigoExterno)}
                                    asignadaAMi={misCodigos.has(item.CodigoExterno)}
                                    otrosUsuarios={asignacionesCompaneros.get(item.CodigoExterno)}
                                />
                            </div>
                        ))}
                    </div>
                    <Paginador paginacion={paginacion} onCambiar={(nuevaPagina) => obtenerTodasLicitaciones(nuevaPagina)} />
                </div>
            )}

            <Modal show={!!modalCodigo} onClose={cerrarModal} titulo={modalCodigo ? `Licitación ${modalCodigo}` : ""}>
                {modalDetalle?.cargando && <p className="text-muted mb-0">Cargando...</p>}
                {modalDetalle?.error && <div className="alert alert-danger">{modalDetalle.error}</div>}
                {modalDetalle?.item && (
                    <>
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
                            <RecomendarBoton
                                codigoExterno={modalCodigo}
                                tipo="LICITACION"
                                yaAsignada={misCodigos.has(modalCodigo)}
                                onAsignado={(codigo) => setMisCodigos((prev) => new Set(prev).add(codigo))}
                                onQuitado={(codigo) => setMisCodigos((prev) => { const next = new Set(prev); next.delete(codigo); return next; })}
                            />
                            <AsignacionesCompaneroBadge usuarios={asignacionesCompaneros.get(modalCodigo)} />
                            {esAdmin && <AsignarBoton codigoExterno={modalCodigo} tipo="LICITACION" />}
                        </div>

                        <DetalleItem tipo="LICITACION" item={modalDetalle.item} />

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
                            {modalPreview && <FilePreviewPanel preview={modalPreview} onClose={() => setModalPreview(null)} />}
                        </div>
                    </>
                )}
            </Modal>

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

            {preview && <FilePreviewPanel preview={preview} onClose={() => setPreview(null)} />}

            {data && (
                <div className="card-panel mb-3">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
                        <RecomendarBoton
                            codigoExterno={data?.Listado?.[0]?.CodigoExterno}
                            tipo="LICITACION"
                            yaAsignada={misCodigos.has(data?.Listado?.[0]?.CodigoExterno)}
                            onAsignado={(codigo) => setMisCodigos((prev) => new Set(prev).add(codigo))}
                            onQuitado={(codigo) => setMisCodigos((prev) => { const next = new Set(prev); next.delete(codigo); return next; })}
                        />
                        <AsignacionesCompaneroBadge usuarios={asignacionesCompaneros.get(data?.Listado?.[0]?.CodigoExterno)} />
                        {esAdmin && data?.Listado?.[0]?.CodigoExterno && (
                            <AsignarBoton codigoExterno={data.Listado[0].CodigoExterno} tipo="LICITACION" />
                        )}
                    </div>
                    <DetalleItem tipo="LICITACION" item={data?.Listado?.[0]} />
                </div>
            )}
        </div>
    );
}

export default Licitacion;
