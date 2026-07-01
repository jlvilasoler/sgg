import type { AuthUser, StockControlSanitarioInput } from "../../types";
import type { StockDispositivoModulo } from "../../api";
import StockControlSanitarioCantidadSelect from "./StockControlSanitarioCantidadSelect";
import StockControlSanitarioFormaSelect from "./StockControlSanitarioFormaSelect";
import StockControlSanitarioFormulaSelect from "./StockControlSanitarioFormulaSelect";
import StockControlSanitarioFuncionarioSelect from "./StockControlSanitarioFuncionarioSelect";
import StockControlSanitarioMarcaSelect from "./StockControlSanitarioMarcaSelect";
import StockControlSanitarioMotivoSelect from "./StockControlSanitarioMotivoSelect";
import StockControlSanitarioSectionTitle from "./StockControlSanitarioSectionTitle";

export type AdminModo = "fechas" | "periodo";

export interface StockControlSanitarioFormState {
  admin_fecha_inicio: string;
  admin_fecha_fin: string;
  admin_periodo_nota: string;
  admin_observaciones: string;
  producto_nombre: string;
  producto_formula: string;
  producto_cantidad: string;
  producto_forma: string;
  producto_espera: string;
  control_motivo: string;
  control_funcionario: string;
}

export function emptyStockControlSanitarioForm(funcionarioDefault = ""): StockControlSanitarioFormState {
  return {
    admin_fecha_inicio: "",
    admin_fecha_fin: "",
    admin_periodo_nota: "",
    admin_observaciones: "",
    producto_nombre: "",
    producto_formula: "",
    producto_cantidad: "",
    producto_forma: "",
    producto_espera: "",
    control_motivo: "",
    control_funcionario: funcionarioDefault,
  };
}

export function buildStockControlSanitarioInput(
  form: StockControlSanitarioFormState,
  adminModo: AdminModo,
  animalCategoriaLote: string,
  animalId: string
): StockControlSanitarioInput {
  return {
    admin_fecha_inicio: adminModo === "fechas" ? form.admin_fecha_inicio.trim() : "",
    admin_fecha_fin: "",
    admin_periodo_nota: adminModo === "periodo" ? form.admin_periodo_nota.trim() : "",
    admin_observaciones: form.admin_observaciones.trim(),
    producto_nombre: form.producto_nombre.trim(),
    producto_formula: form.producto_formula.trim(),
    producto_cantidad: form.producto_cantidad.trim(),
    producto_forma: form.producto_forma.trim(),
    producto_espera: form.producto_espera.trim(),
    animal_categoria_lote: animalCategoriaLote.trim(),
    animal_id: animalId.trim(),
    control_motivo: form.control_motivo.trim(),
    control_funcionario: form.control_funcionario.trim(),
  };
}

export function validateStockControlSanitarioForm(
  form: StockControlSanitarioFormState,
  adminModo: AdminModo
): string | null {
  if (adminModo === "fechas") {
    if (!form.admin_fecha_inicio.trim()) {
      return "Indicá la fecha de aplicación.";
    }
  } else if (!form.admin_periodo_nota.trim()) {
    return "Indicá el período de administración.";
  }
  if (!form.producto_nombre.trim()) {
    return "Seleccioná el nombre comercial del producto.";
  }
  return null;
}

interface Props {
  idPrefix?: string;
  form: StockControlSanitarioFormState;
  adminModo: AdminModo;
  guardando: boolean;
  apiOnline: boolean;
  modulo: StockDispositivoModulo;
  currentUser?: AuthUser | null;
  onPatch: (patch: Partial<StockControlSanitarioFormState>) => void;
  onAdminModo: (modo: AdminModo) => void;
  onError: (msg: string) => void;
  historialMarcas?: string[];
  historialFormulas?: string[];
  historialFormas?: string[];
  historialCantidades?: string[];
  historialMotivos?: string[];
  historialFuncionarios?: string[];
  bandLayout?: boolean;
}

