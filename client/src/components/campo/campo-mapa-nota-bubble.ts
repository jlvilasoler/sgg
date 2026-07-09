import L from "leaflet";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function notaBubbleDisplayText(nombre: string, notas: string): string {
  const note = notas.trim();
  if (note) return note;
  const name = nombre.trim();
  if (name && name.toLowerCase() !== "nota") return name;
  return "Nota";
}

function estimateBubbleSize(text: string): { width: number; height: number } {
  const displayText = text.trim() || "Nota";
  const maxCharsPerLine = 28;
  const lineCount = Math.min(
    5,
    Math.max(1, Math.ceil(displayText.length / maxCharsPerLine)),
  );
  const width = Math.min(220, Math.max(76, Math.min(displayText.length, maxCharsPerLine) * 6.8 + 22));
  const height = 14 + lineCount * 15 + 10;
  return { width, height };
}

export function createCampoMapaNotaBubbleIcon(
  color: string,
  nombre: string,
  notas: string,
  selected = false,
  placeholder = false,
): L.DivIcon {
  const displayText = placeholder ? "Escribí tu nota…" : notaBubbleDisplayText(nombre, notas);
  const { width, height } = estimateBubbleSize(displayText);
  const tailHeight = 8;
  const totalHeight = height + tailHeight;

  return L.divIcon({
    className: `campo-mapa-nota-bubble-leaflet${selected ? " is-selected" : ""}${
      placeholder ? " is-placeholder" : ""
    }`,
    html: `<div class="campo-mapa-nota-bubble" style="--nota-color: ${color}">
      <div class="campo-mapa-nota-bubble-body">
        <span class="campo-mapa-nota-bubble-text">${escapeHtml(displayText)}</span>
      </div>
      <span class="campo-mapa-nota-bubble-tail" aria-hidden="true"></span>
    </div>`,
    iconSize: [width, totalHeight],
    iconAnchor: [width / 2, totalHeight],
    popupAnchor: [0, -totalHeight + 4],
  });
}
