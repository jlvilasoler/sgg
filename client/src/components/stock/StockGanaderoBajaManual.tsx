import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchStockGanaderaDispositivo,
  fetchStockGanaderaDispositivos,
  saveStockGanaderaDispositivo,
} from "../../api";
import type { StockGanaderaDispositivo, TipoBaja } from "../../types";
import { fmtDate } from "../../utils";
import BadgeEstadoDispositivo from "./BadgeEstadoDispositivo";
import {
  buildGrupo,
  dispositivoClave,
  estadoDesdeTipoBaja,
  etiquetaFechaBaja,
  fechaBajaPorDefecto,
  fmtNacimiento,
  fmtTipoBaja,
  listAniosNacimiento,
  MESES_NACIMIENTO,
  normalizarEstadoDispositivo,
  requiereFechaBaja,
  requiereFechaTipoBaja,
  TIPOS_BAJA,
  tipoBajaDesdeDispositivo,
} from "./stock-ganadera-utils";

interface Props {
  apiOnline: boolean;
  onSaved: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

async function resolverDispositivo(
  numero: string
): Promise<
  | { tipo: "unico"; dispositivo: StockGanaderaDispositivo }
  | { tipo: "varios"; candidatos: StockGanaderaDispositivo[] }
> {
  const trimmed = numero.trim();
  if (!trimmed) throw new Error("Ingresá el número de dispositivo");

  const claveDirecta = dispositivoClave(trimmed, "");
  try {
    const detalle = await fetchStockGanaderaDispositivo(claveDirecta);
    return { tipo: "unico", dispositivo: detalle };
  } catch {
    /* intentar búsqueda parcial */
  }

  const candidatos = await fetchStockGanaderaDispositivos({ busqueda: trimmed });
  if (candidatos.length === 0) {
    throw new Error("Dispositivo no encontrado en el stock");
  }
  if (candidatos.length === 1) {
    return { tipo: "unico", dispositivo: candidatos[0] };
  }
  return { tipo: "varios", candidatos };
}

export default function StockGanaderoBajaManual({
  apiOnline,
  onSaved,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [numero, setNumero] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState<StockGanaderaDispositivo[]>([]);
  const [dispositivo, setDispositivo] = useState<StockGanaderaDispositivo | null>(
    null
  );
  const [tipoBaja, setTipoBaja] = useState<TipoBaja>("VENTA_FRIGORIFICO");
  const [bajaMes, setBajaMes] = useState<number | null>(null);
  const [bajaAnio, setBajaAnio] = useState<number | null>(null);
  const [numeroGuia, setNumeroGuia] = useState("");
  const [guardando, setGuardando] = useState(false);

  const aniosBaja = useMemo(() => listAniosNacimiento(), []);
  const estado = estadoDesdeTipoBaja(tipoBaja);

  const cargarDispositivo = useCallback((d: StockGanaderaDispositivo) => {
    setDispositivo(d);
    setCandidatos([]);
    setTipoBaja(tipoBajaDesdeDispositivo(d));
    setBajaMes(d.baja_mes);
    setBajaAnio(d.baja_anio);
    setNumeroGuia(d.numero_guia ?? "");
  }, []);

  useEffect(() => {
    if (!requiereFechaTipoBaja(tipoBaja)) {
      setBajaMes(null);
      setBajaAnio(null);
      return;
    }
    if (!bajaMes || !bajaAnio) {
      const hoy = fechaBajaPorDefecto();
      if (!bajaMes) setBajaMes(hoy.mes);
      if (!bajaAnio) setBajaAnio(hoy.anio);
    }
  }, [tipoBaja, bajaMes, bajaAnio]);

  const estadoActual = dispositivo
    ? normalizarEstadoDispositivo(dispositivo.estado)
    : null;
  const tipoBajaActual = dispositivo ? tipoBajaDesdeDispositivo(dispositivo) : null;

  const hayCambio =
    dispositivo !== null &&
    (estado !== estadoActual ||
      tipoBaja !== tipoBajaActual ||
      (requiereFechaTipoBaja(tipoBaja) &&
        (bajaMes !== dispositivo.baja_mes || bajaAnio !== dispositivo.baja_anio)) ||
      numeroGuia.trim() !== (dispositivo.numero_guia ?? "").trim());

  const buscar = async () => {
    if (!apiOnline || buscando) return;
    setBuscando(true);
    setDispositivo(null);
    setCandidatos([]);
    try {
      const r = await resolverDispositivo(numero);
      if (r.tipo === "unico") {
        cargarDispositivo(r.dispositivo);
      } else {
        setCandidatos(r.candidatos);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al buscar dispositivo");
    } finally {
      setBuscando(false);
    }
  };

  const guardar = async () => {
    if (!dispositivo || !apiOnline || guardando || !hayCambio) return;

    if (requiereFechaTipoBaja(tipoBaja) && (!bajaMes || !bajaAnio)) {
      onError(`Ingresá mes y año de ${etiquetaFechaBaja(estado).toLowerCase()}`);
      return;
    }

    setGuardando(true);
    try {
      await saveStockGanaderaDispositivo(
        dispositivo.clave,
        {
          sexo: dispositivo.sexo ?? "",
          empresa: dispositivo.empresa ?? "",
          grupo: buildGrupo(dispositivo.nacimiento_anio) || dispositivo.grupo || "",
          grupo_libre: dispositivo.grupo_libre ?? "",
          nacimiento_mes: dispositivo.nacimiento_mes,
          nacimiento_anio: dispositivo.nacimiento_anio,
          observaciones: dispositivo.observaciones ?? "",
          estado,
          tipo_baja: tipoBaja,
          numero_guia: numeroGuia.trim(),
          baja_mes: requiereFechaTipoBaja(tipoBaja) ? bajaMes : null,
          baja_anio: requiereFechaTipoBaja(tipoBaja) ? bajaAnio : null,
        },
        dispositivo.eid
      );

      const etiqueta = fmtTipoBaja(tipoBaja);
      onSuccess(
        `Caravana ${dispositivo.vid || dispositivo.eid} registrada como ${etiqueta}. El cambio queda registrado en toda la base.`,
        "Baja registrada"
      );
      cargarDispositivo({
        ...dispositivo,
        estado,
        tipo_baja: tipoBaja,
        numero_guia: numeroGuia.trim(),
        baja_mes: requiereFechaTipoBaja(tipoBaja) ? bajaMes : null,
        baja_anio: requiereFechaTipoBaja(tipoBaja) ? bajaAnio : null,
      });
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar estado");
    } finally {
      setGuardando(false);
    }
  };

  const limpiar = () => {
    setNumero("");
    setDispositivo(null);
    setCandidatos([]);
    setTipoBaja("VENTA_FRIGORIFICO");
    setBajaMes(null);
    setBajaAnio(null);
    setNumeroGuia("");
  };

  return (
    <div className="subseccion-panel stock-import-page stock-baja-manual-page">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Bajas de Dispositivos
      </button>

      <div className="stock-import-hero card stock-import-hero--manual">
        <div className="stock-import-hero-icon stock-import-hero-icon--manual" aria-hidden>
          ✏️
        </div>
        <div className="stock-import-hero-text">
          <h2>Dar de baja manual</h2>
          <p>
            Buscá una caravana por su número EID o visual (VID) y cambiá su{" "}
            <strong>estado</strong>. El cambio se aplica en toda la base de datos
            del dispositivo.
          </p>
        </div>
      </div>

      {!apiOnline && (
        <div className="stock-import-offline" role="status">
          Conectá la API (puerto 3001) para buscar y actualizar dispositivos.
        </div>
      )}

      <div className="stock-baja-manual-buscar card">
        <label htmlFor="stock-baja-manual-numero" className="stock-import-spec-label">
          Número de dispositivo
        </label>
        <div className="stock-baja-manual-buscar-row">
          <input
            id="stock-baja-manual-numero"
            type="search"
            className="stock-baja-manual-input"
            placeholder="EID completo o caravana visual (VID)"
            value={numero}
            disabled={!apiOnline || buscando || guardando}
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void buscar();
              }
            }}
          />
          <button
            type="button"
            className="stock-import-action stock-import-action--manual"
            disabled={!apiOnline || buscando || guardando || !numero.trim()}
            onClick={() => void buscar()}
          >
            {buscando ? (
              <>
                <span className="stock-import-spinner" aria-hidden />
                Buscando…
              </>
            ) : (
              "Buscar"
            )}
          </button>
        </div>
        <p className="stock-import-spec-hint">
          Podés ingresar el RFID completo (ej. <strong>858 000041989349</strong>) o
          solo la parte visual de la caravana.
        </p>
      </div>

      {candidatos.length > 0 && (
        <div className="stock-baja-manual-candidatos card">
          <p className="stock-baja-manual-candidatos-titulo">
            Se encontraron <strong>{candidatos.length}</strong> dispositivos — elegí
            uno:
          </p>
          <ul className="stock-baja-manual-candidatos-lista">
            {candidatos.map((c) => (
              <li key={c.clave}>
                <button
                  type="button"
                  className="stock-baja-manual-candidato-btn"
                  disabled={buscando || guardando}
                  onClick={() => cargarDispositivo(c)}
                >
                  <span className="stock-baja-manual-candidato-ids num">
                    EID {c.eid || "—"} · {c.vid || "—"}
                  </span>
                  <BadgeEstadoDispositivo estado={c.estado} />
                  <span className="stock-baja-manual-candidato-meta">
                    {c.total_lecturas} lectura(s) · últ. {fmtDate(c.ultima_fecha)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dispositivo && (
        <div className="stock-baja-manual-resultado card">
          <header className="stock-baja-manual-resultado-head">
            <div>
              <p className="stock-baja-manual-kicker">Dispositivo encontrado</p>
              <h3 className="stock-baja-manual-titulo num">
                EID {dispositivo.eid || "—"} · {dispositivo.vid || "—"}
              </h3>
              <p className="stock-baja-manual-meta muted">
                {dispositivo.total_lecturas} lectura(s) · última{" "}
                {fmtDate(dispositivo.ultima_fecha)}
                {dispositivo.ultima_hora ? ` ${dispositivo.ultima_hora}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="stock-baja-manual-limpiar"
              disabled={guardando}
              onClick={limpiar}
            >
              Buscar otro
            </button>
          </header>

          <div className="stock-baja-manual-estado-actual">
            <span className="stock-import-spec-label">Estado actual</span>
            <BadgeEstadoDispositivo estado={dispositivo.estado} />
            {requiereFechaBaja(estadoActual!) && dispositivo.baja_mes && dispositivo.baja_anio && (
              <span className="stock-baja-manual-fecha-actual muted">
                {etiquetaFechaBaja(estadoActual!)}:{" "}
                {fmtNacimiento(dispositivo.baja_mes, dispositivo.baja_anio)}
              </span>
            )}
          </div>

          <div className="stock-baja-manual-cambio stock-import-baja-datos">
            <div className="stock-baja-manual-campo field stock-import-field">
              <label htmlFor="stock-baja-manual-tipo">Tipo de baja</label>
              <select
                id="stock-baja-manual-tipo"
                className="stock-import-select"
                value={tipoBaja}
                disabled={!apiOnline || guardando}
                onChange={(e) => setTipoBaja(e.target.value as TipoBaja)}
              >
                {TIPOS_BAJA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {requiereFechaTipoBaja(tipoBaja) && (
              <div className="stock-baja-manual-fecha-baja">
                <span className="stock-import-spec-label">
                  Fecha de {etiquetaFechaBaja(estado).toLowerCase()}
                </span>
                <div className="stock-baja-manual-fecha-row">
                  <select
                    className="stock-edit-select"
                    value={bajaMes ?? ""}
                    disabled={!apiOnline || guardando}
                    onChange={(e) =>
                      setBajaMes(e.target.value ? Number(e.target.value) : null)
                    }
                    aria-label={`Mes de ${etiquetaFechaBaja(estado).toLowerCase()}`}
                  >
                    <option value="">Mes</option>
                    {MESES_NACIMIENTO.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="stock-edit-select"
                    value={bajaAnio ?? ""}
                    disabled={!apiOnline || guardando}
                    onChange={(e) =>
                      setBajaAnio(e.target.value ? Number(e.target.value) : null)
                    }
                    aria-label={`Año de ${etiquetaFechaBaja(estado).toLowerCase()}`}
                  >
                    <option value="">Año</option>
                    {aniosBaja.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="stock-baja-manual-campo field stock-import-field">
              <label htmlFor="stock-baja-manual-guia">Número guía</label>
              <input
                id="stock-baja-manual-guia"
                type="text"
                className="stock-import-text"
                value={numeroGuia}
                disabled={!apiOnline || guardando}
                placeholder="Opcional"
                onChange={(e) => setNumeroGuia(e.target.value)}
              />
            </div>
          </div>

          <div className="stock-baja-manual-acciones">
            <button
              type="button"
              className="stock-import-action stock-import-action--manual"
              disabled={!apiOnline || guardando || !hayCambio}
              onClick={() => void guardar()}
            >
              {guardando ? (
                <>
                  <span className="stock-import-spinner" aria-hidden />
                  Guardando…
                </>
              ) : (
                <>Guardar baja</>
              )}
            </button>
            {!hayCambio && (
              <p className="stock-baja-manual-sin-cambio muted">
                Elegí un tipo de baja distinto o modificá la fecha o guía para guardar.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
