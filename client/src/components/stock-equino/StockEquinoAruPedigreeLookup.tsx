import { useEffect, useState } from "react";
import {
  buscarAruPedigreeEquino,
  fetchAruDetalleEquino,
  fetchAruRazasEquinas,
  type AruBuscarPor,
  type AruDetalleAnimal,
  type AruRazaEquina,
  type AruResultadoBusqueda,
} from "../../api";

export interface AruCamposAltaCabana {
  rp?: string;
  nombre_animal?: string;
  fecha_nacimiento?: string;
  sexo?: "MACHO" | "HEMBRA";
  registro?: string;
  premios?: string;
}

interface Props {
  apiOnline: boolean;
  disabled?: boolean;
  onAplicar: (campos: AruCamposAltaCabana, meta: AruDetalleAnimal) => void;
  onError: (msg: string) => void;
  formId: string;
}

const CRIOLLA_ID = "27";

function labelConsulta(modo: AruBuscarPor): string {
  if (modo === "registro") return "Número de registro (ARU)";
  if (modo === "criador") return "Código de criador";
  return "Nombre del animal";
}

function placeholderConsulta(modo: AruBuscarPor): string {
  if (modo === "registro") return "Ej. P0059533 o 149918";
  if (modo === "criador") return "Ej. E097";
  return "Ej. balin";
}

/** Solo pasa campos con valor real desde ARU (no inventa ni borra con vacío). */
export function camposDesdeAruDetalle(d: AruDetalleAnimal): AruCamposAltaCabana {
  const out: AruCamposAltaCabana = {};
  if (d.rp.trim()) out.rp = d.rp.trim();
  if (d.nombre.trim()) out.nombre_animal = d.nombre.trim();
  if (d.fecha_nacimiento.trim()) out.fecha_nacimiento = d.fecha_nacimiento.trim();
  if (d.sexo === "MACHO" || d.sexo === "HEMBRA") out.sexo = d.sexo;
  if (d.registro.trim()) out.registro = d.registro.trim();
  if (d.premios.trim()) out.premios = d.premios.trim();
  return out;
}

