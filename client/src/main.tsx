import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "toastr/build/toastr.min.css";
import App from "./App";
import "./index.css";
import "./sg-hub-modules.css";
import "./chat-interno-hub.css";
import "./usuarios-actividad-hub.css";
import "./ventas-ingresos-hub.css";
import "./responsive.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
