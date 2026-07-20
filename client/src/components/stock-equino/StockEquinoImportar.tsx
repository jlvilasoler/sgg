import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  deleteStockEquinoLote,
  fetchEmpresasOperativasStock,
  fetchStockEquinoUltimaImportacionArchivo,
  importStockEquinoFile,
  importStockEquinoRows,
  altaStockEquinoGenerica,
} from "../../api";
import type { AuthUser, DispositivoEmpresa, DispositivoSexo } from "../../types";
import { confirmAction } from "../../utils/confirm";
import SelectEmpresaDispositivo, {
  EMPRESA_PENDIENTE,
  type EmpresaSelectValue,
} from "../stock/SelectEmpresaDispositivo";
import SelectPotreroDispositivo from "../stock/SelectPotreroDispositivo";
import { EID_PREFIX_LEN, splitEidVid } from "./stock-equina-utils";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onImported: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
  embedded?: boolean;
}

type ModoImport = "generica" | "archivo" | "manual";

type CategoriaAltaEquino =
  | "POTRANCA"
  | "POTRA"
  | "YEGUA"
  | "POTRILLO"
  | "POTRO"
  | "CABALLO"
  | "PADRILLO";

const CATEGORIA_ALTA_LABELS: Record<CategoriaAltaEquino, string> = {
  POTRANCA: "Potranca (0–12 meses)",
  POTRA: "Potra (12–36 meses)",
  YEGUA: "Yegua (36+ meses)",
  POTRILLO: "Potrillo (0–12 meses)",
  POTRO: "Potro (12–36 meses)",
  CABALLO: "Caballo (36+ · castrado)",
  PADRILLO: "Padrillo (36+ · no castrado)",
};

const EQUINO_FRONTERA_JOVEN = 12;
const EQUINO_FRONTERA_ADULTO = 36;

interface FormGenerica {
  cantidad: string;
  empresa: EmpresaSelectValue;
  potrero: string;
  sexo: DispositivoSexo | "";
  fecha_nacimiento: string;
  /** Solo macho adulto: true=Caballo, false=Padrillo */
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

function categoriaDesdeFormGenerica(
  sexo: DispositivoSexo | "",
  fechaNacimiento: string,
  castrado: boolean | null
): CategoriaAltaEquino | null {
  if (sexo !== "MACHO" && sexo !== "HEMBRA") return null;
  const edad = edadMesesDesdeFechaIso(fechaNacimiento);
  if (edad === null) return null;
  if (sexo === "HEMBRA") {
    if (edad < EQUINO_FRONTERA_JOVEN) return "POTRANCA";
    if (edad < EQUINO_FRONTERA_ADULTO) return "POTRA";
    return "YEGUA";
  }
  if (edad < EQUINO_FRONTERA_JOVEN) return "POTRILLO";
  if (edad < EQUINO_FRONTERA_ADULTO) return "POTRO";
  if (castrado === true) return "CABALLO";
  if (castrado === false) return "PADRILLO";
  return null;
}

function formatEquinoIdDisplay(clave: string): string {
  const digits = clave.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

interface LecturaManual {
  id: string;
  empresa: DispositivoEmpresa;
  eid: string;
  vid: string;
  fecha: string;
  hora: string;
  condicion: string;
}

interface FormLectura {
  empresa: EmpresaSelectValue;
  numero: string;
  fecha: string;
  hora: string;
  condicion: string;
}

const COLUMNAS = ["EID", "VID", "Date", "Time", "Condición"] as const;
const EXTENSIONES_ACEPTADAS = [".txt", ".csv", ".xlsx", ".xls"] as const;
const EID_PREFIJO = "858";

interface UltimaImportacionArchivo {
  id: number;
  nombre: string;
  filas: number;
}

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function horaAhora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formVacio(): FormLectura {
  return {
    empresa: EMPRESA_PENDIENTE,
    numero: `${EID_PREFIJO} `,
    fecha: fechaHoy(),
    hora: horaAhora(),
    condicion: "",
  };
}

function formatNumeroDispositivo(eid: string, vid: string): string {
  const { eid: e, vid: v } = splitEidVid(eid, vid);
  if (!e && !v) return `${EID_PREFIJO} `;
  if (!v) return `${e} `;
  return `${e} ${v}`;
}

/** Normaliza entrada: el prefijo 858 se agrega solo si falta. */
function normalizeNumeroInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith(EID_PREFIJO) && digits.length > EID_PREFIX_LEN) {
    const { eid, vid } = splitEidVid(digits, "");
    return vid ? `${eid} ${vid}` : `${eid} `;
  }

