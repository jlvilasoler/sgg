import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Presupuesto, PresupuestoInput, ResumenEmpresa, ResumenRubro } from "./types.js";
import { EMPRESAS } from "./types.js";
import * as prov from "./proveedores-db.js";
import * as div from "./divisas-db.js";
import * as rub from "./rubros-db.js";
import * as resp from "./responsables-db.js";
import * as sub from "./sub-rubros-db.js";
import * as subItems from "./sub-rubro-items-db.js";
import * as vinc from "./rubro-sub-rubros-db.js";
import * as gicon from "./grupo-iconos-db.js";
import * as func from "./funcionarios-db.js";
import * as rrhh from "./rrhh-pagos-db.js";
import * as ventas from "./ventas-db.js";
import * as vsub from "./venta-sub-rubros-db.js";
import * as vsubItems from "./venta-sub-rubro-items-db.js";
import * as vgicon from "./venta-grupo-iconos-db.js";
import * as stock from "./stock-ganadero-db.js";
import * as auth from "./auth-db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DB_PATH = path.join(DATA_DIR, "scg_contabilidad.db");

let db: Database.Database;

export function initDb(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS PRESUPUESTO (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa TEXT NOT NULL CHECK (
        empresa IN ('GANADERA GUAVIYU', 'GANADERA CHIVILCOY')
      ),
      fecha TEXT NOT NULL,
      codigo_proveedor TEXT,
      razon_social_proveedor TEXT,
      concepto TEXT NOT NULL,
      rubro TEXT NOT NULL,
      nro_factura TEXT,
      pesos REAL DEFAULT 0,
      dolares_usd REAL DEFAULT 0,
      reales REAL DEFAULT 0,
      tc_usd REAL DEFAULT 0,
      tc_reales REAL DEFAULT 0,
      saldo_usd REAL DEFAULT 0,
      nro_registro INTEGER UNIQUE,
      creado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_presupuesto_empresa ON PRESUPUESTO(empresa);
    CREATE INDEX IF NOT EXISTS idx_presupuesto_fecha ON PRESUPUESTO(fecha);
    CREATE INDEX IF NOT EXISTS idx_presupuesto_rubro ON PRESUPUESTO(rubro);
  `);
  prov.initProveedoresTable(db);
  prov.seedProveedoresIfEmpty(db);
  div.initDivisasTable(db);
  rub.initRubrosTable(db);
  sub.initSubRubrosTable(db);
  subItems.initSubRubroItemsTable(db);
  vinc.initRubroSubRubrosTable(db);
  gicon.initGrupoIconosTable(db);
  sub.migrateUnificarGruposIconos(db);
  resp.initResponsablesTable(db);
  func.initFuncionariosTable(db);
  ventas.initVentasTable(db);
  vsub.initVentaSubRubrosTable(db);
  vsubItems.initVentaSubRubroItemsTable(db);
  vgicon.initVentaGrupoIconosTable(db);
  stock.initStockGanaderoTables(db);
  auth.initAuthTables(db);
  migrateNroRegistro(db);
  migrateResponsableGasto(db);
  migrateSubRubro(db);
  migrateFuncionarioCedula(db);
  migrateObservaciones(db);
}

function migrateNroRegistro(database: Database.Database): void {
  const cols = database
    .prepare("PRAGMA table_info(PRESUPUESTO)")
    .all() as { name: string }[];

  if (!cols.some((c) => c.name === "nro_registro")) {
    database.exec(`ALTER TABLE PRESUPUESTO ADD COLUMN nro_registro INTEGER`);
    const rows = database
      .prepare("SELECT id FROM PRESUPUESTO ORDER BY id ASC")
      .all() as { id: number }[];
    const upd = database.prepare(
      "UPDATE PRESUPUESTO SET nro_registro = ? WHERE id = ?"
    );
    let n = 0;
    for (const r of rows) {
      n += 1;
      upd.run(n, r.id);
    }
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS PRESUPUESTO_REGISTRO_SEQ (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ultimo INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO PRESUPUESTO_REGISTRO_SEQ (id, ultimo) VALUES (1, 0);
  `);

  const maxRow = database
    .prepare("SELECT COALESCE(MAX(nro_registro), 0) AS m FROM PRESUPUESTO")
    .get() as { m: number };
  const seqRow = database
    .prepare("SELECT ultimo FROM PRESUPUESTO_REGISTRO_SEQ WHERE id = 1")
    .get() as { ultimo: number } | undefined;
  const ultimo = Math.max(maxRow.m, seqRow?.ultimo ?? 0);
  database
    .prepare("UPDATE PRESUPUESTO_REGISTRO_SEQ SET ultimo = ? WHERE id = 1")
    .run(ultimo);

  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_presupuesto_nro_registro ON PRESUPUESTO(nro_registro)"
  );
}

