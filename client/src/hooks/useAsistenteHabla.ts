import { useCallback, useEffect, useRef, useState } from "react";

const PREFERRED_LANGS = ["es-AR", "es-UY", "es-ES", "es-MX", "es"];

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  for (const lang of PREFERRED_LANGS) {
    const exact = voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;
  }
  const spanish = voices.find((v) => v.lang?.toLowerCase().startsWith("es"));
  return spanish ?? null;
}

export function isAsistenteHablaDisponible(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Limpia texto para que suene natural al leerlo. */
export function textoParaHablar(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[_#>*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

export function useAsistenteHabla() {
  const [soportado] = useState(() => isAsistenteHablaDisponible());
  const [hablando, setHablando] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceReadyRef = useRef(false);

  useEffect(() => {
    if (!soportado) return;

    const markReady = () => {
      voiceReadyRef.current = true;
    };
    markReady();
    window.speechSynthesis.addEventListener("voiceschanged", markReady);
    // Precarga voces en Chrome.
    window.speechSynthesis.getVoices();

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", markReady);
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    };
  }, [soportado]);

  const callar = useCallback(() => {
    if (!soportado) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setHablando(false);
  }, [soportado]);

  const hablar = useCallback(
    (texto: string) => {
      if (!soportado) return;
      const limpia = textoParaHablar(texto);
      if (!limpia) return;

      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(limpia);
      utter.lang = "es-AR";
      utter.rate = 1.02;
      utter.pitch = 1.05;
      utter.volume = 1;

      const voice = pickSpanishVoice();
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang || "es-AR";
      }

      utter.onstart = () => setHablando(true);
      utter.onend = () => {
        utteranceRef.current = null;
        setHablando(false);
      };
      utter.onerror = () => {
        utteranceRef.current = null;
        setHablando(false);
      };

      utteranceRef.current = utter;
      // Chrome a veces necesita un tick tras cancel().
      window.setTimeout(() => {
        try {
          window.speechSynthesis.speak(utter);
        } catch {
          setHablando(false);
        }
      }, 40);
    },
    [soportado]
  );

  return {
    soportado,
    hablando,
    hablar,
    callar,
  };
}
