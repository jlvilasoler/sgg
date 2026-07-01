import type { StockControlSanitarioInput } from "../../types";
import type { StockDispositivoModulo } from "../../api";
import { useCallback, useState } from "react";
import StockControlSanitarioCantidadSelect from "./StockControlSanitarioCantidadSelect";
import StockControlSanitarioEsperaSelect from "./StockControlSanitarioEsperaSelect";
import StockControlSanitarioFormaSelect from "./StockControlSanitarioFormaSelect";
import StockControlSanitarioFormulaSelect from "./StockControlSanitarioFormulaSelect";
import StockControlSanitarioMarcaSelect from "./StockControlSanitarioMarcaSelect";
import StockControlSanitarioMotivoSelect from "./StockControlSanitarioMotivoSelect";
import StockControlSanitarioSectionTitle from "./StockControlSanitarioSectionTitle";
import {
  flagsDesdePatch,
  patchProductoDesdeMarca,
  patchProductoDesdeMarcaAsync,
  type ProductoSugeridoFlags,
} from "./stock-control-sanitario-marca-formula";

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
}

export function emptyStockControlSanitarioForm(): StockControlSanitarioFormState {
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
  adminModo?: AdminModo;
  guardando: boolean;
  apiOnline: boolean;
  modulo: StockDispositivoModulo;
  onPatch: (patch: Partial<StockControlSanitarioFormState>) => void;
  onAdminModo?: (modo: AdminModo) => void;
  onError: (msg: string) => void;
  onFichaSaved?: (msg: string) => void;
  historialMarcas?: string[];
  historialFormulas?: string[];
  historialFormas?: string[];
  historialCantidades?: string[];
  historialEsperas?: string[];
  historialMotivos?: string[];
  bandLayout?: boolean;
  /** Solo superadministrador: puede eliminar marcas agregadas manualmente. */
  puedeEliminarMarca?: boolean;
}

