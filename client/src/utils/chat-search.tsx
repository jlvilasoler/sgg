import type { ReactNode } from "react";

export function resaltarTexto(texto: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return texto;
  const lower = texto.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return texto;
  const before = texto.slice(0, idx);
  const match = texto.slice(idx, idx + needle.length);
  const after = texto.slice(idx + needle.length);
  return (
    <>
      {before}
      <mark className="chat-search-mark">{match}</mark>
      {after}
    </>
  );
}

export function truncarConHighlight(texto: string, query: string, max = 120): ReactNode {
  const t = texto.trim();
  const q = query.trim();
  if (!q) return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
  const lower = t.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
  const start = Math.max(0, idx - 24);
  const slice = t.slice(start, start + max);
  const prefix = start > 0 ? "…" : "";
  const suffix = start + max < t.length ? "…" : "";
  return (
    <>
      {prefix}
      {resaltarTexto(slice, q)}
      {suffix}
    </>
  );
}
