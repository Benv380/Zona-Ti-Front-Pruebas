// Ventana emergente genérica, controlada 100% por estado de React (no por
// el JS de Bootstrap) -- así el contenido puede cambiar libremente sin
// pelear con el ciclo de vida del modal de Bootstrap. Se cierra tocando
// el fondo oscuro, la X, o con Escape.
import { useEffect } from "react";

export default function Modal({ show, onClose, titulo, children }) {
    useEffect(() => {
        if (!show) return;
        function alTeclado(e) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", alTeclado);
        return () => document.removeEventListener("keydown", alTeclado);
    }, [show, onClose]);

    if (!show) return null;

    return (
        <>
            <div className="modal-backdrop-custom" onClick={onClose}></div>
            <div className="modal-panel-custom" role="dialog" aria-modal="true">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0 text-truncate pe-2">{titulo}</h5>
                    <button type="button" className="btn btn-sm btn-outline-secondary flex-shrink-0" onClick={onClose}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
                <div className="modal-body-custom">{children}</div>
            </div>
        </>
    );
}
