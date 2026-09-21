import { useState } from "react";
import { authFetch, getClaims } from "../lib/api.js";
import { generarCotizacionPdf } from "../lib/generarCotizacionPdf.js";

// Convierte un blob a base64 puro (sin el prefijo "data:...;base64,") --
// jsPDF necesita el dataURL completo para doc.addImage, asi que en
// realidad se resuelve con el dataURL entero, no solo la parte base64
// (ver generarCotizacionPdf.js).
function blobADataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Arma la cotizacion ya guardada en la fase ANALISIS (ver
// CotizacionCompraAgil.jsx) y la muestra en la misma página -- vive en
// DESARROLLO porque es el paso natural una vez que la cotizacion ya está
// lista, no antes. Pide el perfil propio y el membrete de la empresa
// recién al generar (no en cada apertura del modal) para no gastar
// pedidos de más si el usuario nunca llega a usar el botón. El PDF en sí
// no se descarga: se entrega vía "onGenerado" para que quien llama lo
// muestre con el mismo visor que ya usa para los demás adjuntos.
export default function GenerarCotizacionBoton({ codigoExterno, cotizacion, institucion, onGenerado }) {
    const [generando, setGenerando] = useState(false);
    const [error, setError] = useState(null);
    const empresaId = getClaims()?.empresaId;

    async function generar() {
        setGenerando(true);
        setError(null);
        try {
            const [resVendedor, resEmpresa] = await Promise.all([
                authFetch("/auth/me"),
                authFetch(`/auth/empresas/${empresaId}/marca-cotizacion`),
            ]);
            if (!resVendedor.ok) throw new Error("No se pudo obtener tu perfil de usuario");
            if (!resEmpresa.ok) throw new Error("No se pudo obtener los datos de tu empresa");
            const vendedor = await resVendedor.json();
            const empresa = await resEmpresa.json();

            let logoDataUrl = null;
            if (empresa.tieneLogo) {
                const resLogo = await authFetch(`/auth/empresas/${empresaId}/marca-cotizacion/logo`);
                if (resLogo.ok) {
                    logoDataUrl = await blobADataUrl(await resLogo.blob());
                }
            }

            const { blob, nombre } = generarCotizacionPdf({ codigoExterno, cotizacion, institucion, vendedor, empresa, logoDataUrl });
            onGenerado(blob, nombre);
        } catch (err) {
            setError(err.message);
        } finally {
            setGenerando(false);
        }
    }

    if (!empresaId) {
        return (
            <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                Tu usuario no pertenece a una empresa, así que no se puede armar el membrete de la cotización.
            </p>
        );
    }

    if (!cotizacion) {
        return (
            <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                Todavía no hay una cotización guardada para esta compra. Hay que volver a la fase Análisis para armarla primero.
            </p>
        );
    }

    return (
        <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={generar} disabled={generando}>
                <i className="bi bi-file-earmark-pdf-fill me-1"></i>
                {generando ? "Generando..." : "Generar cotización (PDF)"}
            </button>
            {error && <span className="text-danger" style={{ fontSize: "0.85rem" }}>{error}</span>}
        </div>
    );
}