export default function StockEquinoAruPedigreeLookup({
  apiOnline,
  disabled = false,
  onAplicar,
  onError,
  formId,
}: Props) {
  const [razas, setRazas] = useState<AruRazaEquina[]>([]);
  const [razaId, setRazaId] = useState(CRIOLLA_ID);
  const [sexoFiltro, setSexoFiltro] = useState<"I" | "M" | "H">("I");
  const [buscarPor, setBuscarPor] = useState<AruBuscarPor>("nombre");
  const [consulta, setConsulta] = useState("");
  const [rpCriador, setRpCriador] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aplicandoId, setAplicandoId] = useState<string | null>(null);
  const [resultados, setResultados] = useState<AruResultadoBusqueda[]>([]);
  const [busquedaHecha, setBusquedaHecha] = useState(false);

  useEffect(() => {
    if (!apiOnline) {
      setRazas([]);
      return;
    }
    let cancelled = false;
    void fetchAruRazasEquinas()
      .then((list) => {
        if (cancelled) return;
        setRazas(list.length ? list : [{ id: CRIOLLA_ID, nombre: "CRIOLLA" }]);
        setRazaId((prev) => {
          if (list.some((r) => r.id === prev)) return prev;
          return list.find((r) => r.id === CRIOLLA_ID)?.id ?? list[0]?.id ?? CRIOLLA_ID;
        });
      })
      .catch(() => {
        if (!cancelled) setRazas([{ id: CRIOLLA_ID, nombre: "CRIOLLA" }]);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOnline]);

  const buscar = async () => {
    if (!apiOnline || disabled || buscando) return;
    const q = consulta.trim();
    if (!q) {
      onError(`Indicá ${labelConsulta(buscarPor).toLowerCase()}.`);
      return;
    }
    setBuscando(true);
    setBusquedaHecha(false);
    try {
      const rows = await buscarAruPedigreeEquino({
        raza_id: razaId,
        sexo: sexoFiltro,
        buscar_por: buscarPor,
        consulta: q,
        rp: buscarPor === "criador" ? rpCriador.trim() : undefined,
        rp_hasta: buscarPor === "criador" ? rpCriador.trim() : undefined,
      });
      setResultados(rows);
      setBusquedaHecha(true);
      if (rows.length === 0) {
        onError("ARU no devolvió animales con esos datos.");
      }
    } catch (e) {
      setResultados([]);
      setBusquedaHecha(true);
      onError(e instanceof Error ? e.message : "Error al consultar ARU");
    } finally {
      setBuscando(false);
    }
  };

  const aplicar = async (row: AruResultadoBusqueda) => {
    if (!apiOnline || disabled || aplicandoId) return;
    if (!row.publico) {
      onError("Ese registro no es público en ARU; no se puede importar el detalle.");
      return;
    }
    setAplicandoId(row.id);
    try {
      const detalle = await fetchAruDetalleEquino({
        id: row.id,
        id_raza: row.id_raza || razaId,
        id_filtro: row.id_filtro,
        id_sesion: row.id_sesion,
        id_especie: row.id_especie,
      });
      const campos = camposDesdeAruDetalle(detalle);
      if (Object.keys(campos).length === 0) {
        onError("ARU no trajo campos útiles para el alta.");
        return;
      }
      onAplicar(campos, detalle);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al leer el detalle en ARU");
    } finally {
      setAplicandoId(null);
    }
  };

  const busy = disabled || buscando || !!aplicandoId;

  return (
    <div className="stock-aru-lookup" aria-label="Consulta pedigree ARU">
      <header className="stock-aru-lookup-head">
        <div>
          <p className="stock-aru-lookup-kicker">Pedigree ARU</p>
          <h3 className="stock-aru-lookup-title">Importar desde registros genealógicos</h3>
          <p className="stock-aru-lookup-sub muted">
            Buscá por registro, criador (+ RP) o nombre en{" "}
            <a
              href="https://aru.org.uy/rrgg/formulario.php"
              target="_blank"
              rel="noopener noreferrer"
            >
              aru.org.uy
            </a>
            . Solo se completan los campos que ARU traiga; empresa y potrero los cargás vos.
          </p>
        </div>
      </header>

      <div className="stock-aru-lookup-filters">
        <div className="field stock-import-field">
          <label htmlFor={`${formId}-aru-raza`}>Raza (ARU)</label>
          <select
            id={`${formId}-aru-raza`}
            className="stock-edit-select"
            value={razaId}
            onChange={(e) => setRazaId(e.target.value)}
            disabled={!apiOnline || busy}
          >
            {(razas.length ? razas : [{ id: CRIOLLA_ID, nombre: "CRIOLLA" }]).map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field stock-import-field">
          <label htmlFor={`${formId}-aru-sexo`}>Sexo (filtro)</label>
          <select
            id={`${formId}-aru-sexo`}
            className="stock-edit-select"
            value={sexoFiltro}
            onChange={(e) => setSexoFiltro(e.target.value as "I" | "M" | "H")}
            disabled={!apiOnline || busy}
          >
            <option value="I">Indistinto</option>
            <option value="M">Macho</option>
            <option value="H">Hembra</option>
          </select>
        </div>
        <div className="field stock-import-field">
          <label htmlFor={`${formId}-aru-por`}>Buscar por</label>
          <select
            id={`${formId}-aru-por`}
            className="stock-edit-select"
            value={buscarPor}
            onChange={(e) => {
              setBuscarPor(e.target.value as AruBuscarPor);
              setResultados([]);
              setBusquedaHecha(false);
            }}
            disabled={!apiOnline || busy}
          >
            <option value="registro">Registro</option>
            <option value="criador">Criador (+ RP)</option>
            <option value="nombre">Nombre</option>
          </select>
        </div>
        <div className="field stock-import-field stock-aru-lookup-consulta">
          <label htmlFor={`${formId}-aru-consulta`}>{labelConsulta(buscarPor)}</label>
          <input
            id={`${formId}-aru-consulta`}
            type="search"
            value={consulta}
            placeholder={placeholderConsulta(buscarPor)}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void buscar();
              }
            }}
            disabled={!apiOnline || busy}
            autoComplete="off"
          />
        </div>
        {buscarPor === "criador" ? (
          <div className="field stock-import-field">
            <label htmlFor={`${formId}-aru-rp`}>RP (opcional)</label>
            <input
              id={`${formId}-aru-rp`}
              type="text"
              value={rpCriador}
              placeholder="Ej. 631"
              onChange={(e) => setRpCriador(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void buscar();
                }
              }}
              disabled={!apiOnline || busy}
              autoComplete="off"
            />
          </div>
        ) : null}
        <div className="stock-aru-lookup-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!apiOnline || busy}
            onClick={() => void buscar()}
          >
            {buscando ? "Buscando en ARU…" : "Buscar en ARU"}
          </button>
        </div>
      </div>

      {busquedaHecha ? (
        <div className="stock-aru-lookup-results table-wrap">
          {resultados.length === 0 ? (
            <p className="empty muted">Sin resultados en ARU.</p>
          ) : (
            <table className="data-table stock-aru-lookup-table">
              <thead>
                <tr>
                  <th>RP</th>
                  <th>Criador</th>
                  <th>Registro</th>
                  <th>Nombre</th>
                  <th aria-label="Acción" />
                </tr>
              </thead>
              <tbody>
                {resultados.map((row) => (
                  <tr key={`${row.id}-${row.registro}-${row.rp}`}>
                    <td className="num">{row.rp || "—"}</td>
                    <td>{row.criador || "—"}</td>
                    <td className="num">{row.registro || "—"}</td>
                    <td>{row.nombre || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!apiOnline || busy || !row.publico}
                        title={
                          row.publico
                            ? "Traer datos al formulario de alta"
                            : "Registro no público en ARU"
                        }
                        onClick={() => void aplicar(row)}
                      >
                        {aplicandoId === row.id ? "Cargando…" : "Usar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
