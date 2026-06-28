import { useCallback, useEffect, useState } from "react";
import { fetchMiCuentaEmpresa } from "../api";
import type { EmpresaCuenta } from "../types";
import ArquitecturaCuentaDetalle from "./ArquitecturaCuentaDetalle";

interface Props {
  apiOnline: boolean;
  onVolver: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function AdministradorCuenta({
  apiOnline,
  onVolver,
  onError,
  onSuccess,
}: Props) {
  const [cuenta, setCuenta] = useState<EmpresaCuenta | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCuenta = useCallback(async () => {
    if (!apiOnline) {
      setCuenta(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCuenta(await fetchMiCuentaEmpresa());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar su cuenta");
      setCuenta(null);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void loadCuenta();
  }, [loadCuenta]);

  if (loading) {
    return (
      <div className="subseccion-panel arquitectura-cuenta-detalle is-cuenta-propia">
        <button type="button" className="subseccion-back" onClick={onVolver}>
          ‹ Volver a Configuración
        </button>
        <div className="card cuenta-detalle-shell cuenta-detalle-skeleton" aria-busy="true">
          <div className="cuenta-detalle-skeleton-hero" />
          <div className="cuenta-detalle-skeleton-body">
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  if (!cuenta) {
    return (
      <div className="subseccion-panel">
        <button type="button" className="subseccion-back" onClick={onVolver}>
          ‹ Volver a Configuración
        </button>
        <div className="card">
          <p className="muted">
            {!apiOnline
              ? "Sin conexión con la API."
              : "No se encontró una cuenta asociada a su usuario."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ArquitecturaCuentaDetalle
      cuenta={cuenta}
      apiOnline={apiOnline}
      modo="cuentaPropia"
      volverLabel="Volver a Configuración"
      onVolver={onVolver}
      onCuentaUpdated={setCuenta}
      onError={onError}
      onSuccess={onSuccess}
    />
  );
}
