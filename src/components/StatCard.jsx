// Card de numero + etiqueta con icono en circulo de color (ver .stat-card
// en index.css). "color" es una de las variables de acento definidas en
// :root (--accent, --accent-2, --success, --warning, --danger) -- default
// a --accent si no se pasa nada.
export default function StatCard({ valor, etiqueta, icono = "bi-bar-chart-fill", color = "var(--accent)" }) {
    return (
        <div className="card-panel h-100 stat-card">
            <div
                className="stat-card__icono"
                style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
            >
                <i className={`bi ${icono}`}></i>
            </div>
            <div>
                <div className="stat-card__valor">{valor}</div>
                <div className="stat-card__etiqueta">{etiqueta}</div>
            </div>
        </div>
    );
}
