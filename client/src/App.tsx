import { useCallback, useEffect, useRef, useState } from "react";
import { useFormularioMayusculas } from "./hooks/useFormularioMayusculas";
import {
  checkApiHealth,
  fetchCatalogos,
  fetchCurrentUser,
  fetchPresupuestoById,
  logoutAuth,
  enviarPresencia,
  registrarPantallaActividad,
} from "./api";
import { DEFAULT_CATALOGOS } from "./constants";
import type { AuthUser, Catalogos, Presupuesto } from "./types";
import type { TabId } from "./components/Header";
import HomeMenu, { type ScreenId } from "./components/HomeMenu";
import HomeMarketTicker from "./components/HomeMarketTicker";
import MainHeaderNav from "./components/MainHeaderNav";
import AppFooter from "./components/AppFooter";
import LoginScreen from "./components/LoginScreen";
import UsuariosHub from "./components/UsuariosHub";
import FormGasto from "./components/FormGasto";
import Listado from "./components/Listado";
import Resumen from "./components/Resumen";
import Configuracion from "./components/Configuracion";
import Divisas from "./components/Divisas";
import PreciosGanado from "./components/precios-ganado/PreciosGanado";
import SimuladorVentas from "./components/simulador-venta/SimuladorVentas";
import RecursosHumanos from "./components/RecursosHumanos";
import IngresosVentas from "./components/ventas/IngresosVentas";
import StockGanadero from "./components/stock/StockGanadero";
import DocumentosDigitales from "./components/DocumentosDigitales";
import ChatPanel from "./components/ChatPanel";
import ChatInterno from "./components/ChatInterno";
import MiCuentaPanel from "./components/MiCuentaModal";
import ConfirmDialogHost from "./components/ConfirmDialogHost";
import { HeaderBackProvider } from "./header-back";
import {
  canAccessChat,
  canAccessScreen,
} from "./utils/auth-permissions";
import { showToast } from "./utils/toast";

