import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPresupuesto,
  createSubRubroByRubro,
  createSubRubroItemByNombre,
  esRubroRemuneracion,
  fetchEmpresasOperativas,
  fetchSiguienteNumeroOperacion,
  fetchSubRubroItemsByNombre,
  fetchSubRubros,
  fetchTiposDocumentoGasto,
  updatePresupuesto,
  uploadPresupuestoDocumento,
} from "../api";
import { normalizeComisionConfig, normalizeGastoMapeo, type ComisionDocumentoConfig, type GastoDestinoId, type GastoMapeoCampos } from "../utils/gasto-campos";
import type { SubRubroItem } from "../types";
import type {
  AuthUser,
  Catalogos,
  Empresa,
  FuncionarioSelectorItem,
  Presupuesto,
  PresupuestoForm,
  TipoDocumentoGasto,
} from "../types";
import { formatNumeroOperacion, todayIso } from "../utils";
import { aMayusculas } from "../utils/formText";
import { grupoClaveOrden, grupoTituloCanon, rubroTituloCanon } from "../utils/grupoRubro";
import { buildRubrosCatalogoGasto, type RubrosCatalogoGasto } from "../utils/rubros-catalogo";
import { IconCancelar, IconConfirmar } from "./icons/ActionIcons";
import ImporteMoneda from "./ImporteMoneda";
import SelectorProveedor from "./SelectorProveedor";
import GastoHistorialTabla from "./GastoHistorialTabla";
import BrouImportador from "./documentos-digitales/BrouImportador";
import ComisionBrouPreviewForm from "./documentos-digitales/ComisionBrouPreviewForm";
import type { ComprobanteLeido } from "../types";
import { applyBrouParsedToForm, buildComisionPayloadForGasto, tieneImporteComision } from "../utils/brou-gasto";

/** Valores internos del select de concepto (no se guardan en PRESUPUESTO). */
const CONCEPTO_OTRO = "__otro__";
const CONCEPTO_AGREGAR = "__agregar_item__";
const SUB_RUBRO_AGREGAR = "__agregar_sub_rubro__";

/**
 * Devuelve la config de comisión del tipo de documento detectado en el comprobante.
 * Si no hay tipo detectado (o no está en la lista), usa la config BROU por defecto.
 */
function resolveComisionConfig(
  data: ComprobanteLeido | null | undefined,
  tipos: TipoDocumentoGasto[],
  fallback: ComisionDocumentoConfig | undefined
): ComisionDocumentoConfig | undefined {
  const detectedId = data?.tipo_detectado?.id;
  if (detectedId != null) {
    const tipo = tipos.find((t) => t.id === detectedId);
    if (tipo) return normalizeComisionConfig(tipo.comision_config);
  }
  return fallback;
}

interface Props {
  catalogos: Catalogos;
  currentUser: AuthUser;
  editRow: Presupuesto | null;
  apiOnline: boolean;
  onSaved: () => void;
  onCancelEdit: () => void;
  onEdit: (row: Presupuesto) => void;
  onCatalogosChanged?: () => void | Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
}

type FormState = Omit<PresupuestoForm, "empresa"> & { empresa: Empresa | "" };

const CAMPOS_TEXTO_GASTO = [
  "codigo_proveedor",
  "razon_social_proveedor",
  "concepto",
  "observaciones",
  "nro_factura",
  "funcionario_cedula",
] as const;

function rowToForm(row: Presupuesto): FormState {
  const { id: _id, creado_en: _c, ...rest } = row;
  const base: FormState = { ...rest, empresa: rest.empresa as Empresa | "" };
  if (base.rubro) base.rubro = rubroTituloCanon(base.rubro);
  for (const k of CAMPOS_TEXTO_GASTO) {
    const v = base[k];
    if (typeof v === "string") base[k] = aMayusculas(v);
  }
  return base;
}

const initial = (): FormState => ({
  empresa: "",
  fecha: todayIso(),
  codigo_proveedor: "",
  razon_social_proveedor: "",
  concepto: "",
  observaciones: "",
  rubro: "",
  sub_rubro: "",
  responsable_gasto: "",
  funcionario_cedula: "",
  nro_factura: "",
  nro_operacion_origen: "",
  pesos: 0,
  dolares_usd: 0,
  reales: 0,
  tc_usd: 0,
  tc_reales: 0,
  saldo_usd: 0,
});

async function uploadPresupuestoDocumentoConReintento(
  id: number,
  file: File,
  intentos = 3
): Promise<void> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      await uploadPresupuestoDocumento(id, file);
      return;
    } catch (err) {
      ultimoError = err;
      if (i < intentos - 1) {
        await new Promise((r) => setTimeout(r, 600 * (i + 1)));
      }
    }
  }
  throw ultimoError instanceof Error
    ? ultimoError
    : new Error("No se pudo subir el comprobante");
}

