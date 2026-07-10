import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { fetchAsistenteConsultar } from "../../api";
import type { AsistenteConsultaResult, AuthUser } from "../../types";
import { useAsistenteHabla } from "../../hooks/useAsistenteHabla";
import { useAsistenteVoz } from "../../hooks/useAsistenteVoz";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import SgHubShell from "../hub/SgHubShell";
import type { SgHubItem } from "../hub/SgHubTypes";
import type { HubIconId } from "../icons/HubMenuIcons";
import AsistenteVozButton from "./AsistenteVozButton";

type Props = {
  apiOnline: boolean;
  currentUser: AuthUser;
  onVolver: () => void;
  onError: (msg: string) => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: AsistenteConsultaResult;
};

type QuickNav = {
  id: string;
  label: string;
  subtitle: string;
  icon: HubIconId;
  pregunta: string;
};

const QUICK_NAV: QuickNav[] = [
  {
    id: "financieros",
    label: "Financieros",
    subtitle: "Estado de resultados",
    icon: "presupuesto_automatizacion",
    pregunta: "¿Cómo están los indicadores financieros?",
  },
  {
    id: "ganaderos",
    label: "Ganaderos",
    subtitle: "Stock e indicadores",
    icon: "stock_lecturas",
    pregunta: "¿Cómo están los indicadores ganaderos?",
  },
  {
    id: "agricolas",
    label: "Agrícolas",
    subtitle: "Zafra y rendimiento",
    icon: "ventas_ganado",
    pregunta: "¿Cómo va la agricultura?",
  },
  {
    id: "lecheria",
    label: "Lechería",
    subtitle: "Indicadores de tambo",
    icon: "divisas_usd",
    pregunta: "¿Qué indicadores de lechería se usan?",
  },
  {
    id: "gastos",
    label: "Gastos del mes",
    subtitle: "Total del mes actual",
    icon: "presupuesto_automatizacion",
    pregunta: "¿Cuánto gasté este mes?",
  },
  {
    id: "divisas",
    label: "Dólar",
    subtitle: "Cotización USD",
    icon: "divisas_usd",
    pregunta: "¿A cuánto está el dólar?",
  },
];

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Asistente({ apiOnline, currentUser: _currentUser, onVolver, onError }: Props) {
  const inputId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hablarActivo, setHablarActivo] = useState(true);
  const [mensajes, setMensajes] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hola. Preguntame por indicadores financieros, ganaderos, agrícolas o lechería; stock; mapa; RRHH; gastos o cotizaciones.",
    },
  ]);
  const [activeId, setActiveId] = useState("chat");

  const habla = useAsistenteHabla();

  const voz = useAsistenteVoz({
    disabled: enviando || !apiOnline,
    onTranscript: (texto) => setPregunta(texto),
    onError: (msg) => {
      setError(msg);
    },
  });

  const hubItems: SgHubItem[] = useMemo(
    () => [
      {
        id: "chat",
        label: "Consultas",
        subtitle: "Escribí tu pregunta",
        icon: "config_admin_cuenta",
      },
      ...QUICK_NAV.map((item) => ({
        id: item.id,
        label: item.label,
        subtitle: item.subtitle,
        icon: item.icon,
      })),
    ],
    []
  );

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mensajes, enviando]);

  useEffect(() => {
    return () => habla.callar();
  }, [habla.callar]);

  async function enviar(texto: string) {
    const limpia = texto.trim();
    if (!limpia || enviando || !apiOnline) return;

    voz.detener();
    habla.callar();
    setError(null);
    setPregunta("");
    setMensajes((prev) => [...prev, { id: newId(), role: "user", text: limpia }]);
    setEnviando(true);

    try {
      const result = await fetchAsistenteConsultar(limpia);
      setMensajes((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text: result.respuesta,
          result,
        },
      ]);
      if (hablarActivo && habla.soportado) {
        habla.hablar(result.respuesta);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo consultar al asistente.";
      setError(msg);
      onError(msg);
    } finally {
      setEnviando(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void enviar(pregunta);
  }

  function onNavigate(id: string) {
    setActiveId(id);
    if (id === "chat") return;
    const quick = QUICK_NAV.find((item) => item.id === id);
    if (quick) void enviar(quick.pregunta);
  }

  function toggleHablar() {
    if (hablarActivo) {
      habla.callar();
      setHablarActivo(false);
      return;
    }
    setHablarActivo(true);
  }

  return (
    <div className="sg-module-page asistente-module-page">
      <SgHubShell
        activeId={activeId}
        items={hubItems}
        onNavigate={onNavigate}
        onVolverDashboard={() => setActiveId("chat")}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title="Consultas"
        subtitle="Respuestas con datos reales de tu cuenta. Sin costo de IA externa."
        asideKicker="SAG · Consultas"
        asideTitle="Asistente"
        asideLogo={<MenuAppIcon id="asistente" />}
        navAriaLabel="Consultas del asistente"
        showDashboardInNav={false}
        hubClassName="asistente-hub"
      >
        <div className="asistente-panel">
          <header className="asistente-panel-head asistente-panel-head--row">
            <div>
              <h2 className="asistente-panel-title">Consultas</h2>
              <p className="asistente-panel-sub">
                Respuestas con datos reales de tu cuenta. Sin costo de IA externa.
              </p>
            </div>
            {habla.soportado ? (
              <button
                type="button"
                className={`asistente-speak-toggle${hablarActivo ? " is-on" : ""}${habla.hablando ? " is-speaking" : ""}`}
                onClick={toggleHablar}
                aria-pressed={hablarActivo}
                title={hablarActivo ? "Silenciar respuestas" : "Activar voz del asistente"}
              >
                {hablarActivo ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
                <span>{hablarActivo ? (habla.hablando ? "Hablando…" : "Habla") : "Mudo"}</span>
              </button>
            ) : null}
          </header>

          {!apiOnline ? (
            <p className="asistente-error" role="status">
              Conectá la API para consultar al asistente.
            </p>
          ) : null}

          <div className="asistente-chat" role="log" aria-live="polite" ref={listRef}>
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`asistente-msg ${m.role === "user" ? "asistente-msg--user" : "asistente-msg--bot"}`}
              >
                <p className="asistente-msg-text">{m.text}</p>
              </div>
            ))}
            {enviando ? (
              <div className="asistente-msg asistente-msg--bot asistente-msg--typing">
                <p className="asistente-msg-text">Consultando…</p>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="asistente-error" role="alert">
              {error}
            </p>
          ) : null}

          <form className="asistente-composer" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor={inputId}>
              Pregunta
            </label>
            <input
              id={inputId}
              type="text"
              className="asistente-input"
              data-sin-mayusculas
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              placeholder={
                voz.escuchando
                  ? "Escuchando… tocá Listo cuando termines"
                  : "Escribí o tocá Voz…"
              }
              disabled={enviando || !apiOnline}
              autoComplete="off"
            />
            {voz.soportado ? (
              <AsistenteVozButton
                escuchando={voz.escuchando}
                disabled={enviando || !apiOnline}
                onToggle={() => {
                  setError(null);
                  if (!voz.escuchando) {
                    habla.callar();
                    const result = voz.toggle();
                    if (result.action === "start") setPregunta("");
                    return;
                  }
                  const result = voz.toggle();
                  const texto = (result.texto || pregunta).trim();
                  if (texto) void enviar(texto);
                }}
              />
            ) : null}
            <button
              type="submit"
              className="asistente-send"
              disabled={enviando || !apiOnline || !pregunta.trim()}
            >
              Enviar
            </button>
          </form>
        </div>
      </SgHubShell>
    </div>
  );
}
