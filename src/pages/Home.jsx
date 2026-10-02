import { useEffect, useState } from "react";
import CompraAgilResueltas from "../components/CompraAgilResueltas.jsx";
import MisActivas from "../components/MisActivas.jsx";
import StatCard from "../components/StatCard.jsx";
import { authFetch, getClaims } from "../lib/api.js";

const ACTIVOS = ["ASIGNADO", "ANALISIS", "DESARROLLO"];

// Misma forma para USUARIO/EMPRESA/GLOBAL (AsignacionResponse y
// AsignacionGlobalResponse comparten tipo/estado/pendienteRevision), solo
// cambia el endpoint del que sale la lista (ver cargar() mas abajo).
function contarActivas(asignaciones) {
    const activas = asignaciones.filter((a) => ACTIVOS.includes(a.estado));
    return {
        licitaciones: activas.filter((a) => a.tipo === "LICITACION").length,
        compras: activas.filter((a) => a.tipo === "COMPRA_AGIL").length,
    };
}

export default function Home() {
    const claims = getClaims();
    const esAdmin = claims?.alcance === "EMPRESA" || claims?.alcance === "GLOBAL";

    // Ya no se guarda la lista cruda de asignaciones -- para GLOBAL sería
    // TODA la tabla del sistema, sin límite (mismo problema que se
    // solucionó en Administracion.jsx paginando /auth/asignaciones, ver
    // ese commit). En su lugar se guardan directo los 3 derivados que
    // necesita el render (totales, pendientes de revisión, completadas):
    // para EMPRESA/USUARIO se calculan acá de la lista (acotada, esa sí es
    // chica); para GLOBAL salen de 3 endpoints livianos aparte (resumen/
    // pendientes-revision/compra-agil-completadas, ver AsignacionService).
    const [totales, setTotales] = useState(null);
    const [pendientesRevision, setPendientesRevision] = useState([]);
    const [compraAgilCompletadas, setCompraAgilCompletadas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        document.title = "Home";
    }, []);

    async function cargar() {
        setLoading(true);
        setError(null);
        try {
            if (claims?.alcance === "GLOBAL") {
                const [resResumen, resPendientes, resCompletadas] = await Promise.all([
                    authFetch("/auth/asignaciones/resumen"),
                    authFetch("/auth/asignaciones/pendientes-revision"),
                    authFetch("/auth/asignaciones/compra-agil-completadas"),
                ]);
                if (!resResumen.ok || !resPendientes.ok || !resCompletadas.ok) {
                    throw new Error("El servidor respondió con un error al cargar el resumen.");
                }
                const resumen = await resResumen.json();
                setTotales({ licitaciones: resumen.licitacionesActivas, compras: resumen.comprasActivas });
                setPendientesRevision(await resPendientes.json());
                setCompraAgilCompletadas(await resCompletadas.json());
                return;
            }

            // EMPRESA ve solo la suya, USUARIO solo lo que tiene asignado a
            // si mismo -- mismos endpoints que ya usan MiEmpresa.jsx/
            // MisActivas.jsx para lo mismo. Universo chico en los 2 casos
            // (una sola empresa, o un solo usuario), asi que alcanza con
            // calcular todo acá mismo sobre la lista completa.
            const url = claims?.alcance === "EMPRESA"
                ? `/auth/empresas/${claims.empresaId}/asignaciones`
                : "/auth/me/asignaciones/detalle";
            const res = await authFetch(url);
            if (!res.ok) throw new Error(`El servidor respondió con estado ${res.status}`);
            const asignaciones = await res.json();
            setTotales(contarActivas(asignaciones));
            setPendientesRevision(esAdmin ? asignaciones.filter((a) => a.pendienteRevision) : []);
            setCompraAgilCompletadas(asignaciones.filter((a) => a.tipo === "COMPRA_AGIL" && a.estado === "COMPLETADO"));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claims?.alcance, claims?.empresaId]);

    // Al pasar a DESCARTADO se pide el motivo -- el backend lo exige (ver
    // AsignacionService.actualizarEstado). Mismo patron que Mi Empresa/
    // Administracion.
    async function cambiarEstado(asignacion, nuevoEstado) {
        let motivoDescarte;
        if (nuevoEstado === "DESCARTADO") {
            motivoDescarte = window.prompt("¿Por qué se descarta? (obligatorio)");
            if (!motivoDescarte || !motivoDescarte.trim()) return;
        }
        try {
            const res = await authFetch(`/auth/asignaciones/${asignacion.id}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevoEstado, motivoDescarte }),
            });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargar();
        } catch (err) {
            setError(err.message);
        }
    }

    // Apaga Asignacion.pendienteRevision -- el estado ya estaba en
    // COMPLETADO desde antes (mismo criterio que Mi Empresa/Administracion).
    async function aprobarRevision(asignacion) {
        try {
            const res = await authFetch(`/auth/asignaciones/${asignacion.id}/revision`, { method: "PATCH" });
            if (!res.ok) {
                const texto = await res.text().catch(() => "");
                throw new Error(texto || `El servidor respondió con estado ${res.status}`);
            }
            await cargar();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="flex-min-w-0">
            <h1>Home</h1>
            <p>Licitaciones y compras ágiles, según los accesos configurados para este usuario.</p>

            {loading && (
                <div className="estado-vacio">
                    <div className="spinner-border" style={{ color: "var(--accent)" }} role="status"></div>
                    <span>Cargando...</span>
                </div>
            )}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && totales && (
                <>
                    {/* Para USUARIO todavia no hay una 3ra tarjeta definida --
                        se deja en 2 columnas en vez de dejar un recuadro vacio. */}
                    <div className={`row row-cols-2 ${esAdmin ? "row-cols-md-3" : ""} g-3 mb-4`}>
                        <div className="col">
                            <StatCard valor={totales.licitaciones} etiqueta={esAdmin ? "Licitaciones activas" : "Mis licitaciones"}
                                icono="bi-file-earmark-text-fill" color="var(--accent)" />
                        </div>
                        <div className="col">
                            <StatCard valor={totales.compras} etiqueta={esAdmin ? "Compras Ágiles activas" : "Mis compras ágiles"}
                                icono="bi-cart-fill" color="var(--accent-2)" />
                        </div>
                        {esAdmin && (
                            <div className="col">
                                <StatCard valor={pendientesRevision.length} etiqueta="Pendientes de revisión"
                                    icono="bi-eye-fill" color="var(--warning)" />
                            </div>
                        )}
                    </div>

                    {/* La tarjeta de arriba solo cuenta -- las Pendientes de revisión
                        en si van MEZCLADAS adentro de "Listas — esperando acción" de
                        MisActivas (junto con las propias en Desarrollo), no en una
                        caja aparte -- para que el admin pueda revisar los datos
                        reales (cotizacion, documentos, etc.) y aprobar o devolver
                        desde ahi mismo. */}
                    <MisActivas extras={pendientesRevision} onAprobarExtra={aprobarRevision}
                        onDevolverExtra={(a) => cambiarEstado(a, "DESARROLLO")} />

                    <CompraAgilResueltas completadas={compraAgilCompletadas} />
                </>
            )}
        </div>
    );
}
