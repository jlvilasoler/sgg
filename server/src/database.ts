import { PgDb, getPool } from "./db/pg-client.js";
import type {
  Presupuesto,
  PresupuestoInput,
  ResumenEmpresa,
  ResumenRubro,
  ResumenEmpresaRubro,
  ResumenSubRubro,
  ResumenSubRubroMes,
  ResumenTotales,
  EstadoFinancieroRubro,
  EstadoFinancieroLinea,
  EstadoFinancieroUsd,
  EstadoFinancieroMes,
  EstadoFinancieroPayload,
  EstadoResultadosPayload,
  GastosProveedoresReportPayload,
  GastosProveedorTotalesLinea,
  GastosProveedorDetalleLinea,
} from "./types.js";
import { buildEstadoResultados as buildEstadoResultadosCore } from "./estado-resultados.js";
import * as prov from "./proveedores-db.js";
import * as div from "./divisas-db.js";
import * as pgan from "./precios-ganado-db.js";
import * as rub from "./rubros-db.js";
import * as resp from "./responsables-db.js";
import * as sub from "./sub-rubros-db.js";
import * as subItems from "./sub-rubro-items-db.js";
import * as vinc from "./rubro-sub-rubros-db.js";
import * as gicon from "./grupo-iconos-db.js";
import * as func from "./funcionarios-db.js";
import * as rrhh from "./rrhh-pagos-db.js";
import * as ventas from "./ventas-db.js";
import * as ventasAgri from "./ventas-agricultura-db.js";
import * as ventasArr from "./ventas-arrendamientos-db.js";
import * as vsub from "./venta-sub-rubros-db.js";
import * as vsubItems from "./venta-sub-rubro-items-db.js";
import * as vgicon from "./venta-grupo-iconos-db.js";
import * as stock from "./stock-ganadero-db.js";
import * as stockEquinoDb from "./stock-equino-db.js";
import * as stockSalidas from "./stock-ganadera-salidas.js";
import * as stockEquinoSalidas from "./stock-equina-salidas.js";
import * as stockAud from "./stock-auditoria-db.js";
import * as auth from "./auth-db.js";
import * as empresasCuenta from "./empresas-cuenta-db.js";
import * as docDig from "./documentos-digitales-db.js";
import * as presDoc from "./presupuesto-documentos-db.js";
import * as chat from "./chat-db.js";
import * as vencImpPrefs from "./vencimientos-impuestos-prefs-db.js";
import { scheduleTeamChannelSync } from "./chat-channels-db.js";
import * as simVenta from "./simulador-venta-ganado-db.js";
import * as simVentaAud from "./simulador-venta-auditoria-db.js";
import * as simVentaDisp from "./simulador-venta-dispositivos-db.js";
import * as simVentaStock from "./simulador-venta-stock-sync.js";
import { applySchema } from "./db/init-schema.js";
import { appendEmpresaScope, type ResumenEmpresaScope } from "./empresa-scope.js";

export type { ResumenEmpresaScope } from "./empresa-scope.js";

let db: PgDb;

const INIT_LOCK_KEY = 84937291;

async function tryAdvisoryLock(waitMs: number): Promise<boolean> {
  const pool = getPool();
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const r = await pool.query("SELECT pg_try_advisory_lock($1) AS ok", [INIT_LOCK_KEY]);
    if (r.rows[0]?.ok === true) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function releaseAdvisoryLock(): Promise<void> {
  await getPool().query("SELECT pg_advisory_unlock($1)", [INIT_LOCK_KEY]).catch(() => {});
}

async function schemaAlreadyApplied(): Promise<boolean> {
  const r = await getPool().query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'presupuesto' LIMIT 1`
  );
  return r.rows.length > 0;
}

async function runModuleSeeds(): Promise<void> {
  await prov.initProveedoresTable(db);
  await prov.seedProveedoresIfEmpty(db);
  await gicon.initGrupoIconosTable(db);

  await Promise.all([
    div.initDivisasTable(db),
    rub.initRubrosTable(db),
    sub.initSubRubrosTable(db),
    subItems.initSubRubroItemsTable(db),
    vinc.initRubroSubRubrosTable(db),
    func.initFuncionariosTable(db),
    ventas.initVentasTable(db),
    vsub.initVentaSubRubrosTable(db),
    vsubItems.initVentaSubRubroItemsTable(db),
    vgicon.initVentaGrupoIconosTable(db),
    stock.initStockGanaderoTables(db),
    stockEquinoDb.initStockEquinoTables(db),
  ]);

  await sub.migrateUnificarGruposIconos(db);
}

async function presupuestoColumnExists(column: string): Promise<boolean> {
  const r = await getPool().query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'presupuesto' AND column_name = $1
     LIMIT 1`,
    [column.toLowerCase()]
  );
  return r.rows.length > 0;
}

async function migratePresupuestoIngresadoPor(db: PgDb): Promise<void> {
  const cols: Array<{ name: string; ddl: string }> = [
    {
      name: "ingresado_por_email",
      ddl: `ALTER TABLE presupuesto ADD COLUMN ingresado_por_email TEXT NOT NULL DEFAULT ''`,
    },
    {
      name: "ingresado_por_nombre",
      ddl: `ALTER TABLE presupuesto ADD COLUMN ingresado_por_nombre TEXT NOT NULL DEFAULT ''`,
    },
    {
      name: "nro_operacion_origen",
      ddl: `ALTER TABLE presupuesto ADD COLUMN nro_operacion_origen TEXT NOT NULL DEFAULT ''`,
    },
  ];
  for (const col of cols) {
    if (await presupuestoColumnExists(col.name)) continue;
    await db.prepare(col.ddl).run();
    console.info(`[SGG] Migración: columna ${col.name} agregada a presupuesto`);
  }
}

async function connectWithRetry(attempts = 4): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await getPool().query("SELECT 1");
      return;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export async function initDb(): Promise<void> {
  await connectWithRetry();
  db = new PgDb();

  const existing = await schemaAlreadyApplied();
  const lockWaitMs = existing ? 3_000 : 50_000;
  // En Vercel el pooler de transacciones no soporta advisory locks de forma fiable.
  const locked =
    process.env.VERCEL === "1" ? true : await tryAdvisoryLock(lockWaitMs);

  try {
    if (!existing || locked) {
      await applySchema();
    }
    if (locked) {
      if (!existing) {
        await runModuleSeeds();
      }
    } else if (!existing) {
      console.warn("[SGG] Init en curso en otra instancia; omitiendo seeds pesados");
    }
    await empresasCuenta.initEmpresasCuentaTables(db);
    await auth.initAuthTables(db);
    await vencImpPrefs.initVencimientosImpuestosPrefsTable(db);
    await empresasCuenta.ensureCuentaMadreAdmin(db);
    await empresasCuenta.backfillCuentaMadreUsuarios(db);
    await empresasCuenta.syncCuentaAdminsEmpresaId(db);
    await docDig.initDocumentosDigitalesTables(db);
    await Promise.all([
      chat.initChatTables(db),
      stock.initStockGanaderoTables(db),
    stockEquinoDb.initStockEquinoTables(db),
      stockAud.initStockAuditoriaTable(db),
      pgan.initPreciosGanadoTable(db),
    ]);
    await Promise.all([
      simVenta.initSimuladorVentaGanadoTable(db),
      simVentaAud.initSimuladorVentaAuditoriaTable(db),
      simVentaDisp.initSimuladorVentaDispositivosTable(db),
      ventasAgri.initVentasAgriculturaTable(db),
      ventasArr.initVentasArrendamientosTable(db),
    ]);
    await migratePresupuestoIngresadoPor(db);
    await prov.initProveedoresTable(db);
    await resp.initResponsablesTable(db);
    await func.initFuncionariosTable(db);
    await ventas.initVentasTable(db);
    await presDoc.initPresupuestoDocumentosTable(db);
  } finally {
    if (locked) await releaseAdvisoryLock();
  }

  scheduleTeamChannelSync(db);
}

