// Encabezado reutilizable para cada seccion dentro de un card-panel:
// icono en circulo + titulo + subtitulo opcional (ver .section-header en
// index.css). Antes cada pagina repetia su propio <h5>/<p> suelto -- esto
// le da una identidad visual consistente a Home/MiEmpresa/Administracion.
export default function SectionHeader({ icono, titulo, subtitulo }) {
    return (
        <div className="section-header">
            <div className="section-header__icono">
                <i className={`bi ${icono}`}></i>
            </div>
            <div>
                <h2 className="section-header__titulo">{titulo}</h2>
                {subtitulo && <p className="section-header__subtitulo">{subtitulo}</p>}
            </div>
        </div>
    );
}
