import { useCallback, useEffect, useMemo, useState, lazy, Suspense, type ReactNode } from "react";
import { Settings } from "lucide-react";
import VencimientosImpuestosOnboarding from "./VencimientosImpuestosOnboarding";
import VencImpProximosCarousel from "./VencImpProximosCarousel";
import VencImpInfoTip from "./VencImpInfoTip";
import VencImpHubSidebarGuide from "./VencImpHubSidebarGuide";
import { MenuAppIcon } from "./icons/MenuAppIcons";
import { SgHubKpi, SgMiniBars } from "./stock/SgHubUi";

const VencImpCalendarioModal = lazy(() => import("./VencImpCalendarioModal"));
import type {
  ContribucionRuralCalendariosStore,
  ContribucionRuralJurisdiccionConfig,
  ContribucionRuralJurisdiccionId,
  ModalidadPagoVencImp,
  UserVencimientosImpuestosPrefs,
} from "../types/contribucion-rural";
import type { PatenteSuciveCalendariosStore } from "../types/patente-sucive";
import type { BpsCajaRuralCalendariosStore } from "../types/bps-caja-rural";
import type { PrimariaRuralCalendariosStore, RegimenPrimariaRuralKey } from "../types/primaria-rural";
import { REGIMEN_PRIMARIA_RURAL_LABEL } from "../types/primaria-rural";
import type { AuthUser } from "../types";
import { saveVencimientosImpuestosPreferencias } from "../api";
import {
  getVencimientosImpuestosCache,
  invalidateVencimientosImpuestosCache,
  loadVencimientosImpuestosBootstrap,
  setVencimientosImpuestosCache,
  type VencimientosImpuestosBootstrap,
} from "../utils/vencimientos-impuestos-cache";
import { buildVencimientosProximosLoginAlert } from "../utils/vencimientos-impuestos-alertas";
import { setVencImpProximosCount } from "../utils/vencimientos-impuestos-proximos-badge";
import {
  MODALIDAD_PAGO_LABEL,
  cuotasFuturasCuentaRural,
  diasHastaVencimientoCuota,
  planCuotasGuardado,
  vistaCalendarioParaUsuario,
  type PlanCuotasKey,
} from "../utils/contribucion-rural-view";
import { patenteComoCalendarioConfig } from "../utils/patente-sucive-view";
import { bpsComoCalendarioConfig } from "../utils/bps-caja-rural-view";
import { primariaComoCalendarioConfig } from "../utils/primaria-rural-view";
import {
  formatearFechaContribucionRural,
  parseFechaLocal,
  semaforoVencimientoCuota,
  diasRestantesLabel,
  SEMAFORO_VENCIMIENTO_LABEL,
} from "../utils/contribucion-rural-common";
import { escudoDepartamentoSrc } from "../utils/escudos-departamentos";
import { canConfigurarVencimientosImpuestos } from "../utils/auth-permissions";
import {
  consolidarCuotasVencimientos,
  tipoImpuestoInicialDesdePrefs,
  type TipoImpuestoVenc,
  type VencImpCuotaConsolidada,
} from "../utils/vencimientos-impuestos-total";

const INITIAL_BOOTSTRAP = getVencimientosImpuestosCache();

function initialTipoImpuesto(): TipoImpuestoVenc {
  return tipoImpuestoInicialDesdePrefs(INITIAL_BOOTSTRAP?.preferencias);
}

function initialShowOnboarding(user: AuthUser | null): boolean {
  if (!canConfigurarVencimientosImpuestos(user)) return false;
  if (!INITIAL_BOOTSTRAP) return false;
  const prefs = INITIAL_BOOTSTRAP.preferencias;
  if (!prefs) return true;
  return !prefs.onboarding_completado;
}

interface Props {
  apiOnline: boolean;
  currentUser: AuthUser | null;
  onError: (msg: string) => void;
}

type TipoImpuesto = TipoImpuestoVenc;
type OnboardingPaso = 1 | 2 | 3 | 4 | 5;

type CalendarioModalAbierto = {
  config: ContribucionRuralJurisdiccionConfig;
  modalidadUsuario: ModalidadPagoVencImp;
  planUsuario?: PlanCuotasKey;
};

function bannerProximoKicker(semaforo: ReturnType<typeof semaforoVencimientoCuota>, diasRestantes: number): string {
  if (diasRestantes <= 0) return "Vence hoy";
  if (semaforo.nivel === "rojo") return diasRestantes <= 7 ? "Próximo" : "Próximo vencimiento";
  if (semaforo.nivel === "amarillo") return "A preparar";
  return "Próximo";
}

interface BannerProximoTarjeta {
  key: string;
  escudoSrc: string;
  escudoClassName?: string;
  titulo: string;
  subtitulo?: string;
  fecha: string;
  fechaLabel: string;
  diasRestantes: number;
}

function listarProximosBanner<T extends { fecha: string; fechaLabel: string; diasRestantes: number }>(
  cuotas: T[],
  mapItem: (cuota: T) => Pick<BannerProximoTarjeta, "key" | "escudoSrc" | "escudoClassName" | "titulo" | "subtitulo">,
): BannerProximoTarjeta[] {
  if (cuotas.length === 0) return [];
  const fechaMin = cuotas[0].fecha;
  return cuotas
    .filter((c) => c.fecha === fechaMin)
    .map((c) => ({
      ...mapItem(c),
      fecha: c.fecha,
      fechaLabel: c.fechaLabel,
      diasRestantes: c.diasRestantes,
    }));
}

function VencImpBannerProximo({ tarjeta }: { tarjeta: BannerProximoTarjeta }) {
  const { fecha, fechaLabel, diasRestantes, titulo, subtitulo, escudoSrc, escudoClassName } = tarjeta;
  const semaforo = semaforoVencimientoCuota(fecha);
  const escudoCls = ["venc-imp-banner-next-escudo", escudoClassName].filter(Boolean).join(" ");
  const ariaParts = [titulo, subtitulo, fechaLabel, diasRestantesLabel(diasRestantes)].filter(Boolean);

  return (
    <div
      className={`venc-imp-banner-next venc-imp-banner-next--${semaforo.nivel}`}
      role="status"
      aria-label={ariaParts.join(" · ")}
    >
      <span className="venc-imp-banner-next-accent" aria-hidden />
      <img src={escudoSrc} alt="" className={escudoCls} loading="lazy" decoding="async" />
      <div className="venc-imp-banner-next-body">
        <span className="venc-imp-banner-next-label">
          <span className="venc-imp-banner-next-dot" aria-hidden />
          {bannerProximoKicker(semaforo, diasRestantes)}
        </span>
        <strong>{titulo}</strong>
        {subtitulo && subtitulo !== titulo ? (
          <span className="venc-imp-banner-next-sub">{subtitulo}</span>
        ) : null}
        <span className="venc-imp-banner-next-fecha">{fechaLabel}</span>
        <span className="venc-imp-banner-next-dias">{diasRestantesLabel(diasRestantes)}</span>
      </div>
    </div>
  );
}

