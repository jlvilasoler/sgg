import { useEffect, useId, useState, type FormEvent } from "react";
import {
  altaStockOvinoCabana,
  altaStockOvinoGenerica,
  fetchEmpresasOperativasStock,
} from "../../api";
import type { AuthUser, DispositivoSexo } from "../../types";
import SelectEmpresaDispositivo, {
  EMPRESA_PENDIENTE,
  type EmpresaSelectValue,
} from "../stock/SelectEmpresaDispositivo";
import SelectPotreroDispositivo from "../stock/SelectPotreroDispositivo";
import { PageModuleHeadRow } from "../PageModuleHead";
import SelectRazaOvinoDispositivo from "./SelectRazaOvinoDispositivo";
import { normalizarRaza } from "../stock/stock-ganadera-utils";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onImported: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
  embedded?: boolean;
}

type ModoImport = "generica" | "cabana";

type CategoriaAltaOvino =
  | "CORDERA"
  | "BORREGA"
  | "OVEJA"
  | "CORDERO"
  | "BORREGO"
  | "CAPON"
  | "CARNERO";

const CATEGORIA_ALTA_LABELS: Record<CategoriaAltaOvino, string> = {
  CORDERA: "Cordera (0–12 meses)",
  BORREGA: "Borrega (12–36 meses)",
  OVEJA: "Oveja (36 meses – 60 años)",
  CORDERO: "Cordero (0–12 meses)",
  BORREGO: "Borrego (12–36 meses)",
  CAPON: "Capón (36 meses – 60 años · castrado)",
  CARNERO: "Carnero (36 meses – 60 años · no castrado)",
};

const OVINO_FRONTERA_JOVEN = 12;
const OVINO_FRONTERA_ADULTO = 36;

interface FormGenerica {
  cantidad: string;
  empresa: EmpresaSelectValue;
  potrero: string;
  sexo: DispositivoSexo | "";
  fecha_nacimiento: string;
  castrado: boolean | null;
  raza: string;
}

interface FormCabana {
  rp: string;
  nombre_animal: string;
  fecha_nacimiento: string;
  sexo: DispositivoSexo | "";
  registro: string;
  premios: string;
  raza: string;
  empresa: EmpresaSelectValue;
  potrero: string;
  castrado: boolean | null;
}

function formGenericaVacio(): FormGenerica {
  return {
    cantidad: "1",
    empresa: EMPRESA_PENDIENTE,
    potrero: "",
    sexo: "",
    fecha_nacimiento: "",
    castrado: null,
    raza: "",
  };
}

function formCabanaVacio(): FormCabana {
  return {
    rp: "",
    nombre_animal: "",
    fecha_nacimiento: "",
    sexo: "",
    registro: "",
    premios: "",
    raza: "",
    empresa: EMPRESA_PENDIENTE,
    potrero: "",
    castrado: null,
  };
}

function edadMesesDesdeFechaIso(fechaIso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso.trim());
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return null;
  }
  const now = new Date();
  return Math.max(0, (now.getFullYear() - anio) * 12 + (now.getMonth() + 1 - mes));
}

function categoriaDesdeForm(
  sexo: DispositivoSexo | "",
  fechaNacimiento: string,
  castrado: boolean | null
): CategoriaAltaOvino | null {
  if (sexo !== "MACHO" && sexo !== "HEMBRA") return null;
  const edad = edadMesesDesdeFechaIso(fechaNacimiento);
  if (edad === null) return null;
  if (sexo === "HEMBRA") {
    if (edad < OVINO_FRONTERA_JOVEN) return "CORDERA";
    if (edad < OVINO_FRONTERA_ADULTO) return "BORREGA";
    return "OVEJA";
  }
  if (edad < OVINO_FRONTERA_JOVEN) return "CORDERO";
  if (edad < OVINO_FRONTERA_ADULTO) return "BORREGO";
  if (castrado === true) return "CAPON";
  if (castrado === false) return "CARNERO";
  return null;
}

