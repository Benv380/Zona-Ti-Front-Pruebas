import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getClaims, logout } from "../lib/api.js";

const links = [
    { to: "/", icon: "bi-house-door-fill", label: "Home" },
    { to: "/compra-agil", icon: "bi-speedometer2", label: "Consulta Compra-Rapida" },
    { to: "/licitacion", icon: "bi-file-earmark-text", label: "Consulta Licitación" },
    // Solo visible para GLOBAL (ADMIN) -- gestion de TODO el
    // sistema (cualquier empresa, cualquier usuario, cualquier rol).
    { to: "/administracion", icon: "bi-shield-lock-fill", label: "Administración", soloGlobal: true },
    // Solo visible para ADMIN_EMPRESA (alcance EMPRESA) -- ver el filtro
    // mas abajo. GLOBAL/USER no gestionan una empresa, no tiene sentido
    // que les aparezca.
    { to: "/mi-empresa", icon: "bi-building-gear", label: "Mi Empresa", soloEmpresa: true },
];

// Etiqueta legible + clase de color por alcance (ver .badge-rol-* en
// index.css) -- para que se note de un vistazo con que tipo de cuenta se
// esta navegando, algo util sobre todo en una demo con varios roles.
const BADGE_POR_ALCANCE = {
    GLOBAL: { texto: "Administrador", clase: "badge-rol-global" },
    EMPRESA: { texto: "Admin. empresa", clase: "badge-rol-empresa" },
    USUARIO: { texto: "Usuario", clase: "badge-rol-usuario" },
};

export default function Sidebar() {
    // "collapsed": modo icono-solo de escritorio (el botón de flechas de
    // siempre). "mobileOpen": el panel off-canvas de pantallas angostas
    // (ver .sidebar en index.css) -- son 2 estados independientes porque
    // en mobile no tiene sentido el modo "icono solo" (no sobra ancho
    // igual), ahí directo se abre/cierra el panel completo.
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const navigate = useNavigate();
    const claims = getClaims();
    const badge = claims?.alcance ? BADGE_POR_ALCANCE[claims.alcance] : null;

    const linksVisibles = links.filter((link) => {
        if (link.soloEmpresa) return claims?.alcance === "EMPRESA";
        if (link.soloGlobal) return claims?.alcance === "GLOBAL";
        return true;
    });

    async function cerrarSesion() {
        // logout() revoca el refresh token en el servidor y limpia el
        // access token local (ver lib/api.js) -- antes solo se borraba
        // localStorage, dejando el refresh token todavia vigente ahí.
        await logout();
        navigate("/login", { replace: true });
    }

    return (
        <>
            {/* Fondo oscuro detrás del panel en mobile -- tocarlo lo cierra,
                igual que cualquier off-canvas conocido. No existe en
                escritorio (ver .sidebar-backdrop en index.css). */}
            <div
                className={`sidebar-backdrop ${mobileOpen ? "is-visible" : ""}`}
                onClick={() => setMobileOpen(false)}
            ></div>

            <div
                className={`sidebar d-flex flex-column p-3 text-white ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}
                style={{ background: "var(--bg-elevated)", borderRight: "1px solid var(--border)" }}
            >
                <div className="d-flex align-items-center mb-3">
                    {!collapsed && (
                        <a href="/" className="d-flex align-items-center flex-grow-1 text-white text-decoration-none text-truncate">
                            <span
                                className="d-flex align-items-center justify-content-center me-2 flex-shrink-0"
                                style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-bg)", color: "var(--accent)" }}
                            >
                                <i className="bi bi-buildings-fill"></i>
                            </span>
                            <span className="fs-5 fw-semibold">ZonaTI</span>
                        </a>
                    )}
                    {/* Botón de escritorio (icono-solo <-> expandido) -- se
                        oculta en mobile vía CSS (.sidebar-toggle-desktop). */}
                    <button
                        type="button"
                        className="sidebar-toggle-desktop btn btn-sm text-white ms-auto"
                        style={{ background: "transparent", border: "1px solid var(--border)" }}
                        onClick={() => setCollapsed((c) => !c)}
                        title={collapsed ? "Expandir menú" : "Retraer menú"}
                    >
                        <i className={`bi ${collapsed ? "bi-chevron-double-right" : "bi-chevron-double-left"}`}></i>
                    </button>
                    {/* Botón de mobile (cerrar el panel off-canvas) -- oculto
                        en escritorio vía CSS (.sidebar-toggle-mobile). */}
                    <button
                        type="button"
                        className="sidebar-toggle-mobile btn btn-sm text-white ms-auto"
                        style={{ background: "transparent", border: "1px solid var(--border)" }}
                        onClick={() => setMobileOpen(false)}
                        title="Cerrar menú"
                    >
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
                <hr className="mt-0" style={{ borderColor: "var(--border)" }} />
                <ul className="nav nav-pills flex-column mb-auto">
                    {linksVisibles.map((link) => (
                        <li key={link.label || link.to} className="nav-item">
                            <NavLink
                                to={link.to}
                                title={collapsed ? link.label : undefined}
                                onClick={() => setMobileOpen(false)}
                                className={({ isActive }) =>
                                    `nav-link d-flex align-items-center text-truncate ${isActive ? "active" : "text-white"}`
                                }
                            >
                                <i className={`bi ${link.icon} ${collapsed ? "" : "me-2"}`}></i>
                                {!collapsed && link.label}
                            </NavLink>
                        </li>
                    ))}
                </ul>
                <hr style={{ borderColor: "var(--border)" }} />
                <div className="dropdown">
                    <a
                        href="#"
                        className="d-flex align-items-center text-white text-decoration-none dropdown-toggle"
                        id="dropdownUser1"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                    >
                        <span
                            className="d-flex align-items-center justify-content-center rounded-circle me-2 flex-shrink-0"
                            style={{ width: 32, height: 32, background: "var(--accent)", color: "#fff", fontSize: "0.9rem", fontWeight: 600 }}
                        >
                            {(claims?.username ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                        {!collapsed && (
                            <span className="text-truncate">
                                <div className="text-truncate" style={{ lineHeight: 1.2 }}>{claims?.username ?? "Invitado"}</div>
                                {badge && <span className={`badge ${badge.clase}`} style={{ fontSize: "0.65rem" }}>{badge.texto}</span>}
                            </span>
                        )}
                    </a>
                    <ul className="dropdown-menu dropdown-menu-dark text-small shadow" aria-labelledby="dropdownUser1">
                        <li>
                            <button type="button" className="dropdown-item" onClick={cerrarSesion}>
                                <i className="bi bi-box-arrow-right me-2"></i>
                                Cerrar sesión
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Botón hamburguesa flotante -- solo visible en mobile (ver
                .app-main/media query), abre el panel off-canvas. Vive
                afuera del <div className="sidebar"> porque ese panel está
                oculto (translateX) hasta que se abre. */}
            <button
                type="button"
                className="sidebar-toggle-mobile btn btn-sm text-white"
                style={{
                    position: "fixed", top: 12, left: 12, zIndex: 1030,
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                }}
                onClick={() => setMobileOpen(true)}
                title="Abrir menú"
            >
                <i className="bi bi-list"></i>
            </button>
        </>
    );
}
