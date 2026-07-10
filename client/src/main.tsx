import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "toastr/build/toastr.min.css";
import "leaflet/dist/leaflet.css";
import App from "./App";
import "./index.css";
import "./sg-hub-modules.css";
import "./chat-interno-hub.css";
import "./usuarios-actividad-hub.css";
import "./usuarios-admin-hub.css";
import "./arquitectura-sistema-hub.css";
import "./presupuesto-hub.css";
import "./rrhh-hub.css";
import "./divisas-hub.css";
import "./mi-cuenta-hub.css";
import "./stock-admin-hub.css";
import "./stock-producto-ficha-hub.css";
import "./campo-mapa-hub.css";
import "./rubros-sag-monitor.css";
import "./home-layout-users-monitor.css";
import "./ayuda-hub.css";
import "./asistente-hub.css";
import "./tareas-operativas-hub.css";
import "./responsive.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