export default function StockControlSanitarioRegistroForm({
  idPrefix = "cs",
  form,
  adminModo,
  guardando,
  apiOnline,
  modulo,
  currentUser,
  onPatch,
  onAdminModo,
  onError,
  historialMarcas = [],
  historialFormulas = [],
  historialFormas = [],
  historialCantidades = [],
  historialMotivos = [],
  historialFuncionarios = [],
  bandLayout = false,
}: Props) {
  const setAdminModo = (modo: AdminModo) => {
    onAdminModo(modo);
    if (modo === "fechas") {
      onPatch({ admin_periodo_nota: "" });
    } else {
      onPatch({ admin_fecha_inicio: "", admin_fecha_fin: "" });
    }
  };

  const adminSection = (
    <section className="stock-control-sanitario-section stock-sanidad-form-section--admin">
      <div className="stock-control-sanitario-section-head">
        <StockControlSanitarioSectionTitle icon="admin">
          Fecha o período de administración
        </StockControlSanitarioSectionTitle>
        <div
          className="stock-control-sanitario-modos"
          role="tablist"
          aria-label="Tipo de administración"
        >
          <button
            type="button"
            role="tab"
            aria-selected={adminModo === "fechas"}
            className={`stock-control-sanitario-modo${adminModo === "fechas" ? " is-active" : ""}`}
            disabled={guardando}
            onClick={() => setAdminModo("fechas")}
          >
            Fechas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={adminModo === "periodo"}
            className={`stock-control-sanitario-modo${adminModo === "periodo" ? " is-active" : ""}`}
            disabled={guardando}
            onClick={() => setAdminModo("periodo")}
          >
            Período
          </button>
        </div>
      </div>
      {adminModo === "fechas" ? (
        <div className={bandLayout ? "stock-sanidad-admin-campos" : undefined}>
          <div className="field">
            <label htmlFor={`${idPrefix}-admin-inicio`}>Fecha aplicación</label>
            <input
              id={`${idPrefix}-admin-inicio`}
              type="date"
              value={form.admin_fecha_inicio}
              disabled={guardando}
              onChange={(e) => onPatch({ admin_fecha_inicio: e.target.value })}
            />
          </div>
          <div className="field stock-control-sanitario-admin-observaciones">
            <label htmlFor={`${idPrefix}-admin-observaciones`}>Observaciones</label>
            <textarea
              id={`${idPrefix}-admin-observaciones`}
              rows={bandLayout ? 3 : 2}
              maxLength={500}
              placeholder="Notas..."
              value={form.admin_observaciones}
              disabled={guardando}
              onChange={(e) => onPatch({ admin_observaciones: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div className="field">
          <label htmlFor={`${idPrefix}-admin-periodo`}>Período / nota</label>
          <input
            id={`${idPrefix}-admin-periodo`}
            type="text"
            maxLength={200}
            placeholder="Ej. 3 días consecutivos, semana 12/2025…"
            value={form.admin_periodo_nota}
            disabled={guardando}
            onChange={(e) => onPatch({ admin_periodo_nota: e.target.value })}
          />
        </div>
      )}
    </section>
  );

  const productoSection = (
    <section className="stock-control-sanitario-section stock-sanidad-form-section--producto">
      <StockControlSanitarioSectionTitle icon="producto">Producto</StockControlSanitarioSectionTitle>
      <div
        className={`stock-control-sanitario-grid stock-control-sanitario-grid--2 stock-control-sanitario-grid--producto${
          bandLayout ? " stock-control-sanitario-grid--producto-band" : ""
        }`}
      >
        <div className="field">
          <label htmlFor={`${idPrefix}-producto-nombre-trigger`}>
            Nombre comercial
            <span className="stock-control-sanitario-required">*</span>
          </label>
          <StockControlSanitarioMarcaSelect
            value={form.producto_nombre}
            onChange={(v) => onPatch({ producto_nombre: v })}
            disabled={guardando}
            historialMarcas={historialMarcas}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-producto-formula-trigger`}>Fórmula</label>
          <StockControlSanitarioFormulaSelect
            value={form.producto_formula}
            onChange={(v) => onPatch({ producto_formula: v })}
            disabled={guardando}
            historialFormulas={historialFormulas}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-producto-forma-trigger`}>Forma de administración</label>
          <StockControlSanitarioFormaSelect
            value={form.producto_forma}
            onChange={(v) => onPatch({ producto_forma: v })}
            disabled={guardando}
            historialFormas={historialFormas}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-producto-cantidad-trigger`}>Cantidad</label>
          <StockControlSanitarioCantidadSelect
            value={form.producto_cantidad}
            onChange={(v) => onPatch({ producto_cantidad: v })}
            disabled={guardando}
            apiOnline={apiOnline}
            modulo={modulo}
            historialCantidades={historialCantidades}
            onError={onError}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-producto-espera`}>Tiempo de espera</label>
          <input
            id={`${idPrefix}-producto-espera`}
            type="text"
            maxLength={80}
            placeholder="Ej. 28 días carne / 7 días leche"
            value={form.producto_espera}
            disabled={guardando}
            onChange={(e) => onPatch({ producto_espera: e.target.value })}
          />
        </div>
      </div>
    </section>
  );

  const controlesSection = (
    <section className="stock-control-sanitario-section stock-sanidad-form-section--controles">
      <StockControlSanitarioSectionTitle icon="controles">Controles</StockControlSanitarioSectionTitle>
      <div
        className={`stock-control-sanitario-grid stock-control-sanitario-grid--2${
          bandLayout ? " stock-control-sanitario-grid--controles-band" : ""
        }`}
      >
        <div className="field">
          <label htmlFor={`${idPrefix}-control-motivo-trigger`}>Motivo</label>
          <StockControlSanitarioMotivoSelect
            value={form.control_motivo}
            onChange={(v) => onPatch({ control_motivo: v })}
            disabled={guardando}
            historialMotivos={historialMotivos}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-control-funcionario-trigger`}>
            Nombre funcionario que autorizó
          </label>
          <StockControlSanitarioFuncionarioSelect
            value={form.control_funcionario}
            onChange={(v) => onPatch({ control_funcionario: v })}
            disabled={guardando}
            apiOnline={apiOnline}
            currentUser={currentUser}
            historialNombres={historialFuncionarios}
            onError={onError}
          />
        </div>
      </div>
    </section>
  );

  if (bandLayout) {
    return (
      <div className="stock-sanidad-form-band">
        {adminSection}
        <div className="stock-sanidad-form-band-row">
          {productoSection}
          {controlesSection}
        </div>
      </div>
    );
  }

  return (
    <>
      {adminSection}
      {productoSection}
      {controlesSection}
    </>
  );
}