function migrateResponsableGasto(database: Database.Database): void {
  const cols = database
    .prepare("PRAGMA table_info(PRESUPUESTO)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "responsable_gasto")) {
    database.exec(
      `ALTER TABLE PRESUPUESTO ADD COLUMN responsable_gasto TEXT NOT NULL DEFAULT ''`
    );
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_presupuesto_responsable ON PRESUPUESTO(responsable_gasto)`
    );
  }
  resp.syncResponsablesFromPresupuesto(database);
}

function migrateSubRubro(database: Database.Database): void {
  const cols = database
    .prepare("PRAGMA table_info(PRESUPUESTO)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "sub_rubro")) {
    database.exec(
      `ALTER TABLE PRESUPUESTO ADD COLUMN sub_rubro TEXT NOT NULL DEFAULT ''`
    );
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_presupuesto_sub_rubro ON PRESUPUESTO(sub_rubro)`
    );
  }
}

function migrateFuncionarioCedula(database: Database.Database): void {
  const cols = database
    .prepare("PRAGMA table_info(PRESUPUESTO)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "funcionario_cedula")) {
    database.exec(
      `ALTER TABLE PRESUPUESTO ADD COLUMN funcionario_cedula TEXT NOT NULL DEFAULT ''`
    );
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_presupuesto_funcionario_cedula ON PRESUPUESTO(funcionario_cedula)`
    );
  }
}

function migrateObservaciones(database: Database.Database): void {
  const cols = database
    .prepare("PRAGMA table_info(PRESUPUESTO)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "observaciones")) {
    database.exec(
      `ALTER TABLE PRESUPUESTO ADD COLUMN observaciones TEXT NOT NULL DEFAULT ''`
    );
  }
}

/** Vista previa del próximo número (no consume la secuencia). */
export function peekNextNroRegistro(): number {
  const row = db
    .prepare("SELECT ultimo FROM PRESUPUESTO_REGISTRO_SEQ WHERE id = 1")
    .get() as { ultimo: number };
  return row.ultimo + 1;
}

export function formatNumeroOperacion(nro: number): string {
  return String(Math.max(1, Math.floor(nro))).padStart(10, "0");
}

/** Número de registro único; nunca se reutiliza aunque se borren filas. */
function allocNroRegistro(): number {
  const tx = db.transaction(() => {
    const row = db
      .prepare("SELECT ultimo FROM PRESUPUESTO_REGISTRO_SEQ WHERE id = 1")
      .get() as { ultimo: number };
    const next = row.ultimo + 1;
    db.prepare("UPDATE PRESUPUESTO_REGISTRO_SEQ SET ultimo = ? WHERE id = 1").run(next);
    return next;
  });
  return tx();
}

export function getDb() {
  return db;
}

export const divisas = {
  list: (filters?: { par?: div.ParDivisa; fecha_desde?: string; fecha_hasta?: string }) =>
    div.listDivisas(db, filters),
  ultimos: () => div.getUltimosPorPar(db),
  indicadores: (par: div.ParDivisa) => div.getIndicadoresPorPar(db, par),
  valorEnFecha: (par: div.ParDivisa, fecha: string) =>
    div.getTipoCambioEnFecha(db, par, fecha),
  getById: (id: number) => div.getTipoCambioById(db, id),
  insert: (row: div.TipoCambioInput) => div.insertTipoCambio(db, row),
  update: (id: number, row: div.TipoCambioInput) => div.updateTipoCambio(db, id, row),
  delete: (id: number) => div.deleteTipoCambio(db, id),
  upsert: (row: div.TipoCambioInput) => div.upsertTipoCambio(db, row),
  exists: (fecha: string, par: div.ParDivisa) =>
    div.existsTipoCambio(db, fecha, par),
  maxFecha: (par: div.ParDivisa) => div.getMaxFechaPorPar(db, par),
  importBatch: (
    rows: div.TipoCambioInput[],
    options?: { solo_nuevos?: boolean }
  ) => div.importBatch(db, rows, options),
  labels: div.PAR_LABELS,
  pares: div.PARES_DIVISA,
};

export const ventaSubRubros = {
  list: (soloActivos?: boolean) => vsub.listVentaSubRubros(db, soloActivos ?? false),
  listGrupos: () => vsub.listVentaSubRubrosGrupos(db),
  getById: (id: number) => vsub.getVentaSubRubroById(db, id),
  getByNombre: (nombre: string) => vsub.getVentaSubRubroByNombre(db, nombre),
  insert: (data: vsub.VentaSubRubroInput) => vsub.insertVentaSubRubro(db, data),
  update: (id: number, data: vsub.VentaSubRubroInput) =>
    vsub.updateVentaSubRubro(db, id, data),
  delete: (id: number) => vsub.deleteVentaSubRubro(db, id),
  deleteByGrupo: (grupo: string) => vsub.deleteVentaSubRubrosByGrupo(db, grupo),
  renameGrupo: (anterior: string, nuevo: string) =>
    vsub.renameVentaSubRubroGrupo(db, anterior, nuevo),
};

export const ventaSubRubroItems = {
  listBySubRubroId: (subRubroId: number, soloActivos?: boolean) =>
    vsubItems.listVentaItemsBySubRubroId(db, subRubroId, soloActivos ?? false),
  listBySubRubroNombre: (nombre: string, soloActivos?: boolean) =>
    vsubItems.listVentaItemsBySubRubroNombre(db, nombre, soloActivos ?? true),
  countsBySubRubroIds: (ids: number[]) =>
    vsubItems.countVentaItemsBySubRubroIds(db, ids),
  groupedBySubRubroIds: (ids: number[]) =>
    vsubItems.listVentaItemsGroupedBySubRubroIds(db, ids),
  getById: (id: number) => vsubItems.getVentaItemById(db, id),
  insert: (subRubroId: number, data: vsubItems.VentaSubRubroItemInput) =>
    vsubItems.insertVentaItem(db, subRubroId, data),
  update: (id: number, data: vsubItems.VentaSubRubroItemInput) =>
    vsubItems.updateVentaItem(db, id, data),
  delete: (id: number) => vsubItems.deleteVentaItem(db, id),
};

export const ventaGrupoIconos = {
  map: () => vgicon.getVentaGrupoIconosMap(db),
  banco: () => vgicon.listVentaBancoIconos(),
  save: (grupo: string, buffer: Buffer, mime: string) =>
    vgicon.saveVentaGrupoIcono(db, grupo, buffer, mime),
  saveEmoji: (grupo: string, emoji: string) =>
    vgicon.saveVentaGrupoIconoEmoji(db, grupo, emoji),
  filePath: (grupo: string) => vgicon.resolveVentaIconFilePath(db, grupo),
  deleteByGrupo: (grupo: string) => vgicon.deleteVentaGrupoIcono(db, grupo),
  renameGrupo: (anterior: string, nuevo: string) =>
    vgicon.renameVentaGrupoIcono(db, anterior, nuevo),
};

export const stockGanadero = {
  listLotes: () => stock.listStockGanaderoLotes(db),
  getLote: (id: number) => stock.getStockGanaderoLoteById(db, id),
  listRegistros: (filters?: stock.StockGanaderoFilters) =>
    stock.listStockGanaderoRegistros(db, filters),
  importRows: (nombreArchivo: string, rows: stock.StockGanaderoRowInput[]) =>
    stock.importStockGanaderoRows(db, nombreArchivo, rows),
  importBaja: (
    rows: stock.StockGanaderoRowInput[],
    estado: "VENDIDO" | "FRIGORIFICO"
  ) => stock.importBajaDispositivos(db, rows, estado),
  deleteLote: (id: number) => stock.deleteStockGanaderoLote(db, id),
  countRegistros: () => stock.countStockGanaderoRegistros(db),
  estadisticas: (filters?: stock.StockGanaderoFilters) =>
    stock.getStockGanaderoEstadisticas(db, filters),
  listDispositivos: (filters?: stock.StockGanaderoFilters) =>
    stock.listStockGanaderaDispositivos(db, filters),
  getDispositivo: (clave: string, filters?: stock.StockGanaderoFilters) =>
    stock.getStockGanaderaDispositivoDetalle(db, clave, filters),
  countDispositivos: () => stock.countStockGanaderaDispositivos(db),
  updateDispositivoSexo: (
    clave: string,
    sexo: stock.DispositivoSexo,
    eid?: string
  ) => stock.updateStockGanaderaDispositivoSexo(db, clave, sexo, eid),
  updateDispositivoEdad: (
    clave: string,
    edad: number | null,
    eid?: string
  ) => stock.updateStockGanaderaDispositivoEdad(db, clave, edad, eid),
  saveDispositivo: (
    clave: string,
    input: stock.DispositivoMetaInput,
    eid?: string
  ) => stock.saveStockGanaderaDispositivo(db, clave, input, eid),
  listHistorialCambios: (clave: string) =>
    stock.listStockGanaderaDispositivoHistorial(db, clave),
};

export const ingresosVentas = {
  list: (filters?: ventas.IngresoVentaFilters) =>
    ventas.listIngresosVentas(db, filters),
  getById: (id: number) => ventas.getIngresoVentaById(db, id),
  insert: (data: ventas.IngresoVentaInput) => ventas.insertIngresoVenta(db, data),
  update: (id: number, data: ventas.IngresoVentaInput) =>
    ventas.updateIngresoVenta(db, id, data),
  delete: (id: number) => ventas.deleteIngresoVenta(db, id),
  peekNextNro: () => ventas.peekNextNroRegistroVenta(db),
  formatNumeroOperacion: (nro: number) => ventas.formatNumeroOperacionVenta(nro),
};

export const proveedores = {
  list: (busqueda?: string) => prov.listProveedores(db, busqueda),
  getByCod: (cod: number) => prov.getProveedorByCod(db, cod),
  getById: (id: number) => prov.getProveedorById(db, id),
  nextCod: () => prov.getNextCod(db),
  insert: (data: prov.ProveedorInput) => prov.insertProveedor(db, data),
  update: (id: number, data: prov.ProveedorInput) =>
    prov.updateProveedor(db, id, data),
  delete: (id: number) => prov.deleteProveedor(db, id),
};

export function insertPresupuesto(data: PresupuestoInput): number {
  const nro_registro = allocNroRegistro();
  const stmt = db.prepare(`
    INSERT INTO PRESUPUESTO (
      nro_registro, empresa, fecha, codigo_proveedor, razon_social_proveedor,
      concepto, observaciones, rubro, sub_rubro, responsable_gasto, funcionario_cedula, nro_factura,
      pesos, dolares_usd, reales, tc_usd, tc_reales, saldo_usd
    ) VALUES (
      @nro_registro, @empresa, @fecha, @codigo_proveedor, @razon_social_proveedor,
      @concepto, @observaciones, @rubro, @sub_rubro, @responsable_gasto, @funcionario_cedula, @nro_factura,
      @pesos, @dolares_usd, @reales, @tc_usd, @tc_reales, @saldo_usd
    )
  `);
  const result = stmt.run({ ...data, nro_registro });
  return Number(result.lastInsertRowid);
}

export function updatePresupuesto(id: number, data: PresupuestoInput): boolean {
  const stmt = db.prepare(`
    UPDATE PRESUPUESTO SET
      empresa = @empresa, fecha = @fecha,
      codigo_proveedor = @codigo_proveedor,
      razon_social_proveedor = @razon_social_proveedor,
      concepto = @concepto, observaciones = @observaciones, rubro = @rubro, sub_rubro = @sub_rubro,
      responsable_gasto = @responsable_gasto, funcionario_cedula = @funcionario_cedula,
      nro_factura = @nro_factura,
      pesos = @pesos, dolares_usd = @dolares_usd, reales = @reales,
      tc_usd = @tc_usd, tc_reales = @tc_reales, saldo_usd = @saldo_usd
    WHERE id = @id
  `);
  return stmt.run({ ...data, id }).changes > 0;
}

export function deletePresupuesto(id: number): boolean {
  return db.prepare("DELETE FROM PRESUPUESTO WHERE id = ?").run(id).changes > 0;
}

export function getPresupuesto(id: number): Presupuesto | undefined {
  return db.prepare("SELECT * FROM PRESUPUESTO WHERE id = ?").get(id) as
    | Presupuesto
    | undefined;
}

export interface ListFilters {
  empresa?: string;
  rubro?: string;
  responsable_gasto?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
}

export function listPresupuesto(filters: ListFilters = {}): Presupuesto[] {
  let query = "SELECT * FROM PRESUPUESTO WHERE 1=1";
  const params: Record<string, string> = {};

  if (filters.empresa) {
    query += " AND empresa = @empresa";
    params.empresa = filters.empresa;
  }
  if (filters.rubro) {
    query += " AND rubro = @rubro";
    params.rubro = filters.rubro;
  }
  if (filters.responsable_gasto === "__none__") {
    query +=
      " AND (responsable_gasto IS NULL OR trim(responsable_gasto) = '')";
  } else if (filters.responsable_gasto) {
    query += " AND responsable_gasto = @responsable_gasto";
    params.responsable_gasto = filters.responsable_gasto;
  }
  if (filters.fecha_desde) {
    query += " AND fecha >= @fecha_desde";
    params.fecha_desde = filters.fecha_desde;
  }
  if (filters.fecha_hasta) {
    query += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = filters.fecha_hasta;
  }
  if (filters.busqueda) {
    query += ` AND (
      concepto LIKE @busqueda OR observaciones LIKE @busqueda
      OR razon_social_proveedor LIKE @busqueda
      OR nro_factura LIKE @busqueda OR codigo_proveedor LIKE @busqueda
    )`;
    params.busqueda = `%${filters.busqueda}%`;
  }

  query += " ORDER BY fecha DESC, id DESC";
  return db.prepare(query).all(params) as Presupuesto[];
}

export function resumenPorEmpresa(
  fecha_desde?: string,
  fecha_hasta?: string
): ResumenEmpresa[] {
  let query = `
    SELECT empresa, COUNT(*) AS cantidad,
      COALESCE(SUM(pesos), 0) AS total_pesos,
      COALESCE(SUM(dolares_usd), 0) AS total_usd,
      COALESCE(SUM(reales), 0) AS total_reales,
      COALESCE(SUM(saldo_usd), 0) AS total_saldo_usd
    FROM PRESUPUESTO WHERE 1=1
  `;
  const params: Record<string, string> = {};
  if (fecha_desde) {
    query += " AND fecha >= @fecha_desde";
    params.fecha_desde = fecha_desde;
  }
  if (fecha_hasta) {
    query += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = fecha_hasta;
  }
  query += " GROUP BY empresa ORDER BY empresa";
  return db.prepare(query).all(params) as ResumenEmpresa[];
}

export function resumenPorRubro(empresa?: string): ResumenRubro[] {
  let query = `
    SELECT rubro, COUNT(*) AS cantidad,
      COALESCE(SUM(pesos), 0) AS total_pesos,
      COALESCE(SUM(dolares_usd), 0) AS total_usd
    FROM PRESUPUESTO WHERE 1=1
  `;
  const params: Record<string, string> = {};
  if (empresa) {
    query += " AND empresa = @empresa";
    params.empresa = empresa;
  }
  query += " GROUP BY rubro ORDER BY total_pesos DESC";
  return db.prepare(query).all(params) as ResumenRubro[];
}

export const rubros = {
  list: (soloActivos?: boolean) => rub.listRubros(db, soloActivos ?? false),
  listNombres: () => rub.listRubrosNombres(db),
  getById: (id: number) => rub.getRubroById(db, id),
  insert: (data: rub.RubroInput) => rub.insertRubro(db, data),
  update: (id: number, data: rub.RubroInput) => rub.updateRubro(db, id, data),
  delete: (id: number) => rub.deleteRubro(db, id),
  existsActivo: (nombre: string) => rub.rubroExistsActivo(db, nombre),
};

export const responsables = {
  list: (soloActivos?: boolean) => resp.listResponsables(db, soloActivos ?? false),
  listNombres: () => resp.listResponsablesNombres(db),
  getById: (id: number) => resp.getResponsableById(db, id),
  insert: (data: resp.ResponsableInput) => resp.insertResponsable(db, data),
  update: (id: number, data: resp.ResponsableInput) =>
    resp.updateResponsable(db, id, data),
  delete: (id: number) => resp.deleteResponsable(db, id),
  existsActivo: (nombre: string) => resp.responsableExistsActivo(db, nombre),
};

export const subRubros = {
  list: (soloActivos?: boolean) => sub.listSubRubros(db, soloActivos ?? false),
  listNombres: () => sub.listSubRubrosNombres(db),
  listGrupos: () => sub.listSubRubrosGrupos(db),
  getById: (id: number) => sub.getSubRubroById(db, id),
  getByNombre: (nombre: string) => sub.getSubRubroByNombre(db, nombre),
  insert: (data: sub.SubRubroInput) => sub.insertSubRubro(db, data),
  update: (id: number, data: sub.SubRubroInput) =>
    sub.updateSubRubro(db, id, data),
  delete: (id: number) => sub.deleteSubRubro(db, id),
  deleteByGrupo: (grupo: string) => sub.deleteSubRubrosByGrupo(db, grupo),
  renameGrupo: (anterior: string, nuevo: string) =>
    sub.renameSubRubroGrupo(db, anterior, nuevo),
  existsActivo: (nombre: string) => sub.subRubroExistsActivo(db, nombre),
};

export const subRubroItems = {
  listBySubRubroId: (subRubroId: number, soloActivos?: boolean) =>
    subItems.listItemsBySubRubroId(db, subRubroId, soloActivos ?? false),
  listBySubRubroNombre: (nombre: string, soloActivos?: boolean) =>
    subItems.listItemsBySubRubroNombre(db, nombre, soloActivos ?? true),
  countsBySubRubroIds: (ids: number[]) =>
    subItems.countItemsBySubRubroIds(db, ids),
  groupedBySubRubroIds: (ids: number[]) =>
    subItems.listItemsGroupedBySubRubroIds(db, ids),
  getById: (id: number) => subItems.getItemById(db, id),
  insert: (subRubroId: number, data: subItems.SubRubroItemInput) =>
    subItems.insertItem(db, subRubroId, data),
  update: (id: number, data: subItems.SubRubroItemInput) =>
    subItems.updateItem(db, id, data),
  delete: (id: number) => subItems.deleteItem(db, id),
};

export const funcionarios = {
  list: (opts?: { busqueda?: string; soloActivos?: boolean }) =>
    func.listFuncionarios(db, opts),
  getById: (id: number) => func.getFuncionarioById(db, id),
  getByCedula: (cedula: string) => func.getFuncionarioByCedula(db, cedula),
  insert: (data: func.FuncionarioInput) => func.insertFuncionario(db, data),
  update: (id: number, data: func.FuncionarioInput) =>
    func.updateFuncionario(db, id, data),
  delete: (id: number) => func.deleteFuncionario(db, id),
  selector: () => func.listFuncionariosParaSelector(db),
  getByNombreDisplay: (nombre: string) =>
    func.getFuncionarioByNombreDisplay(db, nombre),
  esRubroRemuneracion: func.esRubroRemuneracion,
  normalizeCedula: func.normalizeCedula,
  formatCedula: func.formatCedulaDisplay,
};

export const rrhhPagos = {
  porCedula: (
    cedula: string,
    filters?: { fecha_desde?: string; fecha_hasta?: string; empresa?: string }
  ) => rrhh.listPagosPorCedula(db, cedula, filters),
  resumenGlobal: (filters?: { fecha_desde?: string; fecha_hasta?: string }) =>
    rrhh.resumenGlobalSueldos(db, filters),
};

export const grupoIconos = {
  map: () => gicon.getGrupoIconosMap(db),
  banco: () => gicon.listBancoIconos(),
  save: (grupo: string, buffer: Buffer, mime: string) =>
    gicon.saveGrupoIcono(db, grupo, buffer, mime),
  saveEmoji: (grupo: string, emoji: string) =>
    gicon.saveGrupoIconoEmoji(db, grupo, emoji),
  filePath: (grupo: string) => gicon.resolveIconFilePath(db, grupo),
  deleteByGrupo: (grupo: string) => gicon.deleteGrupoIcono(db, grupo),
  renameGrupo: (anterior: string, nuevo: string) =>
    gicon.renameGrupoIcono(db, anterior, nuevo),
};

export const rubroVinculos = {
  getSubRubroIds: (rubroId: number) => vinc.getSubRubroIdsForRubro(db, rubroId),
  setSubRubros: (rubroId: number, subRubroIds: number[]) =>
    vinc.setRubroSubRubros(db, rubroId, subRubroIds),
  mapPorRubro: (soloActivos?: boolean) =>
    vinc.getMapSubRubrosPorRubro(db, soloActivos ?? true),
  mapaCompleto: () => vinc.getMapaVinculosCompleto(db),
  isValidPair: (rubro: string, subRubro: string) =>
    vinc.isSubRubroValidForRubro(db, rubro, subRubro),
  syncPorGrupo: (subRubroId: number, grupo: string) =>
    vinc.syncVinculoSubRubroPorGrupo(db, subRubroId, grupo),
  resolveGrupoParaRubro: (rubroNombre: string) =>
    vinc.resolveGrupoParaRubroContable(db, rubroNombre),
};

export function getCatalogos() {
  return {
    empresas: [...EMPRESAS],
    rubros: rub.listRubrosNombres(db),
    sub_rubros: sub.listSubRubrosNombres(db),
    sub_rubros_por_rubro: vinc.getMapSubRubrosPorRubro(db, true),
    responsables: resp.listResponsablesNombres(db),
    funcionarios: func.listFuncionariosParaSelector(db),
  };
}
