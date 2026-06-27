import * as XLSX from "xlsx";
import type { Presupuesto } from "../types";
import { empresaCorta, fmtDate, fmtNum } from "../utils";

const EXPORT_HEADERS = [
  "N°",
  "Emp.",
  "Fecha",
  "Cód.",
  "Razón",
  "Concepto",
  "Fact.",
  "$ UYU",
  "USD",
  "R$",
  "TOTAL USD",
] as const;

function filaExport(r: Presupuesto): Record<(typeof EXPORT_HEADERS)[number], string | number> {
  return {
    "N°": r.nro_registro,
    "Emp.": empresaCorta(r.empresa),
    Fecha: fmtDate(r.fecha),
    "Cód.": r.codigo_proveedor ?? "",
    Razón: r.razon_social_proveedor ?? "",
    Concepto: r.concepto ?? "",
    "Fact.": r.nro_factura ?? "",
    "$ UYU": Number(r.pesos) || 0,
    USD: Number(r.dolares_usd) || 0,
    "R$": Number(r.reales) || 0,
    "TOTAL USD": Number(r.saldo_usd) || 0,
  };
}

function nombreArchivo(extension: "xlsx" | "pdf" | "csv"): string {
  const hoy = new Date().toISOString().slice(0, 10);
  return `historial-operaciones-${hoy}.${extension}`;
}

function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportPresupuestoListadoExcel(rows: Presupuesto[]): Promise<void> {
  const data = rows.map(filaExport);
  const ws = XLSX.utils.json_to_sheet(data, { header: [...EXPORT_HEADERS] });
  ws["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 28 },
    { wch: 22 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Operaciones");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  descargarBlob(blob, nombreArchivo("xlsx"));
}

export async function exportPresupuestoListadoCsv(rows: Presupuesto[]): Promise<void> {
  const data = rows.map(filaExport);
  const ws = XLSX.utils.json_to_sheet(data, { header: [...EXPORT_HEADERS] });
  const csv = `\uFEFF${XLSX.utils.sheet_to_csv(ws)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  descargarBlob(blob, nombreArchivo("csv"));
}

export async function exportPresupuestoListadoPdf(
  rows: Presupuesto[],
  subtitulo?: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text("Historial de operaciones", 14, 14);
  if (subtitulo) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(subtitulo, 14, 20);
    doc.setTextColor(0);
  }

  const body = rows.map((r) => {
    const f = filaExport(r);
    return EXPORT_HEADERS.map((h) => {
      const v = f[h];
      if (h === "$ UYU" || h === "USD" || h === "R$" || h === "TOTAL USD") {
        return fmtNum(Number(v));
      }
      return String(v ?? "");
    });
  });

  autoTable(doc, {
    head: [[...EXPORT_HEADERS]],
    body,
    startY: subtitulo ? 24 : 18,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [45, 90, 61], textColor: 255 },
    columnStyles: {
      0: { halign: "right", cellWidth: 12 },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
    },
    margin: { left: 10, right: 10 },
  });

  doc.save(nombreArchivo("pdf"));
}