export async function peekNextNroRegistro(): Promise<number> {
  const row = (await db
    .prepare("SELECT ultimo FROM PRESUPUESTO_REGISTRO_SEQ WHERE id = 1")
    .get()) as { ultimo: number };
  return row.ultimo + 1;
}

export function formatNumeroOperacion(nro: number): string {
  return String(Math.max(1, Math.floor(nro))).padStart(10, "0");
}

async function allocNroRegistro(): Promise<number> {
  return db.transaction(async (tx) => {
    const row = (await tx
      .prepare("SELECT ultimo FROM PRESUPUESTO_REGISTRO_SEQ WHERE id = 1")
      .get()) as { ultimo: number };
    const next = row.ultimo + 1;
    await tx.prepare("UPDATE PRESUPUESTO_REGISTRO_SEQ SET ultimo = ? WHERE id = 1").run(next);
    return next;
  });
}

export function getDb(): PgDb {
  if (!db) {
    throw new Error("Base de datos aún inicializando");
  }
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
  exists: (fecha: string, par: div.ParDivisa) => div.existsTipoCambio(db, fecha, par),
  maxFecha: (par: div.ParDivisa) => div.getMaxFechaPorPar(db, par),
  importBatch: (rows: div.TipoCambioInput[], options?: { solo_nuevos?: boolean }) =>
    div.importBatch(db, rows, options),
  labels: div.PAR_LABELS,
  pares: div.PARES_DIVISA,
};

export const preciosGanado = {
  list: (filters?: Parameters<typeof pgan.listPreciosGanado>[1]) =>
    pgan.listPreciosGanado(db, filters),
  ultimaSemana: (segmento: pgan.SegmentoPreciosGanado) =>
    pgan.getUltimaSemanaGuardada(db, segmento),
  semanaGuardada: (
    segmento: pgan.SegmentoPreciosGanado,
    anio: number,
    semana: number
  ) => pgan.semanaYaGuardada(db, segmento, anio, semana),
  pivotSemanas: (rows: pgan.PrecioGanado[]) => pgan.pivotSemanas(rows),
  resumenLocal: (segmento: pgan.SegmentoPreciosGanado) =>
    pgan.getResumenLocal(db, segmento),
  registrarSync: (input: Parameters<typeof pgan.registrarSyncPreciosGanado>[1]) =>
    pgan.registrarSyncPreciosGanado(db, input),
  importBatch: (rows: pgan.PrecioGanadoInput[], options?: { solo_nuevos?: boolean }) =>
    pgan.importBatchPreciosGanado(db, rows, options),
  categoriasPorSegmento: pgan.categoriasPorSegmento,
  labelsPorSegmento: pgan.labelsPorSegmento,
  segmentos: pgan.SEGMENTOS_PRECIOS_GANADO,
};

export const simuladorVentaGanado = {
  preciosReferencia: (tipo: simVenta.SimuladorVentaTipo) =>
    simVenta.getPreciosReferenciaSimulador(db, tipo),
  list: (filters?: Parameters<typeof simVenta.listSimulacionesVentaGanado>[1]) =>
    simVenta.listSimulacionesVentaGanado(db, filters),
  insert: (input: simVenta.SimuladorVentaGanadoInput, cuentaId?: number | null) =>
    simVenta.insertSimulacionVentaGanado(db, input, cuentaId),
  getById: (id: number, cuentaId?: number | null) =>
    simVenta.getSimulacionVentaGanadoById(db, id, cuentaId),
  update: (id: number, input: simVenta.SimuladorVentaGanadoInput, cuentaId?: number | null) =>
    simVenta.updateSimulacionVentaGanado(db, id, input, cuentaId),
  patch: (
    id: number,
    patch: Parameters<typeof simVenta.patchSimulacionVentaGanado>[2],
    cuentaId?: number | null
  ) => simVenta.patchSimulacionVentaGanado(db, id, patch, cuentaId),
  updateDestino: (id: number, destino: string | null, cuentaId?: number | null) =>
    simVenta.updateDestinoVentaGanado(db, id, destino, cuentaId),
  delete: (id: number, cuentaId?: number | null) =>
    simVenta.deleteSimulacionVentaGanado(db, id, cuentaId),
  tipos: simVenta.SIMULADOR_VENTA_TIPOS,
  categoriasPorTipo: simVenta.categoriasPorTipo,
  labelsPorTipo: simVenta.labelsPorTipo,
};

export const simuladorVentaAuditoria = {
  list: (filters?: Parameters<typeof simVentaAud.listSimuladorVentaAuditoria>[1]) =>
    simVentaAud.listSimuladorVentaAuditoria(db, filters),
  record: (input: simVentaAud.SimuladorVentaAuditoriaInput) =>
    simVentaAud.recordSimuladorVentaAuditoria(db, input),
  labels: simVentaAud.SIMULADOR_VENTA_AUDITORIA_LABELS,
};

