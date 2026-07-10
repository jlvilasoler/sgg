import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { ExternalLink, Volume2, VolumeX } from "lucide-react";
import { fetchAsistenteConsultar } from "../../api";
import type { AsistenteConsultaResult } from "../../types";
import { useAsistenteHabla } from "../../hooks/useAsistenteHabla";
import { useAsistenteVoz } from "../../hooks/useAsistenteVoz";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import AsistenteAvatar from "../asistente/AsistenteAvatar";
import AsistenteVozButton from "../asistente/AsistenteVozButton";

type Props = {
  apiOnline: boolean;
  onError?: (msg: string) => void;
  onOpenFull?: () => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: AsistenteConsultaResult;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function HomeAsistentePanel({ apiOnline, onError, onOpenFull }: Props) {
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
      text: "¡Hola! Preguntame por indicadores financieros, ganaderos, agrícolas o lechería; stock; RRHH; gastos o dólar.",
    },
  ]);

  const habla = useAsistenteHabla();

  const voz = useAsistenteVoz({
    disabled: enviando || !apiOnline,
    onTranscript: (texto) => setPregunta(texto),
    onError: (msg) => {
      setError(msg);
    },
  });

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
      onError?.(msg);
    } finally {
      setEnviando(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void enviar(pregunta);
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
    <section className="sg-hub-panel home-hub-panel--asistente" aria-label="Asistente en inicio">
      <div className="home-hub-asistente-banner" aria-hidden>
        <span className="home-hub-asistente-banner-orb home-hub-asistente-banner-orb--a" />
        <span className="home-hub-asistente-banner-orb home-hub-asistente-banner-orb--b" />
      </div>

      <div className="home-hub-asistente-board">
        {!apiOnline ? (
          <p className="home-hub-asistente-error" role="status">
            Conectá la API para consultar.
          </p>
        ) : null}

        <div className="home-hub-asistente-chat" role="log" aria-live="polite" ref={listRef}>
          {mensajes.map((m) => (
            <div
              key={m.id}
              className={`home-hub-asistente-msg ${
                m.role === "user" ? "home-hub-asistente-msg--user" : "home-hub-asistente-msg--bot"
              }`}
            >
              {m.role === "assistant" ? (
                <span className="home-hub-asistente-msg-avatar" aria-hidden>
                  <MenuAppIcon id="asistente" className="menu-app-icon-svg" />
                </span>
              ) : null}
              <div className="home-hub-asistente-msg-bubble">
                <p className="home-hub-asistente-msg-text">{m.text}</p>
              </div>
            </div>
          ))}
          {enviando ? (
            <div className="home-hub-asistente-msg home-hub-asistente-msg--bot home-hub-asistente-msg--typing">
              <span className="home-hub-asistente-msg-avatar" aria-hidden>
                <MenuAppIcon id="asistente" className="menu-app-icon-svg" />
              </span>
              <div className="home-hub-asistente-msg-bubble">
                <p className="home-hub-asistente-msg-text">
                  <span className="home-hub-asistente-dots" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                  Consultando…
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="home-hub-asistente-error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="home-hub-asistente-composer" onSubmit={onSubmit}>
          <div className="home-hub-asistente-composer-row">
            {habla.soportado || onOpenFull ? (
              <div className="home-hub-asistente-tools" role="group" aria-label="Opciones del asistente">
                {habla.soportado ? (
                  <button
                    type="button"
                    className={`home-hub-asistente-speak-toggle${hablarActivo ? " is-on" : ""}${habla.hablando ? " is-speaking" : ""}`}
                    onClick={toggleHablar}
                    aria-pressed={hablarActivo}
                    aria-label={hablarActivo ? "Silenciar respuestas" : "Activar voz del asistente"}
                    title={hablarActivo ? "Silenciar respuestas" : "Activar voz del asistente"}
                  >
                    {hablarActivo ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
                  </button>
                ) : null}
                {onOpenFull ? (
                  <button
                    type="button"
                    className="home-hub-asistente-open"
                    onClick={onOpenFull}
                    aria-label="Abrir módulo"
                    title="Abrir módulo"
                  >
                    <ExternalLink size={16} aria-hidden />
                  </button>
                ) : null}
              </div>
            ) : null}
            <AsistenteAvatar
              className="home-hub-asistente-avatar"
              mood={
                enviando ? "thinking" : voz.escuchando ? "listening" : habla.hablando ? "speaking" : "idle"
              }
            />
            <div className="home-hub-asistente-composer-shell">
              <input
                id={inputId}
                type="text"
                className="home-hub-asistente-input"
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
                aria-label="Tu consulta"
              />
              <div className="home-hub-asistente-composer-actions">
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
                    className="home-hub-asistente-voz"
                  />
                ) : null}
                <button
                  type="submit"
                  className="home-hub-asistente-send"
                  disabled={enviando || !apiOnline || !pregunta.trim()}
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
