import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Genera y descarga el PDF de una cotizacion de Compra Agil, con el
// mismo contenido que la planilla de referencia (cliente, vendedor,
// terminos, items, totales, condiciones comerciales, firma) -- ver
// CotizacionCompraAgil.jsx para de donde sale cada dato. No es una copia
// pixel-perfect de esa planilla (no se tiene el archivo original, solo
// una foto) -- prioriza que la info este completa y prolija por sobre
// calcar el diseño exacto.
//
// Multi-tenant: nombre/rut/direccion/telefono/logo/condicionesComerciales
// vienen del "empresa" que le pasa GenerarCotizacionBoton.jsx (leidos de
// /auth/empresas/{id}/marca-cotizacion, configurable por cada empresa
// desde Mi Empresa) -- nada de esto queda fijo en el codigo.

// Rojo por defecto -- se usa si la empresa todavia no eligio un color
// (ver COLORES_COTIZACION en MiEmpresa.jsx, tiene que coincidir con el
// primero de esa lista).
const ROJO_DEFAULT = [166, 25, 40];
const GRIS = [110, 110, 110];
const MARGEN = 15;
const ANCHO_PAGINA = 210;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;

// "#RRGGBB" -> [r, g, b]. null si no viene o el formato no es el
// esperado (nunca revienta la generacion del PDF por un color raro,
// simplemente usa el default).
function hexARgb(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}

function formatearFechaHoy() {
    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2, "0");
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    return `${dd}-${mm}-${hoy.getFullYear()}`;
}