  if (!digits.startsWith(EID_PREFIJO)) {
    return `${EID_PREFIJO} ${digits}`;
  }

  return `${EID_PREFIJO} `;
}

function esArchivoStockValido(f: File): boolean {
  const name = f.name.toLowerCase();
  if (EXTENSIONES_ACEPTADAS.some((ext) => name.endsWith(ext))) return true;
  const mime = f.type.toLowerCase();
  return (
    mime === "text/plain" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "application/vnd.ms-excel" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function lecturaDesdeForm(form: FormLectura): Omit<LecturaManual, "id"> | null {
  if (form.empresa === EMPRESA_PENDIENTE) return null;
  const { eid, vid } = splitEidVid(form.numero, "");
  if (!eid.trim() || !vid.trim()) return null;
  if (!form.fecha.trim()) return null;
  return {
    empresa: form.empresa,
    eid,
    vid,
    fecha: form.fecha,
    hora: form.hora.trim(),
    condicion: form.condicion.trim(),
  };
}

let lecturaIdSeq = 0;
function nextLecturaId(): string {
  lecturaIdSeq += 1;
  return `lectura-${lecturaIdSeq}`;
}

export default function StockEquinoImportar({
  apiOnline,
  currentUser,
  onImported,
  onError,
  onSuccess,
  onVolver,
  embedded = false,
}: Props) {
  const formId = useId();
  const [modo, setModo] = useState<ModoImport>("generica");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormLectura>(() => formVacio());
  const [formGenerica, setFormGenerica] = useState<FormGenerica>(() => formGenericaVacio());
  const [pendientes, setPendientes] = useState<LecturaManual[]>([]);
  const [importing, setImporting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [ultimaImportacionArchivo, setUltimaImportacionArchivo] =
    useState<UltimaImportacionArchivo | null>(null);
  const [ultimaImportacionLoading, setUltimaImportacionLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
    setForm((prev) => {
      if (prev.empresa === EMPRESA_PENDIENTE || prev.empresa === "") return prev;
      if (empresas.some((e) => e.codigo === prev.empresa)) return prev;
      return { ...prev, empresa: EMPRESA_PENDIENTE };
    });
    setFormGenerica((prev) => {
      if (prev.empresa === EMPRESA_PENDIENTE || prev.empresa === "") return prev;
      if (empresas.some((e) => e.codigo === prev.empresa)) return prev;
      return { ...prev, empresa: EMPRESA_PENDIENTE };
    });
    setPendientes((prev) =>
      prev.filter(
        (row) => !row.empresa || empresas.some((e) => e.codigo === row.empresa)
      )
    );
  }, [empresas]);

  const cuentaScope = currentUser
    ? `${currentUser.id}:${currentUser.empresa_id ?? "na"}`
    : "";

  const cargarUltimaImportacionArchivo = useCallback(async () => {
    if (!apiOnline) {
      setUltimaImportacionArchivo(null);
      setUltimaImportacionLoading(false);
      return;
    }
    setUltimaImportacionLoading(true);
    try {
      const ultima = await fetchStockEquinoUltimaImportacionArchivo();
      setUltimaImportacionArchivo(ultima);
    } catch {
      setUltimaImportacionArchivo(null);
    } finally {
      setUltimaImportacionLoading(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    setUltimaImportacionArchivo(null);
    setUltimaImportacionLoading(true);
    void cargarUltimaImportacionArchivo();
  }, [cargarUltimaImportacionArchivo, cuentaScope]);

  const pickFile = useCallback(
    (f: File | null) => {
      if (!f) {
        setFile(null);
        return;
      }
      if (!esArchivoStockValido(f)) {
        onError("Solo archivos .txt, .csv o .xlsx (export Tru-Test o SNIG)");
        return;
      }
      setFile(f);
    },
    [onError]
  );

  const onNumeroChange = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, numero: normalizeNumeroInput(value) }));
  }, []);

  const onNumeroFocus = useCallback(() => {
    setForm((prev) => {
      if (!prev.numero.trim()) return { ...prev, numero: `${EID_PREFIJO} ` };
      return prev;
    });
  }, []);

  const normalizarNumeroForm = useCallback(() => {
    setForm((prev) => {
      if (!prev.numero.trim()) return { ...prev, numero: `${EID_PREFIJO} ` };
      const { eid, vid } = splitEidVid(prev.numero, "");
      const numero = formatNumeroDispositivo(eid, vid);
      if (numero === prev.numero) return prev;
      return { ...prev, numero };
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!apiOnline || importing) return;
      const f = e.dataTransfer.files?.[0];
      if (f) pickFile(f);
    },
    [apiOnline, importing, pickFile]
  );

  const importarArchivo = async () => {
    if (form.empresa === EMPRESA_PENDIENTE) {
      onError("Seleccioná la empresa de los animales del archivo");
      return;
    }
    if (!file) {
      onError("Seleccioná un archivo .txt, .csv o .xlsx");
      return;
    }
    setImporting(true);
    try {
      const r = await importStockEquinoFile(file, form.empresa);
      onSuccess(r.message, "Importación completada");
      setUltimaImportacionArchivo({
        id: r.lote_id,
        nombre: file.name,
        filas: r.insertados,
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const importarLecturas = async (rows: Omit<LecturaManual, "id">[]) => {
    if (!rows.length) {
      onError("Agregá al menos una lectura");
      return;
    }
    setImporting(true);
    try {
      const r = await importStockEquinoRows(rows);
      onSuccess(r.message, "Importación completada");
      setPendientes([]);
      setForm(formVacio());
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

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
    if (!formGenerica.fecha_nacimiento.trim()) {
      onError("Indicá la fecha de nacimiento");
      return;
    }
    const edad = edadMesesDesdeFechaIso(formGenerica.fecha_nacimiento);
    if (edad === null) {
      onError("Fecha de nacimiento inválida");
      return;
    }
    const necesitaCastrado =
      formGenerica.sexo === "MACHO" && edad >= EQUINO_FRONTERA_ADULTO;
    if (necesitaCastrado && formGenerica.castrado === null) {
      onError("Indicá si es Caballo (castrado) o Padrillo");
      return;
    }
    const categoria = categoriaDesdeFormGenerica(
      formGenerica.sexo,
      formGenerica.fecha_nacimiento,
      formGenerica.castrado
    );
    if (!categoria) {
      onError("No se pudo determinar la categoría");
      return;
    }
    setImporting(true);
    try {
      const r = await altaStockEquinoGenerica({
        cantidad,
        sexo: formGenerica.sexo,
        fecha_nacimiento: formGenerica.fecha_nacimiento,
        castrado: necesitaCastrado ? formGenerica.castrado : null,
        potrero: formGenerica.potrero,
        empresa: formGenerica.empresa,
      });
      const rango =
        r.desde === r.hasta
          ? formatEquinoIdDisplay(r.desde)
          : `${formatEquinoIdDisplay(r.desde)} → ${formatEquinoIdDisplay(r.hasta)}`;
      onSuccess(
        `${r.message}. IDs: ${rango}`,
        "Alta genérica completada"
      );
      setFormGenerica(formGenericaVacio());
      onImported();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error en el alta genérica");
    } finally {
      setImporting(false);
    }
  };

  const agregarPendiente = (e?: FormEvent) => {
    e?.preventDefault();
    const row = lecturaDesdeForm(form);
    if (!row) {
      onError("Completá empresa, número de dispositivo y fecha");
      return;
    }
    setPendientes((prev) => [...prev, { ...row, id: nextLecturaId() }]);
    setForm((prev) => ({
      ...formVacio(),
      fecha: prev.fecha,
      hora: prev.hora,
      empresa: prev.empresa,
    }));
  };

  const quitarPendiente = (id: string) => {
    setPendientes((prev) => prev.filter((p) => p.id !== id));
  };

  const importarFormulario = () => {
    const row = lecturaDesdeForm(form);
    if (!row) {
      onError("Completá empresa, número de dispositivo y fecha");
      return;
    }
    void importarLecturas([row]);
  };

  const importarPendientes = () => {
    void importarLecturas(
      pendientes.map(({ empresa, eid, vid, fecha, hora, condicion }) => ({
        empresa,
        eid,
        vid,
        fecha,
        hora,
        condicion,
      }))
    );
  };

  const deshacerUltimaImportacionArchivo = async () => {
    if (!ultimaImportacionArchivo) return;
    const { id, nombre, filas } = ultimaImportacionArchivo;
    const ok = await confirmAction({
      title: "Deshacer importación",
      message: `¿Eliminar la importación de «${nombre}»? Se quitarán ${filas} lectura(s) de ese archivo.`,
      confirmText: "Deshacer",
      variant: "danger",
    });
    if (!ok) return;
    setUndoing(true);
    try {
      await deleteStockEquinoLote(id);
      onSuccess("Importación deshecha", "Listo");
      await cargarUltimaImportacionArchivo();
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al deshacer importación");
    } finally {
      setUndoing(false);
    }
  };

  const btnGhost = embedded ? "sg-hub-cta sg-hub-cta--ghost" : "btn btn-ghost";
  const btnSecondary = embedded ? "sg-hub-cta sg-hub-cta--ghost" : "btn btn-secondary";
  const btnPrimary = embedded ? "sg-hub-cta" : "btn btn-primary stock-import-btn";

  const offlineBanner = !apiOnline ? (
    <div className="stock-import-offline" role="status">
      Conectá la API (puerto 3001) para importar lecturas.
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
        aria-selected={modo === "archivo"}
        className={`stock-import-tab${modo === "archivo" ? " is-active" : ""}`}
        onClick={() => setModo("archivo")}
      >
        Archivo RFID
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={modo === "manual"}
        className={`stock-import-tab${modo === "manual" ? " is-active" : ""}`}
        onClick={() => setModo("manual")}
      >
        Caravana manual
        {pendientes.length > 0 ? (
          <span
            className={`stock-import-tab-badge${embedded ? " stock-import-tab-badge--hub" : ""}`}
          >
            {pendientes.length}
          </span>
        ) : null}
      </button>
    </div>
  );

  const dropzone = (
    <div
      className={`stock-dropzone${embedded ? " stock-dropzone--hub" : ""}${dragOver ? " is-dragover" : ""}${file ? " has-file" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (apiOnline && !importing) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => {
        if (apiOnline && !importing && !file) inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (apiOnline && !importing) inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={apiOnline && !importing ? 0 : -1}
      aria-label="Zona para soltar archivo TXT o CSV"
    >
      <input
        ref={inputRef}
        type="file"
        className="stock-dropzone-input"
        accept=".txt,.csv,.xlsx,.xls,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={!apiOnline || importing}
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="stock-file-preview">
          <span className="stock-file-icon" aria-hidden>
            ✓
          </span>
          <div className="stock-file-meta">
            <strong className="stock-file-name">{file.name}</strong>
            <span>{formatBytes(file.size)}</span>
          </div>
          <button
            type="button"
            className="stock-file-clear"
            disabled={importing}
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            aria-label="Quitar archivo"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <span className="stock-dropzone-graphic" aria-hidden>
            ↑
          </span>
          <p className="stock-dropzone-title">Soltá el archivo aquí</p>
          <p className="stock-dropzone-sub">
            o hacé clic para buscar · Tru-Test, bastón o lector RFID
          </p>
        </>
      )}
    </div>
  );

  const undoBlock =
    !ultimaImportacionLoading && ultimaImportacionArchivo ? (
      <div
        className={`stock-import-undo${embedded ? " stock-import-undo--hub" : ""}`}
        role="status"
      >
        <div className="stock-import-undo-text">
          <strong>Última importación por archivo</strong>
          <span>
            «{ultimaImportacionArchivo.nombre}» — {ultimaImportacionArchivo.filas} lectura
            {ultimaImportacionArchivo.filas === 1 ? "" : "s"}
          </span>
        </div>
        <button
          type="button"
          className={
            embedded
              ? `${btnSecondary} stock-import-undo-btn`
              : "btn btn-secondary btn-sm stock-import-undo-btn"
          }
          disabled={!apiOnline || importing || undoing}
          onClick={() => void deshacerUltimaImportacionArchivo()}
        >
          {undoing ? "Deshaciendo…" : "Deshacer"}
        </button>
      </div>
    ) : null;

  const empresaArchivoField = (
    <div className="field stock-import-field stock-import-field--empresa">
      <label htmlFor={`${formId}-empresa-archivo`}>Empresa</label>
      <SelectEmpresaDispositivo
        id={`${formId}-empresa-archivo`}
        empresas={empresas}
        value={form.empresa}
        requiereSeleccion
        onChange={(empresa) => setForm((p) => ({ ...p, empresa }))}
        disabled={!apiOnline || importing}
      />
    </div>
  );

  const edadGenerica = edadMesesDesdeFechaIso(formGenerica.fecha_nacimiento);
  const machoAdulto =
    formGenerica.sexo === "MACHO" &&
    edadGenerica !== null &&
    edadGenerica >= EQUINO_FRONTERA_ADULTO;
  const categoriaAuto = categoriaDesdeFormGenerica(
    formGenerica.sexo,
    formGenerica.fecha_nacimiento,
    formGenerica.castrado
  );

  const genericaFormGrid = (
    <div className="stock-import-form-grid">
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-gen-cantidad`}>Cantidad</label>
        <input
          id={`${formId}-gen-cantidad`}
          type="number"
          min={1}
          max={500}
          step={1}
          value={formGenerica.cantidad}
          onChange={(e) =>
            setFormGenerica((p) => ({ ...p, cantidad: e.target.value }))
          }
          disabled={!apiOnline || importing}
          required
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-gen-empresa`}>Empresa</label>
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
        <label htmlFor={`${formId}-gen-potrero`}>Potrero</label>
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
        <label htmlFor={`${formId}-gen-sexo`}>Sexo</label>
        <select
          id={`${formId}-gen-sexo`}
          className="stock-edit-select"
          value={formGenerica.sexo}
          onChange={(e) => {
            const sexo = e.target.value as DispositivoSexo | "";
            setFormGenerica((p) => ({
              ...p,
              sexo,
              castrado: null,
            }));
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
          required
        />
      </div>
      {machoAdulto ? (
        <div className="field stock-import-field">
          <label htmlFor={`${formId}-gen-castrado`}>Tipo adulto</label>
          <select
            id={`${formId}-gen-castrado`}
            className="stock-edit-select"
            value={
              formGenerica.castrado === true
                ? "CABALLO"
                : formGenerica.castrado === false
                  ? "PADRILLO"
                  : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              setFormGenerica((p) => ({
                ...p,
                castrado: v === "CABALLO" ? true : v === "PADRILLO" ? false : null,
              }));
            }}
            disabled={!apiOnline || importing}
            required
          >
            <option value="">Seleccionar…</option>
            <option value="CABALLO">Caballo (castrado)</option>
            <option value="PADRILLO">Padrillo (no castrado)</option>
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
            categoriaAuto
              ? CATEGORIA_ALTA_LABELS[categoriaAuto]
              : machoAdulto
                ? "Elegí Caballo o Padrillo"
                : formGenerica.sexo && formGenerica.fecha_nacimiento
                  ? "Calculando…"
                  : "Según sexo y fecha de nacimiento"
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

  const genericaPane = (
    <section className="stock-import-pane" aria-label="Alta genérica de equinos">
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
          Cada animal recibe un ID interno único con prefijo <strong>600</strong> (global
          en todo el sistema). La categoría se ajusta sola según la fecha de nacimiento.
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
          <button
            type="submit"
            className={btnPrimary}
            disabled={!apiOnline || importing}
          >
            {importing ? "Registrando…" : "Dar de alta"}
          </button>
        </div>
      </form>
    </section>
  );

  const archivoPane = (
    <section className="stock-import-pane" aria-label="Importar desde archivo">
      {embedded ? (
        <div className="stock-alta-form-fields-box">
          {empresaArchivoField}
          {dropzone}
          {undoBlock}
        </div>
      ) : (
        <>
          {empresaArchivoField}
          {dropzone}
          {undoBlock}
        </>
      )}

      <div className={`stock-import-pane-foot${embedded ? " stock-import-pane-foot--hub" : ""}`}>
        <button
          type="button"
          className={btnPrimary}
          disabled={
            !apiOnline || importing || !file || form.empresa === EMPRESA_PENDIENTE
          }
          onClick={() => void importarArchivo()}
        >
          {importing ? (
            <>
              <span className="stock-import-spinner" aria-hidden />
              Procesando…
            </>
          ) : (
            "Subir e importar"
          )}
        </button>
      </div>
    </section>
  );

  const manualFormGrid = (
    <div className="stock-import-form-grid">
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-empresa`}>Empresa</label>
        <SelectEmpresaDispositivo
          id={`${formId}-empresa`}
          empresas={empresas}
          value={form.empresa}
          requiereSeleccion
          onChange={(empresa) => setForm((p) => ({ ...p, empresa }))}
          disabled={!apiOnline || importing}
        />
      </div>
      <div className="field stock-import-field stock-import-field--eid">
        <label htmlFor={`${formId}-numero`}>Número de dispositivo</label>
        <input
          id={`${formId}-numero`}
          type="text"
          className="mayusculas-auto"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000041989349"
          value={form.numero}
          onChange={(e) => onNumeroChange(e.target.value)}
          onFocus={onNumeroFocus}
          onBlur={normalizarNumeroForm}
          disabled={!apiOnline || importing}
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-fecha`}>Fecha</label>
        <input
          id={`${formId}-fecha`}
          type="date"
          value={form.fecha}
          onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
          disabled={!apiOnline || importing}
          required
        />
      </div>
      <div className="field stock-import-field">
        <label htmlFor={`${formId}-hora`}>Hora</label>
        <input
          id={`${formId}-hora`}
          type="time"
          step={1}
          value={form.hora}
          onChange={(e) => setForm((p) => ({ ...p, hora: e.target.value }))}
          disabled={!apiOnline || importing}
        />
      </div>
      <div className="field stock-import-field stock-import-field--condicion">
        <label htmlFor={`${formId}-condicion`}>Condición</label>
        <input
          id={`${formId}-condicion`}
          type="text"
          className="mayusculas-auto"
          autoComplete="off"
          placeholder="Ej. VIVO, VENDIDO…"
          value={form.condicion}
          onChange={(e) => setForm((p) => ({ ...p, condicion: e.target.value }))}
          disabled={!apiOnline || importing}
        />
      </div>
    </div>
  );

  const manualPane = (
    <section className="stock-import-pane" aria-label="Carga manual de lecturas">
      <form id={formId} className="stock-import-form" onSubmit={agregarPendiente}>
        {embedded ? (
          <div className="stock-alta-form-fields-box">{manualFormGrid}</div>
        ) : (
          manualFormGrid
        )}

        <div
          className={`stock-import-form-actions${embedded ? " stock-import-form-actions--hub" : ""}`}
        >
          <button
            type="button"
            className={btnGhost}
            disabled={!apiOnline || importing}
            onClick={() => setForm(formVacio())}
          >
            Limpiar
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!apiOnline || importing || !lecturaDesdeForm(form)}
            onClick={() => importarFormulario()}
          >
            Importar esta lectura
          </button>
          <button
            type="submit"
            className={btnPrimary}
            disabled={!apiOnline || importing || !lecturaDesdeForm(form)}
          >
            Agregar a la lista
          </button>
        </div>
      </form>

      {pendientes.length > 0 ? (
        <div
          className={`stock-import-queue${embedded ? " stock-alta-hub-box stock-alta-hub-box--queue" : ""}`}
        >
          <div className="stock-import-queue-head">
            {embedded ? (
              <>
                <p className="sg-hub-panel-kicker">Lista temporal</p>
                <h4 className="stock-alta-hub-title">Lecturas pendientes</h4>
              </>
            ) : (
              <h4>Lecturas pendientes</h4>
            )}
            <span className={embedded ? "stock-alta-queue-count" : "muted"}>
              {pendientes.length} en cola
            </span>
          </div>
          <div className="table-wrap stock-import-queue-table-wrap">
            <table className="stock-table-pro stock-import-queue-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>EID</th>
                  <th>VID</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Condición</th>
                  <th className="stock-th--sel" aria-label="Quitar" />
                </tr>
              </thead>
              <tbody>
                {pendientes.map((row) => (
                  <tr key={row.id}>
                    <td>{row.empresa || "SIN EMPRESA"}</td>
                    <td className="stock-td-eid">{row.eid}</td>
                    <td>{row.vid || "—"}</td>
                    <td>{row.fecha}</td>
                    <td>{row.hora || "—"}</td>
                    <td>{row.condicion || "—"}</td>
                    <td className="stock-td--sel">
                      <button
                        type="button"
                        className="stock-import-queue-remove"
                        aria-label="Quitar lectura"
                        disabled={importing}
                        onClick={() => quitarPendiente(row.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="stock-import-queue-empty muted">
          Todavía no hay lecturas en la lista. Completá el formulario y usá{" "}
          <strong>Agregar a la lista</strong> para armar un lote manual.
        </p>
      )}

      <div className={`stock-import-pane-foot${embedded ? " stock-import-pane-foot--hub" : ""}`}>
        <button
          type="button"
          className={btnPrimary}
          disabled={!apiOnline || importing || pendientes.length === 0}
          onClick={importarPendientes}
        >
          {importing ? (
            <>
              <span className="stock-import-spinner" aria-hidden />
              Procesando…
            </>
          ) : (
            `Importar ${pendientes.length} lectura(s)`
          )}
        </button>
      </div>
    </section>
  );

  const panel = embedded ? (
    <>
      {offlineBanner}
      <div className="stock-alta-hub-workspace">
        <section className="stock-alta-hub-box" aria-label="Guía de alta">
          <header className="stock-alta-hub-head-box">
            <p className="sg-hub-panel-kicker">Alta</p>
            <h2 className="stock-alta-hub-title">Nuevos equinos en stock</h2>
            <p className="stock-alta-hub-sub muted">
              Alta genérica por cantidad y categoría, o lecturas RFID desde archivo / caravana
              manual. Los IDs genéricos usan prefijo 600 y son únicos en todo el sistema.
            </p>
          </header>
          <div className="stock-import-chips stock-import-chips--hub">
            {COLUMNAS.map((col) => (
              <span key={col} className="stock-import-chip stock-import-chip--hub">
                {col}
              </span>
            ))}
          </div>
          <p className="stock-alta-hub-note muted">
            <strong>Genérica:</strong> cantidad, potrero, sexo y categoría.{" "}
            <strong>RFID:</strong> archivo <strong>.txt</strong>, <strong>.csv</strong> o{" "}
            <strong>.xlsx</strong>, o carga manual por caravana.
          </p>
        </section>

        <section className="stock-alta-hub-box stock-alta-hub-box--main" aria-label="Importar altas">
          <div className="stock-alta-hub-tabs-box">{importTabs}</div>
          {modo === "generica"
            ? genericaPane
            : modo === "archivo"
              ? archivoPane
              : manualPane}
        </section>
      </div>
    </>
  ) : (
    <div className="card stock-import-shell">
      <div className="form-header stock-import-head">
        <PageModuleHeadRow
          icon={{ source: "hub", id: "stock_alta" }}
          title="Alta de Equinos"
          subtitle="Alta genérica (cantidad + potrero + categoría) o lecturas RFID por archivo / caravana. IDs internos con prefijo 600, únicos en todo el sistema."
        />
      </div>

      {offlineBanner}

      <div className="stock-equina-layout stock-import-layout">
        <aside className="stock-facet-sidebar stock-import-sidebar" aria-label="Ayuda de importación">
          <div className="stock-facet-sidebar-head stock-import-sidebar-head">
            <h3 className="stock-facet-sidebar-title">Formato</h3>
          </div>

          <div className="stock-facet-group">
            <div className="stock-facet-group-head">
              <h4 className="stock-facet-group-title">Alta genérica</h4>
            </div>
            <p className="stock-import-sidebar-note">
              Indicá cantidad, potrero, sexo y fecha de nacimiento. La categoría se ajusta
              sola (Potranca/Potra/Yegua o Potrillo/Potro; en machos adultos elegís Caballo
              o Padrillo). Cada animal recibe un ID único con prefijo <strong>600</strong>.
            </p>
          </div>

          <div className="stock-facet-group">
            <div className="stock-facet-group-head">
              <h4 className="stock-facet-group-title">Columnas RFID</h4>
            </div>
            <div className="stock-import-chips stock-import-chips--sidebar">
              {COLUMNAS.map((col) => (
                <span key={col} className="stock-import-chip">
                  {col}
                </span>
              ))}
            </div>
          </div>

          <div className="stock-facet-group">
            <div className="stock-facet-group-head">
              <h4 className="stock-facet-group-title">Archivo</h4>
            </div>
            <p className="stock-import-sidebar-note">
              <strong>.txt</strong>, <strong>.csv</strong> (Tru-Test) o{" "}
              <strong>.xlsx</strong> (SNIG) · Separador tab o <code>;</code>
            </p>
            <p className="stock-import-sidebar-note">
              Fecha <code>AAAA-MM-DD</code> o <code>D/M/AAAA</code> · Hora{" "}
              <code>HH:MM:SS</code>
            </p>
          </div>

          <div className="stock-facet-group">
            <div className="stock-facet-group-head">
              <h4 className="stock-facet-group-title">Carga manual</h4>
            </div>
            <p className="stock-import-sidebar-note">
              Completá el formulario y agregá lecturas a la lista. Podés importar una sola
              o varias en el mismo lote.
            </p>
          </div>
        </aside>

        <div className="stock-equina-main stock-import-main">
          {importTabs}
          {modo === "generica"
            ? genericaPane
            : modo === "archivo"
              ? archivoPane
              : manualPane}
        </div>
      </div>
    </div>
  );

  if (embedded) return panel;

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Equino
      </button>
      {panel}
    </div>
  );
}
