import { useEffect, useState } from "react";
import { authFetch } from "../lib/api.js";

// Dos acciones independientes sobre POST /auth/me/asignaciones (auth-service):
//   - "Asignarme": un click, sin selector -- destinatarioUserId=null, el
//     backend lo interpreta como autoasignacion (ver AsignacionService.recomendar).
//   - "Recomendar a alguien": abre un selector de compañeros de la misma
//     empresa (o del ADMIN_EMPRESA) y manda destinatarioUserId puntual.
// Antes era un solo boton donde "autoasignarme" era "dejar el selector
// vacio y enviar" -- nada obvio. Quedan separadas porque no son
// excluyentes entre si (uno puede asignarselo a si mismo Y ademas
// recomendarselo a un compañero).
export default function RecomendarBoton({ codigoExterno, tipo, yaAsignada = false, onAsignado }) {
    const [companeros, setCompaneros] = useState([]);
    const [destinatarioId, setDestinatarioId] = useState("");
    const [abierto, setAbierto] = useState(false);

    const [asignandome, setAsignandome] = useState(false);
    // "yaAsignada" la calcula la pagina que llama (cruzando el codigo contra
    // GET /auth/me/asignaciones) -- asi el boton arranca ya en "Asignada a
    // mí" si corresponde, en vez de dejar que alguien reintente y se
    // encuentre con el error de duplicado (ver AsignacionService.
    // verificarNoDuplicada en el backend, que igual lo bloquea del otro lado).
    const [asignado, setAsignado] = useState(yaAsignada);

    const [enviando, setEnviando] = useState(false);
    const [recomendado, setRecomendado] = useState(false);

    const [error, setError] = useState(null);

    // Se piden recien al abrir el selector, no en cada card que se
    // renderiza -- evita N requests si hay una lista larga de resultados.
    useEffect(() => {
        if (!abierto || companeros.length > 0) return;
        authFetch(`/auth/me/companeros`)
            .then((r) => (r.ok ? r.json() : []))
            .then(setCompaneros)
            .catch(() => setCompaneros([]));
    }, [abierto]);

    async function crearAsignacion(destinatarioUserId) {
        const res = await authFetch(`/auth/me/asignaciones`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigoExterno, tipo, destinatarioUserId }),
        });
        if (!res.ok) {
            const texto = await res.text().catch(() => "");
            throw new Error(texto || `El servidor respondió con estado ${res.status}`);
        }
    }

    async function asignarme() {
        setAsignandome(true);
        setError(null);
        try {
            await crearAsignacion(null);
            setAsignado(true);
            onAsignado?.(codigoExterno);
        } catch (err) {
            setError(err.message);
        } finally {
            setAsignandome(false);
        }
    }

    async function recomendar() {
        if (!destinatarioId) return;
        setEnviando(true);
        setError(null);
        try {
            await crearAsignacion(Number(destinatarioId));
            setRecomendado(true);
            setAbierto(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setEnviando(false);
        }
    }

    // Texto explicito segun el tipo -- "Asignarme" a secas no dejaba claro
    // que se estaba asignando.
    const nombreTipo = tipo === "LICITACION" ? "esta licitación" : "esta compra ágil";

    return (
        <div className="d-flex flex-wrap align-items-center gap-2">
            {asignado ? (
                <span className="badge badge-rol-global">
                    <i className="bi bi-check-circle-fill me-1"></i>
                    Asignada a mí
                </span>
            ) : (
                <button type="button" className="btn btn-outline-primary btn-sm" disabled={asignandome} onClick={asignarme}>
                    <i className="bi bi-person-check-fill me-1"></i>
                    {asignandome ? "Asignando..." : `Asignarme ${nombreTipo}`}
                </button>
            )}

            {recomendado ? (
                <span className="badge badge-rol-global">
                    <i className="bi bi-check-circle-fill me-1"></i>
                    Recomendada
                </span>
            ) : !abierto ? (
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setAbierto(true)}>
                    <i className="bi bi-hand-thumbs-up-fill me-1"></i>
                    Recomendar a alguien
                </button>
            ) : (
                <>
                    <select
                        className="form-control form-control-sm"
                        style={{ maxWidth: "220px" }}
                        value={destinatarioId}
                        onChange={(e) => setDestinatarioId(e.target.value)}
                    >
                        <option value="">Seleccione a quién...</option>
                        {companeros.map((c) => (
                            <option key={c.id} value={c.id}>{c.username} ({c.rol})</option>
                        ))}
                    </select>
                    <button type="button" className="btn btn-primary btn-sm" disabled={!destinatarioId || enviando} onClick={recomendar}>
                        {enviando ? "Enviando..." : "Enviar"}
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setAbierto(false)}>
                        Cancelar
                    </button>
                </>
            )}

            {error && <div className="text-danger w-100" style={{ fontSize: "0.8rem" }}>{error}</div>}
        </div>
    );
}
