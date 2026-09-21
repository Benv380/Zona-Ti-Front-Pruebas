// Tabla compartida por MiEmpresa.jsx (asignaciones de UNA empresa) y
// Administracion.jsx (asignaciones de TODO el sistema) -- antes cada
// página tenía su propia copia con columnas/badges ligeramente distintos;
// se unificó acá para que el comportamiento (y el aspecto) sea siempre el
// mismo sin importar desde qué panel se lo mire.

export const TIPOS_ASIGNACION = [
    { valor: "LICITACION", etiqueta: "Licitación" },
    { valor: "COMPRA_AGIL", etiqueta: "Compra Ágil" },
];

export const ESTADOS = [
    { valor: "ASIGNADO", etiqueta: "Asignado" },
    { valor: "ANALISIS", etiqueta: "Análisis" },
    { valor: "DESARROLLO", etiqueta: "Desarrollo" },
    { valor: "COMPLETADO", etiqueta: "Completado" },
    { valor: "DESCARTADO", etiqueta: "Descartado" },
];

export const ORIGEN_INFO = {
    ADMIN: { texto: "Asignado por admin", clase: "badge-rol-empresa" },
    USER: { texto: "Recomendado por usuario", clase: "badge-rol-global" },
};

// "mostrarEmpresa" solo lo usa el panel GLOBAL (Administracion.jsx): ahí
// una sola tabla mezcla usuarios de distintas empresas, así que hace
// falta la columna para saber de cuál es cada fila -- en MiEmpresa.jsx
// sería redundante (todo el panel ya es de una sola empresa).
export default function TablaAsignaciones({ asignaciones, mostrarEmpresa = false, onCambiarEstado, onEliminar, onAprobarRevision }) {
    if (asignaciones.length === 0) {
        return (
            <div className="estado-vacio mb-3">
                <i className="bi bi-inbox"></i>
                <span>Nada para mostrar con estos filtros.</span>
            </div>
        );
    }

    return (
        <div className="table-responsive mb-3">
            <table className="table table-sm align-middle">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        {/* Empresa/Tipo/Origen se ocultan en mobile -- Usuario, Código
                            y Estado alcanzan para reconocer y accionar la fila sin
                            scroll horizontal (mismo criterio que las demas tablas). */}
                        {mostrarEmpresa && <th className="d-none d-md-table-cell">Empresa</th>}
                        <th className="d-none d-md-table-cell">Tipo</th>
                        <th>Código</th>
                        <th className="d-none d-md-table-cell">Origen</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {asignaciones.map((a) => (
                        <tr key={a.id}>
                            <td>{a.username}</td>
                            {mostrarEmpresa && <td className="d-none d-md-table-cell">{a.empresaNombre || "-"}</td>}
                            <td className="d-none d-md-table-cell">{TIPOS_ASIGNACION.find((t) => t.valor === a.tipo)?.etiqueta || a.tipo}</td>
                            <td>{a.codigoExterno}</td>
                            <td className="d-none d-md-table-cell">
                                <span className={`badge ${ORIGEN_INFO[a.origen]?.clase || ""}`}>
                                    {ORIGEN_INFO[a.origen]?.texto || a.origen}
                                </span>
                                {a.recomendadoPorUsername && (
                                    <div className="text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                                        por {a.recomendadoPorUsername}
                                    </div>
                                )}
                            </td>
                            <td>
                                <select
                                    className="form-control form-control-sm"
                                    style={{ minWidth: "140px" }}
                                    value={a.estado}
                                    onChange={(e) => onCambiarEstado(a, e.target.value)}
                                >
                                    {ESTADOS.map((es) => (
                                        <option key={es.valor} value={es.valor}>{es.etiqueta}</option>
                                    ))}
                                </select>
                                {a.estado === "DESCARTADO" && a.motivoDescarte && (
                                    <div className="text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                                        {a.etapaDescarte && `(estaba en ${ESTADOS.find((es) => es.valor === a.etapaDescarte)?.etiqueta || a.etapaDescarte}) `}
                                        {a.motivoDescarte}
                                    </div>
                                )}
                                {/* pendienteRevision no es un estado (ver EstadoAsignacion.java) --
                                    es una marca aparte que se muestra encima del estado real
                                    (COMPLETADO) mientras nadie la haya revisado. */}
                                {a.pendienteRevision && (
                                    <div className="mt-1 d-flex align-items-center gap-1">
                                        <span className="badge badge-rol-global" style={{ fontSize: "0.7rem" }}>Pendiente de revisión</span>
                                        {onAprobarRevision && (
                                            <button type="button" className="btn btn-sm btn-outline-success py-0 px-1"
                                                style={{ fontSize: "0.7rem" }} onClick={() => onAprobarRevision(a)}>
                                                Aprobar
                                            </button>
                                        )}
                                    </div>
                                )}
                            </td>
                            <td className="text-end">
                                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onEliminar(a)}>
                                    Eliminar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
