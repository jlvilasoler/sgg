const EXTENSION_NOISE =
  /contentscript\.js|inpage\.js|provider-bridge\.js|chrome-extension:|moz-extension:|MetaMask extension|Pelagus|MaxListenersExceededWarning|Resetting the streams|Receiving end does not exist/i;

function noiseText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isExtensionNoise(...parts: unknown[]): boolean {
  return EXTENSION_NOISE.test(parts.map(noiseText).join("\n"));
}

/** Evita que errores de extensiones crypto (MetaMask, Pelagus, etc.) rompan la app. */
export function installExtensionNoiseGuard(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    if (isExtensionNoise(event.reason)) {
      event.preventDefault();
    }
  });

  window.addEventListener(
    "error",
    (event) => {
      if (
        isExtensionNoise(event.message, event.filename, event.error) ||
        (event.filename && EXTENSION_NOISE.test(event.filename))
      ) {
        event.preventDefault();
      }
    },
    true
  );

  const nativeWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (isExtensionNoise(...args)) return;
    nativeWarn(...args);
  };
}

export function hasCryptoWalletExtension(): boolean {
  const w = window as Window & { ethereum?: unknown; pelagus?: unknown };
  return Boolean(w.ethereum || w.pelagus);
}
