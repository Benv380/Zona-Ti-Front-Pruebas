// Estado y helpers del panel de filtros compartido por CompraRapida.jsx y
// Licitacion.jsx (ver components/FiltrosBar.jsx) -- mismo shape en las 2
// pantallas, aunque el backend interprete "region" distinto en cada una
// (codigo numerico en Compra Agil, nombre en Licitacion -- ver
// CompraAgilDto.FiltrosVista/LicitacionDto.FiltrosVista).
export const FILTROS_VACIOS = {
    ordenarPor: "cierre",
    direccion: "asc",
    region: "",
    montoMin: "",
    montoMax: "",
    cierreDesde: "",
    cierreHasta: "",
};

// Arma el query string a partir del estado de filtros -- solo manda lo que
// se aparta del default (evita ensuciar la URL/logs con parametros que no
// cambian nada).
export function queryStringDeFiltros(filtros) {
    const params = new URLSearchParams();
    if (filtros.ordenarPor && filtros.ordenarPor !== "cierre") params.set("ordenarPor", filtros.ordenarPor);
    if (filtros.direccion && filtros.direccion !== "asc") params.set("direccion", filtros.direccion);
    if (filtros.region) params.set("region", filtros.region);
    if (filtros.montoMin) params.set("montoMin", filtros.montoMin);
    if (filtros.montoMax) params.set("montoMax", filtros.montoMax);
    if (filtros.cierreDesde) params.set("cierreDesde", filtros.cierreDesde);
    if (filtros.cierreHasta) params.set("cierreHasta", filtros.cierreHasta);
    const qs = params.toString();
    return qs ? `&${qs}` : "";
}

export function hayFiltrosActivos(filtros) {
    return (
        filtros.ordenarPor !== FILTROS_VACIOS.ordenarPor ||
        filtros.direccion !== FILTROS_VACIOS.direccion ||
        !!filtros.region ||
        !!filtros.montoMin ||
        !!filtros.montoMax ||
        !!filtros.cierreDesde ||
        !!filtros.cierreHasta
    );
}
