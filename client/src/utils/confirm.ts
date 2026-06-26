export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
  /** Si se define, el usuario debe escribir exactamente este texto (sin distinguir mayúsculas) para habilitar el botón de confirmar. */
  requireText?: string;
  /** Texto de ayuda mostrado sobre el campo de confirmación. */
  requireTextLabel?: string;
};

type ConfirmHandler = (options: ConfirmOptions) => Promise<boolean>;

let handler: ConfirmHandler | null = null;

export function setConfirmHandler(fn: ConfirmHandler | null) {
  handler = fn;
}

function normalize(options: ConfirmOptions | string): ConfirmOptions {
  if (typeof options === "string") {
    return { message: options, variant: "danger" };
  }
  return options;
}

/** Diálogo de confirmación (mismo estilo SGG que Toastr). Reemplaza `window.confirm`. */
export function confirmAction(options: ConfirmOptions | string): Promise<boolean> {
  const opts = normalize(options);
  if (handler) return handler(opts);
  return Promise.resolve(window.confirm(opts.message));
}
