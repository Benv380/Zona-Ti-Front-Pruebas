import { REGIONES, comunasDe } from "../lib/regionesComunas.js";
import { formatearRut, rutValido } from "../lib/rut.js";

// Campos del formulario de empresa (crear/editar) -- extraído de
// Administracion.jsx para poder reusarlo tanto en "Nueva empresa" (form
// inline dentro de la tabla) como en EmpresaDetalle.jsx (panel de detalle,
// exclusivo GLOBAL). No incluye el <form> ni los botones de Guardar/
// Cancelar -- eso queda a cargo de quien lo usa, porque cada lugar
// necesita un comportamiento distinto ahí (ver ambos usos).
export default function EmpresaForm({ form, setForm, logoPreview, onElegirLogo }) {
    return (
        <>
            <p className="text-muted mb-2 mt-3" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Identificación
            </p>
            <div className="row g-2">
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Nombre</label>
                    <input className="form-control" placeholder="Razón social" value={form.nombre} required
                        onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Nombre de fantasía</label>
                    <input className="form-control" placeholder="Nombre comercial, si es distinto" value={form.nombreFantasia}
                        onChange={(e) => setForm((f) => ({ ...f, nombreFantasia: e.target.value }))} />
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>RUT</label>
                    <input className={`form-control ${form.rut && !rutValido(form.rut) ? "is-invalid" : ""}`}
                        placeholder="Ej: 76.123.456-7" value={form.rut} maxLength={12}
                        onChange={(e) => setForm((f) => ({ ...f, rut: formatearRut(e.target.value) }))} />
                    {form.rut && !rutValido(form.rut) && (
                        <div className="invalid-feedback">RUT inválido (dígito verificador no corresponde).</div>
                    )}
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Rubro</label>
                    <input className="form-control" placeholder="Ej: Construcción" value={form.rubro}
                        onChange={(e) => setForm((f) => ({ ...f, rubro: e.target.value }))} />
                    <p className="text-muted mb-0 mt-1" style={{ fontSize: "0.75rem" }}>Usado para filtrar licitaciones/compras.</p>
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Giro</label>
                    <input className="form-control" placeholder="Actividad económica (SII)" value={form.giro}
                        onChange={(e) => setForm((f) => ({ ...f, giro: e.target.value }))} />
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Tamaño de empresa</label>
                    <select className="form-control" value={form.tamanoEmpresa}
                        onChange={(e) => setForm((f) => ({ ...f, tamanoEmpresa: e.target.value }))}>
                        {TAMANOS_EMPRESA.map((t) => (
                            <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                        ))}
                    </select>
                </div>
            </div>

            <p className="text-muted mb-2 mt-3" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Representante legal
            </p>
            <div className="row g-2">
                <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Nombre</label>
                    <input className="form-control" value={form.representanteLegal}
                        onChange={(e) => setForm((f) => ({ ...f, representanteLegal: e.target.value }))} />
                </div>
                <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>RUT</label>
                    <input className={`form-control ${form.rutRepresentanteLegal && !rutValido(form.rutRepresentanteLegal) ? "is-invalid" : ""}`}
                        placeholder="Ej: 12.345.678-5" value={form.rutRepresentanteLegal} maxLength={12}
                        onChange={(e) => setForm((f) => ({ ...f, rutRepresentanteLegal: formatearRut(e.target.value) }))} />
                    {form.rutRepresentanteLegal && !rutValido(form.rutRepresentanteLegal) && (
                        <div className="invalid-feedback">RUT inválido (dígito verificador no corresponde).</div>
                    )}
                </div>
            </div>

            <p className="text-muted mb-2 mt-3" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Contacto y ubicación
            </p>
            <div className="row g-2">
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Teléfono</label>
                    <input className="form-control" value={form.telefono}
                        onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Email de contacto</label>
                    <input type="email" className="form-control" value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Sitio web</label>
                    <input className="form-control" placeholder="https://..." value={form.sitioWeb}
                        onChange={(e) => setForm((f) => ({ ...f, sitioWeb: e.target.value }))} />
                </div>
                <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Dirección</label>
                    <input className="form-control" value={form.direccion}
                        onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} />
                </div>
                <div className="col-md-3">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Región</label>
                    <select className="form-control" value={form.region}
                        onChange={(e) => setForm((f) => ({ ...f, region: e.target.value, comuna: "" }))}>
                        <option value="">Seleccione...</option>
                        {REGIONES.map((r) => (
                            <option key={r.nombre} value={r.nombre}>{r.nombre}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-3">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Comuna</label>
                    {/* Depende de la región elegida arriba -- deshabilitada hasta
                        que haya una región, así no se puede quedar con una comuna
                        que no le corresponde. */}
                    <select className="form-control" value={form.comuna} disabled={!form.region}
                        onChange={(e) => setForm((f) => ({ ...f, comuna: e.target.value }))}>
                        <option value="">{form.region ? "Seleccione..." : "Elija región primero"}</option>
                        {comunasDe(form.region).map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            <p className="text-muted mb-2 mt-3" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Mercado Público
            </p>
            <div className="row g-2 align-items-end">
                <div className="col-md-4 d-flex align-items-center pb-2">
                    <div className="form-check">
                        <input
                            type="checkbox" className="form-check-input" id="chileproveedoresCheck"
                            checked={form.chileproveedoresRegistrado}
                            onChange={(e) => setForm((f) => ({ ...f, chileproveedoresRegistrado: e.target.checked }))}
                        />
                        <label className="form-check-label" htmlFor="chileproveedoresCheck" style={{ fontSize: "0.85rem" }}>
                            Inscrita en ChileProveedores
                        </label>
                    </div>
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Código ChileProveedores</label>
                    <input className="form-control" value={form.chileproveedoresCodigo}
                        onChange={(e) => setForm((f) => ({ ...f, chileproveedoresCodigo: e.target.value }))} />
                </div>
                <div className="col-md-4">
                    <label className="form-label" style={{ fontSize: "0.85rem" }}>Estado de la cuenta</label>
                    <select className="form-control" value={form.estado}
                        onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
                        <option value="ACTIVA">Activa</option>
                        <option value="INACTIVA">Inactiva</option>
                    </select>
                </div>
            </div>

            <p className="text-muted mb-2 mt-3" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Logo
            </p>
            <div className="d-flex align-items-center gap-3">
                {logoPreview && (
                    <img src={logoPreview} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 6, background: "var(--bg-elevated-2)" }} />
                )}
                <input
                    type="file" accept="image/*" className="form-control"
                    style={{ maxWidth: "320px" }}
                    onChange={(e) => onElegirLogo(e.target.files?.[0])}
                />
            </div>
        </>
    );
}

// Exportado -- la tabla de empresas (Administracion.jsx) también lo
// necesita para mostrar la etiqueta legible en la columna "Tamaño".
export const TAMANOS_EMPRESA = [
    { valor: "", etiqueta: "Sin definir" },
    { valor: "MICRO", etiqueta: "Micro" },
    { valor: "PEQUENA", etiqueta: "Pequeña" },
    { valor: "MEDIANA", etiqueta: "Mediana" },
    { valor: "GRANDE", etiqueta: "Grande" },
];

// Estado vacío de referencia para quien arme un form nuevo -- evita que
// cada pantalla que crea una empresa desde cero tenga que repetir la
// lista completa de campos.
export const EMPRESA_VACIA = {
    nombre: "", rut: "", rubro: "", representanteLegal: "",
    direccion: "", comuna: "", region: "", telefono: "", email: "",
    nombreFantasia: "", giro: "", rutRepresentanteLegal: "",
    tamanoEmpresa: "", chileproveedoresRegistrado: false, chileproveedoresCodigo: "",
    sitioWeb: "", estado: "ACTIVA", logoBase64: null, logoTipoContenido: null,
};

// FileReader.readAsDataURL da "data:image/png;base64,AAAA..." -- el
// backend (CrearEmpresaRequest.logoBase64) espera solo la parte de
// despues de la coma, sin el prefijo. Se exporta porque tanto
// SeccionEmpresas como EmpresaDetalle.jsx necesitan el mismo conversor
// para su propio "elegirLogo".
export function archivoABase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
