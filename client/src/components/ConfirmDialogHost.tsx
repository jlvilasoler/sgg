import { useEffect, useState } from "react";
import { setConfirmHandler, type ConfirmOptions } from "../utils/confirm";

type Pending = {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
};

export default function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    setConfirmHandler(
      (opts) =>
        new Promise<boolean>((resolve) => {
          setPending({ opts, resolve });
        })
    );
    return () => setConfirmHandler(null);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const close = (value: boolean) => {
    if (!pending) return;
    pending.resolve(value);
    setPending(null);
  };

  if (!pending) return null;

  const { opts } = pending;
  const isDanger = opts.variant !== "default";
  const title = opts.title ?? (isDanger ? "Confirmar" : "Confirmación");

  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={() => close(false)}
    >
      <div
        className={`confirm-dialog card${isDanger ? " confirm-dialog--danger" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-icon" aria-hidden>
          {isDanger ? "!" : "?"}
        </div>
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h3>
        <p id="confirm-dialog-message" className="confirm-dialog-message">
          {opts.message}
        </p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn btn-ghost confirm-dialog-cancel"
            onClick={() => close(false)}
          >
            {opts.cancelText ?? "Cancelar"}
          </button>
          <button
            type="button"
            className={`btn confirm-dialog-confirm${
              isDanger ? " btn-delete" : " btn-primary"
            }`}
            autoFocus
            onClick={() => close(true)}
          >
            {opts.confirmText ?? "Aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
}