function formatOvinoIdDisplay(clave: string): string {
  const digits = clave.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StockOvinoImportar({
  apiOnline,
  currentUser: _currentUser,
  onImported,
  onError,
  onSuccess,
  onVolver,
  embedded = false,
}: Props) {
  const formId = useId();
  const [modo, setModo] = useState<ModoImport>("generica");
  const [formGenerica, setFormGenerica] = useState<FormGenerica>(() => formGenericaVacio());
  const [formCabana, setFormCabana] = useState<FormCabana>(() => formCabanaVacio());
  const [importing, setImporting] = useState(false);
  const [empresas, setEmpresas] = useState<
    Awaited<ReturnType<typeof fetchEmpresasOperativasStock>>
  >([]);

  useEffect(() => {
    if (!apiOnline) {
      setEmpresas([]);
      return;
    }
    fetchEmpresasOperativasStock()
      .then(setEmpresas)
      .catch(() => setEmpresas([]));
  }, [apiOnline]);

  useEffect(() => {
    if (empresas.length === 0) return;
    setFormGenerica((prev) => {
      if (prev.empresa === EMPRESA_PENDIENTE || prev.empresa === "") return prev;
      if (empresas.some((e) => e.codigo === prev.empresa)) return prev;
      return { ...prev, empresa: EMPRESA_PENDIENTE };
    });
    setFormCabana((prev) => {
      if (prev.empresa === EMPRESA_PENDIENTE || prev.empresa === "") return prev;
      if (empresas.some((e) => e.codigo === prev.empresa)) return prev;
      return { ...prev, empresa: EMPRESA_PENDIENTE };
    });
  }, [empresas]);

  const submitAltaGenerica = async (e?: FormEvent) => {
    e?.preventDefault();
    if (formGenerica.empresa === EMPRESA_PENDIENTE || !formGenerica.empresa) {
      onError("Seleccioná la empresa");
      return;
    }
    const cantidad = Math.floor(Number(formGenerica.cantidad));
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500) {
      onError("La cantidad debe ser un entero entre 1 y 500");
      return;
    }
    if (!formGenerica.potrero.trim()) {
      onError("Seleccioná un potrero");
      return;
    }
    if (formGenerica.sexo !== "MACHO" && formGenerica.sexo !== "HEMBRA") {
      onError("Seleccioná el sexo");
      return;
    }
    const fechaNacimiento = formGenerica.fecha_nacimiento.trim();
    const edad = fechaNacimiento ? edadMesesDesdeFechaIso(fechaNacimiento) : null;
    if (fechaNacimiento && edad === null) {
      onError("Fecha de nacimiento inválida");
      return;
    }
    const necesitaCastrado =
      formGenerica.sexo === "MACHO" && edad !== null && edad >= OVINO_FRONTERA_ADULTO;
    if (necesitaCastrado && formGenerica.castrado === null) {
      onError("Indicá si es Capón (castrado) o Carnero");
      return;
    }
    if (fechaNacimiento) {
      const categoria = categoriaDesdeForm(
        formGenerica.sexo,
        fechaNacimiento,
        formGenerica.castrado
      );
      if (!categoria) {
        onError("No se pudo determinar la categoría");
        return;
      }
    }
    setImporting(true);
    try {
      const r = await altaStockOvinoGenerica({
        cantidad,
        sexo: formGenerica.sexo,
        ...(fechaNacimiento ? { fecha_nacimiento: fechaNacimiento } : {}),
        castrado: necesitaCastrado ? formGenerica.castrado : null,
        potrero: formGenerica.potrero,
        empresa: formGenerica.empresa,
        ...(formGenerica.raza.trim()
          ? { raza: normalizarRaza(formGenerica.raza) }
          : {}),
      });
      const rango =
        r.desde === r.hasta
          ? formatOvinoIdDisplay(r.desde)
          : `${formatOvinoIdDisplay(r.desde)} → ${formatOvinoIdDisplay(r.hasta)}`;
      onSuccess(`${r.message}. IDs: ${rango}`, "Alta genérica completada");
      setFormGenerica(formGenericaVacio());
      onImported();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error en el alta genérica");
    } finally {
      setImporting(false);
    }
  };

  const submitAltaCabana = async (e?: FormEvent) => {
    e?.preventDefault();
    if (formCabana.empresa === EMPRESA_PENDIENTE || !formCabana.empresa) {
      onError("Seleccioná la empresa");
      return;
    }
    if (!formCabana.potrero.trim()) {
      onError("Seleccioná un potrero");
      return;
    }
    if (!formCabana.rp.trim()) {
      onError("Indicá el RP (registro particular)");
      return;
    }
    if (!formCabana.nombre_animal.trim()) {
      onError("Indicá el nombre del animal");
      return;
    }
    if (!formCabana.registro.trim()) {
      onError("Indicá el registro");
      return;
    }
    if (formCabana.sexo !== "MACHO" && formCabana.sexo !== "HEMBRA") {
      onError("Seleccioná el sexo");
      return;
    }
    if (!formCabana.fecha_nacimiento.trim()) {
      onError("Indicá la fecha de nacimiento");
      return;
    }
    const edad = edadMesesDesdeFechaIso(formCabana.fecha_nacimiento);
    if (edad === null) {
      onError("Fecha de nacimiento inválida");
      return;
    }
    const necesitaCastrado =
      formCabana.sexo === "MACHO" && edad >= OVINO_FRONTERA_ADULTO;
    if (necesitaCastrado && formCabana.castrado === null) {
      onError("Indicá si es Capón (castrado) o Carnero");
      return;
    }
    setImporting(true);
    try {
      const r = await altaStockOvinoCabana({
        rp: formCabana.rp.trim(),
        nombre_animal: formCabana.nombre_animal.trim(),
        fecha_nacimiento: formCabana.fecha_nacimiento,
        sexo: formCabana.sexo,
        registro: formCabana.registro.trim(),
        premios: formCabana.premios.trim(),
        raza: normalizarRaza(formCabana.raza),
        castrado: necesitaCastrado ? formCabana.castrado : null,
        potrero: formCabana.potrero,
        empresa: formCabana.empresa,
      });
      onSuccess(
        `${r.message}. ID: ${formatOvinoIdDisplay(r.clave)}`,
        "Alta cabaña completada"
      );
      setFormCabana(formCabanaVacio());
      onImported();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error en el alta de cabaña");
    } finally {
      setImporting(false);
    }
  };

  const btnGhost = embedded ? "sg-hub-cta sg-hub-cta--ghost" : "btn btn-ghost";
  const btnPrimary = embedded ? "sg-hub-cta" : "btn btn-primary stock-import-btn";

  const offlineBanner = !apiOnline ? (
    <div className="stock-import-offline" role="status">
      Conectá la API (puerto 3001) para dar de alta ovinos.
    </div>
  ) : null;

  const importTabs = (
    <div
      className={`stock-import-tabs${embedded ? " stock-import-tabs--hub" : ""}`}
      role="tablist"
      aria-label="Modo de alta"
    >
      <button
        type="button"
        role="tab"
        aria-selected={modo === "generica"}
        className={`stock-import-tab${modo === "generica" ? " is-active" : ""}`}
        onClick={() => setModo("generica")}
      >
        Alta genérica
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={modo === "cabana"}
        className={`stock-import-tab${modo === "cabana" ? " is-active" : ""}`}
        onClick={() => setModo("cabana")}
      >
        Cabaña
      </button>
    </div>
  );

  const edadGenerica = edadMesesDesdeFechaIso(formGenerica.fecha_nacimiento);
  const machoAdultoGen =
    formGenerica.sexo === "MACHO" &&
    edadGenerica !== null &&
    edadGenerica >= OVINO_FRONTERA_ADULTO;
  const categoriaAutoGen = categoriaDesdeForm(
    formGenerica.sexo,
    formGenerica.fecha_nacimiento,
    formGenerica.castrado
  );

  const edadCabana = edadMesesDesdeFechaIso(formCabana.fecha_nacimiento);
  const machoAdultoCab =
    formCabana.sexo === "MACHO" &&
    edadCabana !== null &&
    edadCabana >= OVINO_FRONTERA_ADULTO;
  const categoriaAutoCab = categoriaDesdeForm(
    formCabana.sexo,
    formCabana.fecha_nacimiento,
    formCabana.castrado
  );

  const genericaFormGrid = (
    <div className="stock-import-form-grid">
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-gen-cantidad`}>Cantidad *</label>
        <input
          id={`${formId}-gen-cantidad`}
          type="number"
          min={1}
          max={500}
          step={1}
          value={formGenerica.cantidad}
          onChange={(e) => setFormGenerica((p) => ({ ...p, cantidad: e.target.value }))}
          disabled={!apiOnline || importing}
          required
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-gen-empresa`}>Empresa *</label>
        <SelectEmpresaDispositivo
          id={`${formId}-gen-empresa`}
          empresas={empresas}
          value={formGenerica.empresa}
          requiereSeleccion
          onChange={(empresa) => setFormGenerica((p) => ({ ...p, empresa }))}
          disabled={!apiOnline || importing}
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-gen-potrero`}>Potrero *</label>
        <SelectPotreroDispositivo
          id={`${formId}-gen-potrero`}
          value={formGenerica.potrero}
          onChange={(potrero) => setFormGenerica((p) => ({ ...p, potrero }))}
          disabled={!apiOnline || importing}
          apiOnline={apiOnline}
          onError={onError}
          onSuccess={onSuccess}
          selectClassName="stock-edit-select"
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-gen-sexo`}>Sexo *</label>
        <select
          id={`${formId}-gen-sexo`}
          className="stock-edit-select"
          value={formGenerica.sexo}
          onChange={(e) => {
            const sexo = e.target.value as DispositivoSexo | "";
            setFormGenerica((p) => ({ ...p, sexo, castrado: null }));
          }}
          disabled={!apiOnline || importing}
          required
        >
          <option value="">Seleccionar…</option>
          <option value="HEMBRA">Hembra</option>
          <option value="MACHO">Macho</option>
        </select>
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-gen-raza`}>Raza</label>
        <SelectRazaOvinoDispositivo
          id={`${formId}-gen-raza`}
          value={formGenerica.raza}
          onChange={(raza) => setFormGenerica((p) => ({ ...p, raza }))}
          disabled={!apiOnline || importing}
          apiOnline={apiOnline}
          onError={onError}
          onSuccess={onSuccess}
          selectClassName="stock-edit-select"
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-gen-nacimiento`}>Fecha de nacimiento</label>
        <input
          id={`${formId}-gen-nacimiento`}
          type="date"
          max={fechaHoy()}
          value={formGenerica.fecha_nacimiento}
          onChange={(e) =>
            setFormGenerica((p) => ({
              ...p,
              fecha_nacimiento: e.target.value,
              castrado: null,
            }))
          }
          disabled={!apiOnline || importing}
        />
      </div>
      {machoAdultoGen ? (
        <div className="field stock-import-field">
          <label htmlFor={`${formId}-gen-castrado`}>Tipo adulto *</label>
          <select
            id={`${formId}-gen-castrado`}
            className="stock-edit-select"
            value={
              formGenerica.castrado === true
                ? "CAPON"
                : formGenerica.castrado === false
                  ? "CARNERO"
                  : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              setFormGenerica((p) => ({
                ...p,
                castrado: v === "CAPON" ? true : v === "CARNERO" ? false : null,
              }));
            }}
            disabled={!apiOnline || importing}
            required
          >
            <option value="">Seleccionar…</option>
            <option value="CAPON">Capón (castrado)</option>
            <option value="CARNERO">Carnero (no castrado)</option>
          </select>
        </div>
      ) : null}
      <div className="field stock-import-field stock-import-field--condicion">
        <label htmlFor={`${formId}-gen-categoria`}>Categoría</label>
        <input
          id={`${formId}-gen-categoria`}
          type="text"
          className="stock-edit-select"
          value={
            categoriaAutoGen
              ? CATEGORIA_ALTA_LABELS[categoriaAutoGen]
              : machoAdultoGen
                ? "Elegí Capón o Carnero"
                : formGenerica.fecha_nacimiento
                  ? formGenerica.sexo
                    ? "Calculando…"
                    : "Indicá el sexo"
                  : formGenerica.sexo
                    ? "Sin fecha de nacimiento"
                    : "Opcional: según sexo y fecha de nacimiento"
          }
          readOnly
          disabled
        />
        {edadGenerica !== null ? (
          <span className="muted" style={{ fontSize: "0.85em" }}>
            Edad actual: {edadGenerica} mes{edadGenerica === 1 ? "" : "es"}
          </span>
        ) : null}
      </div>
    </div>
  );

  const cabanaFormGrid = (
    <div className="stock-import-form-grid">
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-cab-rp`}>RP (registro particular)</label>
        <input
          id={`${formId}-cab-rp`}
          type="text"
          maxLength={64}
          value={formCabana.rp}
          onChange={(e) => setFormCabana((p) => ({ ...p, rp: e.target.value }))}
          disabled={!apiOnline || importing}
          required
          autoComplete="off"
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-cab-nombre`}>Nombre animal</label>
        <input
          id={`${formId}-cab-nombre`}
          type="text"
          maxLength={120}
          value={formCabana.nombre_animal}
          onChange={(e) =>
            setFormCabana((p) => ({ ...p, nombre_animal: e.target.value }))
          }
          disabled={!apiOnline || importing}
          required
          autoComplete="off"
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-cab-nacimiento`}>Fecha de nacimiento</label>
        <input
          id={`${formId}-cab-nacimiento`}
          type="date"
          max={fechaHoy()}
          value={formCabana.fecha_nacimiento}
          onChange={(e) =>
            setFormCabana((p) => ({
              ...p,
              fecha_nacimiento: e.target.value,
              castrado: null,
            }))
          }
          disabled={!apiOnline || importing}
          required
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-cab-sexo`}>Sexo</label>
        <select
          id={`${formId}-cab-sexo`}
          className="stock-edit-select"
          value={formCabana.sexo}
          onChange={(e) => {
            const sexo = e.target.value as DispositivoSexo | "";
            setFormCabana((p) => ({ ...p, sexo, castrado: null }));
          }}
          disabled={!apiOnline || importing}
          required
        >
          <option value="">Seleccionar…</option>
          <option value="HEMBRA">Hembra</option>
          <option value="MACHO">Macho</option>
        </select>
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-cab-registro`}>Registro</label>
        <input
          id={`${formId}-cab-registro`}
          type="text"
          maxLength={120}
          value={formCabana.registro}
          onChange={(e) => setFormCabana((p) => ({ ...p, registro: e.target.value }))}
          disabled={!apiOnline || importing}
          required
          autoComplete="off"
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-cab-raza`}>Raza</label>
        <SelectRazaOvinoDispositivo
          id={`${formId}-cab-raza`}
          value={formCabana.raza}
          onChange={(raza) => setFormCabana((p) => ({ ...p, raza }))}
          disabled={!apiOnline || importing}
          apiOnline={apiOnline}
          onError={onError}
          onSuccess={onSuccess}
          selectClassName="stock-edit-select"
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-cab-empresa`}>Empresa</label>
        <SelectEmpresaDispositivo
          id={`${formId}-cab-empresa`}
          empresas={empresas}
          value={formCabana.empresa}
          requiereSeleccion
          onChange={(empresa) => setFormCabana((p) => ({ ...p, empresa }))}
          disabled={!apiOnline || importing}
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-cab-potrero`}>Potrero</label>
        <SelectPotreroDispositivo
          id={`${formId}-cab-potrero`}
          value={formCabana.potrero}
          onChange={(potrero) => setFormCabana((p) => ({ ...p, potrero }))}
          disabled={!apiOnline || importing}
          apiOnline={apiOnline}
          onError={onError}
          onSuccess={onSuccess}
          selectClassName="stock-edit-select"
        />
      </div>
      {machoAdultoCab ? (
        <div className="field stock-import-field">
          <label htmlFor={`${formId}-cab-castrado`}>Tipo adulto</label>
          <select
            id={`${formId}-cab-castrado`}
            className="stock-edit-select"
            value={
              formCabana.castrado === true
                ? "CAPON"
                : formCabana.castrado === false
                  ? "CARNERO"
                  : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              setFormCabana((p) => ({
                ...p,
                castrado: v === "CAPON" ? true : v === "CARNERO" ? false : null,
              }));
            }}
            disabled={!apiOnline || importing}
            required
          >
            <option value="">Seleccionar…</option>
            <option value="CAPON">Capón (castrado)</option>
            <option value="CARNERO">Carnero (no castrado)</option>
          </select>
        </div>
      ) : null}
      <div className="field stock-import-field stock-import-field--condicion">
        <label htmlFor={`${formId}-cab-categoria`}>Categoría</label>
        <input
          id={`${formId}-cab-categoria`}
          type="text"
          className="stock-edit-select"
          value={
            categoriaAutoCab
              ? CATEGORIA_ALTA_LABELS[categoriaAutoCab]
              : machoAdultoCab
                ? "Elegí Capón o Carnero"
                : formCabana.sexo && formCabana.fecha_nacimiento
                  ? "Calculando…"
                  : "Según sexo y fecha de nacimiento"
          }
          readOnly
          disabled
        />
      </div>
      <div className="field stock-import-field stock-import-field--full">
        <label htmlFor={`${formId}-cab-premios`}>Premios</label>
        <textarea
          id={`${formId}-cab-premios`}
          rows={4}
          maxLength={2000}
          value={formCabana.premios}
          onChange={(e) => setFormCabana((p) => ({ ...p, premios: e.target.value }))}
          disabled={!apiOnline || importing}
          placeholder="Premios que ganó el animal…"
        />
      </div>
    </div>
  );

  const genericaPane = (
    <section className="stock-import-pane" aria-label="Alta genérica de ovinos">
      <form
        id={`${formId}-generica`}
        className="stock-import-form"
        onSubmit={(e) => void submitAltaGenerica(e)}
      >
        {embedded ? (
          <div className="stock-alta-form-fields-box">{genericaFormGrid}</div>
        ) : (
          genericaFormGrid
        )}
        <p className="muted stock-alta-hub-note" style={{ marginTop: "0.75rem" }}>
          Cada animal recibe un ID interno único con prefijo <strong>199</strong> (misma
          secuencia correlativa que Cabaña). La fecha de nacimiento es opcional; si la
          indicás, la categoría se ajusta automáticamente.
        </p>
        <div
          className={`stock-import-form-actions${embedded ? " stock-import-form-actions--hub" : ""}`}
        >
          <button
            type="button"
            className={btnGhost}
            disabled={!apiOnline || importing}
            onClick={() => setFormGenerica(formGenericaVacio())}
          >
            Limpiar
          </button>
          <button type="submit" className={btnPrimary} disabled={!apiOnline || importing}>
            {importing ? "Registrando…" : "Dar de alta"}
          </button>
        </div>
      </form>
    </section>
  );

  const cabanaPane = (
    <section className="stock-import-pane" aria-label="Alta cabaña de ovinos">
      <form
        id={`${formId}-cabana`}
        className="stock-import-form"
        onSubmit={(e) => void submitAltaCabana(e)}
      >
        {embedded ? (
          <div className="stock-alta-form-fields-box">{cabanaFormGrid}</div>
        ) : (
          cabanaFormGrid
        )}
        <p className="muted stock-alta-hub-note" style={{ marginTop: "0.75rem" }}>
          El ID se asigna solo, con prefijo <strong>199</strong>, en la misma línea
          correlativa que los genéricos (sin repetición).
        </p>
        <div
          className={`stock-import-form-actions${embedded ? " stock-import-form-actions--hub" : ""}`}
        >
          <button
            type="button"
            className={btnGhost}
            disabled={!apiOnline || importing}
            onClick={() => setFormCabana(formCabanaVacio())}
          >
            Limpiar
          </button>
          <button type="submit" className={btnPrimary} disabled={!apiOnline || importing}>
            {importing ? "Registrando…" : "Dar de alta"}
          </button>
        </div>
      </form>
    </section>
  );

  const panel = embedded ? (
    <>
      {offlineBanner}
      <div className="stock-alta-hub-workspace">
        <section className="stock-alta-hub-box" aria-label="Guía de alta">
          <header className="stock-alta-hub-head-box">
            <p className="sg-hub-panel-kicker">Alta</p>
            <h2 className="stock-alta-hub-title">Nuevos ovinos en stock</h2>
            <p className="stock-alta-hub-sub muted">
              Alta genérica por cantidad, o alta individual de cabaña (RP, nombre, registro
              y premios). Ambos modos comparten la misma secuencia de IDs con prefijo 199.
            </p>
          </header>
          <p className="stock-alta-hub-note muted">
            <strong>Genérica:</strong> cantidad, potrero, sexo y fecha.{" "}
            <strong>Cabaña:</strong> RP, nombre, registro, premios y el mismo ID automático.
          </p>
        </section>

        <section className="stock-alta-hub-box stock-alta-hub-box--main" aria-label="Alta">
          <div className="stock-alta-hub-tabs-box">{importTabs}</div>
          {modo === "generica" ? genericaPane : cabanaPane}
        </section>
      </div>
    </>
  ) : (
    <div className="card stock-import-shell">
      <div className="form-header stock-import-head">
        <PageModuleHeadRow
          icon={{ source: "hub", id: "stock_alta" }}
          title="Alta de Ovinos"
          subtitle="Alta genérica o cabaña. IDs internos con prefijo 199, correlativos y únicos en todo el sistema."
        />
      </div>

      {offlineBanner}

      <div className="stock-ovina-layout stock-import-layout">
        <aside className="stock-facet-sidebar stock-import-sidebar" aria-label="Ayuda de alta">
          <div className="stock-facet-sidebar-head stock-import-sidebar-head">
            <h3 className="stock-facet-sidebar-title">Modos</h3>
          </div>

          <div className="stock-facet-group">
            <div className="stock-facet-group-head">
              <h4 className="stock-facet-group-title">Alta genérica</h4>
            </div>
            <p className="stock-import-sidebar-note">
              Cantidad, potrero, sexo y fecha de nacimiento. Categoría automática. ID único
              con prefijo <strong>199</strong>.
            </p>
          </div>

          <div className="stock-facet-group">
            <div className="stock-facet-group-head">
              <h4 className="stock-facet-group-title">Cabaña</h4>
            </div>
            <p className="stock-import-sidebar-note">
              RP, nombre, fecha, sexo, registro y premios. Misma secuencia de IDs que los
              genéricos.
            </p>
          </div>
        </aside>

        <div className="stock-ovina-main stock-import-main">
          {importTabs}
          {modo === "generica" ? genericaPane : cabanaPane}
        </div>
      </div>
    </div>
  );

  if (embedded) return panel;

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Ovino
      </button>
      {panel}
    </div>
  );
}
