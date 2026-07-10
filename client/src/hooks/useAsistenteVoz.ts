import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isAsistenteVozDisponible(): boolean {
  return getSpeechRecognitionCtor() != null;
}

function isLikelyEdge(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Edg\//.test(ua) || /Edge\//.test(ua);
}

function mensajeErrorVoz(code: string): string | null {
  switch (code) {
    case "aborted":
    case "no-speech":
      return null;
    case "audio-capture":
      return "No hay micrófono disponible o está en uso por otra app.";
    case "not-allowed":
    case "service-not-allowed":
      return "Permití el micrófono en el candado de la barra de dirección.";
    case "network":
      if (isLikelyEdge()) {
        return "El dictado falla en Edge. Abrí SAG en Google Chrome para usar la voz.";
      }
      return "El servicio de voz del navegador no respondió (no es tu Wi‑Fi). Probá en Google Chrome o escribí la pregunta.";
    case "language-not-supported":
      return "Este navegador no tiene dictado en español. Probá en Chrome.";
    default:
      return null;
  }
}

type Options = {
  lang?: string;
  disabled?: boolean;
  onTranscript: (texto: string) => void;
  onError?: (msg: string) => void;
};

/**
 * Toggle de dictado:
 * 1er toque → abre micrófono y queda escuchando
 * 2º toque → corta y deja el texto listo
 */
export function useAsistenteVoz({
  lang = "es-AR",
  disabled = false,
  onTranscript,
  onError,
}: Options) {
  const [escuchando, setEscuchando] = useState(false);
  const [soportado] = useState(() => isAsistenteVozDisponible());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const stoppingRef = useRef(false);
  const finalTextRef = useRef("");
  const gotResultRef = useRef(false);
  const networkRetryRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const sessionRef = useRef(0);
  const busyToggleRef = useRef(false);
  const langRef = useRef(lang);
  const disabledRef = useRef(disabled);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const forceStop = useCallback(() => {
    stoppingRef.current = true;
    activeRef.current = false;
    sessionRef.current += 1;
    clearRestartTimer();
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
    }
    setEscuchando(false);
  }, [clearRestartTimer]);

  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled && activeRef.current) forceStop();
  }, [disabled, forceStop]);

  useEffect(() => {
    return () => forceStop();
  }, [forceStop]);

  const startRecognition = useCallback(
    (Ctor: SpeechRecognitionCtor, speechLang: string, sessionId: number) => {
      if (sessionRef.current !== sessionId || stoppingRef.current || disabledRef.current) {
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
        recognitionRef.current = null;
      }

      const recognition = new Ctor();
      recognition.lang = speechLang;
      // continuous=false + reinicio: más estable en Chrome; el botón sigue “apretado”.
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        if (sessionRef.current !== sessionId) return;
        gotResultRef.current = true;
        let interim = "";
        let finals = finalTextRef.current;
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i][0]?.transcript ?? "";
          if (event.results[i].isFinal) finals += `${piece} `;
          else interim += piece;
        }
        finalTextRef.current = finals;
        const preview = `${finals}${interim}`.trim();
        if (preview) onTranscriptRef.current(preview);
      };

      recognition.onerror = (event) => {
        if (sessionRef.current !== sessionId) return;
        const code = event.error ?? "";
        if (stoppingRef.current || code === "aborted") return;

        if (code === "network" && !networkRetryRef.current && activeRef.current) {
          networkRetryRef.current = true;
          try {
            recognition.onend = null;
            recognition.abort();
          } catch {
            /* ignore */
          }
          recognitionRef.current = null;
          clearRestartTimer();
          restartTimerRef.current = window.setTimeout(() => {
            restartTimerRef.current = null;
            if (sessionRef.current !== sessionId || !activeRef.current || stoppingRef.current) {
              return;
            }
            try {
              startRecognition(Ctor, "es", sessionId);
            } catch {
              forceStop();
              onErrorRef.current?.(mensajeErrorVoz("network"));
            }
          }, 180);
          return;
        }

        if (code === "no-speech") return;

        const msg = mensajeErrorVoz(code);
        if (msg && !gotResultRef.current) onErrorRef.current?.(msg);
        forceStop();
      };

      recognition.onend = () => {
        if (sessionRef.current !== sessionId) return;
        recognitionRef.current = null;
        const limpia = finalTextRef.current.trim();
        if (limpia) onTranscriptRef.current(limpia);

        if (stoppingRef.current || !activeRef.current || disabledRef.current) {
          activeRef.current = false;
          setEscuchando(false);
          return;
        }

        // Seguir escuchando hasta el 2º toque.
        clearRestartTimer();
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (sessionRef.current !== sessionId || !activeRef.current || stoppingRef.current) {
            return;
          }
          try {
            startRecognition(Ctor, speechLang, sessionId);
          } catch {
            forceStop();
            onErrorRef.current?.("Se cortó el micrófono. Tocá Voz de nuevo.");
          }
        }, 160);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setEscuchando(true);
    },
    [clearRestartTimer, forceStop],
  );

  const iniciar = useCallback(() => {
    if (disabled || !soportado || activeRef.current) return false;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.("Tu navegador no soporta dictado por voz. Usá Google Chrome.");
      return false;
    }

    if (isLikelyEdge()) {
      onErrorRef.current?.(
        "En Edge el dictado suele fallar. Abrí SAG en Google Chrome para usar la voz.",
      );
      return false;
    }

    networkRetryRef.current = false;
    finalTextRef.current = "";
    gotResultRef.current = false;
    stoppingRef.current = false;
    activeRef.current = true;
    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;
    setEscuchando(true);

    try {
      startRecognition(Ctor, langRef.current || "es-AR", sessionId);
      return true;
    } catch {
      forceStop();
      onErrorRef.current?.("No se pudo iniciar el micrófono. Esperá un segundo y reintentá.");
      return false;
    }
  }, [disabled, forceStop, soportado, startRecognition]);

  const detener = useCallback(() => {
    const texto = finalTextRef.current.trim();
    forceStop();
    if (texto) onTranscriptRef.current(texto);
    return texto;
  }, [forceStop]);

  const toggle = useCallback(() => {
    if (busyToggleRef.current) return { action: "noop" as const, texto: "" };
    busyToggleRef.current = true;
    window.setTimeout(() => {
      busyToggleRef.current = false;
    }, 280);

    if (escuchando || activeRef.current) {
      const texto = detener();
      return { action: "stop" as const, texto };
    }
    const ok = iniciar();
    return { action: ok ? ("start" as const) : ("noop" as const), texto: "" };
  }, [detener, escuchando, iniciar]);

  return {
    soportado,
    escuchando,
    iniciar,
    detener,
    toggle,
  };
}
