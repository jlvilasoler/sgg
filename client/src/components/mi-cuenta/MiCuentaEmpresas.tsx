import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarRange, Layers, Save, SplitSquareHorizontal } from "lucide-react";
import {
  actualizarEmpresaOperativa,
  actualizarMiEjercicioEmpresa,
  actualizarMiModoInicio,
  fetchCurrentUser,
  fetchMiCuentaEmpresa,
} from "../../api";
import type { AuthUser, EmpresaCuenta, EmpresaOperativa, LoginMode } from "../../types";

interface Props {
  user: AuthUser;
  apiOnline: boolean;
  onUserUpdated: (user: AuthUser) => void;
  onError: (msg: string) => void;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

interface EmpresaDraft {
  nombre: string;
  rut: string;
  mes: number;
  dia: number;
}

/** Solo el administrador de la cuenta puede configurar empresas y modo de inicio. */
function puedeConfigurar(user: AuthUser): boolean {
  return (
    user.es_admin_cuenta ||
    user.es_admin_plataforma ||
    user.es_super_admin ||
    user.rol === "admin"
  );
}

/** Hay cuenta madre asociada para cargar empresas en Mi cuenta. */
function tieneCuentaParaEmpresas(user: AuthUser): boolean {
  return user.cuenta_actividad_id != null && user.cuenta_actividad_id > 0;
}

function clampDia(mes: number, dia: number): number {
  const max = DIAS_POR_MES[mes - 1];
  return Math.min(Math.max(1, dia), max);
}

function finDelEjercicio(mes: number, dia: number): string {
  const start = new Date(2001, mes - 1, clampDia(mes, dia));
  const end = new Date(2002, start.getMonth(), start.getDate());
  end.setDate(end.getDate() - 1);
  return `${end.getDate()} de ${MESES[end.getMonth()]}`;
}

function fmtRut(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 12);
  if (!d) return "";
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4}).*/, (_m, a, b, c, e) =>
    [a, b, c, e].filter(Boolean).join("."),
  );
}

function draftFromEmpresa(e: EmpresaOperativa): EmpresaDraft {
  return {
    nombre: e.nombre,
    rut: e.rut ?? "",
    mes: e.ejercicio_inicio_mes || 7,
    dia: e.ejercicio_inicio_dia || 1,
  };
}