export const simuladorVentaDispositivos = {
  list: (simulacionId: number) => simVentaDisp.listDispositivosBySimulacion(db, simulacionId),
  count: (simulacionId: number) => simVentaDisp.countDispositivosBySimulacion(db, simulacionId),
  replace: (simulacionId: number, items: simVentaDisp.SimuladorVentaDispositivoInput[]) =>
    simVentaDisp.replaceDispositivosBySimulacion(db, simulacionId, items),
  replaceWithStock: (
    simulacion: simVenta.SimuladorVentaGanadoRow,
    items: simVentaDisp.SimuladorVentaDispositivoInput[]
  ) => simVentaStock.syncAndReplaceSimuladorVentaDispositivos(db, simulacion, items),
  revertStock: (simulacionId: number) =>
    simVentaStock.revertirStockDispositivosSimulacion(db, simulacionId),
  clear: (simulacionId: number) => simVentaDisp.clearDispositivosBySimulacion(db, simulacionId),
  countEnVentasCerradas: () => simVentaDisp.countDispositivosEnVentasCerradas(db),
  listClavesEnVentasCerradas: () => simVentaDisp.listClavesDispositivosEnVentasCerradas(db),
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
  countsBySubRubroIds: (ids: number[]) => vsubItems.countVentaItemsBySubRubroIds(db, ids),
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
  listLotes: (filters?: stock.StockGanaderoFilters) =>
    stock.listStockGanaderoLotes(db, filters),
  getLote: (id: number) => stock.getStockGanaderoLoteById(db, id),
  listRegistros: (filters?: stock.StockGanaderoFilters) =>
    stock.listStockGanaderoRegistros(db, filters),
  importRows: (
    nombreArchivo: string,
    rows: stock.StockGanaderoRowInput[],
    cuentaId?: number | null
  ) => stock.importStockGanaderoRows(db, nombreArchivo, rows, cuentaId),
  importBaja: (
    rows: stock.StockGanaderoRowInput[],
    tipo_baja: stock.TipoBaja,
    autor?: stock.HistorialAutor
  ) => stock.importBajaDispositivos(db, rows, tipo_baja, autor),
  importBajaNumeros: (
    numeros: string[],
    tipo_baja: stock.TipoBaja,
    autor?: stock.HistorialAutor
  ) => stock.importBajaPorNumeros(db, numeros, tipo_baja, autor),
  importBajaDetalle: (items: stock.BajaDispositivoItemInput[], autor?: stock.HistorialAutor) =>
    stock.importBajaDetalle(db, items, autor),
  deleteLote: (id: number) => stock.deleteStockGanaderoLote(db, id),
  countRegistros: (filters?: stock.StockGanaderoFilters) =>
    stock.countStockGanaderoRegistros(db, filters),
  estadisticas: (filters?: stock.StockGanaderoFilters) =>
    stock.getStockGanaderoEstadisticas(db, filters),
  listDispositivos: (filters?: stock.StockGanaderoFilters) =>
    stock.listStockGanaderaDispositivos(db, filters),
  listSalidas: (filters?: stock.StockGanaderoFilters) =>
    stockSalidas.listSalidasSistemaDispositivos(db, filters),
  getDispositivo: (clave: string, filters?: stock.StockGanaderoFilters) =>
    stock.getStockGanaderaDispositivoDetalle(db, clave, filters),
  countDispositivos: (filters?: stock.StockGanaderoFilters) =>
    stock.countStockGanaderaDispositivosActivos(db, filters),
  countDispositivosTotal: (filters?: stock.StockGanaderoFilters) =>
    stock.countStockGanaderaDispositivos(db, filters),
  updateDispositivoSexo: (
    clave: string,
    sexo: stock.DispositivoSexo,
    eid?: string,
    autor?: stock.HistorialAutor
  ) => stock.updateStockGanaderaDispositivoSexo(db, clave, sexo, eid, autor),
  updateDispositivoEdad: (clave: string, edad: number | null, eid?: string) =>
    stock.updateStockGanaderaDispositivoEdad(db, clave, edad, eid),
  saveDispositivo: (
    clave: string,
    input: stock.DispositivoMetaInput,
    eid?: string,
    autor?: stock.HistorialAutor
  ) => stock.saveStockGanaderaDispositivo(db, clave, input, eid, autor),
  bulkPatchDispositivos: (
    claves: string[],
    patch: stock.DispositivoMetaPatch,
    eids?: Record<string, string>,
    autor?: stock.HistorialAutor
  ) => stock.bulkPatchStockGanaderaDispositivos(db, claves, patch, eids, autor),
  deleteDispositivos: (claves: string[]) =>
    stock.deleteStockGanaderaDispositivos(db, claves),
  vaciarCompleto: (cuentaId: number | null) =>
    stock.vaciarStockGanaderaCompleto(db, cuentaId),
  backupInfo: (cuentaId: number) => stock.infoStockGanaderaBackup(db, cuentaId),
  restaurarDesdeBackup: (cuentaId: number) =>
    stock.restaurarStockGanaderaDesdeBackup(db, cuentaId),
  listHistorialCambios: (clave: string) =>
    stock.listStockGanaderaDispositivoHistorial(db, clave),
  saveCabanaSeleccion: (
    items: stock.CabanaSeleccionInput[],
    autor?: stock.HistorialAutor
  ) => stock.saveCabanaSeleccionBulk(db, items, autor),
  quitarCabanaSeleccion: (claves: string[], autor?: stock.HistorialAutor) =>
    stock.quitarCabanaSeleccionBulk(db, claves, autor),
  listRazas: () => stock.listStockGanaderoRazas(db),
  createRaza: (nombre: string) => stock.createStockGanaderoRaza(db, nombre),
  deleteRaza: (nombre: string) => stock.deleteStockGanaderoRaza(db, nombre),
  listPotreros: (cuentaId: number) => stock.listStockGanaderoPotreros(db, cuentaId),
  createPotrero: (cuentaId: number, nombre: string) =>
    stock.createStockGanaderoPotrero(db, cuentaId, nombre),
  listGrupos: (cuentaId: number) => stock.listStockGanaderoGrupos(db, cuentaId),
  createGrupo: (cuentaId: number, nombre: string) =>
    stock.createStockGanaderoGrupo(db, cuentaId, nombre),
};

export const stockEquino = {
  listLotes: (filters?: stockEquinoDb.StockEquinoFilters) =>
    stockEquinoDb.listStockEquinoLotes(db, filters),
  getLote: (id: number) => stockEquinoDb.getStockEquinoLoteById(db, id),
  listRegistros: (filters?: stockEquinoDb.StockEquinoFilters) =>
    stockEquinoDb.listStockEquinoRegistros(db, filters),
  importRows: (
    nombreArchivo: string,
    rows: stockEquinoDb.StockEquinoRowInput[],
    cuentaId?: number | null
  ) => stockEquinoDb.importStockEquinoRows(db, nombreArchivo, rows, cuentaId),
  importBaja: (
    rows: stockEquinoDb.StockEquinoRowInput[],
    tipo_baja: stockEquinoDb.TipoBaja,
    autor?: stockEquinoDb.HistorialAutor
  ) => stockEquinoDb.importBajaDispositivos(db, rows, tipo_baja, autor),
  importBajaNumeros: (
    numeros: string[],
    tipo_baja: stockEquinoDb.TipoBaja,
    autor?: stockEquinoDb.HistorialAutor
  ) => stockEquinoDb.importBajaPorNumeros(db, numeros, tipo_baja, autor),
  importBajaDetalle: (items: stockEquinoDb.BajaDispositivoItemInput[], autor?: stockEquinoDb.HistorialAutor) =>
    stockEquinoDb.importBajaDetalle(db, items, autor),
  deleteLote: (id: number) => stockEquinoDb.deleteStockEquinoLote(db, id),
  countRegistros: (filters?: stockEquinoDb.StockEquinoFilters) =>
    stockEquinoDb.countStockEquinoRegistros(db, filters),
  estadisticas: (filters?: stockEquinoDb.StockEquinoFilters) =>
    stockEquinoDb.getStockEquinoEstadisticas(db, filters),
  listDispositivos: (filters?: stockEquinoDb.StockEquinoFilters) =>
    stockEquinoDb.listStockEquinaDispositivos(db, filters),
  listSalidas: (filters?: stockEquinoDb.StockEquinoFilters) =>
    stockEquinoSalidas.listSalidasSistemaDispositivos(db, filters),
  getDispositivo: (clave: string, filters?: stockEquinoDb.StockEquinoFilters) =>
    stockEquinoDb.getStockEquinaDispositivoDetalle(db, clave, filters),
  countDispositivos: (filters?: stockEquinoDb.StockEquinoFilters) =>
    stockEquinoDb.countStockEquinaDispositivosActivos(db, filters),
  countDispositivosTotal: (filters?: stockEquinoDb.StockEquinoFilters) =>
    stockEquinoDb.countStockEquinaDispositivos(db, filters),
  updateDispositivoSexo: (
    clave: string,
    sexo: stockEquinoDb.DispositivoSexo,
    eid?: string,
    autor?: stockEquinoDb.HistorialAutor
  ) => stockEquinoDb.updateStockEquinaDispositivoSexo(db, clave, sexo, eid, autor),
  updateDispositivoEdad: (clave: string, edad: number | null, eid?: string) =>
    stockEquinoDb.updateStockEquinaDispositivoEdad(db, clave, edad, eid),
  saveDispositivo: (
    clave: string,
    input: stockEquinoDb.DispositivoMetaInput,
    eid?: string,
    autor?: stockEquinoDb.HistorialAutor
  ) => stockEquinoDb.saveStockEquinaDispositivo(db, clave, input, eid, autor),
  bulkPatchDispositivos: (
    claves: string[],
    patch: stockEquinoDb.DispositivoMetaPatch,
    eids?: Record<string, string>,
    autor?: stockEquinoDb.HistorialAutor
  ) => stockEquinoDb.bulkPatchStockEquinaDispositivos(db, claves, patch, eids, autor),
  deleteDispositivos: (claves: string[]) =>
    stockEquinoDb.deleteStockEquinaDispositivos(db, claves),
  vaciarCompleto: (cuentaId: number | null) =>
    stockEquinoDb.vaciarStockEquinaCompleto(db, cuentaId),
  backupInfo: (cuentaId: number) => stockEquinoDb.infoStockEquinaBackup(db, cuentaId),
  restaurarDesdeBackup: (cuentaId: number) =>
    stockEquinoDb.restaurarStockEquinaDesdeBackup(db, cuentaId),
  listHistorialCambios: (clave: string) =>
    stockEquinoDb.listStockEquinaDispositivoHistorial(db, clave),
};

