// Normaliza lo que el usuario escribe al buscar una licitación/compra
// ágil por código -- Mercado Público siempre los devuelve en mayúsculas
// (ej: "1234-5-COT26"), pero no hay motivo para exigirle al usuario que
// lo escriba exactamente así: si tipea en minúscula, mezclado, o con
// espacios de más, igual tiene que encontrarlo.
export function normalizarCodigo(valor) {
    return valor.trim().toUpperCase().replace(/\s+/g, "");
}

// Los códigos de Mercado Público siempre llevan guiones (ej:
// "1234-5-COT26"). No es excusa para bloquear la búsqueda (podría ser un
// formato que todavía no vimos), pero sirve para avisar de un typo común
// antes de que el usuario se pregunte por qué no encontró nada.
export function pareceCodigoValido(valor) {
    return valor.includes("-");
}
