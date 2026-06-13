export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
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

/** Diálogo de confirmación (mismo estilo SCG que Toastr). Reemplaza `window.confirm`. */
export function confirmAction(options: ConfirmOptions | string): Promise<boolean> {
  const opts = normalize(options);
  if (handler) return handler(opts);
  return Promise.resolve(window.confirm(opts.message));
}
