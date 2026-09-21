import { useEffect, useState } from "react";

import { authFetch } from "../lib/api.js";

// Tasa de IVA fija (Chile). Si alguna vez hace falta otra tasa, este es
// el unico lugar que hay que tocar.
const TASA_IVA = 0.19;

// Opciones fijas para los campos de "Datos de la cotización" -- antes
// eran texto libre, se acotaron a valores concretos a pedido. El primer
// valor de cada lista es el que queda preseleccionado por defecto (un
// <select> sin <option> vacia siempre muestra el primero).
const MONEDAS = ["CLP", "USD", "EURO", "UF"];
const PLAZOS_ENVIO_DIAS = [1, 2, 3, 4, 5, 10, 20, 30, 45, 60];
// 0 = "Sin crédito" (esta cotización no lleva plazo de crédito).
const PLAZOS_CREDITO_DIAS = [0, 30, 45, 90];
const VALIDEZ_DIAS = [15, 30, 60, 90];
const FORMAS_ENVIO = ["Despacho a domicilio", "Retiro en bodega/local", "Despacho por transportista", "Correo electrónico"];

// Igual idea que archivoABase64 en MiEmpresa.jsx (readAsDataURL da
// "data:tipo/subtipo;base64,AAAA...", el backend solo quiere la parte de
// despues de la coma).
function archivoABase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Debe coincidir con AsignacionDocumentoService.PESO_MAX_BYTES en el
// backend, para avisar antes de mandar el archivo.
const DOCUMENTO_PESO_MAX = 10_000_000; // 10 MB

