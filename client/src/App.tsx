import { useCallback, useEffect, useRef, useState } from "react";
import { useFormularioMayusculas } from "./hooks/useFormularioMayusculas";
import {
  checkApiHealth,
  fetchCatalogos,
  fetchCurrentUser,
  fetchPresupuestoById,
  logoutAuth,
} from "./api";
import { DEFAULT_CATALOGOS } from "./constants";
import type { AuthUser, Catalogos, Presupuesto } from "./types";
import type { TabId } from "./components/Header";
import HomeMenu, { type ScreenId } from "./components/HomeMenu";
import MainHeader from "./components/MainHeader";
import AppFooter from "./components/AppFooter";
import LoginScreen from "./components/LoginScreen";
import Usuarios from "./components/Usuarios";
import FormGasto from "./components/FormGasto";
import Listado from "./components/Listado";
import Resumen from "./components/Resumen";
import Configuracion from "./components/Configuracion";
import Divisas from "./components/Divisas";
import RecursosHumanos from "./components/RecursosHumanos";
import IngresosVentas from "./components/ventas/IngresosVentas";
import StockGanadero from "./components/stock/StockGanadero";
import StockMovimientosAuditoria from "./components/stock/StockMovimientosAuditoria";
import ConfirmDialogHost from "./components/ConfirmDialogHost";
import { canAccessScreen, canAccessStockMovimientos } from "./utils/auth-permissions";
import { showToast } from "./utils/toast";

export default function App() {
  useFormularioMayusculas();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState<ScreenId>("home");
  const [catalogos, setCatalogos] = useState<Catalogos>(DEFAULT_CATALOGOS);
  const [apiOnline, setApiOnline] = useState(false);
  const [booting, setBooting] = useState(true);
  const [editRow, setEditRow] = useState<Presupuesto | null>(null);
  const [listKey, setListKey] = useState(0);
  const hadUserRef = useRef(false);

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
    const ok = await checkApiHealth();
    setApiOnline(ok);
    if (ok) {
      const me = await fetchCurrentUser();
      setUser(me);
      if (me) {
        try {
          const c = await fetchCatalogos();
          setCatalogos(c);
        } catch {
          setCatalogos(DEFAULT_CATALOGOS);
        }
      }
    } else {
      setUser(null);
    }
    setAuthChecked(true);
    setBooting(false);
    return ok;
  }, []);

  useEffect(() => {
    void connectApi();
  }, [connectApi]);

  useEffect(() => {
    if (apiOnline) return;
    const interval = setInterval(() => void connectApi(), 4000);
    return () => clearInterval(interval);
  }, [apiOnline, connectApi]);

  useEffect(() => {
    if (user) hadUserRef.current = true;
  }, [user]);

  useEffect(() => {
    const onUnauthorized = () => {
      const wasLoggedIn = hadUserRef.current;
      setUser(null);
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
    setScreen("home");
    setEditRow(null);
  };

  const navigate = (id: TabId) => {
    if (!user) {
      notify("No tenés permiso para acceder a ese módulo", false);
      return;
    }
    if (id === "stock_movimientos") {
      if (!canAccessStockMovimientos(user)) {
        notify("Solo administradores pueden ver el registro de movimientos", false);
        return;
      }
    } else if (!canAccessScreen(user, id)) {
      notify("No tenés permiso para acceder a ese módulo", false);
      return;
    }
    setScreen(id);
    if (id !== "registro") setEditRow(null);
  };

  const onLogin = (u: AuthUser) => {
    setUser(u);
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
    setEditRow(row);
    setScreen("registro");
  };

  if (booting || !authChecked) {
    return (
      <div className="loading-screen">
        <p>Cargando SGG...</p>
        <p className="muted">
          {import.meta.env.DEV
            ? "Iniciando conexión con la API local"
            : "Conectando con el servidor"}
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
        <ConfirmDialogHost />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <MainHeader user={user} onHome={goHome} onLogout={() => void onLogout()} />

      <div className="layout-content">
        {screen === "home" ? (
          <HomeMenu user={user} onOpen={navigate} />
        ) : (
          <main className="layout-frame page-main bn-ui">
            {screen === "registro" && (
              <FormGasto
                catalogos={catalogos}
                editRow={editRow}
                apiOnline={apiOnline}
                onSaved={onSaved}
                onCancelEdit={() => setEditRow(null)}
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
            {screen === "ingresos_ventas" && (
              <IngresosVentas
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
            {screen === "stock_movimientos" && (
              <StockMovimientosAuditoria
                apiOnline={apiOnline}
                onError={(m) => notify(m, false)}
                onVolver={goHome}
              />
            )}
            {screen === "usuarios" && (
              <Usuarios
                apiOnline={apiOnline}
                currentUser={user}
                onVolver={goHome}
                onError={(m) => notify(m, false)}
                onSuccess={(m) => notify(m, true)}
                onPermissionsChanged={() => void refreshUser()}
              />
            )}
          </main>
        )}
      </div>

      <AppFooter apiOnline={apiOnline} />
      <ConfirmDialogHost />
    </div>
  );
}