function VencImpUserContextBanner({
  ariaLabel,
  proximos,
  children,
}: {
  ariaLabel: string;
  proximos: BannerProximoTarjeta[];
  children: ReactNode;
}) {
  return (
    <section className="venc-imp-user-banner venc-imp-user-banner--pro venc-imp-user-banner--modern" aria-label={ariaLabel}>
      <div className="venc-imp-user-banner-shell">
        <div className="venc-imp-user-banner-info-main">{children}</div>
        {proximos.length > 0 && (
          <div className="venc-imp-user-banner-proximos-wrap">
            {proximos.map((tarjeta) => (
              <div key={tarjeta.key} className="venc-imp-user-banner-proximo-box">
                <VencImpBannerProximo tarjeta={tarjeta} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface SemaforoStats {
  rojo: number;
  amarillo: number;
  verde: number;
  total: number;
}

function VencImpStatsStrip({
  loading,
  stats,
  variant = "legacy",
}: {
  loading: boolean;
  stats: SemaforoStats | null;
  variant?: "legacy" | "hub";
}) {
  if (!stats && !loading) return null;
  const val = (n: number) => (loading ? "—" : String(n));

  if (variant === "hub") {
    return (
      <section className="sg-hub-kpi-strip venc-imp-hub-kpi-strip" aria-label="Estado de vencimientos">
        <SgHubKpi
          variant="dark"
          kicker="Próximo"
          value={stats ? val(stats.rojo) : "—"}
          hint="Vencimientos en los próximos días."
          bars={<SgMiniBars highlight="last" />}
        />
        <SgHubKpi
          kicker="A preparar"
          value={stats ? val(stats.amarillo) : "—"}
          hint="Cuotas que conviene planificar con anticipación."
          bars={<SgMiniBars highlight="mid" />}
        />
        <SgHubKpi
          kicker={SEMAFORO_VENCIMIENTO_LABEL.verde}
          value={stats ? val(stats.verde) : "—"}
          hint="Vencimientos con margen amplio."
          bars={<SgMiniBars />}
        />
        <SgHubKpi
          variant="dark"
          kicker="Cuotas visibles"
          value={stats ? val(stats.total) : "—"}
          hint="Total de vencimientos en el calendario activo."
          bars={<SgMiniBars highlight="last" />}
        />
      </section>
    );
  }

  const items = [
    { key: "rojo", value: stats ? val(stats.rojo) : "—", label: "Próximo", tone: "rojo" as const },
    { key: "amarillo", value: stats ? val(stats.amarillo) : "—", label: "A preparar", tone: "amarillo" as const },
    { key: "verde", value: stats ? val(stats.verde) : "—", label: SEMAFORO_VENCIMIENTO_LABEL.verde, tone: "verde" as const },
    { key: "total", value: stats ? val(stats.total) : "—", label: "Cuotas visibles", tone: "total" as const },
  ];
  return (
    <div className="venc-imp-stats-strip" role="status" aria-label="Estado de vencimientos">
      {items.map((item) => (
        <div key={item.key} className={`venc-imp-stat venc-imp-stat--${item.tone}`}>
          <span className="venc-imp-stat-dot" aria-hidden />
          <span className="venc-imp-stat-val">{item.value}</span>
          <span className="venc-imp-stat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function VencImpProximosSection({
  ariaLabel,
  kicker,
  title,
  subtitle,
  count,
  itemCount,
  carouselAriaLabel,
  emptyMessage,
  children,
}: {
  ariaLabel: string;
  kicker: string;
  title: string;
  subtitle?: string;
  count?: number;
  itemCount: number;
  carouselAriaLabel: string;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <section className="venc-imp-section venc-imp-proximos-section" aria-label={ariaLabel}>
      <div className="venc-imp-proximos-head-box">
        <p className="venc-imp-section-kicker">{kicker}</p>
        <div className="venc-imp-proximos-head-row">
          <div className="venc-imp-proximos-head-main">
            <h2 className="venc-imp-section-title">{title}</h2>
            {subtitle ? <p className="venc-imp-section-sub">{subtitle}</p> : null}
          </div>
          {count != null ? <span className="venc-imp-section-count">{count}</span> : null}
        </div>
      </div>
      <div className="venc-imp-proximos-carousel-box">
        <VencImpProximosCarousel
          itemCount={itemCount}
          ariaLabel={carouselAriaLabel}
          emptyMessage={emptyMessage}
        >
          {children}
        </VencImpProximosCarousel>
      </div>
    </section>
  );
}

function mensajeProximosVacios(tipo: TipoImpuesto): string {
  if (tipo === "total") return "No hay vencimientos pendientes en los impuestos configurados.";
  if (tipo === "patente") return "No hay cuotas pendientes de patente SUCIVE.";
  if (tipo === "bps") return "No hay cuatrimestres pendientes de BPS Caja rural.";
  if (tipo === "primaria") return "No hay cuotas pendientes de Impuesto Primaria rural.";
  return "No hay cuotas pendientes en los departamentos configurados.";
}

export default function VencimientosImpuestos({ apiOnline, currentUser, onError }: Props) {
  const [store, setStore] = useState<ContribucionRuralCalendariosStore | null>(
    () => INITIAL_BOOTSTRAP?.rural ?? null,
  );
  const [patenteStore, setPatenteStore] = useState<PatenteSuciveCalendariosStore | null>(
    () => INITIAL_BOOTSTRAP?.patente ?? null,
  );
  const [bpsStore, setBpsStore] = useState<BpsCajaRuralCalendariosStore | null>(
    () => INITIAL_BOOTSTRAP?.bps ?? null,
  );
  const [primariaStore, setPrimariaStore] = useState<PrimariaRuralCalendariosStore | null>(
    () => INITIAL_BOOTSTRAP?.primaria ?? null,
  );
  const [prefs, setPrefs] = useState<UserVencimientosImpuestosPrefs | null | undefined>(
    () => INITIAL_BOOTSTRAP?.preferencias ?? undefined,
  );
  const [loading, setLoading] = useState(() => INITIAL_BOOTSTRAP == null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => initialShowOnboarding(currentUser));
  const [tipoImpuesto, setTipoImpuesto] = useState<TipoImpuesto>(initialTipoImpuesto);
  const [calendarioModal, setCalendarioModal] = useState<CalendarioModalAbierto | null>(null);
  const [onboardingPasoInicial, setOnboardingPasoInicial] = useState<OnboardingPaso | undefined>(
    undefined,
  );

  useEffect(() => {
    setCalendarioModal(null);
  }, [tipoImpuesto]);

  const puedeConfigurar = canConfigurarVencimientosImpuestos(currentUser);

  const applyPreferenciasCuenta = useCallback(
    (preferencias: UserVencimientosImpuestosPrefs | null) => {
      if (preferencias?.onboarding_completado) {
        setShowOnboarding(false);
        setTipoImpuesto(tipoImpuestoInicialDesdePrefs(preferencias));
      } else if (puedeConfigurar) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    },
    [puedeConfigurar],
  );

  const applyBootstrap = useCallback(
    (calendarios: VencimientosImpuestosBootstrap) => {
      setStore(calendarios.rural);
      setPatenteStore(calendarios.patente);
      setBpsStore(calendarios.bps);
      setPrimariaStore(calendarios.primaria);
      setPrefs(calendarios.preferencias);
      applyPreferenciasCuenta(calendarios.preferencias);
      const alert = buildVencimientosProximosLoginAlert(calendarios);
      setVencImpProximosCount(alert?.totalProximos ?? 0);
    },
    [applyPreferenciasCuenta],
  );

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      setPrefs(null);
      return;
    }

    const cached = getVencimientosImpuestosCache();
    if (cached) {
      applyBootstrap(cached);
      setLoading(false);
      try {
        const fresh = await loadVencimientosImpuestosBootstrap({ force: true });
        applyBootstrap(fresh);
      } catch {
        /* conservar datos en caché */
      }
      return;
    }

    setLoading(true);
    try {
      const bootstrap = await loadVencimientosImpuestosBootstrap();
      applyBootstrap(bootstrap);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron cargar los calendarios.");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError, applyBootstrap]);

  useEffect(() => {
    if (INITIAL_BOOTSTRAP) {
      applyPreferenciasCuenta(INITIAL_BOOTSTRAP.preferencias);
    }
    void load();
  }, [load, applyPreferenciasCuenta]);

  const modalidadRural: ModalidadPagoVencImp =
    prefs?.onboarding_completado && prefs.modalidad_pago ? prefs.modalidad_pago : "cuotas";

  const modalidadPatente: ModalidadPagoVencImp =
    prefs?.onboarding_completado && prefs.modalidad_pago_patente
      ? prefs.modalidad_pago_patente
      : prefs?.modalidad_pago ?? "cuotas";

  const planesCuotasPrefs = prefs?.planes_cuotas_por_jurisdiccion ?? {};

  const planParaConfig = useCallback(
    (config: ContribucionRuralJurisdiccionConfig) =>
      planCuotasGuardado(config, planesCuotasPrefs),
    [planesCuotasPrefs],
  );

  const patenteConfig = useMemo(
    () => (patenteStore ? patenteComoCalendarioConfig(patenteStore) : null),
    [patenteStore],
  );

  const bpsConfig = useMemo(
    () => (bpsStore ? bpsComoCalendarioConfig(bpsStore) : null),
    [bpsStore],
  );

  const regimenPrimaria: RegimenPrimariaRuralKey =
    prefs?.regimen_primaria_rural ?? "con_explotacion";

  const primariaConfig = useMemo(
    () => (primariaStore ? primariaComoCalendarioConfig(primariaStore, regimenPrimaria) : null),
    [primariaStore, regimenPrimaria],
  );

  const modalidadBps: ModalidadPagoVencImp = "cuotas";
  const modalidadPrimaria: ModalidadPagoVencImp = "cuotas";

  const cuotasPatenteFuturas = useMemo(() => {
    if (!patenteConfig) return [];
    const vista = vistaCalendarioParaUsuario(patenteConfig, modalidadPatente);
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
  }, [patenteConfig, modalidadPatente]);

  const statsPatenteSemaforo = useMemo(() => {
    let rojo = 0;
    let amarillo = 0;
    let verde = 0;
    for (const item of cuotasPatenteFuturas) {
      const { nivel } = semaforoVencimientoCuota(item.fecha);
      if (nivel === "rojo") rojo += 1;
      else if (nivel === "amarillo") amarillo += 1;
      else verde += 1;
    }
    return { rojo, amarillo, verde, total: cuotasPatenteFuturas.length };
  }, [cuotasPatenteFuturas]);

  const cuotasBpsFuturas = useMemo(() => {
    if (!bpsConfig) return [];
    const vista = vistaCalendarioParaUsuario(bpsConfig, modalidadBps);
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
  }, [bpsConfig, modalidadBps]);

  const statsBpsSemaforo = useMemo(() => {
    let rojo = 0;
    let amarillo = 0;
    let verde = 0;
    for (const item of cuotasBpsFuturas) {
      const { nivel } = semaforoVencimientoCuota(item.fecha);
      if (nivel === "rojo") rojo += 1;
      else if (nivel === "amarillo") amarillo += 1;
      else verde += 1;
    }
    return { rojo, amarillo, verde, total: cuotasBpsFuturas.length };
  }, [cuotasBpsFuturas]);

  const cuotasPrimariaFuturas = useMemo(() => {
    if (!primariaConfig) return [];
    const vista = vistaCalendarioParaUsuario(primariaConfig, modalidadPrimaria);
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
  }, [primariaConfig, modalidadPrimaria]);

  const statsPrimariaSemaforo = useMemo(() => {
    let rojo = 0;
    let amarillo = 0;
    let verde = 0;
    for (const item of cuotasPrimariaFuturas) {
      const { nivel } = semaforoVencimientoCuota(item.fecha);
      if (nivel === "rojo") rojo += 1;
      else if (nivel === "amarillo") amarillo += 1;
      else verde += 1;
    }
    return { rojo, amarillo, verde, total: cuotasPrimariaFuturas.length };
  }, [cuotasPrimariaFuturas]);

  const departamentosCuenta = useMemo(
    () => prefs?.jurisdiccion_ids ?? [],
    [prefs?.jurisdiccion_ids],
  );

  const configsCuenta = useMemo(() => {
    if (!store || departamentosCuenta.length === 0) return [];
    return departamentosCuenta
      .map((id) => store.jurisdicciones[id])
      .filter(Boolean);
  }, [store, departamentosCuenta]);

  const cuotasFuturas = useMemo(
    () => cuotasFuturasCuentaRural(configsCuenta, modalidadRural, planParaConfig),
    [configsCuenta, modalidadRural, planParaConfig],
  );

  const statsSemaforo = useMemo(() => {
    let rojo = 0;
    let amarillo = 0;
    let verde = 0;
    for (const item of cuotasFuturas) {
      const { nivel } = semaforoVencimientoCuota(item.fecha);
      if (nivel === "rojo") rojo += 1;
      else if (nivel === "amarillo") amarillo += 1;
      else verde += 1;
    }
    return { rojo, amarillo, verde, total: cuotasFuturas.length };
  }, [cuotasFuturas]);

  const proximoBannerRural = useMemo(
    () =>
      listarProximosBanner(cuotasFuturas, (c) => ({
        key: `${c.configId}-${c.cuota}`,
        escudoSrc: escudoDepartamentoSrc(c.configId),
        titulo: c.configLabel,
      })),
    [cuotasFuturas],
  );

  const configPorId = useMemo(() => {
    const map = new Map<ContribucionRuralJurisdiccionId, ContribucionRuralJurisdiccionConfig>();
    for (const config of configsCuenta) map.set(config.id, config);
    return map;
  }, [configsCuenta]);

  const abrirCalendarioRural = useCallback(
    (configId: ContribucionRuralJurisdiccionId) => {
      const config = configPorId.get(configId);
      if (!config || config.esPatenteSucive || config.esBpsCajaRural || config.esPrimariaRural) return;
      setCalendarioModal({
        config,
        modalidadUsuario: modalidadRural,
        planUsuario: planParaConfig(config),
      });
    },
    [configPorId, modalidadRural, planParaConfig],
  );

  const abrirCalendarioPatente = useCallback(() => {
    if (!patenteConfig) return;
    setCalendarioModal({
      config: patenteConfig,
      modalidadUsuario: modalidadPatente,
    });
  }, [patenteConfig, modalidadPatente]);

  const abrirCalendarioBps = useCallback(() => {
    if (!bpsConfig) return;
    setCalendarioModal({
      config: bpsConfig,
      modalidadUsuario: modalidadBps,
    });
  }, [bpsConfig, modalidadBps]);

  const abrirCalendarioPrimaria = useCallback(() => {
    if (!primariaConfig) return;
    setCalendarioModal({
      config: primariaConfig,
      modalidadUsuario: modalidadPrimaria,
    });
  }, [primariaConfig, modalidadPrimaria]);

  const handleOnboardingComplete = async (payload: {
    jurisdiccion_ids: ContribucionRuralJurisdiccionId[];
    modalidad_pago: ModalidadPagoVencImp;
    modalidad_pago_patente: ModalidadPagoVencImp;
    planes_cuotas_por_jurisdiccion: UserVencimientosImpuestosPrefs["planes_cuotas_por_jurisdiccion"];
    seguir_patente_sucive: boolean;
    seguir_bps_caja_rural: boolean;
    seguir_primaria_rural: boolean;
    regimen_primaria_rural: RegimenPrimariaRuralKey;
  }) => {
    if (!puedeConfigurar) {
      onError("No tenés permiso para configurar vencimientos de la cuenta.");
      return;
    }
    setSavingPrefs(true);
    try {
      const saved = await saveVencimientosImpuestosPreferencias({
        ...payload,
        onboarding_completado: true,
      });
      setPrefs(saved);
      applyPreferenciasCuenta(saved);
      setOnboardingPasoInicial(undefined);
      const cached = getVencimientosImpuestosCache();
      if (cached && store && patenteStore && bpsStore && primariaStore) {
        setVencimientosImpuestosCache({
          rural: store,
          patente: patenteStore,
          bps: bpsStore,
          primaria: primariaStore,
          preferencias: saved,
        });
      } else {
        invalidateVencimientosImpuestosCache();
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron guardar las preferencias de la cuenta.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const abrirPreferencias = () => {
    if (!puedeConfigurar) return;
    setOnboardingPasoInicial(
      tipoImpuesto === "primaria"
        ? 5
        : tipoImpuesto === "bps"
          ? 4
          : tipoImpuesto === "patente"
            ? 3
            : 1,
    );
    setShowOnboarding(true);
  };

  const cerrarPreferencias = () => {
    setShowOnboarding(false);
    setOnboardingPasoInicial(undefined);
  };

  const setupPendiente =
    !loading &&
    !!store &&
    !!patenteStore &&
    !!bpsStore &&
    !!primariaStore &&
    showOnboarding &&
    puedeConfigurar;
  const configPendienteLector =
    !loading &&
    !!store &&
    !!patenteStore &&
    !!bpsStore &&
    !!primariaStore &&
    !prefs?.onboarding_completado &&
    !puedeConfigurar;
  const onboardingFullscreen = setupPendiente;
  const cuentaConfigurada = Boolean(prefs?.onboarding_completado);
  const ruralListo =
    !loading && store && cuentaConfigurada && departamentosCuenta.length > 0;
  const patenteListo =
    !loading && patenteStore && patenteConfig && cuentaConfigurada && prefs?.seguir_patente_sucive !== false;
  const bpsListo =
    !loading && bpsStore && bpsConfig && cuentaConfigurada;
  const primariaListo =
    !loading &&
    primariaStore &&
    primariaConfig &&
    cuentaConfigurada &&
    prefs?.seguir_primaria_rural !== false;

  const tiposImpuestoHabilitados = [
    ruralListo ? "rural" as const : null,
    patenteListo ? "patente" as const : null,
    bpsListo ? "bps" as const : null,
    primariaListo ? "primaria" as const : null,
  ].filter(Boolean);

  const mostrarBarraFiltros =
    cuentaConfigurada &&
    !setupPendiente &&
    !configPendienteLector &&
    (ruralListo || patenteListo || bpsListo || primariaListo);

  const mostrarSelectorImpuesto = mostrarBarraFiltros && tiposImpuestoHabilitados.length >= 2;

  const opcionesImpuesto = useMemo(() => {
    const out: { id: TipoImpuesto; label: string }[] = [];
    if (tiposImpuestoHabilitados.length >= 2) {
      out.push({ id: "total", label: "Total" });
    }
    if (ruralListo) out.push({ id: "rural", label: "Contribución rural" });
    if (patenteListo) out.push({ id: "patente", label: "Patente SUCIVE" });
    if (bpsListo) out.push({ id: "bps", label: "BPS Caja rural" });
    if (primariaListo) out.push({ id: "primaria", label: "Primaria rural (DGI)" });
    return out;
  }, [ruralListo, patenteListo, bpsListo, primariaListo, tiposImpuestoHabilitados.length]);

  const totalListo = tiposImpuestoHabilitados.length >= 2;

  const cuotasConsolidadas = useMemo(
    () =>
      consolidarCuotasVencimientos({
        rural: ruralListo ? cuotasFuturas : [],
        modalidadRural,
        patente: patenteListo ? cuotasPatenteFuturas : [],
        modalidadPatente,
        bps: bpsListo ? cuotasBpsFuturas : [],
        primaria: primariaListo ? cuotasPrimariaFuturas : [],
      }),
    [
      ruralListo,
      cuotasFuturas,
      modalidadRural,
      patenteListo,
      cuotasPatenteFuturas,
      modalidadPatente,
      bpsListo,
      cuotasBpsFuturas,
      primariaListo,
      cuotasPrimariaFuturas,
    ],
  );

  const statsTotalSemaforo = useMemo(() => {
    let rojo = 0;
    let amarillo = 0;
    let verde = 0;
    for (const item of cuotasConsolidadas) {
      const { nivel } = semaforoVencimientoCuota(item.fecha);
      if (nivel === "rojo") rojo += 1;
      else if (nivel === "amarillo") amarillo += 1;
      else verde += 1;
    }
    return { rojo, amarillo, verde, total: cuotasConsolidadas.length };
  }, [cuotasConsolidadas]);

  const heroStats: SemaforoStats | null = useMemo(() => {
    if (!cuentaConfigurada || setupPendiente) return null;
    if (tipoImpuesto === "total" && totalListo) return statsTotalSemaforo;
    if (tipoImpuesto === "patente" && patenteListo) return statsPatenteSemaforo;
    if (tipoImpuesto === "bps" && bpsListo) return statsBpsSemaforo;
    if (tipoImpuesto === "primaria" && primariaListo) return statsPrimariaSemaforo;
    if (tipoImpuesto === "rural" && ruralListo) return statsSemaforo;
    return null;
  }, [
    cuentaConfigurada,
    setupPendiente,
    tipoImpuesto,
    patenteListo,
    ruralListo,
    statsPatenteSemaforo,
    statsBpsSemaforo,
    bpsListo,
    primariaListo,
    statsPrimariaSemaforo,
    statsSemaforo,
    totalListo,
    statsTotalSemaforo,
  ]);

  const abrirCalendarioDesdeTotal = useCallback(
    (item: VencImpCuotaConsolidada) => {
      if (item.tipo === "rural" && item.configId) {
        abrirCalendarioRural(item.configId);
        return;
      }
      if (item.tipo === "patente") {
        abrirCalendarioPatente();
        return;
      }
      if (item.tipo === "bps") {
        abrirCalendarioBps();
        return;
      }
      abrirCalendarioPrimaria();
    },
    [abrirCalendarioRural, abrirCalendarioPatente, abrirCalendarioBps, abrirCalendarioPrimaria],
  );

  const proximoBannerPatente = useMemo(
    () =>
      listarProximosBanner(cuotasPatenteFuturas, (c) => ({
        key: `patente-${c.cuota}`,
        escudoSrc: "/logo-sucive.svg",
        escudoClassName: "venc-imp-banner-next-escudo--patente",
        titulo: "Patente SUCIVE",
      })),
    [cuotasPatenteFuturas],
  );

  const proximoBannerTotal = useMemo(
    () =>
      listarProximosBanner(cuotasConsolidadas, (c) => ({
        key: c.key,
        escudoSrc: c.escudoSrc,
        escudoClassName: c.escudoClassName,
        titulo: c.titulo,
        subtitulo: c.impuestoLabel,
      })),
    [cuotasConsolidadas],
  );

  const proximoBannerBps = useMemo(
    () =>
      listarProximosBanner(cuotasBpsFuturas, (c) => ({
        key: `bps-${c.cuota}`,
        escudoSrc: "/logo-bps-compact.svg",
        escudoClassName: "venc-imp-banner-next-escudo--bps",
        titulo: "BPS Caja rural",
      })),
    [cuotasBpsFuturas],
  );

  const proximoBannerPrimaria = useMemo(
    () =>
      listarProximosBanner(cuotasPrimariaFuturas, (c) => ({
        key: `primaria-${c.cuota}`,
        escudoSrc: "/logo-dgi-compact.svg",
        escudoClassName: "venc-imp-banner-next-escudo--dgi",
        titulo: "Primaria rural",
      })),
    [cuotasPrimariaFuturas],
  );

  const impuestoActivoLabel =
    opcionesImpuesto.find((op) => op.id === tipoImpuesto)?.label ?? "Vencimientos Impuestos";

  const totalPanel =
    tipoImpuesto === "total" && totalListo ? (
      <div className="venc-imp-hub-panel sg-hub-panel">
            <VencImpUserContextBanner ariaLabel="Vista total de vencimientos" proximos={proximoBannerTotal}>
                  <div className="venc-imp-brand-row">
                    <img
                      src="/icon-venc-imp-total.svg"
                      alt=""
                      className="venc-imp-brand-icon-img venc-imp-brand-icon-img--total"
                      aria-hidden
                    />
                    <div>
                      <p className="venc-imp-onboard-kicker">Todos los impuestos</p>
                      <p className="venc-imp-user-banner-text">
                        <strong>Vista consolidada</strong>
                      </p>
                      <p className="venc-imp-user-banner-deptos">
                        {cuotasConsolidadas.length}{" "}
                        {cuotasConsolidadas.length === 1 ? "vencimiento" : "vencimientos"} en el calendario
                      </p>
                    </div>
                  </div>
            </VencImpUserContextBanner>

              <VencImpProximosSection
                ariaLabel="Próximos vencimientos consolidados"
                kicker="Vista consolidada"
                title="Próximos vencimientos"
                subtitle="Contribución rural, patente, BPS y Primaria · del más cercano al más lejano"
                count={cuotasConsolidadas.length}
                itemCount={cuotasConsolidadas.length}
                carouselAriaLabel="Próximos vencimientos de todos los impuestos"
                emptyMessage={mensajeProximosVacios("total")}
              >
                    {cuotasConsolidadas.map((item) => {
                      const semaforo = semaforoVencimientoCuota(item.fecha);
                      const escudoCls = ["venc-imp-proximo-escudo", item.escudoClassName]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <button
                          type="button"
                          key={item.key}
                          className={`venc-imp-proximo-card venc-imp-proximo-card--pro venc-imp-proximo-card--total venc-imp-proximo-card--${semaforo.nivel}`}
                          role="listitem"
                          onClick={() => abrirCalendarioDesdeTotal(item)}
                          aria-label={`Ver calendario de ${item.impuestoLabel} · ${item.titulo} · ${item.fechaLabel}`}
                        >
                          <span className="venc-imp-proximo-accent" aria-hidden />
                          <div className="venc-imp-proximo-top">
                            <img
                              src={item.escudoSrc}
                              alt=""
                              className={escudoCls}
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="venc-imp-proximo-meta">
                              <p className="venc-imp-proximo-impuesto">{item.impuestoLabel}</p>
                              <p className="venc-imp-proximo-depto">{item.titulo}</p>
                              <p className="venc-imp-proximo-plazo">{diasRestantesLabel(item.diasRestantes)}</p>
                            </div>
                          </div>
                          <p className="venc-imp-proximo-cuota">{item.cuotaLabel}</p>
                          <p className="venc-imp-proximo-fecha">{item.fechaLabel}</p>
                          <span className={`venc-imp-semaforo-badge venc-imp-semaforo-badge--${semaforo.nivel}`}>
                            <span
                              className={`venc-imp-semaforo-dot venc-imp-semaforo-dot--${semaforo.nivel}`}
                              aria-hidden
                            />
                            {semaforo.label}
                          </span>
                        </button>
                      );
                    })}
              </VencImpProximosSection>
      </div>
    ) : null;

  const patentePanel =
    tipoImpuesto === "patente" && patenteListo && patenteStore && patenteConfig ? (
      <div className="venc-imp-hub-panel sg-hub-panel">
              <VencImpUserContextBanner ariaLabel="Patente SUCIVE" proximos={proximoBannerPatente}>
                  <div className="venc-imp-brand-row">
                    <img src="/logo-sucive.svg" alt="" className="venc-imp-brand-icon-img" aria-hidden />
                    <div>
                      <p className="venc-imp-onboard-kicker">Patente SUCIVE</p>
                      <p className="venc-imp-user-banner-text">
                        <strong>{MODALIDAD_PAGO_LABEL[modalidadPatente]}</strong>
                      </p>
                      <p className="venc-imp-user-banner-deptos">
                        calendario nacional · ejercicio {patenteStore.calendario.anio}
                      </p>
                    </div>
                  </div>
              </VencImpUserContextBanner>

              <VencImpProximosSection
                ariaLabel="Próximos vencimientos patente"
                kicker="Calendario SUCIVE"
                title="Próximos vencimientos"
                subtitle={`${MODALIDAD_PAGO_LABEL[modalidadPatente]} · calendario nacional · ejercicio ${patenteStore.calendario.anio}`}
                count={cuotasPatenteFuturas.length}
                itemCount={cuotasPatenteFuturas.length}
                carouselAriaLabel="Próximos vencimientos patente"
                emptyMessage={mensajeProximosVacios("patente")}
              >
                    {cuotasPatenteFuturas.map((item) => {
                      const semaforo = semaforoVencimientoCuota(item.fecha);
                      return (
                        <button
                          type="button"
                          key={`patente-${item.cuota}-${item.fecha}`}
                          className={`venc-imp-proximo-card venc-imp-proximo-card--pro venc-imp-proximo-card--${semaforo.nivel}`}
                          role="listitem"
                          onClick={abrirCalendarioPatente}
                          aria-label={`Ver calendario completo de Patente SUCIVE · ${item.fechaLabel}`}
                        >
                          <span className="venc-imp-proximo-accent" aria-hidden />
                          <div className="venc-imp-proximo-top">
                    <img
                      src="/logo-sucive.svg"
                      alt=""
                      className="venc-imp-proximo-escudo"
                      loading="lazy"
                      decoding="async"
                    />
                            <div className="venc-imp-proximo-meta">
                              <p className="venc-imp-proximo-depto">Patente SUCIVE</p>
                              <p className="venc-imp-proximo-plazo">{diasRestantesLabel(item.diasRestantes)}</p>
                            </div>
                          </div>
                          <p className="venc-imp-proximo-cuota">
                            {modalidadPatente === "contado"
                              ? "Pago contado anual"
                              : `Cuota ${item.cuota}ª · ${item.planLabel}`}
                          </p>
                          <p className="venc-imp-proximo-fecha">{item.fechaLabel}</p>
                          <span className={`venc-imp-semaforo-badge venc-imp-semaforo-badge--${semaforo.nivel}`}>
                            <span
                              className={`venc-imp-semaforo-dot venc-imp-semaforo-dot--${semaforo.nivel}`}
                              aria-hidden
                            />
                            {semaforo.label}
                          </span>
                        </button>
                      );
                    })}
              </VencImpProximosSection>
      </div>
    ) : null;

  const bpsPanel =
    tipoImpuesto === "bps" && bpsListo && bpsStore && bpsConfig ? (
      <div className="venc-imp-hub-panel sg-hub-panel">
              <VencImpUserContextBanner ariaLabel="BPS Caja rural" proximos={proximoBannerBps}>
                  <div className="venc-imp-brand-row">
                    <img src="/logo-bps-compact.svg" alt="" className="venc-imp-brand-icon-img venc-imp-brand-icon-img--bps" aria-hidden />
                    <div>
                      <p className="venc-imp-onboard-kicker">BPS Caja rural</p>
                      <p className="venc-imp-user-banner-text">
                        <strong>3 cuatrimestres</strong>
                      </p>
                      <p className="venc-imp-user-banner-deptos">
                        calendario nacional · ejercicio {bpsStore.calendario.anio}
                      </p>
                    </div>
                  </div>
              </VencImpUserContextBanner>

              <VencImpProximosSection
                ariaLabel="Próximos vencimientos BPS"
                kicker="Calendario BPS"
                title="Próximos vencimientos"
                subtitle={`3 cuatrimestres · calendario nacional · ejercicio ${bpsStore.calendario.anio}`}
                count={cuotasBpsFuturas.length}
                itemCount={cuotasBpsFuturas.length}
                carouselAriaLabel="Próximos vencimientos BPS Caja rural"
                emptyMessage={mensajeProximosVacios("bps")}
              >
                    {cuotasBpsFuturas.map((item) => {
                      const semaforo = semaforoVencimientoCuota(item.fecha);
                      return (
                        <button
                          type="button"
                          key={`bps-${item.cuota}-${item.fecha}`}
                          className={`venc-imp-proximo-card venc-imp-proximo-card--pro venc-imp-proximo-card--${semaforo.nivel}`}
                          role="listitem"
                          onClick={abrirCalendarioBps}
                          aria-label={`Ver calendario completo de BPS Caja rural · ${item.fechaLabel}`}
                        >
                          <span className="venc-imp-proximo-accent" aria-hidden />
                          <div className="venc-imp-proximo-top">
                            <img
                              src="/logo-bps-compact.svg"
                              alt=""
                              className="venc-imp-proximo-escudo venc-imp-proximo-escudo--bps"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="venc-imp-proximo-meta">
                              <p className="venc-imp-proximo-depto">BPS Caja rural</p>
                              <p className="venc-imp-proximo-plazo">{diasRestantesLabel(item.diasRestantes)}</p>
                            </div>
                          </div>
                          <p className="venc-imp-proximo-cuota">
                            Cuatrimestre {item.cuota}º · {item.planLabel}
                          </p>
                          <p className="venc-imp-proximo-fecha">{item.fechaLabel}</p>
                          <span className={`venc-imp-semaforo-badge venc-imp-semaforo-badge--${semaforo.nivel}`}>
                            <span
                              className={`venc-imp-semaforo-dot venc-imp-semaforo-dot--${semaforo.nivel}`}
                              aria-hidden
                            />
                            {semaforo.label}
                          </span>
                        </button>
                      );
                    })}
              </VencImpProximosSection>
      </div>
    ) : null;

  const djPrimaria =
    regimenPrimaria === "con_explotacion" && primariaStore
      ? {
          fecha: primariaStore.calendario.declaracionJuradaFecha,
          fechaLabel: formatearFechaContribucionRural(primariaStore.calendario.declaracionJuradaFecha),
          diasRestantes: diasHastaVencimientoCuota(primariaStore.calendario.declaracionJuradaFecha),
        }
      : null;

  const primariaPanel =
    tipoImpuesto === "primaria" && primariaListo && primariaStore && primariaConfig ? (
      <div className="venc-imp-hub-panel sg-hub-panel">
              <VencImpUserContextBanner ariaLabel="Impuesto Primaria rural" proximos={proximoBannerPrimaria}>
                  <div className="venc-imp-brand-row">
                    <img
                      src="/logo-dgi-compact.svg"
                      alt=""
                      className="venc-imp-brand-icon-img venc-imp-brand-icon-img--dgi"
                      aria-hidden
                    />
                    <div>
                      <div className="venc-imp-banner-kicker-row">
                        <p className="venc-imp-onboard-kicker">Impuesto Primaria · DGI</p>
                        {primariaStore.calendario.exoneracionNota && (
                          <VencImpInfoTip
                            className="venc-imp-info-tip--banner"
                            label="Exoneración pequeños productores"
                          >
                            {primariaStore.calendario.exoneracionNota}
                          </VencImpInfoTip>
                        )}
                      </div>
                      <p className="venc-imp-user-banner-text">
                        <strong>{REGIMEN_PRIMARIA_RURAL_LABEL[regimenPrimaria]}</strong>
                      </p>
                      <p className="venc-imp-user-banner-deptos">
                        3 cuotas · calendario nacional · ejercicio {primariaStore.calendario.anio}
                      </p>
                    </div>
                  </div>
              </VencImpUserContextBanner>

              <VencImpProximosSection
                ariaLabel="Próximos vencimientos Primaria"
                kicker="Calendario DGI"
                title="Próximos vencimientos"
                subtitle={`${REGIMEN_PRIMARIA_RURAL_LABEL[regimenPrimaria]} · ejercicio ${primariaStore.calendario.anio}`}
                count={cuotasPrimariaFuturas.length}
                itemCount={cuotasPrimariaFuturas.length}
                carouselAriaLabel="Próximos vencimientos Impuesto Primaria rural"
                emptyMessage={mensajeProximosVacios("primaria")}
              >
                    {cuotasPrimariaFuturas.map((item) => {
                      const semaforo = semaforoVencimientoCuota(item.fecha);
                      return (
                        <button
                          type="button"
                          key={`primaria-${item.cuota}-${item.fecha}`}
                          className={`venc-imp-proximo-card venc-imp-proximo-card--pro venc-imp-proximo-card--${semaforo.nivel}`}
                          role="listitem"
                          onClick={abrirCalendarioPrimaria}
                          aria-label={`Ver calendario completo de Primaria rural · ${item.fechaLabel}`}
                        >
                          <span className="venc-imp-proximo-accent" aria-hidden />
                          <div className="venc-imp-proximo-top">
                            <img
                              src="/logo-dgi-compact.svg"
                              alt=""
                              className="venc-imp-proximo-escudo venc-imp-proximo-escudo--dgi"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="venc-imp-proximo-meta">
                              <p className="venc-imp-proximo-depto">Primaria rural</p>
                              <p className="venc-imp-proximo-plazo">{diasRestantesLabel(item.diasRestantes)}</p>
                            </div>
                          </div>
                          <p className="venc-imp-proximo-cuota">
                            Cuota {item.cuota}ª · {item.planLabel}
                          </p>
                          <p className="venc-imp-proximo-fecha">{item.fechaLabel}</p>
                          <span className={`venc-imp-semaforo-badge venc-imp-semaforo-badge--${semaforo.nivel}`}>
                            <span
                              className={`venc-imp-semaforo-dot venc-imp-semaforo-dot--${semaforo.nivel}`}
                              aria-hidden
                            />
                            {semaforo.label}
                          </span>
                        </button>
                      );
                    })}
              </VencImpProximosSection>
      </div>
    ) : null;

  const ruralPanel =
    ruralListo && tipoImpuesto === "rural" ? (
      <div className="venc-imp-hub-panel sg-hub-panel">
        <VencImpUserContextBanner ariaLabel="Contribución rural" proximos={proximoBannerRural}>
            <div className="venc-imp-brand-row">
              <img
                src="/icon-venc-imp-total.svg"
                alt=""
                className="venc-imp-brand-icon-img"
                aria-hidden
              />
              <div>
                <p className="venc-imp-onboard-kicker">Contribución rural</p>
                <p className="venc-imp-user-banner-text">
                  <strong>{MODALIDAD_PAGO_LABEL[modalidadRural]}</strong>
                </p>
                {configsCuenta.length > 0 && (
                  <p className="venc-imp-user-banner-deptos">
                    {configsCuenta.length === 1
                      ? configsCuenta[0].label
                      : `${configsCuenta.length} departamentos · ${configsCuenta.map((c) => c.label).join(", ")}`}
                  </p>
                )}
              </div>
            </div>
        </VencImpUserContextBanner>

        <VencImpProximosSection
          ariaLabel="Próximos vencimientos"
          kicker="Contribución rural"
          title="Próximos vencimientos"
          subtitle={`${MODALIDAD_PAGO_LABEL[modalidadRural]} · del más cercano al más lejano`}
          count={cuotasFuturas.length}
          itemCount={cuotasFuturas.length}
          carouselAriaLabel="Próximos vencimientos contribución rural"
          emptyMessage={mensajeProximosVacios("rural")}
        >
              {cuotasFuturas.map((item) => {
                const semaforo = semaforoVencimientoCuota(item.fecha);
                return (
                  <button
                    type="button"
                    key={`${item.configId}-${item.cuota}-${item.fecha}`}
                    className={`venc-imp-proximo-card venc-imp-proximo-card--pro venc-imp-proximo-card--${semaforo.nivel}`}
                    role="listitem"
                    onClick={() => abrirCalendarioRural(item.configId)}
                    aria-label={`Ver calendario completo de ${item.configLabel} · ${item.fechaLabel}`}
                  >
                    <span className="venc-imp-proximo-accent" aria-hidden />
                    <div className="venc-imp-proximo-top">
                      <img
                        src={escudoDepartamentoSrc(item.configId)}
                        alt=""
                        className="venc-imp-proximo-escudo"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="venc-imp-proximo-meta">
                        <p className="venc-imp-proximo-depto">{item.configLabel}</p>
                        <p className="venc-imp-proximo-plazo">{diasRestantesLabel(item.diasRestantes)}</p>
                      </div>
                    </div>
                    <p className="venc-imp-proximo-cuota">
                      {modalidadRural === "contado"
                        ? "Pago contado anual"
                        : `Cuota ${item.cuota}ª · ${item.planLabel}`}
                    </p>
                    <p className="venc-imp-proximo-fecha">{item.fechaLabel}</p>
                    <span className={`venc-imp-semaforo-badge venc-imp-semaforo-badge--${semaforo.nivel}`}>
                      <span
                        className={`venc-imp-semaforo-dot venc-imp-semaforo-dot--${semaforo.nivel}`}
                        aria-hidden
                      />
                      {semaforo.label}
                    </span>
                  </button>
                );
              })}
        </VencImpProximosSection>
      </div>
    ) : null;

  return (
    <div
      className={`vencimientos-impuestos-page${onboardingFullscreen ? " vencimientos-impuestos-page--onboarding" : " venc-imp-hub-page"}`}
    >
      {setupPendiente && store && patenteStore && bpsStore && primariaStore && (
        <VencimientosImpuestosOnboarding
          store={store}
          saving={savingPrefs}
          initialJurisdiccionIds={prefs?.jurisdiccion_ids ?? []}
          initialModalidad={prefs?.modalidad_pago ?? null}
          initialModalidadPatente={prefs?.modalidad_pago_patente ?? null}
          initialSeguirPatente={prefs?.seguir_patente_sucive ?? true}
          initialSeguirBps={prefs?.seguir_bps_caja_rural ?? true}
          initialSeguirPrimaria={prefs?.seguir_primaria_rural ?? true}
          initialRegimenPrimaria={prefs?.regimen_primaria_rural ?? "con_explotacion"}
          initialPlanesCuotas={prefs?.planes_cuotas_por_jurisdiccion ?? {}}
          modoEdicion={cuentaConfigurada}
          pasoInicialOverride={onboardingPasoInicial}
          onDismiss={cuentaConfigurada ? cerrarPreferencias : undefined}
          onComplete={handleOnboardingComplete}
        />
      )}

      {!onboardingFullscreen && (
        <div className="sg-hub venc-imp-hub">
          <aside className="sg-hub-aside sg-hub-aside--venc" aria-label="Navegación Vencimientos Impuestos">
            <div className="sg-hub-aside-brand">
              <span className="sg-hub-aside-logo venc-imp-hub-aside-logo" aria-hidden>
                <MenuAppIcon id="vencimientos_impuestos" />
              </span>
              <div>
                <p className="sg-hub-aside-kicker">SAG</p>
                <p className="sg-hub-aside-title">Vencimientos</p>
              </div>
            </div>

            {opcionesImpuesto.length > 0 && (
              <nav className="sg-hub-aside-nav" aria-label="Impuestos configurados">
                <p className="sg-hub-aside-nav-label">Impuestos</p>
                {opcionesImpuesto.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    className={`sg-hub-nav-item${tipoImpuesto === op.id ? " is-active" : ""}`}
                    onClick={() => {
                      if (mostrarSelectorImpuesto || op.id === tipoImpuesto) setTipoImpuesto(op.id);
                    }}
                    aria-pressed={tipoImpuesto === op.id}
                    disabled={!mostrarSelectorImpuesto && op.id !== tipoImpuesto}
                  >
                    <span className="sg-hub-nav-copy">
                      <span>{op.label}</span>
                    </span>
                  </button>
                ))}
              </nav>
            )}

            {mostrarBarraFiltros && (
              <VencImpHubSidebarGuide
                tipoImpuesto={tipoImpuesto}
                ruralListo={!!ruralListo}
                patenteListo={!!patenteListo}
                bpsListo={!!bpsListo}
                primariaListo={!!primariaListo}
                configsCuenta={configsCuenta}
                patenteAnio={patenteStore?.calendario.anio}
                bpsAnio={bpsStore?.calendario.anio}
                primariaAnio={primariaStore?.calendario.anio}
                regimenPrimaria={regimenPrimaria}
                djPrimaria={djPrimaria}
                primariaFuenteUrls={
                  primariaStore
                    ? {
                        vencimientos: primariaStore.calendario.fuenteUrl,
                        padrones: primariaStore.calendario.fuenteUrlPadrones,
                        dj: primariaStore.calendario.fuenteUrlDj,
                      }
                    : undefined
                }
              />
            )}

            {puedeConfigurar && (
              <div className="sg-hub-aside-foot">
                <button
                  type="button"
                  className="sg-hub-nav-item sg-hub-nav-item--muted"
                  onClick={abrirPreferencias}
                  title="Preferencias compartidas de la cuenta: los cambios aplican a todos los usuarios"
                >
                  <Settings size={16} aria-hidden />
                  Preferencias de la cuenta
                </button>
              </div>
            )}
          </aside>

          <main className="sg-hub-main">
            <header className="sg-hub-main-head">
              <div>
                <h1 className="sg-hub-main-title">{impuestoActivoLabel}</h1>
                <p className="sg-hub-main-sub">
                  Contribución rural, patente SUCIVE, BPS Caja rural e Impuesto Primaria (DGI).
                </p>
              </div>
              <div className="sg-hub-main-actions">
                <span
                  className={`sg-hub-status${apiOnline ? " sg-hub-status--online" : ""}`}
                  role="status"
                >
                  {apiOnline ? "API conectada" : "Sin conexión API"}
                </span>
              </div>
            </header>

            {mostrarBarraFiltros && (
              <VencImpStatsStrip loading={loading} stats={heroStats} variant="hub" />
            )}

            {loading && (
              <div className="venc-imp-skeleton venc-imp-skeleton--hub" aria-busy="true" aria-label="Cargando calendarios">
                <div className="venc-imp-skeleton-line venc-imp-skeleton-line--banner" />
                <div className="venc-imp-skeleton-kpis">
                  <div className="venc-imp-skeleton-line venc-imp-skeleton-line--kpi" />
                  <div className="venc-imp-skeleton-line venc-imp-skeleton-line--kpi" />
                  <div className="venc-imp-skeleton-line venc-imp-skeleton-line--kpi" />
                </div>
                <div className="venc-imp-skeleton-cards">
                  <div className="venc-imp-skeleton-line venc-imp-skeleton-line--card" />
                  <div className="venc-imp-skeleton-line venc-imp-skeleton-line--card" />
                  <div className="venc-imp-skeleton-line venc-imp-skeleton-line--card" />
                  <div className="venc-imp-skeleton-line venc-imp-skeleton-line--card" />
                </div>
              </div>
            )}

            {configPendienteLector && (
              <p className="venc-imp-empty venc-imp-empty--cuenta-pendiente" role="status">
                La configuración de vencimientos de esta cuenta aún no fue realizada. Un{" "}
                <strong>Administrador</strong> o <strong>Gestor</strong> (N1 o N2) con permiso de edición
                debe completar el asistente inicial una sola vez. Cuando esté lista, todos los usuarios de la
                cuenta verán aquí los mismos vencimientos.
              </p>
            )}

            {!setupPendiente && !configPendienteLector && (
              <div className="venc-imp-hub-workspace">
                {totalPanel}
                {patentePanel}
                {bpsPanel}
                {primariaPanel}
                {ruralPanel}
              </div>
            )}

            {!ruralListo &&
              cuentaConfigurada &&
              departamentosCuenta.length === 0 &&
              patenteListo &&
              tipoImpuesto !== "patente" && (
                <section
                  className="venc-imp-user-banner venc-imp-user-banner--patente venc-imp-hub-panel sg-hub-panel"
                  aria-label="Configuración de la cuenta"
                >
                  <div className="venc-imp-user-banner-main">
                    <p className="venc-imp-user-banner-kicker">Calendario de la cuenta</p>
                    <p className="venc-imp-user-banner-text">
                      <strong>Patente SUCIVE</strong>
                    </p>
                    <p className="venc-imp-user-banner-deptos">{MODALIDAD_PAGO_LABEL[modalidadPatente]}</p>
                  </div>
                </section>
              )}
          </main>
        </div>
      )}

      {calendarioModal && (
        <Suspense fallback={null}>
          <VencImpCalendarioModal
            key={`${calendarioModal.config.esPatenteSucive ? "patente" : calendarioModal.config.esBpsCajaRural ? "bps" : calendarioModal.config.esPrimariaRural ? "primaria" : "rural"}-${calendarioModal.config.id}-${calendarioModal.config.anio}`}
            config={calendarioModal.config}
            modalidadUsuario={calendarioModal.modalidadUsuario}
            planUsuario={calendarioModal.planUsuario}
            onClose={() => setCalendarioModal(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
