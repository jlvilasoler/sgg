import type { Db } from "./db/pg-client.js";
import * as authDb from "./auth-db.js";

/** Acciones visibles en «Últimos guardados» del Inicio (cargas y cambios de la cuenta). */
export function isHomeFeedActivity(detalle: string | null | undefined, evento: string): boolean {
  if (evento !== "accion") return false;
  const d = (detalle ?? "").trim().toLowerCase();
  if (!d) return false;

  if (d.includes("nota compartida")) return true;
  if (d.includes("gasto")) return true;
  if (d.includes("presupuesto")) return true;
  if (d.includes("stock ganadero") || d.includes("stock equino")) return true;
  if (d.includes("funcionario")) return true;
  if (d.includes("recursos humanos")) return true;
  if (d.includes("ingreso por venta")) return true;
  if (d.includes("venta de agricultura")) return true;
  if (d.includes("arrendamiento")) return true;
  if (d.includes("sueldo") || d.includes("jornal")) return true;

  return false;
}

export async function listHomeFeedActivity(
  db: Db,
  filters: authDb.AuthAuditLogFilters,
  limite: number
): Promise<authDb.AuthAuditLogPage> {
  const target = Math.min(20, Math.max(1, limite));
  const batch = 40;
  const maxScan = 400;
  const collected: authDb.AuthAuditLogRow[] = [];
  let offset = 0;

  while (collected.length < target && offset < maxScan) {
    const page = await authDb.listAuthAuditLog(db, {
      ...filters,
      evento: "accion",
      limite: batch,
      offset,
    });
    for (const row of page.rows) {
      if (isHomeFeedActivity(row.detalle, row.evento)) {
        collected.push(row);
        if (collected.length >= target) break;
      }
    }
    if (page.rows.length < batch) break;
    offset += batch;
  }

  return {
    rows: collected,
    total: collected.length,
    resumen: {
      total: collected.length,
      logins: 0,
      navegacion: 0,
      acciones: collected.length,
    },
  };
}
