import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProveedores } from "../../api";
import type { Proveedor } from "../../types";
import {
  BROU_CAMPO_LABELS,
  COMISION_HEREDAR_IDS,
  COMISION_IMPORTE_SANTANDER_LABEL,
  COMISION_IMPORTE_SANTANDER_VALOR,
  COMISION_MAPEO_DEFAULT,
  COMISION_PROVEEDOR_HEREDAR_VALOR,
  GASTO_CAMPO_LABELS,
  GASTO_DESTINO_IDS,
  GASTO_DESTINO_LABELS,
  type ComisionDocumentoConfig,
  type GastoCampoId,
  type GastoDestinoId,
  decodeProveedorComision,
  esImporteComisionSantander,
  esProveedorComisionHeredar,
  esProveedorComisionSantander,
  normalizeComisionConfig,
  normalizeGastoMapeo,
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

    if (destino === "importes" && trimmed === COMISION_IMPORTE_SANTANDER_LABEL) {
      mapeo.importes = COMISION_IMPORTE_SANTANDER_LABEL;
      valores_fijos.importes = COMISION_IMPORTE_SANTANDER_VALOR;
      patch({
        mapeo_campos: mapeo,
        valores_fijos,
        campos_incluidos: incluirDestino(cfg.campos_incluidos, destino, true),
      });
      return;
    }

    if (destino === "importes") {
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
      esImporteComisionSantander(mapeo.importes, valores_fijos.importes)
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
          const importeSantander =
            destino === "importes" && esImporteComisionSantander(mapeoVal, valorFijo);
          const selectValue = importeSantander ? COMISION_IMPORTE_SANTANDER_LABEL : mapeoVal;
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
                <select
                  id={`com-mapeo-${destino}`}
                  className="doc-tipo-mapeo-select"
                  value={selectValue}
                  onChange={(e) => setMapeo(destino, e.target.value)}
                >
                  <option value="">No completar</option>
                  {destino === "importes" && proveedorEsSantander ? (
                    <option value={COMISION_IMPORTE_SANTANDER_LABEL}>
                      {COMISION_IMPORTE_SANTANDER_LABEL}
                    </option>
                  ) : null}
                  {titulos
                    .filter(
                      (etiqueta) =>
                        destino !== "importes" || etiqueta !== COMISION_IMPORTE_SANTANDER_LABEL
                    )
                    .map((etiqueta) => (
                    <option key={etiqueta} value={etiqueta}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
