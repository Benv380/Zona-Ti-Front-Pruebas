import { authFetch } from "./api.js";
import { generarCotizacionPdf } from "./generarCotizacionPdf.js";

// Convierte un blob a dataURL completo ("data:...;base64,...") -- jsPDF lo
// necesita asi para doc.addImage (ver generarCotizacionPdf.js).
export function blobADataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Pide lo que falta para el membrete (perfil de quien genera + base de
// cotizacion de la empresa + logo) y arma el PDF. Lo usan el boton de la
// fase Desarrollo (GenerarCotizacionBoton) y la pagina "Enviar a MP", que
// lo adjunta en Mercado Publico -- asi las dos generan exactamente la misma
// cotizacion. "empresaId" es la empresa duena de la asignacion (un GLOBAL
// no tiene empresa propia en el JWT).
export async function armarCotizacionPdf({ codigoExterno, cotizacion, institucion, empresaId }) {
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

    return generarCotizacionPdf({ codigoExterno, cotizacion, institucion, vendedor, empresa, logoDataUrl });
}
