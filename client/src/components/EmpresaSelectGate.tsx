import { useEffect, useState } from "react";
import { Building2, LogOut } from "lucide-react";
import { fetchMisEmpresas, seleccionarEmpresaActiva } from "../api";
import type { AuthUser, EmpresaOperativa } from "../types";

interface Props {
  user: AuthUser;
  apiOnline: boolean;
  onSelected: (user: AuthUser) => void;
  onError: (msg: string) => void;
  onLogout: () => void;
}

export default function EmpresaSelectGate({
  user,
  apiOnline,
  onSelected,
  onError,
  onLogout,
}: Props) {
  const [empresas, setEmpresas] = useState<EmpresaOperativa[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<number | null>(null);

  const elegir = async (empresa: EmpresaOperativa) => {
    if (selecting != null) return;
    setSelecting(empresa.id);
    try {
      const actualizado = await seleccionarEmpresaActiva(empresa.id);
      onSelected(actualizado);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo seleccionar la empresa");
      setSelecting(null);
    }
  };

  useEffect(() => {
    let cancel = false;
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMisEmpresas()
      .then((data) => {
        if (cancel) return;
        setEmpresas(data);
        // Con una sola empresa no tiene sentido preguntar: entramos directo.
        if (data.length === 1) void elegir(data[0]);
      })
      .catch((e) => {
        if (!cancel) onError(e instanceof Error ? e.message : "No se pudieron cargar las empresas");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiOnline, onError]);

  return (
    <div className="empresa-gate">
      <div className="empresa-gate-card">
        <div className="empresa-gate-head">
          <span className="empresa-gate-icon" aria-hidden="true">
            <Building2 size={22} strokeWidth={2.1} />
          </span>
          <div>
            <h1 className="empresa-gate-title">Elegí una empresa</h1>
            <p className="empresa-gate-sub">
              Hola {user.nombre}. Seleccioná con qué empresa de tu cuenta querés operar en
              esta sesión.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="muted empresa-gate-loading">Cargando empresas…</p>
        ) : empresas.length === 0 ? (
          <p className="muted empresa-gate-loading">
            No hay empresas activas en tu cuenta. Contactá al administrador.
          </p>
        ) : (
          <div className="empresa-gate-list">
            {empresas.map((e) => (
              <button
                key={e.id}
                type="button"
                className="empresa-gate-item"
                onClick={() => void elegir(e)}
                disabled={selecting != null}
              >
                <span
                  className="empresa-gate-dot"
                  style={{ background: e.color || "#94a3b8" }}
                  aria-hidden="true"
                />
                <span className="empresa-gate-item-text">
                  <strong>{e.nombre}</strong>
                  <span className="muted">{e.codigo}</span>
                </span>
                {selecting === e.id ? (
                  <span className="muted empresa-gate-item-loading">Entrando…</span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        <button type="button" className="empresa-gate-logout" onClick={onLogout}>
          <LogOut size={15} strokeWidth={2} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
