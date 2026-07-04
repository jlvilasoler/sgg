import toastr from "toastr";

let configured = false;

function configureToastr() {
  if (configured) return;
  configured = true;

  toastr.options = {
    closeButton: true,
    debug: false,
    escapeHtml: true,
    newestOnTop: true,
    progressBar: true,
    positionClass: "toast-top-right",
    preventDuplicates: true,
    showDuration: 280,
    hideDuration: 320,
    timeOut: 5200,
    extendedTimeOut: 1800,
    showEasing: "swing",
    hideEasing: "linear",
    showMethod: "fadeIn",
    hideMethod: "fadeOut",
    tapToDismiss: true,
  };
}

/** Notificación de éxito (estilo Toastr, tema SGG). */
export function toastSuccess(message: string, title = "Éxito") {
  configureToastr();
  toastr.success(message, title);
}

/** Notificación de error. */
export function toastError(message: string, title = "Error") {
  configureToastr();
  toastr.error(message, title);
}

/** Notificación informativa. */
export function toastInfo(message: string, title = "Información", options?: Partial<typeof toastr.options>) {
  configureToastr();
  toastr.info(message, title, options);
}

/** Aviso de vencimientos próximos al iniciar sesión (azul, mismo lugar que Toastr). */
export function toastVencimientosProximos(
  totalProximos: number,
  primerItem?: { impuestoLabel: string; titulo: string; fechaLabel: string },
) {
  configureToastr();
  const intro =
    totalProximos === 1
      ? "Hay 1 vencimiento próximo (30 días o menos)."
      : `Hay ${totalProximos} vencimientos próximos (30 días o menos).`;
  const detalle = primerItem
    ? `${primerItem.impuestoLabel} · ${primerItem.titulo} · ${primerItem.fechaLabel}`
    : "";
  const cierre =
    totalProximos > 1 ? "Revisá Vencimientos Impuestos para ver todos." : "";
  const message = [intro, detalle, cierre].filter(Boolean).join(" ");

  toastr.info(message, "Vencimientos próximos", {
    timeOut: 9000,
    extendedTimeOut: 3500,
    progressBar: true,
  });
}

/** Compatibilidad con callbacks de App (`msg`, `ok`, título opcional). */
export function showToast(message: string, ok = true, title?: string) {
  configureToastr();
  if (ok) toastr.success(message, title || "Éxito");
  else toastr.error(message, title || "Error");
}
