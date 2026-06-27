import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "toastr/build/toastr.min.css";
import App from "./App";
import "./index.css";
import "./responsive.css";
import { installExtensionNoiseGuard } from "./utils/extension-noise-guard";

installExtensionNoiseGuard();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
