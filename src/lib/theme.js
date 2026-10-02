const STORAGE_KEY = "theme";

function temaPreferidoDelSistema() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
}

// Lee el tema guardado (si el usuario ya eligió uno) o cae al de el
// sistema operativo/navegador -- así la primera visita respeta la
// preferencia del usuario en vez de forzar oscuro siempre.
export function obtenerTemaInicial() {
    try {
        const guardado = localStorage.getItem(STORAGE_KEY);
        if (guardado === "light" || guardado === "dark") return guardado;
    } catch {
        // localStorage puede fallar (modo privado, storage lleno, etc) --
        // seguimos con la preferencia del sistema.
    }
    return temaPreferidoDelSistema();
}

// Aplica el tema al <html> (de ahí lo toman las variables CSS en
// index.css, ver :root[data-theme="light"]) y lo persiste.
export function aplicarTema(tema) {
    document.documentElement.setAttribute("data-theme", tema);
    try {
        localStorage.setItem(STORAGE_KEY, tema);
    } catch {
        // no es crítico si no se pudo guardar -- el tema igual queda
        // aplicado para esta sesión.
    }
}
