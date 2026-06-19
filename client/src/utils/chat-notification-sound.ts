let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

/** Sonido corto tipo notificación (Web Audio API, sin archivo externo). */
export function playChatNotificationSound(): void {
  const now = Date.now();
  if (now - lastPlayedAt < 1200) return;
  lastPlayedAt = now;

  try {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();

    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.setValueAtTime(1174, t0 + 0.07);
    osc.frequency.setValueAtTime(880, t0 + 0.14);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  } catch {
    /* navegador sin audio o sin gesto previo del usuario */
  }
}
