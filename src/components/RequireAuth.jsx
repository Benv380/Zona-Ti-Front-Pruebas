import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { renovarAccessToken, tokenVigente } from "../lib/api.js";

// Guard de rutas. Si el access token esta vigente, pasa directo (chequeo
// sincronico, rapido). Si vencio (pasa cada 1h, ver JwtUtil), NO manda
// directo a /login -- primero intenta renovarlo con el refresh token
// (cookie httpOnly, dura 7 dias, ver /auth/refresh) antes de rendirse. Sin
// esto, la sesion se cortaria cada 1 hora en vez de cada 7 dias.
export default function RequireAuth() {
    // null = todavia verificando (chequeo async en curso), true/false =
    // resultado final. Evita el parpadeo de redirigir a /login para
    // enseguida volver si el refresh resulta exitoso.
    const [autorizado, setAutorizado] = useState(tokenVigente() ? true : null);

    useEffect(() => {
        if (autorizado !== null) return;

        let cancelado = false;
        renovarAccessToken().then((renovado) => {
            if (!cancelado) setAutorizado(renovado);
        });

        return () => { cancelado = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (autorizado === null) {
        // Placeholder minimo mientras se verifica -- dura milisegundos
        // (una sola request a /auth/refresh), no hace falta un spinner
        // elaborado.
        return null;
    }

    if (!autorizado) {
        localStorage.removeItem("token");
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
