import { useCallback, useEffect, useRef, useState } from "react";
import { useFormularioMayusculas } from "./hooks/useFormularioMayusculas";
import { useAppTopChrome } from "./hooks/useAppTopChrome";
import {
  checkApiHealth,
  fetchCatalogos,
  fetchCurrentUser,
  fetchPresupuestoById,
  logoutAuth,
  enviarPresencia,
  registrarPantallaActividad,
  retryDbInit,
} from "./api";
import { DEFAULT_CATALOGOS } from "./constants";
import { pushRecentHomeModule } from "./utils/home-quick-modules";
import { clearAllSessionCaches } from "./utils/clear-session-caches";
import type { AuthUser, Catalogos, Presupuesto as PresupuestoRow } from "./types";
import type { TabId } from "./components/Header";
import HomeMenu, { type ScreenId } from "./components/HomeMenu";
import HomeMarketTicker from "./components/HomeMarketTicker";
import MainHeaderNav from "./components/MainHeaderNav";
import AppFooter from "./components/AppFooter";
import LoginScreen from "./components/LoginScreen";
import ForgotPasswordScreen from "./components/ForgotPasswordScreen";
import ResetPasswordScreen from "./components/ResetPasswordScreen";
import ArquitecturaSistema from "./components/ArquitecturaSistema";
import PresupuestoModule from "./components/presupuesto/Presupuesto";
import Configuracion from "./components/Configuracion";
import Divisas from "./components/Divisas";
import PreciosGanado from "./components/precios-ganado/PreciosGanado";
import RecursosHumanos from "./components/RecursosHumanos";
import IngresosVentas from "./components/ventas/IngresosVentas";
import StockGanadero from "./components/stock/StockGanadero";
import CampoMapa from "./components/campo/CampoMapa";
import TareasOperativas from "./components/operaciones/TareasOperativas";
import StockEquino from "./components/stock-equino/StockEquino";
import DocumentosDigitales from "./components/DocumentosDigitales";
import VencimientosImpuestos from "./components/VencimientosImpuestos";
import ChatPanel from "./components/ChatPanel";
import ChatInterno from "./components/ChatInterno";
import Notas from "./components/Notas";
import ChatExternalRequestHost from "./components/chat/ChatExternalRequestHost";
import MiCuentaPanel from "./components/MiCuentaModal";
import ConfirmDialogHost from "./components/ConfirmDialogHost";
import AppBootScreen from "./components/AppBootScreen";
import { ChatExternalRequestsProvider } from "./context/ChatExternalRequestsContext";
import { HeaderBackProvider } from "./header-back";
import {
  canAccessArquitecturaSistema,
  canAccessChat,
  canAccessScreen,
  type ActividadVistaModo,
} from "./utils/auth-permissions";
import { showToast } from "./utils/toast";
import { clearVencImpLoginAlertStorage } from "./utils/vencimientos-impuestos-alertas";
import { notifyVencimientosProximosOnLogin } from "./utils/vencimientos-impuestos-login-notify";
import { setVencImpProximosCount } from "./utils/vencimientos-impuestos-proximos-badge";

const DB_BOOT_TIMEOUT_MS = 90_000;

function parseResetTokenFromUrl(): string | null {
  const token = new URLSearchParams(window.location.search).get("reset")?.trim();
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : null;
}

function clearResetTokenFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("reset")) return;
  url.searchParams.delete("reset");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export default function App() {
  useFormularioMayusculas();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState<ScreenId>("home");
  const [navHistory, setNavHistory] = useState<ScreenId[]>([]);
  const [catalogos, setCatalogos] = useState<Catalogos>(DEFAULT_CATALOGOS);
  const [apiOnline, setApiOnline] = useState(false);
  const [booting, setBooting] = useState(true);
  const [bootPhase, setBootPhase] = useState<"api" | "db">("api");
  const [bootBlocked, setBootBlocked] = useState(false);
  const [bootError, setBootError] = useState("");
  const [editRow, setEditRow] = useState<PresupuestoRow | null>(null);
  const [listKey, setListKey] = useState(0);
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [authView, setAuthView] = useState<"login" | "forgot">("login");
  const [resetToken, setResetToken] = useState<string | null>(parseResetTokenFromUrl);
  const [forgotEmail, setForgotEmail] = useState("");
  const [actividadModoOverride, setActividadModoOverride] = useState<ActividadVistaModo | null>(
    null
  );
  const [configModuloInicial, setConfigModuloInicial] = useState<"registro_actividad" | null>(null);
  const hadUserRef = useRef(false);
  const freshLoginRef = useRef(false);
  const sessionUserIdRef = useRef<number | null>(null);
  const dbBootStartedRef = useRef<number | null>(null);
  const screenRef = useRef<ScreenId>("home");
  const navHistoryRef = useRef<ScreenId[]>([]);
  screenRef.current = screen;
  navHistoryRef.current = navHistory;

  useAppTopChrome(!!user);

  const notify = useCallback((msg: string, ok = true, title?: string) => {
    showToast(msg, ok, title);
  }, []);

  const trackPantalla = useCallback(
    (pantalla: string, recordRecent = true) => {
      registrarPantallaActividad(pantalla);
      if (recordRecent && user?.id) pushRecentHomeModule(user.id, pantalla);
    },
    [user?.id]
  );

  const runVencimientosLoginAlert = useCallback(async (userId: number, force = false) => {
    await notifyVencimientosProximosOnLogin(userId, { force });
  }, []);

  const resetToHomeScreen = useCallback(() => {
    navHistoryRef.current = [];
    setNavHistory([]);
    setScreen("home");
    setEditRow(null);
    setChatOpen(false);
    setCuentaOpen(false);
    setActividadModoOverride(null);
    setConfigModuloInicial(null);
  }, []);

  useEffect(() => {
    if (!user) {
      sessionUserIdRef.current = null;
      return;
    }
    if (sessionUserIdRef.current === user.id) return;
    sessionUserIdRef.current = user.id;
    resetToHomeScreen();
    registrarPantallaActividad("home");
  }, [user?.id, resetToHomeScreen]);

  useEffect(() => {
    if (!user || !apiOnline) return;
    if (freshLoginRef.current) {
      freshLoginRef.current = false;
      return;
    }
    void runVencimientosLoginAlert(user.id, false);
  }, [user?.id, apiOnline, runVencimientosLoginAlert]);

  const refreshCatalogos = useCallback(async () => {
    if (!user) return;
    try {
      const c = await fetchCatalogos();
      setCatalogos(c);
    } catch {
      /* mantener catálogo actual si falla el refresh */
    }
  }, [user]);

  const connectApi = useCallback(async () => {
    const healthTimeout =
      dbBootStartedRef.current != null ? 20_000 : 8_000;
    const health = await checkApiHealth(healthTimeout);
    const ok = health.online && health.ready;
    setApiOnline(ok);
    setBootPhase(health.online && !health.ready ? "db" : "api");
    if (ok) {
      dbBootStartedRef.current = null;
      setBootBlocked(false);
      setBootError("");
      const me = await fetchCurrentUser();
      setUser(me);
      setAuthChecked(true);
      setBooting(false);
      if (me) {
        void fetchCatalogos()
          .then((c) => setCatalogos(c))
          .catch(() =>
            setCatalogos((prev) => ({
              ...prev,
              responsables: [],
              funcionarios: [],
            }))
          );
      }
    } else if (health.online && !health.ready) {
      const startedAt = dbBootStartedRef.current ?? Date.now();
      dbBootStartedRef.current = startedAt;
      setBootError(
        health.detail ||
          health.hint ||
          health.error ||
          "El servidor está iniciando la base de datos. En producción puede tardar hasta un minuto en el primer acceso."
      );
      if (health.detail || health.hint || health.error || Date.now() - startedAt >= DB_BOOT_TIMEOUT_MS) {
        setBootBlocked(true);
      }
    } else if (!health.online) {
      dbBootStartedRef.current = null;
      setBootBlocked(false);
      setBootError("");
      setUser(null);
      setAuthChecked(true);
      setBooting(false);
    }
    return ok;
  }, []);

  const retryBoot = useCallback(() => {
    dbBootStartedRef.current = null;
    setBootBlocked(false);
    setBootError("");
    setBooting(true);
    setAuthChecked(false);
    void retryDbInit()
      .catch(() => undefined)
      .finally(() => {
        void connectApi();
      });
  }, [connectApi]);

  useEffect(() => {
    void connectApi();
  }, [connectApi]);

  useEffect(() => {
    if (apiOnline) return;
    const interval = setInterval(() => void connectApi(), booting ? 800 : 4000);
    return () => clearInterval(interval);
  }, [apiOnline, booting, connectApi]);

  useEffect(() => {
    if (user) hadUserRef.current = true;
  }, [user]);

  useEffect(() => {
    if (!user || !apiOnline) return;
    const tick = () => enviarPresencia(screenRef.current);
    tick();
    const id = window.setInterval(tick, 40_000);
    return () => window.clearInterval(id);
  }, [user, apiOnline, screen]);

  useEffect(() => {
    const onUnauthorized = () => {
      const wasLoggedIn = hadUserRef.current;
      setVencImpProximosCount(0);
      setUser(null);
      setNavHistory([]);
      navHistoryRef.current = [];
      setScreen("home");
      setEditRow(null);
      hadUserRef.current = false;
      if (wasLoggedIn) {
        notify("Tu sesión expiró. Volvé a iniciar sesión.", false);
      }
    };
    window.addEventListener("scg-unauthorized", onUnauthorized);
    return () => window.removeEventListener("scg-unauthorized", onUnauthorized);
  }, [notify]);

  const goHome = () => {
    resetToHomeScreen();
    trackPantalla("home");
  };

  const goBackScreen = () => {
    const h = navHistoryRef.current;
    if (h.length === 0) return;
    const prev = h[h.length - 1]!;
    const next = h.slice(0, -1);
    navHistoryRef.current = next;
    setNavHistory(next);
    setScreen(prev);
    if (prev !== "registro") setEditRow(null);
    trackPantalla(prev);
  };

  const pushNavHistory = () => {
    const next = [...navHistoryRef.current, screenRef.current];
    navHistoryRef.current = next;
    setNavHistory(next);
  };

  const openChatPage = () => {
    setCuentaOpen(false);
    setChatOpen(false);
    if (screenRef.current === "chat") {
      volverDesdeChat();
      return;
    }
    pushNavHistory();
    setScreen("chat");
    setEditRow(null);
    trackPantalla("chat");
  };

  const volverDesdeChat = () => {
    if (navHistoryRef.current.length > 0) goBackScreen();
    else goHome();
  };

  const navigate = (id: TabId, opts?: { actividadModo?: ActividadVistaModo }) => {
    if (!user) {
      notify("No tenés permiso para acceder a ese módulo", false);
      return;
    }
    if (id === "chat") {
      openChatPage();
      return;
    }
    if (!canAccessScreen(user, id)) {
      notify("No tenés permiso para acceder a ese módulo", false);
      return;
    }
    if (id === "registro_actividad") {
      setConfigModuloInicial("registro_actividad");
      setActividadModoOverride(opts?.actividadModo ?? null);
      if (screenRef.current !== "configuracion") pushNavHistory();
      setScreen("configuracion");
      setEditRow(null);
      trackPantalla("configuracion");
      return;
    }
    setActividadModoOverride(null);
    setConfigModuloInicial(null);
    if (screenRef.current !== id) pushNavHistory();
    setScreen(id);
    if (id !== "registro") setEditRow(null);
    trackPantalla(id);
  };

  const onLogin = (u: AuthUser) => {
    freshLoginRef.current = true;
    sessionUserIdRef.current = null;
    setUser(u);
    resetToHomeScreen();
    void (async () => {
      try {
        const c = await fetchCatalogos();
        setCatalogos(c);
      } catch {
        setCatalogos((prev) => ({
          ...prev,
          responsables: [],
          funcionarios: [],
        }));
      }
    })();
    void runVencimientosLoginAlert(u.id, true);
    notify(`Bienvenido, ${u.nombre}`, true, "Sesión iniciada");
  };

  const onLogout = async () => {
    const userId = user?.id;
    try {
      await logoutAuth();
    } catch {
      /* cerrar sesión local aunque falle la API */
    }
    if (userId != null) clearVencImpLoginAlertStorage(userId);
    setVencImpProximosCount(0);
    setUser(null);
    clearAllSessionCaches();
    navHistoryRef.current = [];
    setNavHistory([]);
    setScreen("home");
    setEditRow(null);
    setCatalogos(DEFAULT_CATALOGOS);
    notify("Sesión cerrada", true);
  };

  const onSaved = () => {
    setEditRow(null);
    setListKey((k) => k + 1);
  };

  const onEdit = (row: PresupuestoRow) => {
    if (screenRef.current !== "registro") pushNavHistory();
    setEditRow(row);
    setScreen("registro");
    trackPantalla("registro");
  };

  if (bootBlocked) {
    return (
      <AppBootScreen
        title="No se pudo iniciar la base de datos"
        subtitle="El servidor respondió, pero la base todavía no quedó lista. Puede ser un arranque en frío de Supabase o un problema con la conexión."
        busy={false}
      >
        {bootError ? <code className="app-boot-code">{bootError}</code> : null}
        <button type="button" className="btn btn-primary app-boot-retry" onClick={retryBoot}>
          Reintentar
        </button>
      </AppBootScreen>
    );
  }

  if (booting || !authChecked) {
    return (
      <AppBootScreen
        title="Cargando SAG…"
        subtitle={
          bootPhase === "db"
            ? "Iniciando base de datos…"
            : import.meta.env.DEV
              ? "Conectando con la API local…"
              : "Conectando con el servidor…"
        }
      />
    );
  }

  if (!user) {
    if (resetToken) {
      return (
        <div className="app-shell app-shell--login">
          <ResetPasswordScreen
            token={resetToken}
            apiOnline={apiOnline}
            onBack={() => {
              clearResetTokenFromUrl();
              setResetToken(null);
              setAuthView("login");
            }}
            onSuccess={(msg) => {
              clearResetTokenFromUrl();
              setResetToken(null);
              setAuthView("login");
              notify(msg, true, "Contraseña actualizada");
            }}
            onError={(m) => notify(m, false)}
          />
          <ConfirmDialogHost />
        </div>
      );
    }

    if (authView === "forgot") {
      return (
        <div className="app-shell app-shell--login">
          <ForgotPasswordScreen
            apiOnline={apiOnline}
            initialEmail={forgotEmail}
            onBack={() => setAuthView("login")}
            onError={(m) => notify(m, false)}
          />
          <ConfirmDialogHost />
        </div>
      );
    }

    return (
      <div className="app-shell app-shell--login">
        <LoginScreen
          apiOnline={apiOnline}
          onLogin={onLogin}
          onError={(m) => notify(m, false)}
          onForgotPassword={(email) => {
            setForgotEmail(email);
            setAuthView("forgot");
          }}
        />
        <ConfirmDialogHost />
      </div>
    );
  }

  const chatAccess = user != null && canAccessChat(user);

  const appBody = (
    <>
      <div className="app-shell">
        <div id="app-chrome-top" className="app-chrome-top">
          <MainHeaderNav
            user={user}
            screen={screen}
            navHistory={navHistory}
            onHome={goHome}
            onGoBackScreen={goBackScreen}
            onLogout={() => void onLogout()}
            onOpenCuenta={() => setCuentaOpen(true)}
            onUserUpdated={setUser}
            onPasswordChanged={(msg) => {
              setCuentaOpen(false);
              setUser(null);
              navHistoryRef.current = [];
              setNavHistory([]);
              setScreen("home");
              setEditRow(null);
              hadUserRef.current = false;
              notify(msg, true, "Contraseña actualizada");
            }}
            onError={(m) => notify(m, false)}
          />

          <HomeMarketTicker apiOnline={apiOnline} />
        </div>

      <div className="layout-content">
        {cuentaOpen ? (
          <main className="page-main bn-ui">
            <MiCuentaPanel
              user={user}
              apiOnline={apiOnline}
              onVolver={() => setCuentaOpen(false)}
              onUserUpdated={setUser}
              onPasswordChanged={(msg) => {
                setCuentaOpen(false);
                setUser(null);
                navHistoryRef.current = [];
                setNavHistory([]);
                setScreen("home");
                setEditRow(null);
                hadUserRef.current = false;
                notify(msg, true, "Contraseña actualizada");
              }}
              onError={(m) => notify(m, false)}
            />
          </main>
        ) : screen === "home" ? (
          <main className="page-main bn-ui">
            <HomeMenu user={user} apiOnline={apiOnline} onOpen={navigate} />
          </main>
        ) : (
          <main className="layout-frame page-main bn-ui">
            {(screen === "registro" || screen === "listado" || screen === "resumen") && (
              <PresupuestoModule
                screen={screen}
                catalogos={catalogos}
                currentUser={user}
                editRow={editRow}
                listKey={listKey}
                apiOnline={apiOnline}
                onScreenChange={navigate}
                onVolver={goHome}
                onSaved={onSaved}
                onCancelEdit={() => setEditRow(null)}
                onEdit={onEdit}
                onDeleted={() => {
                  notify("Registro eliminado");
                  setListKey((k) => k + 1);
                }}
                onCatalogosChanged={refreshCatalogos}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
              />
            )}
            {screen === "vencimientos_impuestos" && (
              <VencimientosImpuestos
                apiOnline={apiOnline}
                currentUser={user}
                onError={(m) => notify(m, false)}
              />
            )}
            {screen === "configuracion" && (
              <Configuracion
                apiOnline={apiOnline}
                currentUser={user}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onCatalogosChanged={refreshCatalogos}
                onVolver={goHome}
                onOpenMiPerfil={() => setCuentaOpen(true)}
                moduloInicial={configModuloInicial}
                actividadModoInicial={actividadModoOverride}
                onModuloInicialConsumido={() => {
                  setConfigModuloInicial(null);
                  setActividadModoOverride(null);
                }}
              />
            )}
            {screen === "divisas" && (
              <Divisas
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
                onVolver={goHome}
              />
            )}
            {screen === "precios_ganado" && (
              <PreciosGanado
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
                onVolver={goHome}
              />
            )}
            {screen === "simulador_venta_ganado" && user && (
              <IngresosVentas
                user={user}
                catalogos={catalogos}
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onVolver={goHome}
                initialVista="simulador"
              />
            )}
            {screen === "recursos_humanos" && (
              <RecursosHumanos
                catalogos={catalogos}
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
                onCatalogosChanged={refreshCatalogos}
                onVolver={goHome}
                onEditGasto={async (id) => {
                  try {
                    const row = await fetchPresupuestoById(id);
                    onEdit(row);
                  } catch (e) {
                    notify(
                      e instanceof Error ? e.message : "No se pudo abrir el gasto",
                      false
                    );
                  }
                }}
              />
            )}
            {screen === "ingresos_ventas" && user && (
              <IngresosVentas
                user={user}
                catalogos={catalogos}
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onVolver={goHome}
              />
            )}
            {screen === "stock_ganadero" && (
              <StockGanadero
                apiOnline={apiOnline}
                currentUser={user}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onVolver={goHome}
              />
            )}
            {screen === "campo_mapa" && user && (
              <CampoMapa
                apiOnline={apiOnline}
                currentUser={user}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
                onVolver={goHome}
              />
            )}
            {screen === "tareas_operativas" && user && (
              <TareasOperativas
                apiOnline={apiOnline}
                currentUser={user}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
                onVolver={goHome}
                onOpenMapa={() => setScreen("campo_mapa")}
              />
            )}
            {screen === "stock_equino" && (
              <StockEquino
                apiOnline={apiOnline}
                currentUser={user}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onVolver={goHome}
              />
            )}
            {screen === "panel_admin_sitio" && user && canAccessArquitecturaSistema(user) && (
              <ArquitecturaSistema
                apiOnline={apiOnline}
                titulo="Administración del sitio"
                volverLabel="Volver al inicio"
                onVolver={goHome}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
              />
            )}
            {screen === "documentos_digitales" && user?.es_super_admin && (
              <DocumentosDigitales
                apiOnline={apiOnline}
                onVolver={goHome}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
              />
            )}
            {screen === "chat" && user && (
              <ChatInterno user={user} variant="page" onClose={volverDesdeChat} />
            )}
            {screen === "notas" && user && (
              <Notas
                apiOnline={apiOnline}
                currentUser={user}
                onVolver={goHome}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
              />
            )}
          </main>
        )}
      </div>

      {user && canAccessChat(user) && (
        <ChatPanel
          user={user}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onOpenFullscreen={openChatPage}
        />
      )}

      <AppFooter
        user={user}
        chatOpen={chatOpen}
        chatPageOpen={screen === "chat"}
        onOpenChat={() => {
          setCuentaOpen(false);
          if (screen === "chat") {
            volverDesdeChat();
            return;
          }
          setChatOpen((open) => !open);
        }}
      />

      <ConfirmDialogHost />
      </div>
    </>
  );

  return (
    <HeaderBackProvider>
      {chatAccess ? (
        <ChatExternalRequestsProvider
          key={user.id}
          userId={user.id}
          enabled
          onAccepted={(_requesterId, requesterNombre) => {
            showToast(`Autorizaste a ${requesterNombre}. Ya pueden chatear.`, true);
          }}
        >
          {appBody}
          <ChatExternalRequestHost />
        </ChatExternalRequestsProvider>
      ) : (
        appBody
      )}
    </HeaderBackProvider>
  );
}
