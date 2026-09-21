import { useLocation, Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";

export default function Layout() {
    // "key={pathname}" fuerza que React desmonte/remonte el <main> en
    // cada cambio de ruta -- sin esto, la animacion .page-enter (ver
    // index.css) solo se ve la primera vez, porque el elemento nunca deja
    // de existir entre una pagina y otra.
    const { pathname } = useLocation();

    return (
        // "app-shell"/"app-main" (ver index.css): altura FIJA (100vh), no
        // minHeight -- así el Sidebar y el contenido scrollean cada uno
        // por su cuenta y el Sidebar nunca se estira con páginas largas
        // (era el bug: antes crecía junto con el contenido de <main>).
        <div className="app-shell">
            <Sidebar />
            {/* flex-min-w-0: sin esto, contenido ancho (ej. el JSON de una
                API) empuja todo el layout hacia el costado en vez de
                scrollear dentro de su propia caja. */}
            <main key={pathname} className="app-main flex-min-w-0 p-4 page-enter">
                <Outlet />
            </main>
        </div>
    );
}
