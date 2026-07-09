import { Sparkles } from "lucide-react";
import HomeLayoutUsersMonitor from "./HomeLayoutUsersMonitor";

interface Props {
  apiOnline: boolean;
  onVolver: () => void;
  volverLabel?: string;
  onError: (msg: string) => void;
}

export default function ConfigHomeLayoutMonitor({
  apiOnline,
  onVolver,
  volverLabel = "Volver a Configuración SAG",
  onError,
}: Props) {
  return (
    <div className="subseccion-panel config-home-layout-monitor">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <section
        className="sg-hub-panel config-home-layout-monitor-card"
        aria-labelledby="config-home-layout-monitor-title"
      >
        <div className="sg-hub-panel-head config-home-layout-monitor-head">
          <div>
            <p className="sg-hub-panel-kicker">Plataforma SAG · Control</p>
            <h2 id="config-home-layout-monitor-title" className="sg-hub-panel-title">
              Monitor de usuarios
            </h2>
            <p className="config-home-layout-monitor-lead muted">
              Supervisá cómo tiene configurado el <strong>Inicio</strong> cada usuario: bloques
              visibles, orden y si personalizó su pantalla respecto al perfil asignado.
            </p>
          </div>
          <div className="config-home-layout-monitor-head-badge" aria-hidden>
            <Sparkles size={20} />
          </div>
        </div>

        <HomeLayoutUsersMonitor apiOnline={apiOnline} onError={onError} />
      </section>
    </div>
  );
}