export default function StockControlSanitarioRegistroForm({
  idPrefix = "cs",
  form,
  adminModo = "fechas",
  guardando,
  apiOnline,
  modulo,
  onPatch,
  onAdminModo,
  onError,
  onFichaSaved,
  historialMarcas = [],
  historialFormulas = [],
  historialFormas = [],
  historialCantidades = [],
  historialEsperas = [],
  historialMotivos = [],
  bandLayout = false,
  puedeEliminarMarca = false,
}: Props) {
  const [sugeridoFicha, setSugeridoFicha] = useState<ProductoSugeridoFlags>({
    formula: false,
    forma: false,
  });

  const setAdminModo = (modo: AdminModo) => {
    onAdminModo?.(modo);
    if (modo === "fechas") {
      onPatch({ admin_periodo_nota: "" });
    } else {
      onPatch({ admin_fecha_inicio: "", admin_fecha_fin: "" });
    }
  };

  const onMarcaChange = useCallback(
    (nombre: string) => {
      setSugeridoFicha({ formula: false, forma: false });
      const sync = patchProductoDesdeMarca(nombre);
      onPatch(sync);
      setSugeridoFicha(flagsDesdePatch(sync));

      if (apiOnline && nombre.trim()) {
        void patchProductoDesdeMarcaAsync(nombre, modulo, apiOnline).then((patch) => {
          onPatch(patch);
          setSugeridoFicha(flagsDesdePatch(patch));
        });
      }
    },
    [apiOnline, modulo, onPatch]
  );

  const sugerenciaHint = (activo: boolean) =>
    activo ? (
      <span className="stock-control-sanitario-sugerencia-hint"> · sugerido según ficha</span>
    ) : null;

  const adminSection = (
    <section className="stock-control-sanitario-section stock-sanidad-form-section--admin">
      <div
        className={`stock-control-sanitario-section-head${
          bandLayout ? " stock-control-sanitario-section-head--solo-titulo" : ""
        }`}
      >
        <StockControlSanitarioSectionTitle icon="admin">
          {bandLayout ? "Fecha de administración" : "Fecha o período de administración"}
        </StockControlSanitarioSectionTitle>
        {!bandLayout ? (
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
        ) : null}
      </div>
      {bandLayout || adminModo === "fechas" ? (
        <div
          className={
            bandLayout ? "stock-sanidad-admin-campos stock-sanidad-admin-campos--band" : undefined
          }
        >
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
          <div className={bandLayout ? "stock-sanidad-admin-row-detalles" : undefined}>
            <div className="field stock-control-sanitario-admin-observaciones">
            <label htmlFor={`${idPrefix}-admin-observaciones`}>Observaciones</label>
            {bandLayout ? (
              <input
                id={`${idPrefix}-admin-observaciones`}
                type="text"
                className="stock-control-sanitario-admin-observaciones-input mayusculas-auto"
                maxLength={500}
                placeholder="Notas..."
                value={form.admin_observaciones}
                disabled={guardando}
                onChange={(e) => onPatch({ admin_observaciones: e.target.value })}
              />
            ) : (
              <textarea
                id={`${idPrefix}-admin-observaciones`}
                rows={2}
                maxLength={500}
                placeholder="Notas..."
                value={form.admin_observaciones}
                disabled={guardando}
                onChange={(e) => onPatch({ admin_observaciones: e.target.value })}
              />
            )}
            </div>
            {bandLayout ? (
              <div className="field stock-control-sanitario-admin-espera">
                <label htmlFor={`${idPrefix}-producto-espera-trigger`}>Tiempo de espera</label>
                <StockControlSanitarioEsperaSelect
                  idPrefix={idPrefix}
                  value={form.producto_espera}
                  onChange={(v) => onPatch({ producto_espera: v })}
                  disabled={guardando}
                  apiOnline={apiOnline}
                  modulo={modulo}
                  historialEsperas={historialEsperas}
                  onError={onError}
                />
              </div>
            ) : null}
            {bandLayout ? (
              <div className="field stock-control-sanitario-admin-motivo">
                <label htmlFor={`${idPrefix}-control-motivo-trigger`}>Motivo</label>
                <StockControlSanitarioMotivoSelect
                  value={form.control_motivo}
                  onChange={(v) => onPatch({ control_motivo: v })}
                  disabled={guardando}
                  historialMotivos={historialMotivos}
                />
              </div>
            ) : null}
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
            onChange={onMarcaChange}
            disabled={guardando}
            historialMarcas={historialMarcas}
            apiOnline={apiOnline}
            modulo={modulo}
            onError={onError}
            onFichaSaved={onFichaSaved}
            puedeEliminarMarca={puedeEliminarMarca}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-producto-formula-trigger`}>
            Fórmula
            {sugerenciaHint(sugeridoFicha.formula)}
          </label>
          <StockControlSanitarioFormulaSelect
            value={form.producto_formula}
            onChange={(v) => {
              onPatch({ producto_formula: v });
              setSugeridoFicha((prev) => ({ ...prev, formula: false }));
            }}
            disabled={guardando}
            historialFormulas={historialFormulas}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-producto-forma-trigger`}>
            Forma de administración
            {sugerenciaHint(sugeridoFicha.forma)}
          </label>
          <StockControlSanitarioFormaSelect
            value={form.producto_forma}
            onChange={(v) => {
              onPatch({ producto_forma: v });
              setSugeridoFicha((prev) => ({ ...prev, forma: false }));
            }}
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
        {!bandLayout ? (
        <div className="field">
          <label htmlFor={`${idPrefix}-producto-espera-trigger`}>Tiempo de espera</label>
          <StockControlSanitarioEsperaSelect
            idPrefix={idPrefix}
            value={form.producto_espera}
            onChange={(v) => onPatch({ producto_espera: v })}
            disabled={guardando}
            apiOnline={apiOnline}
            modulo={modulo}
            historialEsperas={historialEsperas}
            onError={onError}
          />
        </div>
        ) : null}
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
      </div>
    </section>
  );

  if (bandLayout) {
    return (
      <div className="stock-sanidad-form-band">
        {adminSection}
        {productoSection}
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
