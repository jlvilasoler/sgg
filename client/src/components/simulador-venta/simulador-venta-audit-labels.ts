export const SIM_AUDIT_CAMPO_LABELS: Record<string, string> = {
  categoria: "Categoría",
  tipo: "Tipo venta",
  destacada: "Destacada",
  "simulacion.modo_kg": "Modo kg",
  "simulacion.precio_usd_kg": "USD/kg sim.",
  "simulacion.precio_ref_anio": "Ref. año",
  "simulacion.precio_ref_semana": "Ref. semana",
  "simulacion.precio_ref_fecha_hasta": "Ref. hasta",
  "simulacion.cantidad_animales": "Cabezas sim.",
  "simulacion.kg_promedio": "Kg prom. sim.",
  "simulacion.kg_total": "Kg total sim.",
  "simulacion.total_usd": "Total USD sim.",
  "simulacion.total_usd_por_cabeza": "USD/cab. sim.",
  "simulacion.notas": "Notas sim.",
  venta_real: "Venta real",
  "venta_real.precio_usd_kg": "USD/kg real",
  "venta_real.cantidad_animales": "Cabezas real",
  "venta_real.kg_promedio": "Kg prom. real",
  "venta_real.kg_total": "Kg total real",
  "venta_real.total_usd": "Total USD real",
  "venta_real.total_usd_por_cabeza": "USD/cab. real",
  "venta_real.notas": "Notas real",
  "venta_real.venta_realizada_en": "Fecha embarque",
};

export const SIM_AUDIT_TIPO_LABELS: Record<string, string> = {
  CREAR: "Creación",
  ACTUALIZAR: "Edición simulación",
  DESTACAR: "Destacada",
  QUITAR_DESTACADO: "Quitar destacado",
  VENTA_REAL_REGISTRADA: "Venta real registrada",
  VENTA_REAL_ACTUALIZADA: "Venta real editada",
  VENTA_REAL_ANULADA: "Venta real anulada",
  ELIMINAR: "Eliminación",
};

export function labelCampoAuditoria(campo: string): string {
  return SIM_AUDIT_CAMPO_LABELS[campo] ?? campo;
}
