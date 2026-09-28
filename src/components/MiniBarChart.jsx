// Barras horizontales minimas (sin libreria de graficos -- el proyecto no
// tenia ninguna, y esto no necesita mas que barras proporcionales). Se usa
// en PerfilCompradorPanel.jsx para "compras por mes" y "convocatorias mas
// frecuentes".
export default function MiniBarChart({ datos, colorVar = "--accent" }) {
    if (!datos || datos.length === 0) {
        return <p className="text-muted mb-0" style={{ fontSize: "0.78rem" }}>Sin datos suficientes.</p>;
    }
    const max = Math.max(...datos.map((d) => d.valor), 1);

    return (
        <div className="d-flex flex-column gap-1">
            {datos.map((d) => (
                <div key={d.label} className="d-flex align-items-center gap-2" style={{ fontSize: "0.75rem" }}>
                    <span className="text-truncate text-muted" style={{ width: "120px", flexShrink: 0 }} title={d.label}>
                        {d.label}
                    </span>
                    <div style={{ flex: 1, background: "var(--bg-elevated-2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
                        <div style={{ width: `${(d.valor / max) * 100}%`, background: `var(${colorVar})`, height: "100%" }} />
                    </div>
                    <span style={{ width: "22px", textAlign: "right", flexShrink: 0 }}>{d.valor}</span>
                </div>
            ))}
        </div>
    );
}