const DB_BOOT_TIMEOUT_MS = 25_000;

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
  const [editRow, setEditRow] = useState<Presupuesto | null>(null);
  const [listKey, setListKey] = useState(0);
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const hadUserRef = useRef(false);
  const dbBootStartedRef = useRef<number | null>(null);
  const screenRef = useRef<ScreenId>("home");
  const navHistoryRef = useRef<ScreenId[]>([]);
  screenRef.current = screen;
  navHistoryRef.current = navHistory;

  const notify = useCallback((msg: string, ok = true, title?: string) => {
    showToast(msg, ok, title);
  }, []);

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
    const health = await checkApiHealth();
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
          .catch(() => setCatalogos(DEFAULT_CATALOGOS));
      }
    } else if (health.online && !health.ready) {
      const startedAt = dbBootStartedRef.current ?? Date.now();
      dbBootStartedRef.current = startedAt;
      const detail = health.detail || health.error || "";
      setBootError(detail);
      if (Date.now() - startedAt >= DB_BOOT_TIMEOUT_MS) {
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
    void connectApi();
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
    navHistoryRef.current = [];
    setNavHistory([]);
    setScreen("home");
    setEditRow(null);
    setChatOpen(false);
    registrarPantallaActividad("home");
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
    registrarPantallaActividad(prev);
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
    registrarPantallaActividad("chat");
  };

  const volverDesdeChat = () => {
    if (navHistoryRef.current.length > 0) goBackScreen();
    else goHome();
  };

  const navigate = (id: TabId) => {
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
    if (screenRef.current !== id) pushNavHistory();
    setScreen(id);
    if (id !== "registro") setEditRow(null);
    registrarPantallaActividad(id);
  };

  const onLogin = (u: AuthUser) => {
    setUser(u);
    navHistoryRef.current = [];
    setNavHistory([]);
    setScreen("home");
    void (async () => {
      try {
        const c = await fetchCatalogos();
        setCatalogos(c);
      } catch {
        setCatalogos(DEFAULT_CATALOGOS);
      }
    })();
    notify(`Bienvenido, ${u.nombre}`, true, "Sesión iniciada");
  };

  const onLogout = async () => {
    try {
      await logoutAuth();
    } catch {
      /* cerrar sesión local aunque falle la API */
    }
    setUser(null);
    navHistoryRef.current = [];
    setNavHistory([]);
    setScreen("home");
    setEditRow(null);
    setCatalogos(DEFAULT_CATALOGOS);
    notify("Sesión cerrada", true);
  };

  const refreshUser = useCallback(async () => {
    if (!apiOnline) return;
    const me = await fetchCurrentUser();
    if (me) setUser(me);
  }, [apiOnline]);

  const onSaved = () => {
    setEditRow(null);
    setListKey((k) => k + 1);
  };

  const onEdit = (row: Presupuesto) => {
    if (screenRef.current !== "registro") pushNavHistory();
    setEditRow(row);
    setScreen("registro");
    registrarPantallaActividad("registro");
  };

  if (bootBlocked) {
    return (
      <div className="loading-screen loading-screen--blocked">
        <p>No se pudo iniciar la base de datos</p>
        <p className="muted">
          El servidor respondió, pero la base todavía no quedó lista. Puede ser un arranque en frío de
          Supabase o un problema con la conexión.
        </p>
        {bootError ? <code>{bootError}</code> : null}
        <button type="button" className="btn btn-primary" onClick={retryBoot}>
          Reintentar
        </button>
      </div>
    );
  }

  if (booting || !authChecked) {
    return (
      <div className="loading-screen">
        <p>Cargando SAG...</p>
        <p className="muted">
          {bootPhase === "db"
            ? "Iniciando base de datos…"
            : import.meta.env.DEV
              ? "Conectando con la API local…"
              : "Conectando con el servidor…"}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell app-shell--login">
        <LoginScreen
          apiOnline={apiOnline}
          onLogin={onLogin}
          onError={(m) => notify(m, false)}
        />
        <AppFooter user={null} />
        <ConfirmDialogHost />
      </div>
    );
  }

  return (
    <HeaderBackProvider>
      <div className="app-shell">
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

      <div className="layout-content">
        {cuentaOpen ? (
          <main className="layout-frame page-main bn-ui">
            <MiCuentaPanel
              user={user}
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
          <HomeMenu user={user} onOpen={navigate} />
        ) : (
          <main className="layout-frame page-main bn-ui">
            {screen === "registro" && (
              <FormGasto
                catalogos={catalogos}
                currentUser={user}
                editRow={editRow}
                apiOnline={apiOnline}
                onSaved={onSaved}
                onCancelEdit={() => setEditRow(null)}
                onEdit={onEdit}
                onCatalogosChanged={refreshCatalogos}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
              />
            )}
            {screen === "listado" && (
              <Listado
                key={listKey}
                catalogos={catalogos}
                apiOnline={apiOnline}
                onEdit={onEdit}
                onDeleted={() => {
                  notify("Registro eliminado");
                  setListKey((k) => k + 1);
                }}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
              />
            )}
            {screen === "resumen" && (
              <Resumen
                catalogos={catalogos}
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
              />
            )}
            {screen === "configuracion" && (
              <Configuracion
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
                onCatalogosChanged={refreshCatalogos}
                onVolver={goHome}
              />
            )}
            {screen === "divisas" && (
              <Divisas
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
              />
            )}
            {screen === "precios_ganado" && (
              <PreciosGanado
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
              />
            )}
            {screen === "simulador_venta_ganado" && (
              <SimuladorVentas
                user={user}
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
              />
            )}
            {screen === "recursos_humanos" && (
              <RecursosHumanos
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
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onVolver={goHome}
              />
            )}
            {screen === "stock_ganadero" && (
              <StockGanadero
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onVolver={goHome}
              />
            )}
            {screen === "usuarios" && user && (
              <UsuariosHub
                user={user}
                apiOnline={apiOnline}
                onVolver={goHome}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
                onPermissionsChanged={() => void refreshUser()}
              />
            )}
            {screen === "documentos_digitales" && user?.rol === "admin" && (
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
    </HeaderBackProvider>
  );
}
