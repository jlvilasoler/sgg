import type { UserPublic } from "./auth-db.js";
import * as auth from "./auth-db.js";
import type { Db } from "./db/pg-client.js";
import * as empresasCuenta from "./empresas-cuenta-db.js";
import type { GastosRubrosReadScope } from "./gastos-rubros-scope.js";
import * as rub from "./rubros-db.js";
import * as sub from "./sub-rubros-db.js";

export interface RubrosMonitorPermisos {
  ver_en_gastos: boolean;
  editar_catalogo: boolean;
  crear_desde_gasto: boolean;
  eliminar_catalogo: boolean;
  eliminar_items: boolean;
}

export interface RubrosMonitorUsuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  rol_label: string;
  activo: boolean;
  es_admin_cuenta: boolean;
  permisos: RubrosMonitorPermisos;
}

export interface RubrosMonitorSubRubro {
  id: number;
  nombre: string;
  origen: "sag" | "cuenta";
  activo: boolean;
}

export interface RubrosMonitorGrupo {
  nombre: string;
  sub_rubros: RubrosMonitorSubRubro[];
  sub_sag: number;
  sub_cuenta: number;
}

export interface RubrosMonitorCuentaResumen {
  id: number;
  nombre: string;
  codigo: string;
  cuenta_numero: string;
  activo: boolean;
  grupos: number;
  sub_rubros: number;
  sub_propios: number;
  rubros_contables: number;
  usuarios_count: number;
}

export interface RubrosMonitorCuentaDetalle extends RubrosMonitorCuentaResumen {
  grupos_catalogo: RubrosMonitorGrupo[];
  usuarios: RubrosMonitorUsuario[];
}

export interface RubrosMonitorSnapshot {
  generado_en: string;
  cuentas: RubrosMonitorCuentaResumen[];
  totales: {
    cuentas: number;
    cuentas_activas: number;
    sub_rubros_sag: number;
    sub_rubros_propios: number;
  };
}

function cuentaReadScope(cuentaId: number): GastosRubrosReadScope {
  return { mode: "cuenta", cuentaId };
}

function permisosRubrosUsuario(user: UserPublic): RubrosMonitorPermisos {
  const verEnGastos = user.permisos.includes("presupuesto");
  const escribePresupuesto =
    user.puede_escribir && !user.modulos_solo_lectura.includes("presupuesto");
  return {
    ver_en_gastos: verEnGastos,
    editar_catalogo: user.es_super_admin || user.es_admin_cuenta,
    crear_desde_gasto: verEnGastos && escribePresupuesto,
    eliminar_catalogo: user.es_super_admin,
    eliminar_items: user.es_super_admin || user.es_admin_cuenta,
  };
}

function buildGruposCatalogo(
  subs: sub.SubRubro[]
): RubrosMonitorGrupo[] {
  const buckets = new Map<string, RubrosMonitorSubRubro[]>();
  for (const row of subs) {
    const grupo = row.grupo.trim() || "Sin grupo";
    const item: RubrosMonitorSubRubro = {
      id: row.id,
      nombre: row.nombre,
      origen: row.cuenta_id == null ? "sag" : "cuenta",
      activo: row.activo === 1,
    };
    const list = buckets.get(grupo) ?? [];
    list.push(item);
    buckets.set(grupo, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([nombre, items]) => {
      const sorted = items.sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "accent" })
      );
      return {
        nombre,
        sub_rubros: sorted,
        sub_sag: sorted.filter((s) => s.origen === "sag").length,
        sub_cuenta: sorted.filter((s) => s.origen === "cuenta").length,
      };
    });
}

async function buildCuentaResumen(
  db: Db,
  cuenta: empresasCuenta.EmpresaCuenta,
  subs: sub.SubRubro[],
  rubrosContables: rub.Rubro[],
  usuariosCount: number
): Promise<RubrosMonitorCuentaResumen> {
  const subPropios = subs.filter((s) => s.cuenta_id === cuenta.id).length;
  const grupos = new Set(subs.map((s) => s.grupo.trim() || "Sin grupo"));
  return {
    id: cuenta.id,
    nombre: cuenta.nombre,
    codigo: cuenta.codigo,
    cuenta_numero: cuenta.cuenta_numero,
    activo: cuenta.activo,
    grupos: grupos.size,
    sub_rubros: subs.length,
    sub_propios: subPropios,
    rubros_contables: rubrosContables.length,
    usuarios_count: usuariosCount,
  };
}

export async function getGastosRubrosMonitorSnapshot(
  db: Db
): Promise<RubrosMonitorSnapshot> {
  const cuentas = await empresasCuenta.listEmpresasCuenta(db);
  const sagSubs = await sub.listSubRubros(db, false, { mode: "sag", filterCuentaId: null });

  const resumenes: RubrosMonitorCuentaResumen[] = [];
  for (const cuenta of cuentas) {
    const scope = cuentaReadScope(cuenta.id);
    const subs = await sub.listSubRubros(db, false, scope);
    const rubrosContables = await rub.listRubros(db, false, scope);
    const usuarios = await auth.listUsers(db, {
      empresa_id: cuenta.id,
      incluir_admin_id: cuenta.admin_user_id ?? undefined,
    });
    resumenes.push(
      await buildCuentaResumen(db, cuenta, subs, rubrosContables, usuarios.length)
    );
  }

  const subPropiosTotal = resumenes.reduce((sum, c) => sum + c.sub_propios, 0);

  return {
    generado_en: new Date().toISOString(),
    cuentas: resumenes,
    totales: {
      cuentas: cuentas.length,
      cuentas_activas: cuentas.filter((c) => c.activo).length,
      sub_rubros_sag: sagSubs.length,
      sub_rubros_propios: subPropiosTotal,
    },
  };
}

export async function getGastosRubrosMonitorCuenta(
  db: Db,
  cuentaId: number
): Promise<RubrosMonitorCuentaDetalle | null> {
  const cuenta = await empresasCuenta.getEmpresaCuentaById(db, cuentaId);
  if (!cuenta) return null;

  const scope = cuentaReadScope(cuentaId);
  const subs = await sub.listSubRubros(db, false, scope);
  const rubrosContables = await rub.listRubros(db, false, scope);
  const usuarios = await auth.listUsers(db, {
    empresa_id: cuentaId,
    incluir_admin_id: cuenta.admin_user_id ?? undefined,
  });

  const resumen = await buildCuentaResumen(
    db,
    cuenta,
    subs,
    rubrosContables,
    usuarios.length
  );

  return {
    ...resumen,
    grupos_catalogo: buildGruposCatalogo(subs),
    usuarios: usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      rol_label: u.rol_label,
      activo: u.activo,
      es_admin_cuenta: u.es_admin_cuenta,
      permisos: permisosRubrosUsuario(u),
    })),
  };
}
