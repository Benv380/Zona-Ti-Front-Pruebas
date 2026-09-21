import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
    // El login es por email, no por username (ver AuthService.authenticate
    // en auth-service) -- username sigue existiendo, pero ahora es solo el
    // identificador que se muestra en el resto de la app.
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        document.title = "Iniciar Sesión";
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setEnviando(true);
        try {
            const res = await fetch("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
                // Sin esto el navegador ignora el Set-Cookie del refresh
                // token que manda AuthController -- "include" es necesario
                // aunque sea same-origin cuando se navega directo a esta
                // URL (fetch no manda cookies por default salvo que se
                // pida explicito).
                credentials: "include",
            });

            if (res.status === 401) {
                // AuthController responde 401 + texto plano "Credenciales
                // inválidas" cuando falla la autenticación (ver
                // AuthController.login).
                setError("Credenciales inválidas");
                return;
            }
            if (!res.ok) {
                // Cualquier otro status (404 si el proxy /auth/ no está
                // configurado, 500, etc.) NO es un error de credenciales --
                // mostrarlo aparte para no confundir "no llegué al backend"
                // con "la contraseña está mal".
                setError(`Error del servidor (${res.status}). Revisa que auth-service esté corriendo.`);
                return;
            }

            const contentType = res.headers.get("content-type") ?? "";
            if (!contentType.includes("application/json")) {
                // Si nginx/el proxy no tiene la ruta /auth/ configurada,
                // devuelve el index.html de la SPA con status 200 -- eso
                // rompería el res.json() de abajo con un error críptico.
                setError("Respuesta inesperada del servidor (¿está el proxy /auth/ configurado?).");
                return;
            }

            const { token } = await res.json();
            // El access token (JWT, 1h) va en localStorage y lo adjunta
            // authFetch() en cada request a compra-service. El refresh
            // token (7 dias) NO se toca aca -- ya quedo guardado por el
            // navegador como cookie httpOnly gracias a credentials:
            // "include" de arriba; el JS de este archivo ni puede leerlo.
            localStorage.setItem("token", token);
            navigate("/");
        } catch {
            setError("No se pudo contactar al servidor de autenticación");
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div
            className="d-flex flex-column justify-content-center align-items-center vh-100"
            style={{
                background:
                    "radial-gradient(circle at 50% 20%, rgba(168, 85, 247, 0.12), transparent 60%), var(--bg)",
                padding: "16px",
            }}
        >
            <div className="d-flex align-items-center gap-2 mb-4">
                <span
                    className="d-flex align-items-center justify-content-center"
                    style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-bg)", color: "var(--accent)", fontSize: "1.4rem" }}
                >
                    <i className="bi bi-buildings-fill"></i>
                </span>
                <span className="fs-3 fw-semibold" style={{ color: "var(--text-h)" }}>ZonaTI</span>
            </div>

            <div className="card-panel" style={{ width: "22rem", maxWidth: "100%" }}>
                <h1 className="text-center" style={{ fontSize: "1.4rem" }}>Iniciar sesión</h1>
                <p className="text-center mb-4">Accedé al panel de licitaciones y compras ágiles.</p>

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label" style={{ fontSize: "0.85rem" }}>Correo electrónico</label>
                        <input
                            type="email"
                            className="form-control"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            autoFocus
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label" style={{ fontSize: "0.85rem" }}>Contraseña</label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <div className="alert alert-danger py-2 mb-3" style={{ fontSize: "0.85rem" }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary w-100" disabled={enviando}>
                        {enviando ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Ingresando...
                            </>
                        ) : (
                            "Iniciar sesión"
                        )}
                    </button>
                </form>

                <div className="d-flex align-items-center gap-2 my-3">
                    <hr className="flex-grow-1 m-0" style={{ borderColor: "var(--border)" }} />
                    <span className="text-muted" style={{ fontSize: "0.75rem" }}>o</span>
                    <hr className="flex-grow-1 m-0" style={{ borderColor: "var(--border)" }} />
                </div>

                {/* Sin logica real todavia -- SSO no esta implementado en
                    auth-service, queda como intencion visual para cuando
                    se conecte. */}
                <button
                    type="button"
                    className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2"
                    title="Todavía no disponible"
                    disabled
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M7.462 0H0v7.19h7.462zM16 0H8.538v7.19H16zM7.462 8.211H0V16h7.462zm8.538 0H8.538V16H16z" />
                    </svg>
                    Continuar con Microsoft
                </button>
            </div>
        </div>
    );
}
