import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProveedores } from "../../api";
import type { Proveedor } from "../../types";
import {
  BROU_CAMPO_LABELS,
  COMISION_HEREDAR_IDS,
  COMISION_IMPORTE_FIJOS,
  COMISION_IMPORTE_MANUAL_MAPEO,
  COMISION_IMPORTE_MANUAL_OPCION,
  COMISION_MAPEO_DEFAULT,
  COMISION_PROVEEDOR_HEREDAR_VALOR,
  GASTO_CAMPO_LABELS,
  GASTO_DESTINO_IDS,
  GASTO_DESTINO_LABELS,
  type ComisionDocumentoConfig,
  type GastoCampoId,
  type GastoDestinoId,
  decodeProveedorComision,
  esImporteComisionFijoConfigurado,
  esImporteComisionManual,
  esProveedorComisionHeredar,
  esProveedorComisionSantander,
  importeComisionFijoLabelDesdeConfig,
  importeUsdFijoADisplay,
  normalizeComisionConfig,
  normalizeGastoMapeo,
  parseImporteUsdManualInput,
} from "../../utils/gasto-campos";
import ComisionProveedorPicker from "./ComisionProveedorPicker";

interface Props {
  apiOnline: boolean;
  config: ComisionDocumentoConfig;
  titulosDisponibles: string[];
  onChange: (config: ComisionDocumentoConfig) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
}