export default function FormGasto({
  catalogos,
  currentUser,
  editRow,
  apiOnline,
  onSaved,
  onCancelEdit,
  onEdit,
  onCatalogosChanged,
  onError,
  onSuccess,
}: Props) {
  const [form, setForm] = useState<FormState>(initial);
  const [empresasCuenta, setEmpresasCuenta] = useState<string[]>(catalogos.empresas);
  const handleMoneyChange = useCallback(
    (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch })),
    []
  );
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [conceptoItems, setConceptoItems] = useState<SubRubroItem[]>([]);
  /** true = escribir concepto a mano en el mismo lugar del menú (opción «Otro concepto»). */
  const [conceptoModoOtro, setConceptoModoOtro] = useState(false);
  /** true = alta de ítem en SUB_RUBRO_ITEMS del sub-rubro elegido. */
  const [conceptoModoAgregar, setConceptoModoAgregar] = useState(false);
  const [conceptoNuevoItem, setConceptoNuevoItem] = useState("");
  const [conceptoGuardandoItem, setConceptoGuardandoItem] = useState(false);
  /** Alta de sub-rubro en catálogo (SUB_RUBROS + vínculos con rubro). */
  const [subRubroModoAgregar, setSubRubroModoAgregar] = useState(false);
  const [subRubroNuevoNombre, setSubRubroNuevoNombre] = useState("");
  const [subRubroGuardando, setSubRubroGuardando] = useState(false);
  const [subRubrosLocales, setSubRubrosLocales] = useState<Record<string, string[]>>({});
  const [rubrosCatalogo, setRubrosCatalogo] = useState<RubrosCatalogoGasto>({
    rubros: [],
    sub_rubros_por_rubro: {},
  });
  const [historialKey, setHistorialKey] = useState(0);
  const [brouImportado, setBrouImportado] = useState<ComprobanteLeido | null>(null);
  const [documentoArchivo, setDocumentoArchivo] = useState<File | null>(null);
  const [registrarComisionBrou, setRegistrarComisionBrou] = useState(false);
  const [importeSyncKey, setImporteSyncKey] = useState(0);
  const [comisionManualSyncKey, setComisionManualSyncKey] = useState(0);
  const [comisionManualMoney, setComisionManualMoney] = useState({
    pesos: 0,
    dolares_usd: 0,
    reales: 0,
    tc_usd: 0,
    tc_reales: 0,
    saldo_usd: 0,
  });
  const handleComisionMoneyChange = useCallback(
    (patch: Partial<typeof comisionManualMoney>) =>
      setComisionManualMoney((prev) => ({ ...prev, ...patch })),
    []
  );
  const [brouMapeo, setBrouMapeo] = useState<GastoMapeoCampos | undefined>(undefined);
  const [brouComisionConfig, setBrouComisionConfig] = useState<ComisionDocumentoConfig | undefined>(
    undefined
  );
  const [tiposDocLista, setTiposDocLista] = useState<TipoDocumentoGasto[]>([]);
  const [comisionConcepto, setComisionConcepto] = useState("");
  const comisionConceptoEditadoRef = useRef(false);

  // Config de comisión del tipo de comprobante detectado (Santander, BROU, etc.).
  const comisionConfigActiva = useMemo(
    () => resolveComisionConfig(brouImportado, tiposDocLista, brouComisionConfig),
    [brouImportado, tiposDocLista, brouComisionConfig]
  );
  // Comisión con importe fijo definido en la config (p.ej. Santander 1,60 USD).
  const comisionTieneImporteFijo = useMemo(
    () => Boolean(normalizeComisionConfig(comisionConfigActiva).valores_fijos?.importes?.trim()),
    [comisionConfigActiva]
  );

  const comisionDesdePdf = Boolean(brouImportado?.comision && brouImportado.comision.valor > 0);
  const comisionEsManual =
    registrarComisionBrou && !comisionDesdePdf && !comisionTieneImporteFijo;

  const onComisionToggle = useCallback(
    (checked: boolean) => {
      setRegistrarComisionBrou(checked);
      if (checked && !comisionDesdePdf) {
        setComisionManualMoney({
          pesos: 0,
          dolares_usd: 0,
          reales: 0,
          tc_usd: form.tc_usd,
          tc_reales: 0,
          saldo_usd: 0,
        });
        setComisionManualSyncKey((k) => k + 1);
      }
    },
    [comisionDesdePdf, form.tc_usd]
  );

  const resetComisionState = useCallback(() => {
    setRegistrarComisionBrou(false);
    setComisionManualMoney({
      pesos: 0,
      dolares_usd: 0,
      reales: 0,
      tc_usd: 0,
      tc_reales: 0,
      saldo_usd: 0,
    });
    setComisionConcepto("");
    comisionConceptoEditadoRef.current = false;
  }, []);

  const numeroOperacionVisible =
    form.nro_operacion_origen.trim() ||
    (editRow?.nro_operacion_origen?.trim() ?? "") ||
    numeroOperacion;

  const onBrouAplicado = useCallback(
    (data: ComprobanteLeido) => {
      setBrouImportado(data);
      const comCfg = normalizeComisionConfig(
        resolveComisionConfig(data, tiposDocLista, brouComisionConfig)
      );
      const hayComisionPdf = Boolean(data.comision && data.comision.valor > 0);
      const hayComisionFija = Boolean(comCfg.valores_fijos?.importes?.trim());
      // Santander «en el país» no trae la comisión en el PDF: igual abrimos el
      // form de comisión bancaria (pago) para registrarla manualmente o con el
      // importe fijo configurado en el tipo de documento.
      setRegistrarComisionBrou(
        comCfg.activa && (hayComisionPdf || hayComisionFija || Boolean(data.es_santander_pais))
      );
      setForm((f) =>
      applyBrouParsedToForm(data, f, brouMapeo, data.valores_mapeo as Partial<
        Record<GastoDestinoId, string>
      >)
    );
      setImporteSyncKey((k) => k + 1);
    },
    [brouMapeo, brouComisionConfig, tiposDocLista]
  );

  const loadRubrosCatalogo = useCallback(async () => {
    if (!apiOnline) return;
    try {
      const rows = await fetchSubRubros(false);
      setRubrosCatalogo(buildRubrosCatalogoGasto(rows));
    } catch {
      /* mantener catálogo previo */
    }
  }, [apiOnline]);

  useEffect(() => {
    void loadRubrosCatalogo();
  }, [loadRubrosCatalogo]);

  useEffect(() => {
    if (!apiOnline) return;
    fetchTiposDocumentoGasto({ soloActivos: true })
      .then((tipos) => {
        setTiposDocLista(tipos);
        const brou = tipos.find((t) => {
          const o = t.origen.trim().toUpperCase();
          const n = t.nombre.trim().toUpperCase();
          return o === "BROU" || n.includes("BROU");
        });
        setBrouMapeo(brou ? normalizeGastoMapeo(brou.mapeo_campos) : undefined);
        setBrouComisionConfig(brou ? normalizeComisionConfig(brou.comision_config) : undefined);
      })
      .catch(() => {
        setTiposDocLista([]);
        setBrouMapeo(undefined);
        setBrouComisionConfig(undefined);
      });
  }, [apiOnline]);

  const catalogoRubros = useMemo(() => {
    if (rubrosCatalogo.rubros.length > 0) return rubrosCatalogo;
    return {
      rubros: catalogos.rubros,
      sub_rubros_por_rubro: catalogos.sub_rubros_por_rubro,
    };
  }, [rubrosCatalogo, catalogos.rubros, catalogos.sub_rubros_por_rubro]);

  const rubroFormCanon = form.rubro ? grupoTituloCanon(form.rubro) : "";

  const rubroOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of catalogoRubros.rubros) {
      const canon = grupoTituloCanon(r);
      const key = grupoClaveOrden(canon);
      if (!seen.has(key)) seen.set(key, canon);
    }
    if (rubroFormCanon) {
      const key = grupoClaveOrden(rubroFormCanon);
      if (!seen.has(key)) seen.set(key, rubroFormCanon);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "es"));
  }, [catalogoRubros.rubros, rubroFormCanon]);

  const subRubrosDelRubro = useMemo(() => {
    if (!rubroFormCanon) return [];
    const map = catalogoRubros.sub_rubros_por_rubro;
    let base: string[] = map[rubroFormCanon] ?? [];
    if (!base.length) {
      const clave = grupoClaveOrden(rubroFormCanon);
      const key = Object.keys(map).find((k) => grupoClaveOrden(k) === clave);
      base = key ? (map[key] ?? []) : [];
    }
    if (!base.length) {
      const key = Object.keys(map).find(
        (k) =>
          rubroTituloCanon(k).localeCompare(rubroFormCanon, "es", {
            sensitivity: "accent",
          }) === 0
      );
      base = key ? (map[key] ?? []) : [];
    }
    const extra = subRubrosLocales[rubroFormCanon] ?? [];
    return [...new Set([...base, ...extra])].sort((a, b) => a.localeCompare(b, "es"));
  }, [catalogoRubros.sub_rubros_por_rubro, rubroFormCanon, subRubrosLocales]);

  const subRubroOptions = useMemo(() => {
    if (!form.rubro) return [];
    const base = [...subRubrosDelRubro];
    if (form.sub_rubro && !base.includes(form.sub_rubro)) {
      base.push(form.sub_rubro);
    }
    return base.sort((a, b) => a.localeCompare(b, "es"));
  }, [form.rubro, form.sub_rubro, subRubrosDelRubro]);

  const mostrarFuncionario = useMemo(
    () => esRubroRemuneracion(form.rubro, form.sub_rubro),
    [form.rubro, form.sub_rubro]
  );

  const empleadosActivos = useMemo(() => {
    const map = new Map<string, FuncionarioSelectorItem>();
    for (const f of catalogos.funcionarios) {
      const nombre =
        f.nombre_display?.trim() ||
        (f.label.includes(" — ") ? f.label.split(" — ").slice(1).join(" — ") : f.label);
      map.set(f.cedula, { ...f, nombre_display: nombre });
    }
    if (
      form.funcionario_cedula &&
      !map.has(form.funcionario_cedula)
    ) {
      map.set(form.funcionario_cedula, {
        cedula: form.funcionario_cedula,
        label: form.funcionario_cedula,
        nombre_display: form.responsable_gasto || form.funcionario_cedula,
      });
    }
    return [...map.values()].sort((a, b) =>
      a.nombre_display.localeCompare(b.nombre_display, "es", { sensitivity: "accent" })
    );
  }, [catalogos.funcionarios, form.funcionario_cedula, form.responsable_gasto]);

  const gastoAsignadoEsEmpleados = mostrarFuncionario;

  const sortNombres = (a: string, b: string) =>
    a.localeCompare(b, "es", { sensitivity: "accent" });

  const gastoAsignadoAgrupado = useMemo(() => {
    const funcionarios = empleadosActivos.map((f) => f.nombre_display.trim()).filter(Boolean);
    const keysFunc = new Set(funcionarios.map((n) => n.toLocaleUpperCase("es-UY")));

    const catalogo = catalogos.responsables
      .map((r) => r.trim())
      .filter((r) => r && !keysFunc.has(r.toLocaleUpperCase("es-UY")));

    const actual = form.responsable_gasto.trim();
    if (actual) {
      const key = actual.toLocaleUpperCase("es-UY");
      const enFunc = keysFunc.has(key);
      const enCat = catalogo.some(
        (n) => n.toLocaleUpperCase("es-UY") === key
      );
      if (!enFunc && !enCat) {
        if (empleadosActivos.some(
          (f) =>
            f.nombre_display.localeCompare(actual, "es", { sensitivity: "accent" }) === 0
        )) {
          funcionarios.push(actual);
        } else {
          catalogo.push(actual);
        }
      }
    }

    return {
      funcionarios: [...new Set(funcionarios)].sort(sortNombres),
      catalogo: [...new Set(catalogo)].sort(sortNombres),
    };
  }, [empleadosActivos, catalogos.responsables, form.responsable_gasto]);

  const responsableOptions = useMemo(() => {
    if (gastoAsignadoEsEmpleados) {
      return [...gastoAsignadoAgrupado.funcionarios, ...gastoAsignadoAgrupado.catalogo];
    }
    const list = [...catalogos.responsables];
    if (form.responsable_gasto && !list.includes(form.responsable_gasto)) {
      list.push(form.responsable_gasto);
    }
    return list.sort(sortNombres);
  }, [
    gastoAsignadoEsEmpleados,
    gastoAsignadoAgrupado,
    catalogos.responsables,
    form.responsable_gasto,
  ]);

  const presupuestoEmpresasHint = useMemo(() => {
    if (empresasCuenta.length === 0) return "Tabla PRESUPUESTO";
    if (empresasCuenta.length <= 4) {
      return `Tabla PRESUPUESTO — ${empresasCuenta.join(" / ")}`;
    }
    return `Tabla PRESUPUESTO — ${empresasCuenta.length} empresas de su cuenta`;
  }, [empresasCuenta]);

  useEffect(() => {
    if (!apiOnline) {
      setEmpresasCuenta([]);
      return;
    }
    fetchEmpresasOperativas()
      .then(setEmpresasCuenta)
      .catch(() => setEmpresasCuenta(catalogos.empresas));
  }, [apiOnline, catalogos.empresas]);

  useEffect(() => {
    if (!form.empresa || empresasCuenta.length === 0) return;
    if (!empresasCuenta.includes(form.empresa)) {
      setForm((f) => ({ ...f, empresa: "" }));
    }
  }, [empresasCuenta, form.empresa]);

  useEffect(() => {
    if (!apiOnline || rubroOptions.length > 0) return;
    void loadRubrosCatalogo();
    void onCatalogosChanged?.();
  }, [apiOnline, rubroOptions.length, loadRubrosCatalogo, onCatalogosChanged]);

  useEffect(() => {
    if (editRow) {
      setForm(rowToForm(editRow));
      setNumeroOperacion(
        editRow.nro_operacion_origen?.trim() ||
          formatNumeroOperacion(editRow.nro_registro)
      );
      return;
    }
    setForm(initial());
    setBrouImportado(null);
    setDocumentoArchivo(null);
    resetComisionState();
    if (!apiOnline) {
      setNumeroOperacion("");
      return;
    }
    fetchSiguienteNumeroOperacion()
      .then((d) => setNumeroOperacion(d.numero_operacion))
      .catch(() => setNumeroOperacion(""));
  }, [editRow, apiOnline, resetComisionState]);

  useEffect(() => {
    if (!gastoAsignadoEsEmpleados || !form.funcionario_cedula) return;
    const emp = empleadosActivos.find((f) => f.cedula === form.funcionario_cedula);
    if (emp && form.responsable_gasto !== emp.nombre_display) {
      setForm((f) => ({ ...f, responsable_gasto: emp.nombre_display }));
    }
  }, [
    gastoAsignadoEsEmpleados,
    form.funcionario_cedula,
    form.responsable_gasto,
    empleadosActivos,
  ]);

  useEffect(() => {
    if (!form.rubro || !form.sub_rubro) return;
    const permitidos = subRubrosDelRubro;
    if (
      permitidos.length > 0 &&
      !permitidos.some(
        (n) => n.localeCompare(form.sub_rubro, "es", { sensitivity: "accent" }) === 0
      )
    ) {
      setForm((f) => ({ ...f, sub_rubro: "" }));
    }
  }, [form.rubro, form.sub_rubro, subRubrosDelRubro]);

  useEffect(() => {
    const nombre = form.sub_rubro.trim();
    if (!apiOnline || !nombre) {
      setConceptoItems([]);
      return;
    }
    let cancelled = false;
    fetchSubRubroItemsByNombre(nombre, true)
      .then((data) => {
        if (!cancelled) setConceptoItems(data);
      })
      .catch(() => {
        if (!cancelled) setConceptoItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOnline, form.sub_rubro]);

  const conceptoItemNombres = useMemo(
    () => conceptoItems.filter((i) => i.activo).map((i) => i.nombre),
    [conceptoItems]
  );

  /** Nombre del ítem de catálogo que coincide con el concepto guardado (misma grafía que en el select). */
  const conceptoItemSeleccionado = useMemo(() => {
    const t = form.concepto.trim();
    if (!t) return "";
    return (
      conceptoItemNombres.find(
        (n) => n.localeCompare(t, "es", { sensitivity: "accent" }) === 0
      ) ?? ""
    );
  }, [conceptoItemNombres, form.concepto]);

  const conceptoSelectValue = conceptoItemSeleccionado;

  useEffect(() => {
    setSubRubroModoAgregar(false);
    setSubRubroNuevoNombre("");
  }, [form.rubro]);

  useEffect(() => {
    setConceptoModoOtro(false);
    setConceptoModoAgregar(false);
    setConceptoNuevoItem("");
  }, [form.sub_rubro]);

  const conceptoUsaLista = Boolean(form.sub_rubro.trim());

  useEffect(() => {
    if (conceptoModoAgregar) return;
    if (!conceptoItemNombres.length) {
      setConceptoModoOtro(false);
      return;
    }
    const t = form.concepto.trim();
    if (!t) return;
    setConceptoModoOtro(!conceptoItemSeleccionado);
  }, [
    conceptoItemNombres,
    form.concepto,
    conceptoItemSeleccionado,
    conceptoModoAgregar,
  ]);

  const handleConceptoSelect = (value: string) => {
    if (value === "") {
      setConceptoModoOtro(false);
      setConceptoModoAgregar(false);
      setConceptoNuevoItem("");
      setForm((f) => ({ ...f, concepto: "" }));
      return;
    }
    if (value === CONCEPTO_AGREGAR) {
      setConceptoModoAgregar(true);
      setConceptoModoOtro(false);
      setConceptoNuevoItem("");
      return;
    }
    if (value === CONCEPTO_OTRO) {
      setConceptoModoOtro(true);
      setConceptoModoAgregar(false);
      setConceptoNuevoItem("");
      setForm((f) => {
        const esItem = conceptoItemNombres.some(
          (n) =>
            n.localeCompare(f.concepto, "es", { sensitivity: "accent" }) === 0
        );
        return {
          ...f,
          concepto: f.concepto.trim() && !esItem ? f.concepto : "",
        };
      });
      return;
    }
    setConceptoModoOtro(false);
    setConceptoModoAgregar(false);
    setConceptoNuevoItem("");
    setForm((f) => ({ ...f, concepto: value }));
  };

  const volverConceptoItems = () => {
    setConceptoModoOtro(false);
    setConceptoModoAgregar(false);
    setConceptoNuevoItem("");
    setForm((f) => ({ ...f, concepto: "" }));
  };

  const handleSubRubroSelect = (value: string) => {
    if (value === SUB_RUBRO_AGREGAR) {
      setSubRubroModoAgregar(true);
      setSubRubroNuevoNombre("");
      return;
    }
    setSubRubroModoAgregar(false);
    setSubRubroNuevoNombre("");
    set("sub_rubro", value);
  };

  const cancelarSubRubroNuevo = () => {
    setSubRubroModoAgregar(false);
    setSubRubroNuevoNombre("");
  };

  const guardarSubRubroNuevo = async () => {
    if (!apiOnline) {
      onError("Iniciá la API con npm run dev en la carpeta del proyecto");
      return;
    }
    if (!rubroFormCanon) {
      onError("Seleccioná un rubro antes de agregar un sub-rubro");
      return;
    }
    const nombre = subRubroNuevoNombre.trim();
    if (!nombre) {
      onError("Escribí el nombre del sub-rubro");
      return;
    }
    setSubRubroGuardando(true);
    try {
      const creado = await createSubRubroByRubro(rubroFormCanon, nombre);
      setSubRubrosLocales((prev) => {
        const list = prev[rubroFormCanon] ?? [];
        if (list.includes(creado.nombre)) return prev;
        return { ...prev, [rubroFormCanon]: [...list, creado.nombre] };
      });
      setSubRubroModoAgregar(false);
      setSubRubroNuevoNombre("");
      setForm((f) => ({ ...f, sub_rubro: creado.nombre, concepto: "" }));
      await loadRubrosCatalogo();
      await onCatalogosChanged?.();
      onSuccess(`Sub-rubro «${creado.nombre}» agregado`, "Catálogo");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar el sub-rubro");
    } finally {
      setSubRubroGuardando(false);
    }
  };

  const guardarConceptoNuevoItem = async () => {
    if (!apiOnline) {
      onError("Iniciá la API con npm run dev en la carpeta del proyecto");
      return;
    }
    const subNombre = form.sub_rubro.trim();
    if (!subNombre) {
      onError("Seleccioná un sub-rubro antes de agregar un ítem");
      return;
    }
    const nombre = conceptoNuevoItem.trim();
    if (!nombre) {
      onError("Escribí el nombre del ítem");
      return;
    }
    setConceptoGuardandoItem(true);
    try {
      const item = await createSubRubroItemByNombre(subNombre, nombre);
      setConceptoItems((prev) => {
        const next = [...prev.filter((i) => i.id !== item.id), item];
        next.sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
        );
        return next;
      });
      setConceptoModoAgregar(false);
      setConceptoModoOtro(false);
      setConceptoNuevoItem("");
      setForm((f) => ({ ...f, concepto: item.nombre }));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar el ítem");
    } finally {
      setConceptoGuardandoItem(false);
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    const sinMayus =
      key === "rubro" ||
      key === "sub_rubro" ||
      key === "responsable_gasto" ||
      key === "empresa" ||
      key === "fecha";
    const val =
      typeof value === "string" && !sinMayus ? (aMayusculas(value) as FormState[K]) : value;
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "rubro") {
        next.rubro = grupoTituloCanon(String(val));
        next.sub_rubro = "";
        if (!esRubroRemuneracion(next.rubro, "")) {
          next.funcionario_cedula = "";
        }
      }
      if (key === "sub_rubro") {
        next.concepto = "";
        if (!esRubroRemuneracion(next.rubro, String(value))) {
          next.funcionario_cedula = "";
        }
      }
      return next;
    });
  };

  const validarCamposGasto = (): string | null => {
    if (!form.empresa) return "Seleccioná la empresa";
    if (!form.fecha) return "Ingresá la fecha";
    if (!form.rubro) return "Seleccioná el rubro";
    return null;
  };

  const comisionPreview = useMemo(() => {
    if (editRow || !registrarComisionBrou) return null;
    const mainPayload: PresupuestoForm = {
      ...form,
      empresa: form.empresa as Empresa,
      nro_operacion_origen: form.nro_operacion_origen.trim(),
    };
    return buildComisionPayloadForGasto(
      mainPayload,
      comisionConfigActiva,
      brouImportado,
      comisionEsManual ? comisionManualMoney : undefined
    );
  }, [
    form,
    editRow,
    registrarComisionBrou,
    brouImportado,
    comisionConfigActiva,
    comisionEsManual,
    comisionManualMoney,
  ]);

  useEffect(() => {
    setComisionConcepto("");
    comisionConceptoEditadoRef.current = false;
  }, [brouImportado?.numero_operacion]);

  useEffect(() => {
    if (!comisionPreview || comisionConceptoEditadoRef.current) return;
    setComisionConcepto(comisionPreview.concepto);
  }, [comisionPreview]);

  const onComisionConceptoChange = useCallback((value: string) => {
    comisionConceptoEditadoRef.current = true;
    setComisionConcepto(aMayusculas(value));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError("Iniciá la API con npm run dev en la carpeta del proyecto");
      return;
    }
    const err = validarCamposGasto();
    if (err) {
      onError(err);
      return;
    }
    if (registrarComisionBrou && comisionEsManual && !tieneImporteComision(comisionManualMoney)) {
      onError("Ingresá el importe de la comisión bancaria");
      return;
    }
    try {
      const payload = {
        ...form,
        empresa: form.empresa as Empresa,
        nro_operacion_origen: form.nro_operacion_origen.trim(),
      };
      if (editRow) {
        await updatePresupuesto(editRow.id, payload);
        onSuccess("Los cambios se guardaron en PRESUPUESTO.", "Operación actualizada");
      } else {
        const reg = await createPresupuesto(payload);
        let msg = `Nro. de operación: ${formatNumeroOperacion(reg.nro_registro)}`;
        if (form.nro_operacion_origen.trim()) {
          msg += ` — ref. BROU ${form.nro_operacion_origen.trim()}`;
        }

        const comision =
          registrarComisionBrou &&
          (comisionDesdePdf ||
            comisionTieneImporteFijo ||
            tieneImporteComision(comisionManualMoney));

        let comPayload: ReturnType<typeof buildComisionPayloadForGasto> | null = null;
        if (comision) {
          comPayload = buildComisionPayloadForGasto(
            payload,
            comisionConfigActiva,
            brouImportado,
            comisionEsManual ? comisionManualMoney : undefined
          );
          if (comisionConcepto.trim()) {
            comPayload.concepto = comisionConcepto.trim();
          }
        }

        const tareas: Promise<void>[] = [];
        let documentoError: string | null = null;

        if (documentoArchivo) {
          tareas.push(
            uploadPresupuestoDocumentoConReintento(reg.id, documentoArchivo)
              .then(() => {
                msg += ". Comprobante adjunto guardado.";
              })
              .catch((docErr) => {
                documentoError =
                  docErr instanceof Error ? docErr.message : "error desconocido";
              })
          );
        }

        if (comPayload) {
          tareas.push(
            createPresupuesto(comPayload).then((regCom) => {
              msg += `. Comisión registrada (N° ${formatNumeroOperacion(regCom.nro_registro)}).`;
            })
          );
        }

        if (tareas.length > 0) {
          await Promise.all(tareas);
        }

        if (documentoError) {
          onError(
            `El gasto se guardó, pero el comprobante NO se adjuntó: ${documentoError}. ` +
              "El archivo quedó cargado: revisá que la API esté activa y volvé a guardar para reintentar."
          );
          setForm(initial());
          setBrouImportado(null);
          resetComisionState();
          if (apiOnline) {
            fetchSiguienteNumeroOperacion()
              .then((d) => setNumeroOperacion(d.numero_operacion))
              .catch(() => setNumeroOperacion(""));
          } else {
            setNumeroOperacion("");
          }
          onSaved();
          setHistorialKey((k) => k + 1);
          return;
        }

        onSuccess(msg, "Operación ingresada con éxito");
      }
      setForm(initial());
      setBrouImportado(null);
      setDocumentoArchivo(null);
      resetComisionState();
      if (apiOnline) {
        fetchSiguienteNumeroOperacion()
          .then((d) => setNumeroOperacion(d.numero_operacion))
          .catch(() => setNumeroOperacion(""));
      } else {
        setNumeroOperacion("");
      }
      onSaved();
      setHistorialKey((k) => k + 1);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  return (
    <div className="form-gasto-layout">
    <form className={`card form-card${!editRow ? " gasto-factura-card" : ""}`} onSubmit={handleSubmit}>
      <div className="form-header">
        {!editRow ? (
          <span className="gasto-factura-badge">Factura</span>
        ) : null}
        <h2>
          {editRow
            ? `Editar gasto — Operación N° ${formatNumeroOperacion(editRow.nro_registro)}`
            : "Ingresar nuevo gasto"}
        </h2>
        <p className="muted">
          {brouImportado
            ? "Comprobante detectado — transferencia a otros bancos"
            : presupuestoEmpresasHint}
        </p>
      </div>

      {!editRow && (
        <BrouImportador
          apiOnline={apiOnline}
          onError={onError}
          onApplied={onBrouAplicado}
          onArchivo={setDocumentoArchivo}
          archivoAdjunto={documentoArchivo}
        />
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="empresa">Empresa *</label>
          <select
            id="empresa"
            required
            value={form.empresa}
            onChange={(e) => set("empresa", e.target.value as Empresa | "")}
          >
            <option value="">Seleccionar...</option>
            {empresasCuenta.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="nro-operacion">
            {form.nro_operacion_origen.trim()
              ? "N° operación (documento BROU)"
              : "Número de operación"}
          </label>
          <input
            id="nro-operacion"
            type="text"
            readOnly
            className="input-readonly"
            value={numeroOperacionVisible}
            placeholder={apiOnline ? "Asignando…" : "Sin conexión"}
            aria-readonly="true"
            title={
              form.nro_operacion_origen.trim()
                ? "Número del comprobante BROU"
                : "Número único asignado por el sistema al guardar"
            }
          />
        </div>

        <div className="field">
          <label htmlFor="fecha">Fecha *</label>
          <input
            type="date"
            id="fecha"
            required
            value={form.fecha}
            onChange={(e) => set("fecha", e.target.value)}
          />
        </div>

        <SelectorProveedor
          apiOnline={apiOnline}
          codigo={form.codigo_proveedor}
          razonSocial={form.razon_social_proveedor}
          onSelect={(cod, razon) => {
            set("codigo_proveedor", cod);
            set("razon_social_proveedor", aMayusculas(razon));
          }}
          onError={onError}
          onSuccess={onSuccess}
          onProveedorCreado={() => void onCatalogosChanged?.()}
        />

        <div className="field">
          <label htmlFor="nro_factura">Nro. factura</label>
          <input
            id="nro_factura"
            value={form.nro_factura}
            onChange={(e) => set("nro_factura", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="rubro">Rubro *</label>
          <select
            id="rubro"
            required
            value={form.rubro}
            onChange={(e) => set("rubro", e.target.value)}
            disabled={!apiOnline}
          >
            <option value="">
              {!apiOnline
                ? "Sin conexión con la API"
                : rubroOptions.length === 0
                  ? "Cargando rubros…"
                  : "Seleccionar..."}
            </option>
            {rubroOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label
            htmlFor={
              subRubroModoAgregar ? "sub-rubro-nuevo" : "sub_rubro"
            }
          >
            Sub-rubro
          </label>
          {!form.rubro ? (
            <select id="sub_rubro" disabled value="">
              <option value="">Primero seleccioná un rubro</option>
            </select>
          ) : subRubroModoAgregar ? (
            <div className="concepto-input-group">
              <input
                id="sub-rubro-nuevo"
                className="concepto-unificado"
                type="text"
                data-sin-mayusculas="true"
                disabled={subRubroGuardando}
                placeholder="Nombre del nuevo sub-rubro…"
                value={subRubroNuevoNombre}
                onChange={(e) => setSubRubroNuevoNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void guardarSubRubroNuevo();
                  }
                }}
                autoComplete="off"
              />
              <div className="concepto-acciones">
                <button
                  type="button"
                  className="concepto-btn concepto-btn--guardar"
                  disabled={subRubroGuardando}
                  onClick={() => void guardarSubRubroNuevo()}
                  title="Agregar sub-rubro al rubro"
                  aria-label="Agregar sub-rubro"
                >
                  {subRubroGuardando ? (
                    <span className="concepto-btn-spinner" aria-hidden />
                  ) : (
                    <IconConfirmar size={18} />
                  )}
                </button>
                <button
                  type="button"
                  className="concepto-btn concepto-btn--cancelar"
                  disabled={subRubroGuardando}
                  onClick={cancelarSubRubroNuevo}
                  title="Cancelar"
                  aria-label="Cancelar"
                >
                  <IconCancelar size={18} />
                </button>
              </div>
            </div>
          ) : (
            <select
              id="sub_rubro"
              value={form.sub_rubro}
              onChange={(e) => handleSubRubroSelect(e.target.value)}
            >
              <option value="">Sin sub-rubro (opcional)</option>
              {subRubroOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={SUB_RUBRO_AGREGAR}>Agregar sub-rubro -&gt;</option>
            </select>
          )}
        </div>

        <div className="field">
          <label htmlFor="responsable_gasto">Presupuesto asignado</label>
          <select
            id="responsable_gasto"
            value={form.responsable_gasto}
            onChange={(e) => {
              const nombre = e.target.value;
              if (gastoAsignadoEsEmpleados) {
                const emp = empleadosActivos.find(
                  (f) =>
                    f.nombre_display.localeCompare(nombre, "es", {
                      sensitivity: "accent",
                    }) === 0
                );
                setForm((f) => ({
                  ...f,
                  responsable_gasto: nombre,
                  funcionario_cedula: emp?.cedula ?? "",
                }));
                return;
              }
              set("responsable_gasto", nombre);
              set("funcionario_cedula", "");
            }}
          >
            <option value="">
              {gastoAsignadoEsEmpleados
                ? "Seleccionar persona…"
                : "Sin asignar"}
            </option>
            {gastoAsignadoEsEmpleados ? (
              <>
                {gastoAsignadoAgrupado.funcionarios.length > 0 && (
                  <optgroup label="Funcionarios (Recursos Humanos)">
                    {gastoAsignadoAgrupado.funcionarios.map((r) => (
                      <option key={`rrhh-${r}`} value={r}>
                        {r}
                      </option>
                    ))}
                  </optgroup>
                )}
                {gastoAsignadoAgrupado.funcionarios.length > 0 &&
                  gastoAsignadoAgrupado.catalogo.length > 0 && (
                    <option disabled className="gasto-asignado-separador">
                      ────────────────────────
                    </option>
                  )}
                {gastoAsignadoAgrupado.catalogo.length > 0 && (
                  <optgroup label="Presupuesto asignado (catálogo)">
                    {gastoAsignadoAgrupado.catalogo.map((r) => (
                      <option key={`cat-${r}`} value={r}>
                        {r}
                      </option>
                    ))}
                  </optgroup>
                )}
              </>
            ) : (
              responsableOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="field field-concepto span-3">
          <div className="field-concepto-row">
            <label
              htmlFor={
                conceptoModoOtro
                  ? "concepto"
                  : conceptoModoAgregar
                    ? "concepto-nuevo-item"
                    : conceptoUsaLista
                      ? "concepto-select"
                      : "concepto"
              }
            >
              Concepto
            </label>
            <div className="field-concepto-inputs">
              {conceptoUsaLista ? (
                conceptoModoAgregar ? (
                  <div className="concepto-input-group">
                    <input
                      id="concepto-nuevo-item"
                      className="concepto-unificado"
                      type="text"
                      data-sin-mayusculas="true"
                      disabled={conceptoGuardandoItem}
                      placeholder="Nombre del nuevo ítem…"
                      value={conceptoNuevoItem}
                      onChange={(e) => setConceptoNuevoItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void guardarConceptoNuevoItem();
                        }
                      }}
                      autoComplete="off"
                    />
                    <div className="concepto-acciones">
                      <button
                        type="button"
                        className="concepto-btn concepto-btn--guardar"
                        disabled={conceptoGuardandoItem}
                        onClick={() => void guardarConceptoNuevoItem()}
                        title="Agregar ítem al sub-rubro"
                        aria-label="Agregar ítem"
                      >
                        {conceptoGuardandoItem ? (
                          <span className="concepto-btn-spinner" aria-hidden />
                        ) : (
                          <IconConfirmar size={18} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="concepto-btn concepto-btn--cancelar"
                        disabled={conceptoGuardandoItem}
                        onClick={volverConceptoItems}
                        title="Cancelar"
                        aria-label="Cancelar"
                      >
                        <IconCancelar size={18} />
                      </button>
                    </div>
                  </div>
                ) : conceptoModoOtro ? (
                  <div className="concepto-input-group">
                    <input
                      id="concepto"
                      className="concepto-unificado"
                      type="text"
                      placeholder="Detalle del concepto (ej. arreglo alambrado potrero 3)…"
                      value={form.concepto}
                      onChange={(e) => set("concepto", e.target.value)}
                      autoComplete="off"
                    />
                    <div className="concepto-acciones">
                      <button
                        type="button"
                        className="concepto-btn concepto-btn--cancelar"
                        onClick={volverConceptoItems}
                        title="Cancelar y volver al listado"
                        aria-label="Cancelar"
                      >
                        <IconCancelar size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    id="concepto-select"
                    className="concepto-select"
                    value={conceptoSelectValue}
                    onChange={(e) => handleConceptoSelect(e.target.value)}
                  >
                    <option value="">Seleccionar ítem…</option>
                    {conceptoItemNombres.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                    <option value={CONCEPTO_AGREGAR}>Agregar Item -&gt;</option>
                    <option value={CONCEPTO_OTRO}>Otro concepto…</option>
                  </select>
                )
              ) : (
                <input
                  id="concepto"
                  className="concepto-unificado"
                  type="text"
                  placeholder="Ej: Sueldos marzo, IVA, compra balanceado…"
                  value={form.concepto}
                  onChange={(e) => set("concepto", e.target.value)}
                  autoComplete="off"
                />
              )}
            </div>
          </div>
        </div>

        <ImporteMoneda
          fecha={form.fecha}
          apiOnline={apiOnline}
          pesos={form.pesos}
          dolares_usd={form.dolares_usd}
          reales={form.reales}
          tc_usd={form.tc_usd}
          tc_reales={form.tc_reales}
          saldo_usd={form.saldo_usd}
          syncKey={(editRow?.id ?? 0) + importeSyncKey * 100_000}
          onMoneyChange={handleMoneyChange}
        />

        <div className="field span-2">
          <label htmlFor="observaciones">Observaciones</label>
          <textarea
            id="observaciones"
            rows={3}
            placeholder="Detalle adicional de la operación (opcional)…"
            value={form.observaciones}
            onChange={(e) => set("observaciones", e.target.value)}
          />
        </div>
      </div>

      {(comisionDesdePdf || brouImportado?.es_santander_pais) && !editRow ? (
        <label className="brou-comision-toggle inline-check">
          <input
            type="checkbox"
            checked={registrarComisionBrou}
            onChange={(e) => onComisionToggle(e.target.checked)}
          />
          Registrar la comisión bancaria como gasto independiente
        </label>
      ) : null}

      {comisionPreview ? (
        <ComisionBrouPreviewForm
          payload={comisionPreview}
          comision={brouImportado?.comision}
          concepto={comisionConcepto}
          onConceptoChange={onComisionConceptoChange}
          manual={comisionEsManual}
          apiOnline={apiOnline}
          fecha={form.fecha}
          manualMoney={comisionManualMoney}
          onManualMoneyChange={handleComisionMoneyChange}
          manualSyncKey={comisionManualSyncKey}
        />
      ) : null}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {editRow ? "Actualizar registro" : "Guardar"}
        </button>
        {editRow && (
          <button type="button" className="btn btn-secondary" onClick={onCancelEdit}>
            Cancelar edición
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setForm(initial());
            setBrouImportado(null);
            setDocumentoArchivo(null);
            resetComisionState();
            onCancelEdit();
          }}
        >
          Limpiar formulario
        </button>
      </div>
    </form>

    <GastoHistorialTabla
      apiOnline={apiOnline}
      currentUser={currentUser}
      onEdit={onEdit}
      onError={onError}
      refreshKey={historialKey}
      onDeleted={() => setHistorialKey((k) => k + 1)}
    />
    </div>
  );
}