export const stockAuditoria = {
  record: (input: stockAud.StockMovimientoAuditoriaInput) =>
    stockAud.recordStockMovimientoAuditoria(db, input),
  list: (filters?: stockAud.StockMovimientoAuditoriaFilters) =>
    stockAud.listStockMovimientosAuditoria(db, filters),
};

export const ingresosVentas = {
  list: (filters?: ventas.IngresoVentaFilters, cuentaId?: number | null) =>
    ventas.listIngresosVentas(db, filters, cuentaId),
  getById: (id: number, cuentaId?: number | null) =>
    ventas.getIngresoVentaById(db, id, cuentaId),
  insert: (data: ventas.IngresoVentaInput, cuentaId?: number | null) =>
    ventas.insertIngresoVenta(db, data, cuentaId),
  update: (id: number, data: ventas.IngresoVentaInput, cuentaId?: number | null) =>
    ventas.updateIngresoVenta(db, id, data, cuentaId),
  delete: (id: number, cuentaId?: number | null) =>
    ventas.deleteIngresoVenta(db, id, cuentaId),
  peekNextNro: () => ventas.peekNextNroRegistroVenta(db),
  formatNumeroOperacion: (nro: number) => ventas.formatNumeroOperacionVenta(nro),
};

export const ventasAgricultura = {
  list: (filters?: ventasAgri.VentaAgriculturaFilters) =>
    ventasAgri.listVentasAgricultura(db, filters),
  getById: (id: number) => ventasAgri.getVentaAgriculturaById(db, id),
  insert: (data: ventasAgri.VentaAgriculturaInput) =>
    ventasAgri.insertVentaAgricultura(db, data),
  update: (id: number, data: ventasAgri.VentaAgriculturaInput) =>
    ventasAgri.updateVentaAgricultura(db, id, data),
  patch: (id: number, patch: Parameters<typeof ventasAgri.patchVentaAgricultura>[2]) =>
    ventasAgri.patchVentaAgricultura(db, id, patch),
  delete: (id: number) => ventasAgri.deleteVentaAgricultura(db, id),
};

export const ventasArrendamientos = {
  list: (filters?: ventasArr.VentaArrendamientoFilters) =>
    ventasArr.listVentasArrendamientos(db, filters),
  getById: (id: number) => ventasArr.getVentaArrendamientoById(db, id),
  insert: (data: ventasArr.VentaArrendamientoInput) =>
    ventasArr.insertVentaArrendamiento(db, data),
  update: (id: number, data: ventasArr.VentaArrendamientoInput) =>
    ventasArr.updateVentaArrendamiento(db, id, data),
  patch: (id: number, patch: Parameters<typeof ventasArr.patchVentaArrendamiento>[2]) =>
    ventasArr.patchVentaArrendamiento(db, id, patch),
  delete: (id: number) => ventasArr.deleteVentaArrendamiento(db, id),
};

export const proveedores = {
  list: (busqueda?: string, cuentaId?: number | null) =>
    prov.listProveedores(db, busqueda, cuentaId),
  getByCod: (cod: number, cuentaId?: number | null) =>
    prov.getProveedorByCod(db, cod, cuentaId),
  getById: (id: number, cuentaId?: number | null) => prov.getProveedorById(db, id, cuentaId),
  nextCod: (cuentaId?: number | null) => prov.getNextCod(db, cuentaId),
  insert: (data: prov.ProveedorInput, cuentaId?: number | null) =>
    prov.insertProveedor(db, data, cuentaId),
  update: (id: number, data: prov.ProveedorInput, cuentaId?: number | null) =>
    prov.updateProveedor(db, id, data, cuentaId),
  updateRubroClasificacion: (
    id: number,
    data: prov.ProveedorRubroClasificacionInput,
    cuentaId?: number | null
  ) => prov.updateProveedorRubroClasificacion(db, id, data, cuentaId),
  updateClasificacionResultado: (
    id: number,
    clasificacion: prov.Proveedor["clasificacion_resultado"],
    cuentaId?: number | null
  ) => prov.updateProveedorClasificacionResultado(db, id, clasificacion, cuentaId),
  delete: (id: number, cuentaId?: number | null) => prov.deleteProveedor(db, id, cuentaId),
};

export async function insertPresupuesto(
  data: PresupuestoInput,
  ingresadoPor?: { email: string; nombre: string }
): Promise<Presupuesto> {
  const nro_registro = await allocNroRegistro();
  const row = (await db.prepare(`
    INSERT INTO PRESUPUESTO (
      nro_registro, empresa, fecha, codigo_proveedor, razon_social_proveedor,
      concepto, observaciones, rubro, sub_rubro, responsable_gasto, funcionario_cedula, nro_factura,
      nro_operacion_origen,
      pesos, dolares_usd, reales, tc_usd, tc_reales, saldo_usd,
      ingresado_por_email, ingresado_por_nombre
    ) VALUES (
      @nro_registro, @empresa, @fecha, @codigo_proveedor, @razon_social_proveedor,
      @concepto, @observaciones, @rubro, @sub_rubro, @responsable_gasto, @funcionario_cedula, @nro_factura,
      @nro_operacion_origen,
      @pesos, @dolares_usd, @reales, @tc_usd, @tc_reales, @saldo_usd,
      @ingresado_por_email, @ingresado_por_nombre
    )
    RETURNING *
  `).get({
    ...data,
    nro_registro,
    ingresado_por_email: ingresadoPor?.email?.trim() ?? "",
    ingresado_por_nombre: ingresadoPor?.nombre?.trim() ?? "",
  })) as Presupuesto;
  return { ...row, documento_adjunto: null };
}

export async function updatePresupuesto(id: number, data: PresupuestoInput): Promise<boolean> {
  const result = await db.prepare(`
    UPDATE PRESUPUESTO SET
      empresa = @empresa, fecha = @fecha,
      codigo_proveedor = @codigo_proveedor,
      razon_social_proveedor = @razon_social_proveedor,
      concepto = @concepto, observaciones = @observaciones, rubro = @rubro, sub_rubro = @sub_rubro,
      responsable_gasto = @responsable_gasto, funcionario_cedula = @funcionario_cedula,
      nro_factura = @nro_factura, nro_operacion_origen = @nro_operacion_origen,
      pesos = @pesos, dolares_usd = @dolares_usd, reales = @reales,
      tc_usd = @tc_usd, tc_reales = @tc_reales, saldo_usd = @saldo_usd
    WHERE id = @id
  `).run({ ...data, id });
  return result.changes > 0;
}