export default function ComisionConfigPanel({
  apiOnline,
  config,
  titulosDisponibles,
  onChange,
  onError,
  onSuccess,
}: Props) {
  const cfg = normalizeComisionConfig(config);

  const titulos = useMemo(() => {
    const conocidos = Object.values(BROU_CAMPO_LABELS);
    const guardados = Object.values(cfg.mapeo_campos).filter(Boolean) as string[];
    return [...new Set([...titulosDisponibles, ...conocidos, ...guardados])].sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "accent" })
    );
  }, [titulosDisponibles, cfg.mapeo_campos]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [importeManualTexto, setImporteManualTexto] = useState<string | null>(null);

  const cargarProveedores = useCallback(async () => {
    if (!apiOnline) {
      setProveedores([]);
      return;
    }
    try {
      setProveedores(await fetchProveedores());
    } catch {
      setProveedores([]);
    }
  }, [apiOnline]);

  useEffect(() => {
    void cargarProveedores();
  }, [cargarProveedores]);

  const patch = (partial: Partial<ComisionDocumentoConfig>) => {
    onChange(normalizeComisionConfig({ ...cfg, ...partial }));
  };

  const toggleHeredar = (campo: GastoCampoId) => {
    const next = cfg.heredar.includes(campo)
      ? cfg.heredar.filter((c) => c !== campo)
      : [...cfg.heredar, campo];
    patch({ heredar: next });
  };

  const incluirDestino = (lista: GastoDestinoId[], destino: GastoDestinoId, incluir: boolean) => {
    if (incluir) {
      return lista.includes(destino) ? lista : [...lista, destino];
    }
    return lista.filter((c) => c !== destino);
  };

  const setMapeo = (destino: GastoDestinoId, etiqueta: string) => {
    const mapeo = normalizeGastoMapeo(cfg.mapeo_campos);
    const valores_fijos = { ...cfg.valores_fijos };
    const trimmed = etiqueta.trim();

    if (destino === "importes") {
      const fijo = COMISION_IMPORTE_FIJOS.find((o) => o.label === trimmed);
      if (fijo) {
        mapeo.importes = fijo.label;
        valores_fijos.importes = fijo.valor;
        patch({
          mapeo_campos: mapeo,
          valores_fijos,
          campos_incluidos: incluirDestino(cfg.campos_incluidos, destino, true),
        });
        return;
      }
      if (trimmed === COMISION_IMPORTE_MANUAL_OPCION || trimmed === COMISION_IMPORTE_MANUAL_MAPEO) {
        mapeo.importes = COMISION_IMPORTE_MANUAL_MAPEO;
        setImporteManualTexto(importeUsdFijoADisplay(valores_fijos.importes) || "");
        patch({
          mapeo_campos: mapeo,
          valores_fijos,
          campos_incluidos: incluirDestino(
            cfg.campos_incluidos,
            destino,
            Boolean(valores_fijos.importes?.trim())
          ),
        });
        return;
      }
      delete valores_fijos.importes;
    }

    if (trimmed) {
      mapeo[destino] = trimmed;
    } else {
      delete mapeo[destino];
    }
    const tieneValor = Boolean(trimmed);
    patch({
      mapeo_campos: mapeo,
      valores_fijos,
      campos_incluidos: incluirDestino(cfg.campos_incluidos, destino, tieneValor),
    });
  };

  const setImporteManualUsd = (texto: string) => {
    setImporteManualTexto(texto);
    const mapeo = normalizeGastoMapeo(cfg.mapeo_campos);
    const valores_fijos = { ...cfg.valores_fijos };
    mapeo.importes = COMISION_IMPORTE_MANUAL_MAPEO;
    const parsed = parseImporteUsdManualInput(texto);
    if (parsed) {
      valores_fijos.importes = parsed;
    } else {
      delete valores_fijos.importes;
    }
    patch({
      mapeo_campos: mapeo,
      valores_fijos,
      campos_incluidos: incluirDestino(cfg.campos_incluidos, "importes", Boolean(parsed)),
    });
  };

  const blurImporteManual = () => {
    const display = importeUsdFijoADisplay(cfg.valores_fijos.importes);
    setImporteManualTexto(display || null);
  };

  const salirImporteManual = () => {
    setImporteManualTexto(null);
    const mapeo = normalizeGastoMapeo(cfg.mapeo_campos);
    const valores_fijos = { ...cfg.valores_fijos };
    delete mapeo.importes;
    delete valores_fijos.importes;
    patch({
      mapeo_campos: mapeo,
      valores_fijos,
      campos_incluidos: incluirDestino(cfg.campos_incluidos, "importes", false),
    });
  };

  const setProveedorComision = (value: string) => {
    const valores_fijos = { ...cfg.valores_fijos };
    const mapeo = normalizeGastoMapeo(cfg.mapeo_campos);
    let heredar: GastoCampoId[] = cfg.heredar.filter((c) => c !== "proveedor");
    let campos_incluidos: GastoDestinoId[] = cfg.campos_incluidos.filter(
      (c) => c !== "proveedor"
    );
    delete mapeo.proveedor;

    if (!value) {
      delete valores_fijos.proveedor;
    } else if (value === COMISION_PROVEEDOR_HEREDAR_VALOR) {
      valores_fijos.proveedor = COMISION_PROVEEDOR_HEREDAR_VALOR;
      heredar = [...heredar, "proveedor"];
    } else {
      valores_fijos.proveedor = value;
      campos_incluidos = [...campos_incluidos, "proveedor"];
    }

    if (
      !esProveedorComisionSantander(value) &&
      (esImporteComisionFijoConfigurado(mapeo.importes, valores_fijos.importes) ||
        esImporteComisionManual(mapeo.importes, valores_fijos.importes))
    ) {
      delete valores_fijos.importes;
      mapeo.importes = COMISION_MAPEO_DEFAULT.importes;
    }

    patch({ valores_fijos, mapeo_campos: mapeo, heredar, campos_incluidos });
  };

  const proveedorSelectValue = (): string => {
    const raw = cfg.valores_fijos.proveedor ?? "";
    if (esProveedorComisionHeredar(raw)) return COMISION_PROVEEDOR_HEREDAR_VALOR;
    if (decodeProveedorComision(raw)) return raw;
    if (cfg.heredar.includes("proveedor")) return COMISION_PROVEEDOR_HEREDAR_VALOR;
    return "";
  };

  const proveedorEsSantander = esProveedorComisionSantander(cfg.valores_fijos.proveedor);

  const etiquetasImporteReservadas = useMemo(
    () =>
      new Set([
        ...COMISION_IMPORTE_FIJOS.map((o) => o.label),
        COMISION_IMPORTE_MANUAL_OPCION,
        "x,xx usd",
      ]),
    []
  );

  return (
    <div className="doc-comision-config">
      <label className="inline-check doc-comision-activa">
        <input
          type="checkbox"
          checked={cfg.activa}
          onChange={(e) => patch({ activa: e.target.checked })}
        />
        Registrar comisión bancaria como operación separada al guardar el gasto
      </label>

      <h4>Copiar de la transferencia principal</h4>
      <p className="muted doc-tipo-campos-hint">
        Estos campos se toman del gasto principal sin leer el PDF de comisión.
      </p>
      <div className="doc-comision-heredar-grid">
        {COMISION_HEREDAR_IDS.map((campo) => (
          <label key={campo} className="doc-comision-heredar-item">
            <input
              type="checkbox"
              checked={cfg.heredar.includes(campo)}
              onChange={() => toggleHeredar(campo)}
            />
            {GASTO_CAMPO_LABELS[campo]}
          </label>
        ))}
      </div>

      <h4>Campos del registro de comisión</h4>
      <p className="muted doc-tipo-campos-hint">
        Para cada campo, elegí qué título del documento lo completa.
        El proveedor se elige del listado de la aplicación.
      </p>

      <div className="doc-tipo-mapeo-grid">
        {GASTO_DESTINO_IDS.map((destino) => {
          if (destino === "concepto") return null;

          if (destino === "proveedor") {
            return (
              <div key={destino} className="doc-tipo-mapeo-row">
                <label className="doc-tipo-mapeo-destino" htmlFor="com-mapeo-proveedor">
                  {GASTO_DESTINO_LABELS.proveedor}
                </label>
                <span className="doc-tipo-mapeo-flecha" aria-hidden>
                  ←
                </span>
                <ComisionProveedorPicker
                  apiOnline={apiOnline}
                  proveedores={proveedores}
                  value={proveedorSelectValue()}
                  onChange={setProveedorComision}
                  onError={onError}
                  onSuccess={onSuccess}
                  onProveedorCreado={() => void cargarProveedores()}
                />
              </div>
            );
          }

          const valorFijo = cfg.valores_fijos[destino] ?? "";
          const mapeoVal = cfg.mapeo_campos[destino] ?? "";
          const importeFijoLabel = importeComisionFijoLabelDesdeConfig(mapeoVal, valorFijo);
          const importeManual = esImporteComisionManual(mapeoVal, valorFijo);
          const selectValue = importeFijoLabel ?? (importeManual ? "" : mapeoVal);
          const mostrarImporteEditable =
            destino === "importes" && proveedorEsSantander && importeManual;
          return (
            <div key={destino} className="doc-tipo-mapeo-row">
              <label className="doc-tipo-mapeo-destino" htmlFor={`com-mapeo-${destino}`}>
                {GASTO_DESTINO_LABELS[destino]}
                {destino === "nro_operacion_origen" ? (
                  <span className="muted doc-comision-suffix-hint"> (+ -COM)</span>
                ) : null}
              </label>
              <span className="doc-tipo-mapeo-flecha" aria-hidden>
                ←
              </span>
              <div className="doc-comision-control">
                {mostrarImporteEditable ? (
                  <div className="doc-comision-importe-editable">
                    <input
                      id={`com-mapeo-${destino}`}
                      type="text"
                      className="doc-tipo-mapeo-select doc-comision-importe-monto"
                      inputMode="decimal"
                      placeholder="0,00"
                      autoFocus
                      aria-label="Monto en USD"
                      value={importeManualTexto ?? importeUsdFijoADisplay(valorFijo)}
                      onChange={(e) => setImporteManualUsd(e.target.value)}
                      onBlur={blurImporteManual}
                    />
                    <span className="doc-comision-importe-acciones">
                      <span className="doc-comision-importe-sufijo">usd</span>
                      <button
                        type="button"
                        className="doc-comision-importe-volver"
                        onClick={salirImporteManual}
                      >
                        Cambiar
                      </button>
                    </span>
                  </div>
                ) : (
                  <select
                    id={`com-mapeo-${destino}`}
                    className="doc-tipo-mapeo-select"
                    value={selectValue}
                    onChange={(e) => setMapeo(destino, e.target.value)}
                  >
                    <option value="">No completar</option>
                    {destino === "importes" && proveedorEsSantander ? (
                      <>
                        {COMISION_IMPORTE_FIJOS.map((opcion) => (
                          <option key={opcion.label} value={opcion.label}>
                            {opcion.label}
                          </option>
                        ))}
                        <option value={COMISION_IMPORTE_MANUAL_OPCION}>
                          {COMISION_IMPORTE_MANUAL_OPCION}
                        </option>
                      </>
                    ) : null}
                    {titulos
                      .filter(
                        (etiqueta) =>
                          destino !== "importes" || !etiquetasImporteReservadas.has(etiqueta)
                      )
                      .map((etiqueta) => (
                        <option key={etiqueta} value={etiqueta}>
                          {etiqueta}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
