import type { ContribucionRuralJurisdiccionConfig } from "../types/contribucion-rural";
import type { RegimenPrimariaRuralKey } from "../types/primaria-rural";
import { REGIMEN_PRIMARIA_RURAL_LABEL } from "../types/primaria-rural";
import { SEMAFORO_VENCIMIENTO_LABEL, diasRestantesLabel } from "./contribucion-rural-common";
import type { TipoImpuestoVenc } from "./vencimientos-impuestos-total";

export interface VencImpAsideInfoContext {
  tipoImpuesto: TipoImpuestoVenc;
  ruralListo: boolean;
  patenteListo: boolean;
  bpsListo: boolean;
  primariaListo: boolean;
  personalizadoListo?: boolean;
  personalizadosCount?: number;
  configsCuenta: ContribucionRuralJurisdiccionConfig[];
  patenteAnio?: number;
  bpsAnio?: number;
  primariaAnio?: number;
  regimenPrimaria: RegimenPrimariaRuralKey;
  djPrimaria?: { fechaLabel: string; diasRestantes: number } | null;
}

/** Texto compacto para el tip «i» del lateral (contexto del vencimiento activo). */
export function buildVencImpAsideInfoText(ctx: VencImpAsideInfoContext): string {
  const lines: string[] = [];
  const { tipoImpuesto } = ctx;

  if (tipoImpuesto === "total") {
    lines.push(
      "Vista total: todos los vencimientos configurados en una sola línea de tiempo, del más cercano al más lejano.",
    );
    const incluidos: string[] = [];
    if (ctx.ruralListo) {
      incluidos.push(
        ctx.configsCuenta.length > 0
          ? `Contribución rural (${ctx.configsCuenta.map((c) => c.label).join(", ")})`
          : "Contribución rural",
      );
    }
    if (ctx.patenteListo) incluidos.push("Patente SUCIVE");
    if (ctx.bpsListo) incluidos.push("BPS Caja rural");
    if (ctx.primariaListo) incluidos.push("Primaria (DGI)");
    if (ctx.personalizadoListo && (ctx.personalizadosCount ?? 0) > 0) {
      incluidos.push(`Personalizado (${ctx.personalizadosCount})`);
    }
    if (incluidos.length > 0) lines.push(`Incluye: ${incluidos.join(" · ")}`);
  } else if (tipoImpuesto === "rural") {
    lines.push("Contribución rural: vencimientos por departamento según la modalidad de la cuenta.");
    if (ctx.configsCuenta.length > 0) {
      lines.push(`Departamentos: ${ctx.configsCuenta.map((c) => c.label).join(", ")}.`);
    }
  } else if (tipoImpuesto === "patente") {
    lines.push("Patente SUCIVE: calendario nacional de patente de rodados.");
    if (ctx.patenteAnio != null) lines.push(`Ejercicio ${ctx.patenteAnio}.`);
  } else if (tipoImpuesto === "bps") {
    lines.push("BPS Caja rural: aportes de seguridad social del personal rural.");
    if (ctx.bpsAnio != null) lines.push(`Ejercicio ${ctx.bpsAnio}.`);
  } else if (tipoImpuesto === "primaria") {
    lines.push(
      "Primaria rural (DGI): impuesto de Enseñanza Primaria sobre padrones rurales (tres cuotas anuales).",
    );
    lines.push(`Régimen: ${REGIMEN_PRIMARIA_RURAL_LABEL[ctx.regimenPrimaria]}.`);
    if (ctx.djPrimaria && ctx.djPrimaria.diasRestantes >= 0) {
      lines.push(
        `Declaración jurada: ${ctx.djPrimaria.fechaLabel} (${diasRestantesLabel(ctx.djPrimaria.diasRestantes)}).`,
      );
    }
    if (ctx.primariaAnio != null) lines.push(`Calendario nacional ${ctx.primariaAnio}.`);
  } else if (tipoImpuesto === "personalizado") {
    lines.push(
      "Personalizado: préstamos y otros pagos con fechas definidas por la cuenta (entidad, tasa, cuotas).",
    );
    lines.push(
      `${ctx.personalizadosCount ?? 0} ${(ctx.personalizadosCount ?? 0) === 1 ? "pago" : "pagos"} registrado${(ctx.personalizadosCount ?? 0) === 1 ? "" : "s"}.`,
    );
  }

  lines.push(
    `Semáforo: rojo = Próximo · amarillo = A preparar · verde = ${SEMAFORO_VENCIMIENTO_LABEL.verde}.`,
  );

  return lines.join("\n\n");
}
