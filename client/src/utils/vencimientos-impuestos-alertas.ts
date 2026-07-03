import type { ModalidadPagoVencImp } from "../types/contribucion-rural";
import type { RegimenPrimariaRuralKey } from "../types/primaria-rural";
import {
  cuotasFuturasCuentaRural,
  planCuotasGuardado,
  vistaCalendarioParaUsuario,
} from "./contribucion-rural-view";
import { patenteComoCalendarioConfig } from "./patente-sucive-view";
import { bpsComoCalendarioConfig } from "./bps-caja-rural-view";
import { primariaComoCalendarioConfig } from "./primaria-rural-view";
import {
  diasHastaVencimientoCuota,
  formatearFechaContribucionRural,
  parseFechaLocal,
  semaforoVencimientoCuota,
} from "./contribucion-rural-common";
import { consolidarCuotasVencimientos } from "./vencimientos-impuestos-total";
import type { VencimientosImpuestosBootstrap } from "./vencimientos-impuestos-cache";

export interface VencImpLoginAlertItem {
  impuestoLabel: string;
  titulo: string;
  fechaLabel: string;
  diasRestantes: number;
  cuotaLabel: string;
}

export interface VencImpLoginAlert {
  totalProximos: number;
  items: VencImpLoginAlertItem[];
}

function cuotasNacionalesFuturas(
  config: ReturnType<typeof patenteComoCalendarioConfig> | null,
  modalidad: ModalidadPagoVencImp,
) {
  if (!config) return [];
  const vista = vistaCalendarioParaUsuario(config, modalidad);
  const out: Array<{
    cuota: number;
    fecha: string;
    fechaLabel: string;
    planLabel: string;
    diasRestantes: number;
  }> = [];
  for (const item of vista.cuotas) {
    const dias = diasHastaVencimientoCuota(item.fecha);
    if (dias < 0) continue;
    out.push({
      cuota: item.cuota,
      fecha: item.fecha,
      fechaLabel: formatearFechaContribucionRural(item.fecha),
      planLabel: vista.tituloPlan,
      diasRestantes: dias,
    });
  }
  return out.sort(
    (a, b) => parseFechaLocal(a.fecha).getTime() - parseFechaLocal(b.fecha).getTime(),
  );
}

export function buildVencimientosProximosLoginAlert(
  bootstrap: VencimientosImpuestosBootstrap,
): VencImpLoginAlert | null {
  const prefs = bootstrap.preferencias;
  if (!prefs?.onboarding_completado) return null;

  const ruralListo = prefs.jurisdiccion_ids.length > 0;
  const patenteListo = prefs.seguir_patente_sucive !== false;
  const bpsListo = prefs.seguir_bps_caja_rural;
  const primariaListo = prefs.seguir_primaria_rural !== false;

  const modalidadRural: ModalidadPagoVencImp =
    prefs.modalidad_pago ? prefs.modalidad_pago : "cuotas";
  const modalidadPatente: ModalidadPagoVencImp =
    prefs.modalidad_pago_patente ?? prefs.modalidad_pago ?? "cuotas";
  const planesCuotasPrefs = prefs.planes_cuotas_por_jurisdiccion ?? {};
  const regimenPrimaria: RegimenPrimariaRuralKey =
    prefs.regimen_primaria_rural ?? "con_explotacion";

  const configsCuenta = ruralListo
    ? prefs.jurisdiccion_ids
        .map((id) => bootstrap.rural.jurisdicciones[id])
        .filter(Boolean)
    : [];

  const cuotasRural = ruralListo
    ? cuotasFuturasCuentaRural(
        configsCuenta,
        modalidadRural,
        (config) => planCuotasGuardado(config, planesCuotasPrefs),
      )
    : [];

  const patenteConfig = patenteListo ? patenteComoCalendarioConfig(bootstrap.patente) : null;
  const bpsConfig = bpsListo ? bpsComoCalendarioConfig(bootstrap.bps) : null;
  const primariaConfig = primariaListo
    ? primariaComoCalendarioConfig(bootstrap.primaria, regimenPrimaria)
    : null;

  const consolidadas = consolidarCuotasVencimientos({
    rural: cuotasRural,
    modalidadRural,
    patente: cuotasNacionalesFuturas(patenteConfig, modalidadPatente),
    modalidadPatente,
    bps: cuotasNacionalesFuturas(bpsConfig, "cuotas"),
    primaria: cuotasNacionalesFuturas(primariaConfig, "cuotas"),
  });

  const proximos = consolidadas.filter(
    (item) => semaforoVencimientoCuota(item.fecha).nivel === "rojo",
  );
  if (proximos.length === 0) return null;

  return {
    totalProximos: proximos.length,
    items: proximos.slice(0, 6).map((item) => ({
      impuestoLabel: item.impuestoLabel,
      titulo: item.titulo,
      fechaLabel: item.fechaLabel,
      diasRestantes: item.diasRestantes,
      cuotaLabel: item.cuotaLabel,
    })),
  };
}

export function vencImpLoginAlertStorageKey(userId: number): string {
  return `scg:venc-imp-login-notif:${userId}`;
}

export function clearVencImpLoginAlertStorage(userId: number): void {
  try {
    sessionStorage.removeItem(vencImpLoginAlertStorageKey(userId));
  } catch {
    /* noop */
  }
}