// CLP sin decimales, cualquier otra moneda (dolares, UF, UTM, etc.) con 2
// decimales fijos -- mismo criterio que CotizacionCompraAgil.jsx.
function formatearMonto(numero, moneda) {
    const esClp = !moneda || moneda.trim().toUpperCase() === "CLP";
    return Number(numero || 0).toLocaleString("es-CL", esClp
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Asegura que quede espacio para lo que sigue -- si no, agrega una
// pagina nueva y devuelve el cursor reseteado al margen superior. El
// item table de autoTable ya pagina solo; esto es para los bloques que
// se dibujan a mano DESPUES de la tabla (totales, condiciones, firma).
function asegurarEspacio(doc, y, alturaNecesaria) {
    if (y + alturaNecesaria > 280) {
        doc.addPage();
        return MARGEN;
    }
    return y;
}

export function generarCotizacionPdf({ codigoExterno, cotizacion, institucion, vendedor, empresa, logoDataUrl }) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const moneda = cotizacion.moneda || "CLP";
    const colorPrincipal = hexARgb(empresa?.colorPrincipal) || ROJO_DEFAULT;

    // ---------------------------------------------------------- Encabezado
    // Con logo cargado, se dibuja la imagen (tamaño real, escalado para
    // no pasar de una caja de 32x14mm, preservando proporción -- el logo
    // ya viene limitado a 400x200px del lado del servidor, ver
    // MarcaCotizacionService). Sin logo, el nombre de la empresa como
    // texto hace de encabezado.
    if (logoDataUrl) {
        try {
            const props = doc.getImageProperties(logoDataUrl);
            const cajaAncho = 32;
            const cajaAlto = 14;
            const escala = Math.min(cajaAncho / props.width, cajaAlto / props.height);
            doc.addImage(logoDataUrl, MARGEN, 12, props.width * escala, props.height * escala);
        } catch {
            // Si el logo guardado no se puede leer (formato raro, dato
            // corrupto), no se corta la generación del PDF por eso -- se
            // sigue sin logo, como si no hubiera uno cargado.
        }
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...colorPrincipal);
        doc.text(empresa?.nombre || "—", MARGEN, 20);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    if (empresa?.rut) doc.text(`RUT: ${empresa.rut}`, ANCHO_PAGINA - MARGEN, 15, { align: "right" });
    if (empresa?.direccion) doc.text(empresa.direccion, ANCHO_PAGINA - MARGEN, 19.5, { align: "right" });
    if (empresa?.telefono) doc.text(`Teléfono: ${empresa.telefono}`, ANCHO_PAGINA - MARGEN, 24, { align: "right" });

    doc.setDrawColor(...colorPrincipal);
    doc.setLineWidth(0.6);
    doc.line(MARGEN, 29, ANCHO_PAGINA - MARGEN, 29);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text("COTIZACIÓN", ANCHO_PAGINA / 2, 39, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Fecha: ${formatearFechaHoy()}`, MARGEN, 47);
    doc.text(`N° Cotización: COT-${codigoExterno}`, ANCHO_PAGINA - MARGEN, 47, { align: "right" });

    // -------------------------------------------------------------- Cliente
    const filasCliente = [
        ["Nombre", institucion?.organismo_comprador || "—"],
        ["RUT", institucion?.rut || "—"],
        ["Unidad de compra", institucion?.unidad_compra || "—"],
        ["Región", institucion?.nombre_region || "—"],
    ];
    let y = 53;
    doc.setFillColor(...colorPrincipal);
    doc.rect(MARGEN, y, ANCHO_UTIL, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("CLIENTE", MARGEN + 2, y + 4.3);
    y += 6;

    const altoCliente = filasCliente.length * 5.5 + 3;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(MARGEN, y, ANCHO_UTIL, altoCliente, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    filasCliente.forEach(([etiqueta, valor], i) => {
        const yFila = y + 5 + i * 5.5;
        doc.setFont("helvetica", "bold");
        doc.text(`${etiqueta}:`, MARGEN + 3, yFila);
        doc.setFont("helvetica", "normal");
        doc.text(String(valor), MARGEN + 40, yFila);
    });
    y += altoCliente + 5;

    // ------------------------------------------------ Terminos (una fila)
    const vendedorNombre = [vendedor?.name, vendedor?.lastName].filter(Boolean).join(" ") || vendedor?.username || "—";
    // "formaEnvio" es una unica opcion elegida (ver CotizacionCompraAgil.jsx)
    // -- Array.isArray() cubre los borradores guardados durante la breve
    // ventana en que fue un arreglo (checkbox de multiple seleccion).
    const formaEnvioTexto = Array.isArray(cotizacion.formaEnvio)
        ? (cotizacion.formaEnvio[0] || "—")
        : (cotizacion.formaEnvio || "—");
    autoTable(doc, {
        startY: y,
        margin: { left: MARGEN, right: MARGEN },
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 30, 30] },
        headStyles: { fillColor: colorPrincipal, textColor: 255, fontStyle: "bold" },
        head: [["VENDEDOR", "MONEDA", "TIEMPO DE ENVÍO", "FORMA DE ENVÍO", "PLAZO CRÉDITO", "VALIDEZ"]],
        body: [[
            vendedorNombre,
            moneda,
            cotizacion.tiempoEnvio ? `${cotizacion.tiempoEnvio} día${cotizacion.tiempoEnvio === "1" ? "" : "s"}` : "—",
            formaEnvioTexto,
            // "0" = Sin crédito (ver PLAZOS_CREDITO_DIAS en CotizacionCompraAgil.jsx).
            cotizacion.plazoCredito === "0" ? "Sin crédito" : (cotizacion.plazoCredito ? `${cotizacion.plazoCredito} días` : "—"),
            cotizacion.validez ? `${cotizacion.validez} días` : "—",
        ]],
    });
    y = doc.lastAutoTable.finalY + 6;

    // ------------------------------------------------------------ Items
    autoTable(doc, {
        startY: y,
        margin: { left: MARGEN, right: MARGEN },
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2.5, valign: "top" },
        headStyles: { fillColor: colorPrincipal, textColor: 255, fontStyle: "bold", halign: "center" },
        columnStyles: {
            0: { cellWidth: 20, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 28, halign: "right" },
            3: { cellWidth: 28, halign: "right" },
        },
        head: [["CANTIDAD", "DESCRIPCIÓN", `PRECIO ${moneda}`, `TOTAL ${moneda}`]],
        body: (cotizacion.lineas || []).map((l) => [
            `${l.cantidad ?? ""} ${l.unidadMedida || ""}`.trim(),
            l.detalleDescripcion || l.nombre || "",
            formatearMonto(l.valorUnitario, moneda),
            formatearMonto(l.subtotal, moneda),
        ]),
    });
    y = doc.lastAutoTable.finalY + 6;

    // ----------------------------------------------------------- Totales
    y = asegurarEspacio(doc, y, 32);
    const anchoTotales = 70;
    const xTotales = ANCHO_PAGINA - MARGEN - anchoTotales;
    const filasTotales = [
        [`Subtotal ${moneda}`, formatearMonto(cotizacion.valorNeto, moneda)],
        [`Exentos ${moneda}`, formatearMonto(cotizacion.montoExento, moneda)],
        [`Monto IVA`, formatearMonto(cotizacion.montoIva, moneda)],
    ];
    doc.setDrawColor(200, 200, 200);
    doc.setFontSize(9);
    filasTotales.forEach(([etiqueta, valor], i) => {
        const yFila = y + i * 5.5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GRIS);
        doc.text(etiqueta, xTotales, yFila);
        doc.setTextColor(30, 30, 30);
        doc.text(valor, ANCHO_PAGINA - MARGEN, yFila, { align: "right" });
    });
    const yTotalFinal = y + filasTotales.length * 5.5 + 2;
    doc.setLineWidth(0.4);
    doc.line(xTotales, yTotalFinal - 4, ANCHO_PAGINA - MARGEN, yTotalFinal - 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...colorPrincipal);
    doc.text(`Total ${moneda}`, xTotales, yTotalFinal);
    doc.text(formatearMonto(cotizacion.montoTotal, moneda), ANCHO_PAGINA - MARGEN, yTotalFinal, { align: "right" });
    y = yTotalFinal + 6;

    if (cotizacion.tipoCambio) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...GRIS);
        // El tipo de cambio en si SIEMPRE lleva decimales (es una tasa, no
        // un monto de la cotizacion) -- no pasa por el criterio de "CLP
        // sin decimales", por eso no usa "moneda" acá.
        doc.text(`T/C referencial: $${cotizacion.tipoCambio.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, xTotales, y);
        y += 6;
    }

    // ------------------------------------------------- Condiciones comerciales
    // Texto libre propio de cada empresa (ver Mi Empresa -- Base de
    // cotización) -- si todavia no cargaron nada, se salta la sección
    // entera en vez de mostrar un encabezado vacío.
    if (empresa?.condicionesComerciales) {
        y = asegurarEspacio(doc, y, 32);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);
        doc.text("Condiciones Comerciales", MARGEN, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GRIS);
        empresa.condicionesComerciales.split("\n").filter((linea) => linea.trim()).forEach((linea) => {
            const partes = doc.splitTextToSize(linea, ANCHO_UTIL);
            doc.text(partes, MARGEN, y);
            y += partes.length * 3.8;
        });
        y += 8;
    }

    // --------------------------------------------------------- Datos bancarios
    // Igual que condiciones comerciales: si la empresa todavia no cargo
    // nada, se salta la seccion entera en vez de mostrar un encabezado
    // vacio. Alcanza con que haya al menos un dato para mostrar el bloque.
    if (empresa?.banco || empresa?.numeroCuenta) {
        y = asegurarEspacio(doc, y, 22);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);
        doc.text("Datos Bancarios", MARGEN, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GRIS);
        const filasBanco = [
            empresa.banco && `Banco: ${empresa.banco}`,
            empresa.tipoCuenta && `Tipo de cuenta: ${empresa.tipoCuenta}`,
            empresa.numeroCuenta && `N° de cuenta: ${empresa.numeroCuenta}`,
            empresa.rut && `RUT: ${empresa.rut}`,
        ].filter(Boolean);
        filasBanco.forEach((linea) => {
            doc.text(linea, MARGEN, y);
            y += 4;
        });
        y += 4;
    }

    // ------------------------------------------------------------- Firma
    y = asegurarEspacio(doc, y, 25);
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, y, MARGEN + 70, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(vendedorNombre, MARGEN, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS);
    if (vendedor?.email) {
        doc.text(`Correo: ${vendedor.email}`, MARGEN, y);
        y += 4.2;
    }
    if (cotizacion.telefonoContacto) {
        doc.text(`Teléfono: ${cotizacion.telefonoContacto}`, MARGEN, y);
        y += 4.2;
    }

    if (empresa?.nombre) {
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...colorPrincipal);
        doc.text(empresa.nombre, ANCHO_PAGINA / 2, y, { align: "center" });
    }

    // Devuelve el blob en vez de descargarlo directo (doc.save) -- se
    // muestra en la página con el mismo visor que ya se usa para los
    // demás adjuntos (ver FilePreviewPanel/resolverPreview en
    // GenerarCotizacionBoton.jsx), sin forzar una descarga.
    return { blob: doc.output("blob"), nombre: `Cotizacion-${codigoExterno}.pdf` };
}
