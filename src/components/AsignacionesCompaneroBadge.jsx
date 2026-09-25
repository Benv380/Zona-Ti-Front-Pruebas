// Cruce de datos entre usuarios/admins de una misma empresa (ver
// AsignacionController.asignacionesDeMiEmpresa en auth-service): avisa que
// esta compra/licitacion ya la tiene un COMPAÑERO, para no duplicar
// trabajo. Distinto del badge "Asignada a mí" de RecomendarBoton -- este
// es sobre OTROS, puede convivir con ese si a mi tambien me la
// recomendaron. "usuarios" ya viene sin mi propio username (se filtra al
// armar el mapa en la pagina que llama).
export default function AsignacionesCompaneroBadge({ usuarios }) {
    if (!usuarios || usuarios.length === 0) return null;
    const [primero, ...resto] = usuarios;
    return (
        <span
            className="badge bg-warning text-dark"
            title={`Ya asignada a: ${usuarios.join(", ")}`}
        >
            <i className="bi bi-people-fill me-1"></i>
            Asignada a {primero}{resto.length > 0 ? ` +${resto.length}` : ""}
        </span>
    );
}