export default function MiCuentaEmpresas({
  user,
  apiOnline,
  onUserUpdated,
  onError,
}: Props) {
  const editable = puedeConfigurar(user);
  const puedeCargar = editable && tieneCuentaParaEmpresas(user);

  const [cuenta, setCuenta] = useState<EmpresaCuenta | null>(null);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<LoginMode>("consolidado");
  const [savingModo, setSavingModo] = useState(false);
  const [ejercicioEmpresaId, setEjercicioEmpresaId] = useState<number | null>(null);
  const [savingEjEmpresa, setSavingEjEmpresa] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, EmpresaDraft>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [okId, setOkId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!puedeCargar || !apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchMiCuentaEmpresa();
      setCuenta(data);
      setModo(data.login_mode ?? "consolidado");
      setEjercicioEmpresaId(data.ejercicio_empresa_id ?? null);
      const map: Record<number, EmpresaDraft> = {};
      for (const e of data.empresas) map[e.id] = draftFromEmpresa(e);
      setDrafts(map);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudieron cargar las empresas";
      if (/no tiene una cuenta asignada|cuenta no encontrada/i.test(msg)) {
        setCuenta(null);
      } else {
        onError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [puedeCargar, apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const empresasOrdenadas = useMemo(
    () => (cuenta ? [...cuenta.empresas].sort((a, b) => a.nombre.localeCompare(b.nombre)) : []),
    [cuenta],
  );

  const cambiarModo = async (nuevo: LoginMode) => {
    if (nuevo === modo || savingModo) return;
    setSavingModo(true);
    try {
      const updated = await actualizarMiModoInicio(nuevo);
      setModo(nuevo);
      setCuenta((prev) => (prev ? { ...prev, login_mode: nuevo } : prev));
      onUserUpdated(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo cambiar el modo de inicio");
    } finally {
      setSavingModo(false);
    }
  };

  const cambiarEjercicioEmpresa = async (id: number | null) => {
    if (savingEjEmpresa) return;
    setSavingEjEmpresa(true);
    try {
      const updated = await actualizarMiEjercicioEmpresa(id);
      setEjercicioEmpresaId(id);
      setCuenta((prev) => (prev ? { ...prev, ejercicio_empresa_id: id } : prev));
      onUserUpdated(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo configurar el ejercicio fiscal");
    } finally {
      setSavingEjEmpresa(false);
    }
  };

  const setDraft = (id: number, patch: Partial<EmpresaDraft>) => {
    setOkId(null);
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const dirtyEmpresa = (e: EmpresaOperativa): boolean => {
    const d = drafts[e.id];
    if (!d) return false;
    return (
      d.nombre.trim() !== e.nombre ||
      d.rut.replace(/\D/g, "") !== (e.rut ?? "").replace(/\D/g, "") ||
      d.mes !== (e.ejercicio_inicio_mes || 7) ||
      clampDia(d.mes, d.dia) !== (e.ejercicio_inicio_dia || 1)
    );
  };

  const guardarEmpresa = async (e: EmpresaOperativa) => {
    if (!cuenta) return;
    const d = drafts[e.id];
    if (!d || !d.nombre.trim()) {
      onError("El nombre de la empresa no puede quedar vacío");
      return;
    }
    setSavingId(e.id);
    setOkId(null);
    try {
      const actualizada = await actualizarEmpresaOperativa(cuenta.id, e.id, {
        nombre: d.nombre.trim(),
        rut: d.rut.replace(/\D/g, ""),
        ejercicio_inicio_mes: d.mes,
        ejercicio_inicio_dia: clampDia(d.mes, d.dia),
      });
      setCuenta((prev) =>
        prev
          ? { ...prev, empresas: prev.empresas.map((x) => (x.id === e.id ? actualizada : x)) }
          : prev,
      );
      setDrafts((prev) => ({ ...prev, [e.id]: draftFromEmpresa(actualizada) }));
      setOkId(e.id);
      try {
        const me = await fetchCurrentUser();
        if (me) onUserUpdated(me);
      } catch {
        /* refresco best-effort del ejercicio efectivo */
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo guardar la empresa");
    } finally {
      setSavingId(null);
    }
  };

  if (!editable) {
    return (
      <section className="sg-hub-panel mi-cuenta-panel mi-cuenta-empresas" aria-label="Empresas">
        <header className="mi-cuenta-ejercicio-head">
          <span className="mi-cuenta-ejercicio-head-icon" aria-hidden="true">
            <Building2 size={18} strokeWidth={2.2} />
          </span>
          <div className="mi-cuenta-ejercicio-head-text">
            <strong>Empresas de la cuenta</strong>
            <span className="muted">
              Solo el administrador de la cuenta puede ver y configurar las empresas.
            </span>
          </div>
        </header>
      </section>
    );
  }

  if (!tieneCuentaParaEmpresas(user)) {
    return (
      <section className="sg-hub-panel mi-cuenta-panel mi-cuenta-empresas" aria-label="Empresas">
        <header className="mi-cuenta-ejercicio-head">
          <span className="mi-cuenta-ejercicio-head-icon" aria-hidden="true">
            <Building2 size={18} strokeWidth={2.2} />
          </span>
          <div className="mi-cuenta-ejercicio-head-text">
            <strong>Empresas de la cuenta</strong>
            <span className="muted">
              Como administrador de plataforma sin cuenta propia, gestioná las cuentas desde
              Configuración SAG → Arquitectura del sistema.
            </span>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="sg-hub-panel mi-cuenta-panel mi-cuenta-empresas" aria-label="Empresas">
      <header className="mi-cuenta-ejercicio-head">
        <span className="mi-cuenta-ejercicio-head-icon" aria-hidden="true">
          <Building2 size={18} strokeWidth={2.2} />
        </span>
        <div className="mi-cuenta-ejercicio-head-text">
          <strong>Empresas de la cuenta</strong>
          <span className="muted">
            Editá el nombre, el RUT y el ejercicio fiscal de cada empresa. Cada empresa
            documenta sus datos según su propio ejercicio (siempre 12 meses).
          </span>
        </div>
      </header>

      {!loading && empresasOrdenadas.length > 1 ? (
        <div className="mi-cuenta-empresas-config-card">
          <div className="mi-cuenta-empresas-config-inner">
            <div className="mi-cuenta-empresas-modo">
              <div className="mi-cuenta-empresas-modo-title">
                <span>Modo de inicio de sesión</span>
                {savingModo ? <span className="muted">Guardando…</span> : null}
              </div>
              <div className="mi-cuenta-empresas-modo-options">
                <button
                  type="button"
                  className={`mi-cuenta-modo-card ${modo === "consolidado" ? "is-active" : ""}`}
                  onClick={() => void cambiarModo("consolidado")}
                  disabled={savingModo}
                >
                  <Layers size={18} strokeWidth={2} />
                  <strong>Todas juntas (consolidado)</strong>
                  <span className="muted">
                    Al iniciar sesión se ven todas las empresas de la cuenta a la vez.
                  </span>
                </button>
                <button
                  type="button"
                  className={`mi-cuenta-modo-card ${modo === "individual" ? "is-active" : ""}`}
                  onClick={() => void cambiarModo("individual")}
                  disabled={savingModo}
                >
                  <SplitSquareHorizontal size={18} strokeWidth={2} />
                  <strong>Elegir empresa al iniciar</strong>
                  <span className="muted">
                    Al iniciar sesión se pregunta en qué empresa de la cuenta operar.
                  </span>
                </button>
              </div>
            </div>

            <div className="mi-cuenta-empresas-ejercicio-principal">
              <div className="mi-cuenta-empresas-modo-title">
                <span>Ejercicio fiscal en modo consolidado</span>
                {savingEjEmpresa ? <span className="muted">Guardando…</span> : null}
              </div>
              <p className="muted">
                Cuando operás con todas las empresas juntas, se usa el ejercicio fiscal de la
                empresa que elijas. En modo "elegir empresa al iniciar", cada empresa usa el suyo.
              </p>
              <select
                aria-label="Empresa que define el ejercicio fiscal consolidado"
                className="mi-cuenta-ejercicio-select mi-cuenta-ejercicio-select--mes"
                value={ejercicioEmpresaId ?? ""}
                onChange={(ev) =>
                  void cambiarEjercicioEmpresa(ev.target.value ? Number(ev.target.value) : null)
                }
                disabled={savingEjEmpresa}
              >
                <option value="">
                  Automática ({empresasOrdenadas[0]?.nombre ?? "primera empresa"})
                </option>
                {empresasOrdenadas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && empresasOrdenadas.length === 1 ? (
        <p className="muted mi-cuenta-empresas-ejercicio-nota">
          La cuenta tiene una sola empresa: se usa su ejercicio fiscal.
        </p>
      ) : null}

      {loading ? (
        <p className="muted mi-cuenta-empresas-loading">Cargando empresas…</p>
      ) : (
        <div className="mi-cuenta-empresas-list">
          {empresasOrdenadas.map((e) => {
            const d = drafts[e.id];
            if (!d) return null;
            const maxDia = DIAS_POR_MES[d.mes - 1];
            const diaValido = clampDia(d.mes, d.dia);
            const dirty = dirtyEmpresa(e);
            return (
              <article key={e.id} className="mi-cuenta-empresa-card">
                <div className="mi-cuenta-empresa-card-inner">
                  <div className="mi-cuenta-empresa-card-head">
                    <span
                      className="mi-cuenta-empresa-dot"
                      style={{ background: e.color || "#94a3b8" }}
                      aria-hidden="true"
                    />
                    <span className="mi-cuenta-empresa-codigo">{e.codigo}</span>
                    {!e.activo ? (
                      <span className="mi-cuenta-empresa-inactiva">Inactiva</span>
                    ) : null}
                  </div>

                  <div className="mi-cuenta-empresa-grid">
                  <label className="mi-cuenta-empresa-field">
                    <span className="mi-cuenta-ejercicio-label">Nombre</span>
                    <input
                      className="mi-cuenta-empresa-input"
                      value={d.nombre}
                      onChange={(ev) => setDraft(e.id, { nombre: ev.target.value })}
                      maxLength={80}
                    />
                  </label>

                  <label className="mi-cuenta-empresa-field">
                    <span className="mi-cuenta-ejercicio-label">RUT</span>
                    <input
                      className="mi-cuenta-empresa-input"
                      value={fmtRut(d.rut)}
                      onChange={(ev) => setDraft(e.id, { rut: ev.target.value.replace(/\D/g, "") })}
                      inputMode="numeric"
                      placeholder="Ej. 21.123.456.0012"
                    />
                  </label>
                </div>

                <div className="mi-cuenta-empresa-grid">
                  <div className="mi-cuenta-empresa-field">
                    <span className="mi-cuenta-ejercicio-label">Inicio del ejercicio</span>
                    <div className="mi-cuenta-ejercicio-inputs">
                      <select
                        aria-label="Día de inicio"
                        className="mi-cuenta-ejercicio-select"
                        value={diaValido}
                        onChange={(ev) => setDraft(e.id, { dia: Number(ev.target.value) })}
                      >
                        {Array.from({ length: maxDia }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <span className="mi-cuenta-ejercicio-de">de</span>
                      <select
                        aria-label="Mes de inicio"
                        className="mi-cuenta-ejercicio-select mi-cuenta-ejercicio-select--mes"
                        value={d.mes}
                        onChange={(ev) => setDraft(e.id, { mes: Number(ev.target.value) })}
                      >
                        {MESES.map((nombre, i) => (
                          <option key={nombre} value={i + 1}>
                            {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mi-cuenta-empresa-field">
                    <span className="mi-cuenta-ejercicio-label">Fin del ejercicio</span>
                    <div className="mi-cuenta-ejercicio-fin" title="Se calcula automáticamente">
                      <CalendarRange size={14} strokeWidth={2} />
                      {finDelEjercicio(d.mes, diaValido)}
                    </div>
                  </div>
                </div>

                <div className="mi-cuenta-empresa-actions">
                  {okId === e.id && !dirty ? (
                    <span className="mi-cuenta-ejercicio-ok">Guardado</span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void guardarEmpresa(e)}
                    disabled={!dirty || savingId === e.id}
                  >
                    <Save size={15} strokeWidth={2.1} />
                    {savingId === e.id ? "Guardando…" : "Guardar"}
                  </button>
                </div>
                </div>
              </article>
            );
          })}
          {empresasOrdenadas.length === 0 ? (
            <p className="muted">La cuenta no tiene empresas cargadas.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
