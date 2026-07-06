import { useCallback, useEffect, useState } from "react";
import { fetchGastosAutomatizacion } from "../api";
import type { AuthUser, GastoAutoPendiente } from "../types";
import { canAprobarGastosAutomatizacion } from "../utils/auth-permissions";

export function useHomeAutoPendientes(user: AuthUser, apiOnline: boolean) {
  const puedeAprobar = canAprobarGastosAutomatizacion(user);
  const [pendientes, setPendientes] = useState<GastoAutoPendiente[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (!apiOnline || !puedeAprobar) {
      setPendientes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchGastosAutomatizacion();
      setPendientes(
        data.pendientes.filter((p) => p.estado === "pendiente_aprobacion")
      );
    } catch {
      setPendientes([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, puedeAprobar]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { pendientes, loading, puedeAprobar, recargar: cargar };
}
