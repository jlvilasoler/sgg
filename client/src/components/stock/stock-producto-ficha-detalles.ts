export interface DetalleTecnicoSection {
  title: string;
  items: string[];
}

/** Agrupa texto libre de detalles técnicos en secciones legibles (composición, dosis, etc.). */
export function parseDetallesTecnicos(text: string): DetalleTecnicoSection[] {
  const raw = String(text ?? "").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sections: DetalleTecnicoSection[] = [];
  let current: DetalleTecnicoSection | null = null;

  const pushCurrent = () => {
    if (current && current.items.length > 0) sections.push(current);
    current = null;
  };

  for (const line of lines) {
    if (/^producto\s*:/i.test(line)) continue;

    const isBullet = /^[•\-–]\s/.test(line);
    const isHeader =
      !isBullet &&
      (line.endsWith(":") ||
        /^[A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s]+—/.test(line) ||
        /^(composición|anacultivos|excipientes|indicaciones|dosificación|contraindicaciones|almacenamiento)/i.test(
          line,
        ));

    if (isHeader) {
      pushCurrent();
      current = {
        title: line.replace(/:$/, "").trim(),
        items: [],
      };
      continue;
    }

    if (!current) current = { title: "Información", items: [] };
    current.items.push(line.replace(/^[•\-–]\s*/, "").trim());
  }

  pushCurrent();
  return sections;
}

export function defaultOpenDetalleSections(sections: DetalleTecnicoSection[]): Set<number> {
  const open = new Set<number>();
  sections.forEach((s, i) => {
    const t = s.title.toLowerCase();
    if (
      t.includes("indicacion") ||
      t.includes("dosific") ||
      t.includes("almacen") ||
      t.includes("información") ||
      t.includes("informacion")
    ) {
      open.add(i);
    }
  });
  if (open.size === 0 && sections.length > 0) {
    open.add(sections.length - 1);
  }
  return open;
}