// CLP sin decimales (nunca se usan centavos de peso chileno, igual que en
// Mercado Publico) -- cualquier otra moneda (dolares, UF, UTM, etc.) SI
// lleva 2 decimales fijos, porque esas si tienen unidades fraccionarias
// reales. "moneda" es texto libre (ver CotizacionCompraAgil), por eso se
// compara sin importar mayusculas/espacios.
export function formatearMonto(numero, moneda) {
    const esClp = !moneda || moneda.trim().toUpperCase() === "CLP";
    return Number(numero || 0).toLocaleString("es-CL", esClp
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Arma las lineas iniciales de la tabla a partir de los productos
// solicitados del detalle (cantidad/unidad ya vienen de ahi, fijos) mas lo
// que ya se habia guardado antes (valorUnitario, detalleDescripcion) --
// matcheado por POSICION (indice), no por codigo_producto: Mercado Publico
// puede repetir el mismo codigo en mas de una linea de una misma compra
// (ej. varios "Audífonos" distintos pedidos bajo el mismo codigo generico),
// y matchear por codigo hacia que escribir el valor de una linea
// sobreescribiera TODAS las que compartian codigo (ver actualizarLinea, el
// mismo bug estaba ahi). El orden de "productos" es estable entre pedidos
// para una misma compra, asi que la posicion es un identificador seguro.
// "detalleDescripcion" arranca sembrado con la descripcion original del
// producto (si no habia nada guardado todavia) -- ahorra tener que
// retipear desde cero, y se puede editar libre despues (ej. agregar el
// detalle en formato de lista que va en la cotizacion final, ver
// generarCotizacionPdf.js).
function construirLineasIniciales(productos, guardado) {
    const guardadas = guardado?.lineas || [];
    return (productos || []).map((p, indice) => {
        const previa = guardadas[indice];
        return {
            codigoProducto: String(p.codigo_producto ?? ""),
            nombre: p.nombre,
            descripcionOriginal: p.descripcion,
            cantidad: p.cantidad,
            unidadMedida: p.unidad_medida,
            valorUnitario: previa?.valorUnitario ?? "",
            detalleDescripcion: previa?.detalleDescripcion ?? p.descripcion ?? "",
        };
    });
}

// Herramienta de cotizacion para la fase ANALISIS de una Compra Agil --
// misma idea que la pantalla "Participar de la Compra Agil" de Mercado
// Publico (lista de productos solicitados, valor unitario por linea con
// subtotal automatico, despacho, IVA afecto/exento y el total), mas los
// datos propios de la cotizacion final que arma la empresa (tiempo de
// envio, forma de envio, plazo credito, validez, moneda, tipo de cambio)
// -- ver generarCotizacionPdf.js, que lee todo esto ya guardado para
// armar el PDF descargable en la fase DESARROLLO. Se arma y calcula todo
// del lado del cliente; al guardar se manda como JSON opaco a
// auth-service (ver AsignacionService.actualizarCotizacion), que no
// necesita entender su estructura, solo persistirla.
export default function CotizacionCompraAgil({ asignacionId, productos, valorInicial, onGuardar }) {
    const [lineas, setLineas] = useState(() => construirLineasIniciales(productos, valorInicial));
    const [valorDespacho, setValorDespacho] = useState(valorInicial?.valorDespacho ?? "");
    const [ivaAfecto, setIvaAfecto] = useState(valorInicial?.ivaAfecto ?? true);

    // Datos de la cotizacion final -- los completa quien arma la
    // cotizacion (a diferencia de "Vendedor", que se toma solo del
    // usuario conectado al generar el PDF, no se pide aca).
    const [moneda, setMoneda] = useState(valorInicial?.moneda ?? MONEDAS[0]);
    const [tiempoEnvio, setTiempoEnvio] = useState(valorInicial?.tiempoEnvio ?? String(PLAZOS_ENVIO_DIAS[0]));
    // Una sola opcion, no varias a la vez ("es uno u otro"). Compatibilidad
    // con borradores guardados durante la breve ventana en que esto fue un
    // arreglo (checkbox de multiple seleccion): si hay uno guardado, se usa
    // el primer valor.
    const [formaEnvio, setFormaEnvio] = useState(
        Array.isArray(valorInicial?.formaEnvio) ? (valorInicial.formaEnvio[0] ?? FORMAS_ENVIO[0]) : (valorInicial?.formaEnvio || FORMAS_ENVIO[0])
    );
    // Preseleccionado en 30, no en el primero del arreglo (0 = "Sin
    // crédito") -- la mayoria de las cotizaciones SI llevan credito.
    const [plazoCredito, setPlazoCredito] = useState(valorInicial?.plazoCredito ?? "30");
    const [validez, setValidez] = useState(valorInicial?.validez ?? String(VALIDEZ_DIAS[0]));
    const [tipoCambio, setTipoCambio] = useState(valorInicial?.tipoCambio ?? "");
    // Unico dato de contacto que no sale de ningun lado automatico -- el
    // nombre/correo del vendedor se toman del usuario conectado recien al
    // generar el PDF (ver GenerarCotizacionBoton.jsx), pero el telefono no
    // se guarda en el perfil de ningun usuario, asi que hay que pedirlo aca.
    const [telefonoContacto, setTelefonoContacto] = useState(valorInicial?.telefonoContacto ?? "");

    // Documentacion necesaria para presentar esta compra agil, y una nota
    // libre de analisis -- a diferencia de los datos de arriba (que van al
    // PDF de la cotizacion), esto es informacion interna de trabajo, no
    // aparece en el PDF. "documentacionRequerida" (el campo de texto que
    // describia que se necesitaba) se saco -- quedo redundante con los
    // archivos reales que ahora se suben al lado (ver "documentos" mas
    // abajo).
    const [notaAnalisis, setNotaAnalisis] = useState(valorInicial?.notaAnalisis ?? "");

    // Archivos subidos de verdad (ver AsignacionDocumentoController) --
    // aparte del campo de texto de arriba, que sigue existiendo para
    // anotar QUE se necesita aunque todavia no este subido.
    const [documentos, setDocumentos] = useState([]);
    const [cargandoDocumentos, setCargandoDocumentos] = useState(false);
    const [subiendoDocumento, setSubiendoDocumento] = useState(false);
    const [errorDocumento, setErrorDocumento] = useState(null);

    const [guardando, setGuardando] = useState(false);
    const [guardadoOk, setGuardadoOk] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!asignacionId) return;
        let cancelado = false;
        setCargandoDocumentos(true);
        authFetch(`/auth/asignaciones/${asignacionId}/documentos`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar la lista de documentos"))))
            .then((lista) => { if (!cancelado) setDocumentos(lista); })
            .catch(() => { if (!cancelado) setErrorDocumento("No se pudo cargar la lista de documentos"); })
            .finally(() => { if (!cancelado) setCargandoDocumentos(false); });
        return () => { cancelado = true; };
    }, [asignacionId]);

    async function subirDocumento(file) {
        if (!file || !asignacionId) return;
        if (file.size > DOCUMENTO_PESO_MAX) {
            setErrorDocumento(`El archivo pesa demasiado (máx. ${DOCUMENTO_PESO_MAX / 1_000_000} MB)`);
            return;
        }
        setSubiendoDocumento(true);
        setErrorDocumento(null);
        try {
            const contenidoBase64 = await archivoABase64(file);
            const res = await authFetch(`/auth/asignaciones/${asignacionId}/documentos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombreArchivo: file.name, tipoContenido: file.type || null, contenidoBase64 }),
            });
            if (!res.ok) throw new Error("No se pudo subir el archivo");
            const documento = await res.json();
            setDocumentos((prev) => [...prev, documento]);
        } catch (err) {
            setErrorDocumento(err.message);
        } finally {
            setSubiendoDocumento(false);
        }
    }

    async function descargarDocumento(documento) {
        try {
            const res = await authFetch(`/auth/documentos/${documento.id}`);
            if (!res.ok) throw new Error("No se pudo descargar el archivo");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const enlace = window.document.createElement("a");
            enlace.href = url;
            enlace.download = documento.nombreArchivo;
            enlace.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setErrorDocumento(err.message);
        }
    }

    async function eliminarDocumento(documentoId) {
        try {
            const res = await authFetch(`/auth/documentos/${documentoId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("No se pudo eliminar el archivo");
            setDocumentos((prev) => prev.filter((d) => d.id !== documentoId));
        } catch (err) {
            setErrorDocumento(err.message);
        }
    }

    // Por indice, no por codigoProducto -- ver el comentario en
    // construirLineasIniciales, el mismo codigo puede repetirse en mas de
    // una linea.
    function actualizarLinea(indice, campo, valor) {
        setGuardadoOk(false);
        setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
    }

    function actualizarCampo(setter) {
        return (valor) => {
            setGuardadoOk(false);
            setter(valor);
        };
    }

    const lineasConSubtotal = lineas.map((l) => ({
        ...l,
        subtotal: (Number(l.cantidad) || 0) * (Number(l.valorUnitario) || 0),
    }));
    const valorProductos = lineasConSubtotal.reduce((acum, l) => acum + l.subtotal, 0);
    const despachoNumero = Number(valorDespacho) || 0;
    const valorNeto = valorProductos + despachoNumero;
    const montoExento = ivaAfecto ? 0 : valorNeto;
    const montoIva = ivaAfecto ? Math.round(valorNeto * TASA_IVA) : 0;
    const montoTotal = valorNeto + montoIva;

    async function guardar() {
        setGuardando(true);
        setError(null);
        try {
            await onGuardar({
                lineas: lineasConSubtotal.map((l) => ({
                    codigoProducto: l.codigoProducto,
                    nombre: l.nombre,
                    cantidad: l.cantidad,
                    unidadMedida: l.unidadMedida,
                    valorUnitario: Number(l.valorUnitario) || 0,
                    subtotal: l.subtotal,
                    detalleDescripcion: l.detalleDescripcion,
                })),
                valorDespacho: despachoNumero,
                ivaAfecto,
                valorNeto,
                montoExento,
                montoIva,
                montoTotal,
                moneda,
                tiempoEnvio,
                formaEnvio,
                plazoCredito,
                validez,
                tipoCambio: Number(tipoCambio) || null,
                telefonoContacto,
                notaAnalisis,
            });
            setGuardadoOk(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    }

    if (lineas.length === 0) {
        return (
            <div className="mt-3 pt-3 border-top">
                <h6 className="mb-2">Cotización</h6>
                <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                    Esta compra no trae productos solicitados con los que armar una cotización.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-3 pt-3 border-top">
            <h6 className="mb-2">Cotización</h6>

            {/* Una tarjeta grande por producto -- antes era una tabla, pero con
                productos repetidos (mismo nombre, distinta descripcion, ver el
                bug de "editar uno pisaba los demas") las filas se mezclaban
                visualmente sin ningun limite claro entre una y otra. */}
            <div className="d-flex flex-column gap-3 mb-3">
                {lineasConSubtotal.map((l, indice) => (
                    <div key={indice} className="card border" style={{ background: "var(--bg-elevated-2)", borderColor: "var(--border)" }}>
                        <div className="card-body p-3">
                            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                                <div style={{ color: "var(--text-h)", fontWeight: 600 }}>{l.nombre}</div>
                                <span className="text-muted text-nowrap" style={{ fontSize: "0.85rem" }}>{l.cantidad} {l.unidadMedida}</span>
                            </div>

                            <div className="row g-3 mb-3">
                                <div className="col-sm-6 col-md-4">
                                    <label className="form-label mb-1 text-muted" style={{ fontSize: "0.75rem" }}>Valor unitario</label>
                                    <div className="input-group input-group-sm">
                                        <span className="input-group-text">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            className="form-control"
                                            value={l.valorUnitario}
                                            onChange={(e) => actualizarLinea(indice, "valorUnitario", e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="col-sm-6 col-md-4">
                                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>Subtotal</div>
                                    <div style={{ color: "var(--text-h)", fontVariantNumeric: "tabular-nums" }}>
                                        {formatearMonto(l.subtotal, moneda)}
                                    </div>
                                </div>
                            </div>

                            <label className="form-label mb-1 text-muted" style={{ fontSize: "0.75rem" }}>
                                Descripción para la cotización
                            </label>
                            <textarea
                                className="form-control form-control-sm"
                                rows={3}
                                style={{ resize: "none" }}
                                value={l.detalleDescripcion}
                                onChange={(e) => actualizarLinea(indice, "detalleDescripcion", e.target.value)}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="row g-3 align-items-end mb-3">
                <div className="col-sm-6 col-lg-4">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Valor de despacho</label>
                    <div className="input-group input-group-sm">
                        <span className="input-group-text">$</span>
                        <input
                            type="number"
                            min="0"
                            className="form-control"
                            value={valorDespacho}
                            onChange={(e) => actualizarCampo(setValorDespacho)(e.target.value)}
                        />
                    </div>
                </div>
                <div className="col-sm-6 col-lg-4">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>IVA</label>
                    <select
                        className="form-control form-control-sm"
                        value={ivaAfecto ? "afecto" : "exento"}
                        onChange={(e) => actualizarCampo(setIvaAfecto)(e.target.value === "afecto")}
                    >
                        <option value="afecto">Afecto (19%)</option>
                        <option value="exento">Exento</option>
                    </select>
                </div>
            </div>

            {/* Datos de la cotizacion final -- los usa generarCotizacionPdf.js
                (boton "Generar cotización" en la fase DESARROLLO). "Vendedor"
                no se pide aca -- se toma directo del usuario conectado recien
                al generar el PDF. */}
            <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Datos de la cotización</p>
            <div className="row g-3 mb-3">
                <div className="col-sm-6 col-lg-4">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Moneda</label>
                    <select className="form-control form-control-sm" value={moneda}
                        onChange={(e) => actualizarCampo(setMoneda)(e.target.value)}>
                        {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="col-sm-6 col-lg-4">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Tipo de cambio</label>
                    <input type="number" min="0" className="form-control form-control-sm" value={tipoCambio}
                        onChange={(e) => actualizarCampo(setTipoCambio)(e.target.value)} placeholder="Solo si Moneda no es CLP" />
                </div>
                <div className="col-sm-6 col-lg-4">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Tiempo de envío</label>
                    <select className="form-control form-control-sm" value={tiempoEnvio}
                        onChange={(e) => actualizarCampo(setTiempoEnvio)(e.target.value)}>
                        {PLAZOS_ENVIO_DIAS.map((d) => <option key={d} value={d}>{d} día{d === 1 ? "" : "s"}</option>)}
                    </select>
                </div>
                <div className="col-sm-6 col-lg-4">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Plazo crédito</label>
                    <select className="form-control form-control-sm" value={plazoCredito}
                        onChange={(e) => actualizarCampo(setPlazoCredito)(e.target.value)}>
                        {PLAZOS_CREDITO_DIAS.map((d) => <option key={d} value={d}>{d === 0 ? "Sin crédito" : `${d} días`}</option>)}
                    </select>
                </div>
                <div className="col-sm-6 col-lg-4">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Validez</label>
                    <select className="form-control form-control-sm" value={validez}
                        onChange={(e) => actualizarCampo(setValidez)(e.target.value)}>
                        {VALIDEZ_DIAS.map((d) => <option key={d} value={d}>{d} días</option>)}
                    </select>
                </div>
                <div className="col-sm-6 col-lg-4">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Teléfono de contacto</label>
                    <input type="text" className="form-control form-control-sm" value={telefonoContacto}
                        onChange={(e) => actualizarCampo(setTelefonoContacto)(e.target.value)} placeholder="Para el pie de la cotización" />
                </div>
                <div className="col-12">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Forma de envío</label>
                    <div className="d-flex flex-wrap gap-3">
                        {FORMAS_ENVIO.map((opcion) => (
                            <div className="form-check" key={opcion}>
                                <input type="radio" className="form-check-input" id={`forma-envio-${opcion}`} name="forma-envio"
                                    checked={formaEnvio === opcion} onChange={() => actualizarCampo(setFormaEnvio)(opcion)} />
                                <label className="form-check-label" htmlFor={`forma-envio-${opcion}`} style={{ fontSize: "0.85rem" }}>
                                    {opcion}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Info de trabajo interna -- no va al PDF de la cotizacion, es
                para coordinar dentro del equipo. */}
            <p className="mb-2 text-muted" style={{ fontSize: "0.8rem" }}>Documentación y notas</p>
            <div className="row g-3 mb-3">
                <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Documentación necesaria</label>

                    {asignacionId && (
                        <div>
                            <input type="file" className="form-control form-control-sm" disabled={subiendoDocumento}
                                onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; subirDocumento(file); }} />
                            {subiendoDocumento && <p className="text-muted mt-1 mb-0" style={{ fontSize: "0.75rem" }}>Subiendo...</p>}
                            {errorDocumento && <p className="text-danger mt-1 mb-0" style={{ fontSize: "0.75rem" }}>{errorDocumento}</p>}
                            {cargandoDocumentos && <p className="text-muted mt-1 mb-0" style={{ fontSize: "0.75rem" }}>Cargando documentos...</p>}
                            {documentos.length > 0 && (
                                <ul className="list-unstyled mt-2 mb-0" style={{ fontSize: "0.8rem" }}>
                                    {documentos.map((d) => (
                                        <li key={d.id} className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                            <button type="button" className="btn btn-link btn-sm p-0 text-truncate text-start"
                                                onClick={() => descargarDocumento(d)} title={d.nombreArchivo}>
                                                <i className="bi bi-file-earmark-arrow-down me-1" />{d.nombreArchivo}
                                            </button>
                                            <button type="button" className="btn btn-link btn-sm p-0 text-danger flex-shrink-0"
                                                onClick={() => eliminarDocumento(d.id)} title="Eliminar">
                                                <i className="bi bi-trash" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
                <div className="col-md-6">
                    <label className="form-label mb-1" style={{ fontSize: "0.8rem" }}>Nota</label>
                    <textarea className="form-control form-control-sm" rows={3} style={{ resize: "none" }} value={notaAnalisis}
                        onChange={(e) => actualizarCampo(setNotaAnalisis)(e.target.value)}
                        placeholder="Cualquier observación para quien siga con esta compra." />
                </div>
            </div>

            <div className="p-3" style={{ background: "var(--bg-elevated-2)", borderRadius: "8px" }}>
                <div className="d-flex justify-content-between" style={{ fontSize: "0.85rem" }}>
                    <span className="text-muted">Subtotal {moneda}</span>
                    <span className="text-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{formatearMonto(valorNeto, moneda)}</span>
                </div>
                <div className="d-flex justify-content-between" style={{ fontSize: "0.85rem" }}>
                    <span className="text-muted">Exentos {moneda}</span>
                    <span className="text-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{formatearMonto(montoExento, moneda)}</span>
                </div>
                <div className="d-flex justify-content-between" style={{ fontSize: "0.85rem" }}>
                    <span className="text-muted">Monto IVA {ivaAfecto ? "(19%)" : ""}</span>
                    <span className="text-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{formatearMonto(montoIva, moneda)}</span>
                </div>
                <div className="d-flex justify-content-between mt-1 pt-1 border-top">
                    <strong>Total {moneda}</strong>
                    <strong className="text-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{formatearMonto(montoTotal, moneda)}</strong>
                </div>
            </div>

            <div className="d-flex align-items-center gap-2 mt-3">
                <button type="button" className="btn btn-sm btn-primary" onClick={guardar} disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar cotización"}
                </button>
                {guardadoOk && <span className="text-success" style={{ fontSize: "0.85rem" }}>Guardado.</span>}
                {error && <span className="text-danger" style={{ fontSize: "0.85rem" }}>{error}</span>}
            </div>
        </div>
    );
}