export async function deletePresupuesto(id: number): Promise<boolean> {
  await presDoc.deletePresupuestoDocumento(db, id);
  const result = await db.prepare("DELETE FROM PRESUPUESTO WHERE id = ?").run(id);
  return result.changes > 0;
}

const PRESUPUESTO_SELECT = `
  SELECT p.*,
    pd.presupuesto_id AS doc_id,
    pd.nombre AS doc_nombre,
    pd.mime AS doc_mime,
    pd.tamano AS doc_tamano
  FROM PRESUPUESTO p
  LEFT JOIN PRESUPUESTO_DOCUMENTOS pd ON pd.presupuesto_id = p.id
`;

type PresupuestoDbRow = Presupuesto & {
  doc_id?: number | null;
  doc_nombre?: string | null;
  doc_mime?: string | null;
  doc_tamano?: number | null;
};

function mapPresupuestoRow(row: PresupuestoDbRow): Presupuesto {
  const { doc_id, doc_nombre, doc_mime, doc_tamano, ...base } = row;
  const tieneDoc = doc_id != null && Number(doc_id) > 0;
  const meta = presDoc.documentoMetaFromJoin({ doc_nombre, doc_mime, doc_tamano });
  return {
    ...base,
    documento_adjunto: tieneDoc
      ? meta ?? {
          nombre: String(doc_nombre ?? "comprobante.pdf").trim() || "comprobante.pdf",
          mime: String(doc_mime ?? "application/pdf"),
          tamano: Number(doc_tamano ?? 0),
        }
      : null,
  };
}

export async function getPresupuesto(id: number): Promise<Presupuesto | undefined> {
  const row = (await db
    .prepare(`${PRESUPUESTO_SELECT} WHERE p.id = ?`)
    .get(id)) as PresupuestoDbRow | undefined;
  return row ? mapPresupuestoRow(row) : undefined;
}

export interface ListFilters {
  empresa?: string;
  empresas?: string[];
  rubro?: string;
  responsable_gasto?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
  ingresado_por_email?: string;
}

