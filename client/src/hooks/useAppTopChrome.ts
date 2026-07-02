import { useEffect } from "react";

function applyAppTopChrome(bottomPx: number) {
  const value = `${bottomPx}px`;
  document.documentElement.style.setProperty("--app-top-chrome", value);
  document.querySelector<HTMLElement>(".app-shell")?.style.setProperty("--app-top-chrome", value);
}

function measureAppTopChrome() {
  const chrome = document.getElementById("app-chrome-top");
  if (chrome) {
    applyAppTopChrome(chrome.getBoundingClientRect().bottom);
    return;
  }

  const header = document.querySelector<HTMLElement>(".main-header");
  if (header) {
    applyAppTopChrome(header.getBoundingClientRect().bottom);
  }
}

export function useAppTopChrome(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measureAppTopChrome());
    };

    scheduleMeasure();

    const chrome = document.getElementById("app-chrome-top");
    if (!chrome) return;

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(chrome);

    const header = chrome.querySelector<HTMLElement>(".main-header");
    if (header) resizeObserver.observe(header);

    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(chrome, { childList: true, subtree: true, attributes: true });

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("load", scheduleMeasure);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("load", scheduleMeasure);
    };
  }, [enabled]);
}
