import { badgeCierre } from "../lib/fechas.js";

// Cuenta regresiva visual de cuanto falta para que cierre una licitacion/
// compra agil -- ver lib/fechas.js para los cortes de color. No renderiza
// nada si no hay fecha de cierre valida (mejor omitirlo que mostrar "-").
export default function BadgeCierre({ fecha }) {
    const info = badgeCierre(fecha);
    if (!info) return null;
    return <span className={`badge ${info.clase}`}>{info.texto}</span>;
}