export async function listPresupuesto(filters: ListFilters = {}): Promise<Presupuesto[]> {
  let query = `${PRESUPUESTO_SELECT} WHERE 1=1`;
  const params: Record<string, unknown> = {};

  if (filters.ingresado_por_email) {
    query += " AND LOWER(ingresado_por_email) = LOWER(@ingresado_por_email)";
    params.ingresado_por_email = filters.ingresado_por_email.trim();
  }
  if (filters.empresas?.length) {
    const names = filters.empresas.map((_, i) => `@empresa_${i}`);
    query += ` AND empresa IN (${names.join(", ")})`;
    filters.empresas.forEach((empresa, i) => {
      params[`empresa_${i}`] = empresa;
    });
  } else if (filters.empresa) {
    query += " AND empresa = @empresa";
    params.empresa = filters.empresa;
  }
  if (filters.rubro) {
    query += " AND rubro = @rubro";
    params.rubro = filters.rubro;
  }
  if (filters.responsable_gasto === "__none__") {
    query += " AND (responsable_gasto IS NULL OR trim(responsable_gasto) = '')";
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

  query += " ORDER BY p.fecha DESC, p.id DESC";
  const rows = (await db.prepare(query).all(params)) as PresupuestoDbRow[];
  return rows.map(mapPresupuestoRow);
}

export async function resumenPorEmpresa(
  fecha_desde?: string,
  fecha_hasta?: string,
  scope?: ResumenEmpresaScope
): Promise<ResumenEmpresa[]> {
  let query = `
    SELECT empresa, COUNT(*) AS cantidad,
      COALESCE(SUM(pesos), 0) AS total_pesos,
      COALESCE(SUM(dolares_usd), 0) AS total_usd,
      COALESCE(SUM(reales), 0) AS total_reales,
      COALESCE(SUM(saldo_usd), 0) AS total_saldo_usd
    FROM PRESUPUESTO WHERE 1=1
  `;
  const params: Record<string, string> = {};
  query = appendEmpresaScope(query, params, scope);
  if (fecha_desde) {
    query += " AND fecha >= @fecha_desde";
    params.fecha_desde = fecha_desde;
  }
  if (fecha_hasta) {
    query += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = fecha_hasta;
  }
  query += " GROUP BY empresa ORDER BY empresa";
  return (await db.prepare(query).all(params)) as ResumenEmpresa[];
}

export async function resumenPorRubro(
  scope?: ResumenEmpresaScope,
  fecha_desde?: string,
  fecha_hasta?: string
): Promise<ResumenRubro[]> {
  let query = `
    SELECT rubro, COUNT(*) AS cantidad,
      COALESCE(SUM(pesos), 0) AS total_pesos,
      COALESCE(SUM(dolares_usd), 0) AS total_usd,
      COALESCE(SUM(reales), 0) AS total_reales,
      COALESCE(SUM(saldo_usd), 0) AS total_saldo_usd
    FROM PRESUPUESTO WHERE 1=1
  `;
  const params: Record<string, string> = {};
  query = appendEmpresaScope(query, params, scope);
  if (fecha_desde) {
    query += " AND fecha >= @fecha_desde";
    params.fecha_desde = fecha_desde;
  }
  if (fecha_hasta) {
    query += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = fecha_hasta;
  }
  query += " GROUP BY rubro ORDER BY total_saldo_usd DESC";
  return (await db.prepare(query).all(params)) as ResumenRubro[];
}

export async function resumenPorEmpresaRubro(
  fecha_desde?: string,
  fecha_hasta?: string,
  scope?: ResumenEmpresaScope
): Promise<ResumenEmpresaRubro[]> {
  let query = `
    SELECT empresa, rubro, COUNT(*) AS cantidad,
      COALESCE(SUM(pesos), 0) AS total_pesos,
      COALESCE(SUM(dolares_usd), 0) AS total_usd,
      COALESCE(SUM(reales), 0) AS total_reales,
      COALESCE(SUM(saldo_usd), 0) AS total_saldo_usd
    FROM PRESUPUESTO WHERE 1=1
  `;
  const params: Record<string, string> = {};
  query = appendEmpresaScope(query, params, scope);
  if (fecha_desde) {
    query += " AND fecha >= @fecha_desde";
    params.fecha_desde = fecha_desde;
  }
  if (fecha_hasta) {
    query += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = fecha_hasta;
  }
  query += " GROUP BY empresa, rubro ORDER BY empresa ASC, total_saldo_usd DESC";
  return (await db.prepare(query).all(params)) as ResumenEmpresaRubro[];
}

/**
 * Inicio del ejercicio contable agropecuario (Uruguay/IMEBA): 1/7 → 30/6.
 * De enero a junio el ejercicio vigente empezó el 1/7 del año anterior.
 */
function inicioEjercicioContable(ref: Date = new Date()): Date {
  const year = ref.getMonth() < 6 ? ref.getFullYear() - 1 : ref.getFullYear();
  return new Date(year, 6, 1);
}

/** Fecha ISO (YYYY-MM-01) del inicio del ejercicio contable vigente. */
function estadoFinancieroDesde(): string {
  const d = inicioEjercicioContable();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Inicio del mismo rango, un año antes (para variación interanual). */
function estadoFinancieroDesdeAnioAnterior(): string {
  const d = inicioEjercicioContable();
  return `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "set",
  "oct",
  "nov",
  "dic",
] as const;

function labelMesEstado(clave: string): string {
  const [y, m] = clave.split("-");
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return clave;
  return `${MESES_CORTOS[idx]} ${y}`;
}

function claveMesDesdeFecha(iso: string): string {
  return iso.slice(0, 7);
}

export function listarMesesEstadoFinanciero(fecha_hasta?: string): EstadoFinancieroMes[] {
  const inicio = inicioEjercicioContable();
  // Cierre del ejercicio: 30/6 del año siguiente al inicio.
  const finEjercicio = new Date(inicio.getFullYear() + 1, 5, 1);
  let fin = new Date();
  if (fin > finEjercicio) fin = finEjercicio;
  if (fecha_hasta) {
    const h = new Date(`${fecha_hasta}T12:00:00`);
    if (!Number.isNaN(h.getTime()) && h < fin) fin = h;
  }
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const finMes = new Date(fin.getFullYear(), fin.getMonth(), 1);
  const hastaMes = finMes < cursor ? cursor : finMes;
  const meses: EstadoFinancieroMes[] = [];
  while (cursor <= hastaMes) {
    const clave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    meses.push({ clave, label: labelMesEstado(clave) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return meses;
}

function usdVacio(): EstadoFinancieroUsd {
  return { total_saldo_usd: 0, por_mes: {} };
}

function sumarUsd(acc: EstadoFinancieroUsd, row: EstadoFinancieroUsd): EstadoFinancieroUsd {
  const por_mes = { ...acc.por_mes };
  for (const [mes, valor] of Object.entries(row.por_mes)) {
    por_mes[mes] = (por_mes[mes] ?? 0) + valor;
  }
  return {
    total_saldo_usd: acc.total_saldo_usd + row.total_saldo_usd,
    por_mes,
  };
}

function usdDesdePorMes(por_mes: Record<string, number>): EstadoFinancieroUsd {
  const total_saldo_usd = Object.values(por_mes).reduce((a, b) => a + b, 0);
  return { total_saldo_usd, por_mes };
}

function normClave(s: string): string {
  return s.trim().toLowerCase();
}

function claveRubroSub(rubro: string, subRubro: string): string {
  return `${normClave(rubro)}|${normClave(subRubro)}`;
}

function mismoNombre(a: string, b: string): boolean {
  return a.localeCompare(b, "es", { sensitivity: "accent" }) === 0;
}

function sumarTotales(acc: ResumenTotales, row: ResumenTotales): ResumenTotales {
  return {
    cantidad: acc.cantidad + row.cantidad,
    total_pesos: acc.total_pesos + row.total_pesos,
    total_usd: acc.total_usd + row.total_usd,
    total_reales: acc.total_reales + row.total_reales,
    total_saldo_usd: acc.total_saldo_usd + row.total_saldo_usd,
  };
}

export async function resumenPorSubRubro(
  scope?: ResumenEmpresaScope,
  fecha_desde?: string,
  fecha_hasta?: string
): Promise<ResumenSubRubro[]> {
  let query = `
    SELECT rubro,
      COALESCE(NULLIF(trim(sub_rubro), ''), '') AS sub_rubro,
      COUNT(*) AS cantidad,
      COALESCE(SUM(pesos), 0) AS total_pesos,
      COALESCE(SUM(dolares_usd), 0) AS total_usd,
      COALESCE(SUM(reales), 0) AS total_reales,
      COALESCE(SUM(saldo_usd), 0) AS total_saldo_usd
    FROM PRESUPUESTO WHERE 1=1
  `;
  const params: Record<string, string> = {};
  query = appendEmpresaScope(query, params, scope);
  if (fecha_desde) {
    query += " AND fecha >= @fecha_desde";
    params.fecha_desde = fecha_desde;
  }
  if (fecha_hasta) {
    query += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = fecha_hasta;
  }
  query += " GROUP BY rubro, COALESCE(NULLIF(trim(sub_rubro), ''), '')";
  query += " ORDER BY rubro ASC, sub_rubro ASC";
  return (await db.prepare(query).all(params)) as ResumenSubRubro[];
}

export async function resumenPorSubRubroMensual(
  scope?: ResumenEmpresaScope,
  fecha_hasta?: string
): Promise<ResumenSubRubroMes[]> {
  let query = `
    SELECT rubro,
      COALESCE(NULLIF(trim(sub_rubro), ''), '') AS sub_rubro,
      SUBSTRING(fecha FROM 1 FOR 7) AS mes,
      COALESCE(SUM(saldo_usd), 0) AS total_saldo_usd
    FROM PRESUPUESTO
    WHERE fecha >= @fecha_inicio
  `;
  const params: Record<string, string> = { fecha_inicio: estadoFinancieroDesdeAnioAnterior() };
  query = appendEmpresaScope(query, params, scope);
  if (fecha_hasta) {
    query += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = fecha_hasta;
  }
  query +=
    " GROUP BY rubro, COALESCE(NULLIF(trim(sub_rubro), ''), ''), SUBSTRING(fecha FROM 1 FOR 7)";
  query += " ORDER BY mes ASC, rubro ASC, sub_rubro ASC";
  return (await db.prepare(query).all(params)) as ResumenSubRubroMes[];
}

function claveMesAnioAnterior(clave: string): string {
  const [y, m] = clave.split("-");
  if (!y || !m) return clave;
  return `${Number(y) - 1}-${m}`;
}

function porMesDesdeMovimientos(
  meses: EstadoFinancieroMes[],
  rubro: string,
  subRubro: string,
  movMes: Map<string, number>
): Record<string, number> {
  const base = claveRubroSub(rubro, subRubro);
  const por_mes: Record<string, number> = {};
  for (const mes of meses) {
    por_mes[mes.clave] = movMes.get(`${base}|${mes.clave}`) ?? 0;
    const claveAa = claveMesAnioAnterior(mes.clave);
    por_mes[claveAa] = movMes.get(`${base}|${claveAa}`) ?? 0;
  }
  return por_mes;
}

/** Estado financiero: catálogo Configuración → Rubros, USD por mes desde 01/07/2026. */
export async function buildEstadoFinanciero(
  scope?: ResumenEmpresaScope,
  fecha_hasta?: string
): Promise<EstadoFinancieroPayload> {
  const catalogo = await sub.getCatalogoGruposParaGastos(db);
  const meses = listarMesesEstadoFinanciero(fecha_hasta);
  const movMensual = await resumenPorSubRubroMensual(scope, fecha_hasta);

  const movMes = new Map<string, number>();
  for (const m of movMensual) {
    if (!m.mes) continue;
    const clave = `${claveRubroSub(m.rubro, m.sub_rubro)}|${m.mes}`;
    movMes.set(clave, (movMes.get(clave) ?? 0) + m.total_saldo_usd);
  }

  const rubrosCatalogo = [...catalogo.rubros].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "accent" })
  );

  const rubrosEnMovimientos = new Set<string>();
  for (const m of movMensual) {
    if (m.rubro?.trim()) rubrosEnMovimientos.add(m.rubro.trim());
  }

  const rubrosOrdenados: string[] = [...rubrosCatalogo];
  for (const r of rubrosEnMovimientos) {
    if (!rubrosOrdenados.some((x) => mismoNombre(x, r))) {
      rubrosOrdenados.push(r);
    }
  }
  rubrosOrdenados.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "accent" }));

  const rubros: EstadoFinancieroRubro[] = [];

  for (const rubro of rubrosOrdenados) {
    const subsCatalogo = catalogo.sub_rubros_por_rubro[rubro] ?? [];
    const subsMovimiento = movMensual
      .filter((m) => mismoNombre(m.rubro, rubro) && m.sub_rubro.trim())
      .map((m) => m.sub_rubro.trim());

    const subsUnicos: string[] = [...subsCatalogo];
    for (const s of subsMovimiento) {
      if (!subsUnicos.some((x) => mismoNombre(x, s))) subsUnicos.push(s);
    }
    subsUnicos.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "accent" }));

    const sub_rubros: EstadoFinancieroLinea[] = subsUnicos.map((sub_rubro) => {
      const por_mes = porMesDesdeMovimientos(meses, rubro, sub_rubro, movMes);
      return { sub_rubro, ...usdDesdePorMes(por_mes) };
    });

    const sinSubPorMes = porMesDesdeMovimientos(meses, rubro, "", movMes);
    const sinSubTotal = Object.values(sinSubPorMes).reduce((a, b) => a + b, 0);
    if (sinSubTotal > 0) {
      sub_rubros.push({
        sub_rubro: "(Sin sub-rubro)",
        ...usdDesdePorMes(sinSubPorMes),
      });
    }

    const totales = sub_rubros.reduce((acc, linea) => sumarUsd(acc, linea), usdVacio());

    const enCatalogo = rubrosCatalogo.some((r) => mismoNombre(r, rubro));
    const tieneMovimiento = totales.total_saldo_usd > 0;
    if (enCatalogo || tieneMovimiento || subsCatalogo.length > 0) {
      rubros.push({ rubro, sub_rubros, totales });
    }
  }

  return { meses, rubros };
}

function totalesVacio(): ResumenTotales {
  return {
    cantidad: 0,
    total_pesos: 0,
    total_usd: 0,
    total_reales: 0,
    total_saldo_usd: 0,
  };
}

export async function buildGastosProveedoresReport(
  codigos: number[],
  scope?: ResumenEmpresaScope,
  fecha_desde?: string,
  fecha_hasta?: string
): Promise<GastosProveedoresReportPayload> {
  const codigosUnicos = [...new Set(codigos.filter((c) => Number.isFinite(c) && c > 0))];
  if (codigosUnicos.length === 0) {
    return { totales: [], detalle: [], consolidado: totalesVacio() };
  }

  const codStr = codigosUnicos.map(String);
  const placeholders = codStr.map((_, i) => `@cod${i}`).join(", ");
  const params: Record<string, string> = {};
  codStr.forEach((c, i) => {
    params[`cod${i}`] = c;
  });

  let where = ` WHERE trim(codigo_proveedor) IN (${placeholders})`;
  where = appendEmpresaScope(where, params, scope);
  if (fecha_desde?.trim()) {
    where += " AND fecha >= @fecha_desde";
    params.fecha_desde = fecha_desde.trim();
  }
  if (fecha_hasta?.trim()) {
    where += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = fecha_hasta.trim();
  }

  const totalesRows = (await db
    .prepare(
      `
    SELECT
      trim(codigo_proveedor) AS codigo_proveedor,
      MAX(razon_social_proveedor) AS razon_social_proveedor,
      COUNT(*) AS cantidad,
      COALESCE(SUM(pesos), 0) AS total_pesos,
      COALESCE(SUM(dolares_usd), 0) AS total_usd,
      COALESCE(SUM(reales), 0) AS total_reales,
      COALESCE(SUM(saldo_usd), 0) AS total_saldo_usd
    FROM PRESUPUESTO
    ${where}
    GROUP BY trim(codigo_proveedor)
    ORDER BY total_saldo_usd DESC, codigo_proveedor ASC
  `
    )
    .all(params)) as GastosProveedorTotalesLinea[];

  const detalle = (await db
    .prepare(
      `
    SELECT
      id,
      trim(codigo_proveedor) AS codigo_proveedor,
      fecha,
      empresa,
      rubro,
      COALESCE(NULLIF(trim(sub_rubro), ''), '') AS sub_rubro,
      concepto,
      nro_factura,
      COALESCE(pesos, 0) AS pesos,
      COALESCE(dolares_usd, 0) AS dolares_usd,
      COALESCE(reales, 0) AS reales,
      COALESCE(saldo_usd, 0) AS saldo_usd
    FROM PRESUPUESTO
    ${where}
    ORDER BY trim(codigo_proveedor) ASC, fecha DESC, id DESC
  `
    )
    .all(params)) as GastosProveedorDetalleLinea[];

  const catalogoProveedores = await prov.listProveedores(db);
  const nombreCatalogo = new Map(
    catalogoProveedores.map((p) => [String(p.cod), p.razon_social])
  );

  const totalesMap = new Map(
    totalesRows.map((row) => [String(row.codigo_proveedor), row])
  );

  const totales: GastosProveedorTotalesLinea[] = codigosUnicos.map((codNum) => {
    const cod = String(codNum);
    const row = totalesMap.get(cod);
    if (row) {
      return {
        ...row,
        codigo_proveedor: cod,
        razon_social_proveedor:
          nombreCatalogo.get(cod) ??
          String(row.razon_social_proveedor ?? "").trim() ??
          `Proveedor ${cod}`,
        cantidad: Number(row.cantidad ?? 0),
        total_pesos: Number(row.total_pesos ?? 0),
        total_usd: Number(row.total_usd ?? 0),
        total_reales: Number(row.total_reales ?? 0),
        total_saldo_usd: Number(row.total_saldo_usd ?? 0),
      };
    }
    return {
      codigo_proveedor: cod,
      razon_social_proveedor: nombreCatalogo.get(cod) ?? `Proveedor ${cod}`,
      ...totalesVacio(),
    };
  });

  totales.sort(
    (a, b) =>
      b.total_saldo_usd - a.total_saldo_usd ||
      a.razon_social_proveedor.localeCompare(b.razon_social_proveedor, "es", {
        sensitivity: "accent",
      })
  );

  const consolidado = totales.reduce((acc, row) => sumarTotales(acc, row), totalesVacio());

  return {
    totales,
    detalle: detalle.map((row) => ({
      ...row,
      id: Number(row.id),
      codigo_proveedor: String(row.codigo_proveedor ?? "").trim(),
      fecha: String(row.fecha ?? ""),
      empresa: String(row.empresa ?? ""),
      rubro: String(row.rubro ?? ""),
      sub_rubro: String(row.sub_rubro ?? ""),
      concepto: String(row.concepto ?? ""),
      nro_factura: String(row.nro_factura ?? ""),
      pesos: Number(row.pesos ?? 0),
      dolares_usd: Number(row.dolares_usd ?? 0),
      reales: Number(row.reales ?? 0),
      saldo_usd: Number(row.saldo_usd ?? 0),
    })),
    consolidado,
  };
}

export async function buildEstadoResultados(
  opts: {
    fecha_desde?: string;
    fecha_hasta?: string;
    empresa?: string;
    empresas?: string[];
    cuentaId?: number | null;
  }
): Promise<EstadoResultadosPayload> {
  return buildEstadoResultadosCore(db, opts);
}

export const rubros = {
  list: (soloActivos?: boolean) => rub.listRubros(db, soloActivos ?? false),
  listNombres: () => rub.listRubrosNombres(db),
  getById: (id: number) => rub.getRubroById(db, id),
  insert: (data: rub.RubroInput) => rub.insertRubro(db, data),
  update: (id: number, data: rub.RubroInput) => rub.updateRubro(db, id, data),
  delete: (id: number) => rub.deleteRubro(db, id),
  existsActivo: (nombre: string) => rub.rubroExistsActivo(db, nombre),
  gastoValido: (nombre: string) => vinc.rubroGastoValido(db, nombre),
};

export const responsables = {
  list: (soloActivos?: boolean, cuentaId?: number | null) =>
    resp.listResponsables(db, soloActivos ?? false, cuentaId),
  listNombres: (cuentaId?: number | null) => resp.listResponsablesNombres(db, cuentaId),
  getById: (id: number, cuentaId?: number | null) => resp.getResponsableById(db, id, cuentaId),
  insert: (data: resp.ResponsableInput, cuentaId?: number | null) =>
    resp.insertResponsable(db, data, cuentaId),
  update: (id: number, data: resp.ResponsableInput, cuentaId?: number | null) =>
    resp.updateResponsable(db, id, data, cuentaId),
  delete: (id: number, cuentaId?: number | null) => resp.deleteResponsable(db, id, cuentaId),
  existsActivo: (nombre: string, cuentaId?: number | null) =>
    resp.responsableExistsActivo(db, nombre, cuentaId),
};

export const subRubros = {
  list: (soloActivos?: boolean) => sub.listSubRubros(db, soloActivos ?? false),
  listNombres: () => sub.listSubRubrosNombres(db),
  listGrupos: () => sub.listSubRubrosGrupos(db),
  getById: (id: number) => sub.getSubRubroById(db, id),
  getByNombre: (nombre: string) => sub.getSubRubroByNombre(db, nombre),
  insert: (data: sub.SubRubroInput) => sub.insertSubRubro(db, data),
  update: (id: number, data: sub.SubRubroInput) => sub.updateSubRubro(db, id, data),
  delete: (id: number) => sub.deleteSubRubro(db, id),
  deleteByGrupo: (grupo: string) => sub.deleteSubRubrosByGrupo(db, grupo),
  renameGrupo: (anterior: string, nuevo: string) => sub.renameSubRubroGrupo(db, anterior, nuevo),
  existsActivo: (nombre: string) => sub.subRubroExistsActivo(db, nombre),
};

export const subRubroItems = {
  listBySubRubroId: (subRubroId: number, soloActivos?: boolean) =>
    subItems.listItemsBySubRubroId(db, subRubroId, soloActivos ?? false),
  listBySubRubroNombre: (nombre: string, soloActivos?: boolean) =>
    subItems.listItemsBySubRubroNombre(db, nombre, soloActivos ?? true),
  countsBySubRubroIds: (ids: number[]) => subItems.countItemsBySubRubroIds(db, ids),
  groupedBySubRubroIds: (ids: number[]) => subItems.listItemsGroupedBySubRubroIds(db, ids),
  getById: (id: number) => subItems.getItemById(db, id),
  insert: (subRubroId: number, data: subItems.SubRubroItemInput) =>
    subItems.insertItem(db, subRubroId, data),
  update: (id: number, data: subItems.SubRubroItemInput) =>
    subItems.updateItem(db, id, data),
  delete: (id: number) => subItems.deleteItem(db, id),
};

export const funcionarios = {
  list: (opts?: { busqueda?: string; soloActivos?: boolean }, cuentaId?: number | null) =>
    func.listFuncionarios(db, opts, cuentaId),
  getById: (id: number, cuentaId?: number | null) => func.getFuncionarioById(db, id, cuentaId),
  getByCedula: (cedula: string, cuentaId?: number | null) =>
    func.getFuncionarioByCedula(db, cedula, cuentaId),
  insert: (data: func.FuncionarioInput, cuentaId?: number | null) =>
    func.insertFuncionario(db, data, cuentaId),
  update: (id: number, data: func.FuncionarioInput, cuentaId?: number | null) =>
    func.updateFuncionario(db, id, data, cuentaId),
  delete: (id: number, cuentaId?: number | null) => func.deleteFuncionario(db, id, cuentaId),
  selector: (cuentaId?: number | null) => func.listFuncionariosParaSelector(db, cuentaId),
  getByNombreDisplay: (nombre: string, cuentaId?: number | null) =>
    func.getFuncionarioByNombreDisplay(db, nombre, cuentaId),
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
  renameGrupo: (anterior: string, nuevo: string) => gicon.renameGrupoIcono(db, anterior, nuevo),
};

export const rubroVinculos = {
  getSubRubroIds: (rubroId: number) => vinc.getSubRubroIdsForRubro(db, rubroId),
  setSubRubros: (rubroId: number, subRubroIds: number[]) =>
    vinc.setRubroSubRubros(db, rubroId, subRubroIds),
  mapPorRubro: (soloActivos?: boolean) => vinc.getMapSubRubrosPorRubro(db, soloActivos ?? true),
  mapaCompleto: () => vinc.getMapaVinculosCompleto(db),
  isValidPair: (rubro: string, subRubro: string) =>
    vinc.isSubRubroValidForRubro(db, rubro, subRubro),
  syncPorGrupo: (subRubroId: number, grupo: string) =>
    vinc.syncVinculoSubRubroPorGrupo(db, subRubroId, grupo),
  resolveGrupoParaRubro: (rubroNombre: string) =>
    vinc.resolveGrupoParaRubroContable(db, rubroNombre),
};

export const documentosDigitales = {
  listTiposGasto: (opts?: { soloActivos?: boolean }) =>
    docDig.listTiposDocumentoGasto(db, opts),
  getTipoGastoById: (id: number) => docDig.getTipoDocumentoGastoById(db, id),
  insertTipoGasto: (input: docDig.TipoDocumentoGastoInput) =>
    docDig.insertTipoDocumentoGasto(db, input),
  updateTipoGasto: (id: number, input: docDig.TipoDocumentoGastoInput) =>
    docDig.updateTipoDocumentoGasto(db, id, input),
  deleteTipoGasto: (id: number) => docDig.deleteTipoDocumentoGasto(db, id),
};

export async function getCatalogos(user?: {
  id?: number;
  email?: string;
  es_super_admin?: boolean;
  es_admin_plataforma?: boolean;
  empresa_id?: number | null;
}): Promise<{
  empresas: string[];
  rubros: string[];
  sub_rubros: string[];
  sub_rubros_por_rubro: Record<string, string[]>;
  responsables: string[];
  funcionarios: Awaited<ReturnType<typeof func.listFuncionariosParaSelector>>;
}> {
  const { rubros, sub_rubros_por_rubro: porGrupo } =
    await sub.getCatalogoGruposParaGastos(db);
  const porRubroContable = await vinc.getMapSubRubrosPorRubro(db, true);
  const scopeUser =
    user && user.id != null
      ? {
          id: user.id,
          email: user.email,
          es_super_admin: user.es_super_admin,
          es_admin_plataforma: user.es_admin_plataforma,
          empresa_id: user.empresa_id,
        }
      : null;
  const empresasScope = scopeUser
    ? await empresasCuenta.getEmpresasOperativasPermitidas(db, scopeUser)
    : null;
  const empresas =
    empresasScope ??
    (scopeUser?.es_admin_plataforma
      ? await empresasCuenta.getEmpresaNombresActivos(db)
      : []);
  const cuentaId = scopeUser
    ? await empresasCuenta.resolveCuentaMadreIdForUser(db, scopeUser)
    : null;

  const sinCuentaOperativa =
    scopeUser && !scopeUser.es_super_admin && cuentaId == null;
  const responsables = sinCuentaOperativa
    ? []
    : await resp.listResponsablesNombres(db, cuentaId);
  const funcionarios = sinCuentaOperativa
    ? []
    : await func.listFuncionariosParaSelector(db, cuentaId);

  return {
    empresas,
    rubros,
    sub_rubros: await sub.listSubRubrosNombres(db),
    sub_rubros_por_rubro: { ...porRubroContable, ...porGrupo },
    responsables,
    funcionarios,
  };
}

export { empresasCuenta };
