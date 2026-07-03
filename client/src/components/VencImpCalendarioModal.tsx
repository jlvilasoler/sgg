import { useEffect } from "react";
import ContribucionRuralCalendarioSection from "./ContribucionRuralCalendarioSection";
import type { ContribucionRuralJurisdiccionConfig } from "../types/contribucion-rural";
import type { ModalidadPagoVencImp } from "../types/contribucion-rural";
import type { PlanCuotasKey } from "../utils/contribucion-rural-view";
import { escudoDepartamentoSrc } from "../utils/escudos-departamentos";

export interface VencImpCalendarioModalProps {
  config: ContribucionRuralJurisdiccionConfig;
  modalidadUsuario: ModalidadPagoVencImp;
  planUsuario?: PlanCuotasKey;
  onClose: () => void;
}

function IconCerrar() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function modalTipo(config: ContribucionRuralJurisdiccionConfig): "primaria" | "bps" | "patente" | "rural" {
  if (config.esPrimariaRural) return "primaria";
  if (config.esBpsCajaRural) return "bps";
  if (config.esPatenteSucive) return "patente";
  return "rural";
}

export function VencImpCalendarioModal({
  config,
  modalidadUsuario,
  planUsuario,
  onClose,
}: VencImpCalendarioModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const esPatente = Boolean(config.esPatenteSucive);
  const esBps = Boolean(config.esBpsCajaRural);
  const esPrimaria = Boolean(config.esPrimariaRural);
  const tipo = modalTipo(config);

  return (
    <div
      className="pd-overlay venc-imp-calendario-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`pd-dialog venc-imp-calendario-modal venc-imp-calendario-modal--${tipo}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="venc-imp-calendario-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="venc-imp-calendario-modal-head">
          <span className="venc-imp-calendario-modal-accent" aria-hidden />
          <div className="venc-imp-calendario-modal-head-main">
            {esPatente ? (
              <img src="/logo-sucive.svg" alt="" className="venc-imp-calendario-modal-escudo" />
            ) : esBps ? (
              <img
                src="/logo-bps-compact.svg"
                alt=""
                className="venc-imp-calendario-modal-escudo venc-imp-calendario-modal-escudo--bps"
              />
            ) : esPrimaria ? (
              <img
                src="/logo-dgi-compact.svg"
                alt=""
                className="venc-imp-calendario-modal-escudo venc-imp-calendario-modal-escudo--dgi"
              />
            ) : (
              <img
                src={escudoDepartamentoSrc(config.id)}
                alt=""
                className="venc-imp-calendario-modal-escudo"
              />
            )}
            <div className="venc-imp-calendario-modal-head-text">
              <p className="venc-imp-calendario-modal-kicker">{config.intendenciaLabel}</p>
              <div className="venc-imp-calendario-modal-title-row">
                <h2 id="venc-imp-calendario-modal-title">{config.label}</h2>
                <span className="venc-imp-calendario-modal-ejercicio">{config.anio}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-icon-only venc-imp-calendario-modal-close"
            onClick={onClose}
            aria-label="Cerrar calendario"
          >
            <IconCerrar />
          </button>
        </header>
        <div className="venc-imp-calendario-modal-body">
          <ContribucionRuralCalendarioSection
            config={config}
            modalidadUsuario={modalidadUsuario}
            planUsuario={planUsuario}
            soloPreferenciaCuenta
            modoModal
          />
        </div>
      </div>
    </div>
  );
}

export default VencImpCalendarioModal;
