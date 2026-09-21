// Helpers de fecha de cierre -- compartidos entre CompraCard.jsx (tarjeta),
// MisActivas.jsx (orden del dashboard) y donde haga falta saber "cuanto
// falta para que cierre esto". LICITACION viene en PascalCase, COMPRA_AGIL
// en snake_case (son 2 formatos distintos que entrega Mercado Publico).

// Extrae la fecha de cierre de un item ya sea licitacion o compra agil,
// en cualquiera de los 2 shapes que puede traer (resumen del listado o
// detalle completo -- ver DetalleItem.jsx).
export function fechaCierreDe(tipo, item) {
    if (!item) return null;
    if (tipo === "LICITACION") {
        return item.Fechas?.FechaCierre || item.FechaCierre || null;
    }
    return item.fechas?.fecha_cierre || null;
}

// { texto, clase } listo para un <span className={clase}>{texto}</span>,
// o null si no hay fecha valida. Los cortes (24h/3 dias) son arbitrarios
// pero razonables para priorizar de un vistazo que esta mas urgente.
export function badgeCierre(fechaCierreIso) {
    if (!fechaCierreIso) return null;
    const cierre = new Date(fechaCierreIso);
    if (Number.isNaN(cierre.getTime())) return null;

    const msRestantes = cierre.getTime() - Date.now();
    if (msRestantes <= 0) {
        return { texto: "Cerrada", clase: "badge-cierre-vencida" };
    }

    const horasRestantes = msRestantes / (1000 * 60 * 60);
    if (horasRestantes < 24) {
        const horas = Math.max(1, Math.ceil(horasRestantes));
        return { texto: `Cierra en ${horas} h`, clase: "badge-cierre-urgente" };
    }

    const diasRestantes = Math.ceil(horasRestantes / 24);
    if (diasRestantes <= 3) {
        return { texto: `Cierra en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"}`, clase: "badge-cierre-proxima" };
    }
    return { texto: `Cierra en ${diasRestantes} días`, clase: "badge-cierre-lejana" };
}
