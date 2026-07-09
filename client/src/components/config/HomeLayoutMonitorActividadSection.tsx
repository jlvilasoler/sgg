import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { fetchAuthActividad } from "../../api";
import type { AuthActividadLog } from "../../types";
import { formatActividadDetalle } from "../../utils/format-actividad-detalle";

interface Props {
  apiOnline: boolean;
  email: string;
  onError: (msg: string) => void;
}

const EVENTO_LABELS: Record<string, string> = {
  login_ok: "Inicio de sesión",
  logout: "Cierre de sesión",
  navegacion: "Navegación",
  accion: "Acción",
};

function fmtFecha(iso: string): string {
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelEvento(evento: string): string {
  return EVENTO_LABELS[evento] ?? evento.replace(/_/g, " ");
}

export default function HomeLayoutMonitorActividadSection({
  apiOnline,
  email,
  onError,
}: Props) {
  const [items, setItems] = useState<AuthActividadLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!apiOnline || !email.trim()) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchAuthActividad({
      email: email.trim(),
      ambito: "total",
      limite: 40,
    })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((e) => {
        if (cancelled) return;
        onError(e instanceof Error ? e.message : "Error al cargar actividad del usuario");
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiOnline, email, onError]);

  return (
    <section
      className="home-layout-users-monitor-extra home-layout-users-monitor-actividad"
      aria-labelledby="home-layout-monitor-actividad-title"
    >
      <header className="home-layout-users-monitor-extra-head">
        <div>
          <p className="sg-hub-panel-kicker">Auditoría</p>
          <h4 id="home-layout-monitor-actividad-title">
            <Activity size={16} aria-hidden />
            Actividades recientes
          </h4>
          <p className="muted">
            Últimas acciones registradas de este usuario en la plataforma.
          </p>
        </div>
        {!loading ? (
          <span className="home-layout-users-monitor-extra-count muted">
            {total > items.length ? `${items.length} de ${total}` : `${items.length}`} eventos
          </span>
        ) : null}
      </header>

      {loading ? (
        <p className="home-layout-users-monitor-empty muted">Cargando actividad…</p>
      ) : items.length === 0 ? (
        <p className="home-layout-users-monitor-empty muted">
          Sin actividad registrada para este usuario.
        </p>
      ) : (
        <ul className="home-layout-users-monitor-actividad-list">
          {items.map((row) => (
            <li key={row.id} className="home-layout-users-monitor-actividad-item">
              <span className="home-layout-users-monitor-actividad-fecha muted">
                {fmtFecha(row.creado_en)}
              </span>
              <span className="home-layout-users-monitor-actividad-tipo">
                {labelEvento(row.evento)}
              </span>
              <span className="home-layout-users-monitor-actividad-detalle">
                {formatActividadDetalle(row.detalle, row.evento)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
