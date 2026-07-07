-- SAG — esquema PostgreSQL (Supabase)
-- Ejecutar en SQL Editor de Supabase o vía init automático al arrancar.

CREATE TABLE IF NOT EXISTS PRESUPUESTO (
  id SERIAL PRIMARY KEY,
  empresa TEXT NOT NULL CHECK (empresa IN ('GANADERA GUAVIYU', 'GANADERA CHIVILCOY')),
  fecha TEXT NOT NULL,
  codigo_proveedor TEXT,
  razon_social_proveedor TEXT,
  concepto TEXT NOT NULL,
  rubro TEXT NOT NULL,
  nro_factura TEXT,
  pesos DOUBLE PRECISION DEFAULT 0,
  dolares_usd DOUBLE PRECISION DEFAULT 0,
  reales DOUBLE PRECISION DEFAULT 0,
  tc_usd DOUBLE PRECISION DEFAULT 0,
  tc_reales DOUBLE PRECISION DEFAULT 0,
  saldo_usd DOUBLE PRECISION DEFAULT 0,
  nro_registro INTEGER UNIQUE,
  responsable_gasto TEXT NOT NULL DEFAULT '',
  sub_rubro TEXT NOT NULL DEFAULT '',
  funcionario_cedula TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  ingresado_por_email TEXT NOT NULL DEFAULT '',
  ingresado_por_nombre TEXT NOT NULL DEFAULT '',
  nro_operacion_origen TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_presupuesto_empresa ON PRESUPUESTO(empresa);
CREATE INDEX IF NOT EXISTS idx_presupuesto_fecha ON PRESUPUESTO(fecha);
CREATE INDEX IF NOT EXISTS idx_presupuesto_rubro ON PRESUPUESTO(rubro);
CREATE INDEX IF NOT EXISTS idx_presupuesto_responsable ON PRESUPUESTO(responsable_gasto);
CREATE INDEX IF NOT EXISTS idx_presupuesto_sub_rubro ON PRESUPUESTO(sub_rubro);
CREATE INDEX IF NOT EXISTS idx_presupuesto_funcionario_cedula ON PRESUPUESTO(funcionario_cedula);
CREATE UNIQUE INDEX IF NOT EXISTS idx_presupuesto_nro_registro ON PRESUPUESTO(nro_registro);

CREATE TABLE IF NOT EXISTS PRESUPUESTO_REGISTRO_SEQ (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ultimo INTEGER NOT NULL DEFAULT 0
);
INSERT INTO PRESUPUESTO_REGISTRO_SEQ (id, ultimo) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS PRESUPUESTO_DOCUMENTOS (
  presupuesto_id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  mime TEXT NOT NULL,
  tamano INTEGER NOT NULL DEFAULT 0,
  archivo TEXT NOT NULL DEFAULT '',
  datos BYTEA,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS PROVEEDORES (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id),
  cod INTEGER NOT NULL,
  razon_social TEXT NOT NULL,
  rut TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  ciudad TEXT DEFAULT '',
  rubro TEXT DEFAULT '',
  sub_rubro TEXT DEFAULT '',
  clasificacion_resultado TEXT CHECK (
    clasificacion_resultado IS NULL OR clasificacion_resultado IN (
      'COSTOS_PRODUCCION', 'GASTOS_ADMINISTRATIVOS', 'GASTOS_COMERCIALES'
    )
  ),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_cuenta_cod ON PROVEEDORES(cuenta_id, cod);
CREATE INDEX IF NOT EXISTS idx_proveedores_razon ON PROVEEDORES(razon_social);

CREATE TABLE IF NOT EXISTS DIVISAS_TC (
  id SERIAL PRIMARY KEY,
  fecha TEXT NOT NULL,
  par TEXT NOT NULL CHECK (par IN ('UYU_USD', 'BRL_USD')),
  valor DOUBLE PRECISION NOT NULL,
  UNIQUE (fecha, par)
);

CREATE TABLE IF NOT EXISTS PRECIOS_GANADO_ACG (
  id SERIAL PRIMARY KEY,
  anio INTEGER NOT NULL,
  semana INTEGER NOT NULL,
  fecha_desde TEXT NOT NULL,
  fecha_hasta TEXT NOT NULL,
  segmento TEXT NOT NULL DEFAULT 'GORDO' CHECK (segmento IN ('GORDO', 'REPOSICION')),
  categoria TEXT NOT NULL CHECK (categoria IN ('NOVILLO', 'VACA', 'VAQUILLONA', 'TERNERO', 'TERNERA', 'VACA_INVERNADA')),
  valor DOUBLE PRECISION NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'USD_KG_CUARTA_BALANZA',
  fuente TEXT NOT NULL DEFAULT 'ACG',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (anio, semana, segmento, categoria)
);

CREATE TABLE IF NOT EXISTS PRECIOS_GANADO_ACG_SYNC (
  id SERIAL PRIMARY KEY,
  segmento TEXT NOT NULL DEFAULT 'GORDO' CHECK (segmento IN ('GORDO', 'REPOSICION')),
  anio INTEGER NOT NULL,
  semana INTEGER NOT NULL,
  fecha_desde TEXT NOT NULL,
  fecha_hasta TEXT NOT NULL,
  novillo DOUBLE PRECISION,
  vaca DOUBLE PRECISION,
  vaquillona DOUBLE PRECISION,
  ternero DOUBLE PRECISION,
  ternera DOUBLE PRECISION,
  vaca_invernada DOUBLE PRECISION,
  resultado TEXT NOT NULL CHECK (resultado IN ('insertado', 'actualizado', 'sin_cambios', 'error')),
  detalle TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_precios_ganado_fecha_hasta ON PRECIOS_GANADO_ACG(fecha_hasta DESC);
CREATE INDEX IF NOT EXISTS idx_precios_ganado_segmento ON PRECIOS_GANADO_ACG(segmento, fecha_hasta DESC);
CREATE INDEX IF NOT EXISTS idx_precios_ganado_sync_creado ON PRECIOS_GANADO_ACG_SYNC(creado_en DESC);

CREATE TABLE IF NOT EXISTS SIMULADOR_VENTA_GANADO (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('EN_PIE', 'CUARTA_BALANZA')),
  segmento TEXT NOT NULL CHECK (segmento IN ('GORDO', 'REPOSICION')),
  categoria TEXT NOT NULL,
  modo_kg TEXT NOT NULL CHECK (modo_kg IN ('TOTAL', 'CABEZAS')),
  precio_usd_kg DOUBLE PRECISION NOT NULL,
  precio_ref_anio INTEGER,
  precio_ref_semana INTEGER,
  precio_ref_fecha_hasta TEXT,
  cantidad_animales DOUBLE PRECISION,
  kg_promedio DOUBLE PRECISION,
  kg_total DOUBLE PRECISION NOT NULL,
  rendimiento DOUBLE PRECISION,
  total_usd DOUBLE PRECISION NOT NULL,
  total_usd_por_cabeza DOUBLE PRECISION,
  notas TEXT,
  destacada INTEGER NOT NULL DEFAULT 0,
  venta_realizada INTEGER NOT NULL DEFAULT 0,
  venta_realizada_en TIMESTAMPTZ,
  real_precio_usd_kg DOUBLE PRECISION,
  real_cantidad_animales DOUBLE PRECISION,
  real_kg_promedio DOUBLE PRECISION,
  real_kg_total DOUBLE PRECISION,
  real_total_usd DOUBLE PRECISION,
  real_total_usd_por_cabeza DOUBLE PRECISION,
  real_notas TEXT,
  destino TEXT,
  numero_operacion TEXT,
  usuario_id INTEGER,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sim_venta_ganado_numero_operacion
  ON SIMULADOR_VENTA_GANADO(numero_operacion)
  WHERE numero_operacion IS NOT NULL AND numero_operacion != '';
CREATE TABLE IF NOT EXISTS SIMULADOR_VENTA_GANADO_OP_SEQ (
  tipo TEXT PRIMARY KEY CHECK (tipo IN ('EN_PIE', 'CUARTA_BALANZA')),
  last_num INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sim_venta_ganado_tipo ON SIMULADOR_VENTA_GANADO(tipo, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_sim_venta_ganado_user ON SIMULADOR_VENTA_GANADO(usuario_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS SIMULADOR_VENTA_GANADO_AUDITORIA (
  id SERIAL PRIMARY KEY,
  simulacion_id INTEGER,
  numero_operacion TEXT NOT NULL DEFAULT '',
  user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL DEFAULT '',
  user_nombre TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL,
  resumen TEXT NOT NULL DEFAULT '',
  detalle TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sim_venta_audit_sim ON SIMULADOR_VENTA_GANADO_AUDITORIA(simulacion_id);
CREATE INDEX IF NOT EXISTS idx_sim_venta_audit_numero ON SIMULADOR_VENTA_GANADO_AUDITORIA(numero_operacion);
CREATE INDEX IF NOT EXISTS idx_sim_venta_audit_creado ON SIMULADOR_VENTA_GANADO_AUDITORIA(creado_en DESC);

CREATE TABLE IF NOT EXISTS SIMULADOR_VENTA_GANADO_DISPOSITIVO (
  id SERIAL PRIMARY KEY,
  simulacion_id INTEGER NOT NULL,
  clave TEXT NOT NULL,
  eid TEXT NOT NULL DEFAULT '',
  vid TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (simulacion_id, clave)
);
CREATE INDEX IF NOT EXISTS idx_sim_venta_disp_sim ON SIMULADOR_VENTA_GANADO_DISPOSITIVO(simulacion_id);
CREATE INDEX IF NOT EXISTS idx_sim_venta_disp_clave ON SIMULADOR_VENTA_GANADO_DISPOSITIVO(clave);

CREATE TABLE IF NOT EXISTS RUBROS (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rubros_nombre ON RUBROS (LOWER(nombre));

CREATE TABLE IF NOT EXISTS SUB_RUBROS (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  grupo TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_rubros_nombre ON SUB_RUBROS (LOWER(nombre));

CREATE TABLE IF NOT EXISTS SUB_RUBRO_ITEMS (
  id SERIAL PRIMARY KEY,
  sub_rubro_id INTEGER NOT NULL REFERENCES SUB_RUBROS(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (sub_rubro_id, nombre)
);

CREATE TABLE IF NOT EXISTS RUBRO_SUB_RUBROS (
  rubro_id INTEGER NOT NULL REFERENCES RUBROS(id) ON DELETE CASCADE,
  sub_rubro_id INTEGER NOT NULL REFERENCES SUB_RUBROS(id) ON DELETE CASCADE,
  PRIMARY KEY (rubro_id, sub_rubro_id)
);

CREATE TABLE IF NOT EXISTS GRUPO_ICONOS (
  id SERIAL PRIMARY KEY,
  grupo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'imagen',
  archivo TEXT NOT NULL DEFAULT '',
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_iconos_grupo ON GRUPO_ICONOS (LOWER(grupo));

CREATE TABLE IF NOT EXISTS RESPONSABLES (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id),
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  observaciones TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_responsables_cuenta_nombre ON RESPONSABLES (cuenta_id, LOWER(nombre));

CREATE TABLE IF NOT EXISTS FUNCIONARIOS (
  id SERIAL PRIMARY KEY,
  cedula TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  domicilio TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL DEFAULT '',
  departamento TEXT NOT NULL DEFAULT '',
  banco TEXT NOT NULL DEFAULT '',
  sucursal TEXT NOT NULL DEFAULT '',
  cuenta TEXT NOT NULL DEFAULT '',
  tipo_cuenta TEXT NOT NULL DEFAULT '',
  titular_cuenta TEXT NOT NULL DEFAULT '',
  cuenta_otros_bancos TEXT NOT NULL DEFAULT '',
  moneda_otros_bancos TEXT NOT NULL DEFAULT '',
  celular TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_funcionarios_cedula ON FUNCIONARIOS(cedula);
CREATE INDEX IF NOT EXISTS idx_funcionarios_apellido ON FUNCIONARIOS(apellido);
CREATE INDEX IF NOT EXISTS idx_funcionarios_activo ON FUNCIONARIOS(activo);

CREATE TABLE IF NOT EXISTS INGRESOS_VENTAS (
  id SERIAL PRIMARY KEY,
  nro_registro INTEGER UNIQUE,
  fecha TEXT NOT NULL,
  codigo_proveedor TEXT NOT NULL DEFAULT '',
  razon_social_proveedor TEXT NOT NULL DEFAULT '',
  concepto TEXT NOT NULL,
  nro_factura TEXT NOT NULL DEFAULT '',
  pesos DOUBLE PRECISION NOT NULL DEFAULT 0,
  dolares_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  tc_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON INGRESOS_VENTAS(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_nro_registro ON INGRESOS_VENTAS(nro_registro);

CREATE TABLE IF NOT EXISTS INGRESOS_VENTAS_SEQ (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ultimo INTEGER NOT NULL DEFAULT 0
);
INSERT INTO INGRESOS_VENTAS_SEQ (id, ultimo) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS VENTAS_AGRICULTURA (
  id SERIAL PRIMARY KEY,
  empresa TEXT NOT NULL CHECK (empresa IN ('GANADERA GUAVIYU', 'GANADERA CHIVILCOY')),
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  mes_inicio INTEGER CHECK (mes_inicio >= 1 AND mes_inicio <= 12),
  mes_fin INTEGER CHECK (mes_fin >= 1 AND mes_fin <= 12),
  anio_inicio INTEGER CHECK (anio_inicio >= 2025 AND anio_inicio <= 2040),
  anio_fin INTEGER CHECK (anio_fin >= 2025 AND anio_fin <= 2040),
  anio INTEGER NOT NULL CHECK (anio >= 2025 AND anio <= 2040),
  cultivo TEXT NOT NULL,
  hectareas DOUBLE PRECISION NOT NULL,
  rendimiento_ton_ha DOUBLE PRECISION NOT NULL,
  precio_usd_ton DOUBLE PRECISION NOT NULL,
  total_ton DOUBLE PRECISION NOT NULL,
  importe_usd DOUBLE PRECISION NOT NULL,
  venta_realizada INTEGER NOT NULL DEFAULT 0,
  venta_realizada_en TIMESTAMPTZ,
  real_mes_inicio INTEGER CHECK (real_mes_inicio >= 1 AND real_mes_inicio <= 12),
  real_mes_fin INTEGER CHECK (real_mes_fin >= 1 AND real_mes_fin <= 12),
  real_anio_inicio INTEGER CHECK (real_anio_inicio >= 2025 AND real_anio_inicio <= 2040),
  real_anio_fin INTEGER CHECK (real_anio_fin >= 2025 AND real_anio_fin <= 2040),
  real_hectareas DOUBLE PRECISION,
  real_rendimiento_ton_ha DOUBLE PRECISION,
  real_precio_usd_ton DOUBLE PRECISION,
  real_total_ton DOUBLE PRECISION,
  real_importe_usd DOUBLE PRECISION,
  real_notas TEXT,
  destacada INTEGER NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ventas_agri_periodo
  ON VENTAS_AGRICULTURA(anio DESC, mes DESC, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_agri_empresa
  ON VENTAS_AGRICULTURA(empresa, anio DESC, mes DESC);

CREATE TABLE IF NOT EXISTS VENTAS_ARRENDAMIENTO (
  id SERIAL PRIMARY KEY,
  empresa TEXT NOT NULL CHECK (empresa IN ('GANADERA GUAVIYU', 'GANADERA CHIVILCOY')),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  departamento TEXT NOT NULL CHECK (departamento IN ('RIVERA', 'RIO_NEGRO')),
  padron TEXT NOT NULL,
  hectareas DOUBLE PRECISION NOT NULL,
  precio_usd_ha DOUBLE PRECISION NOT NULL,
  total_usd DOUBLE PRECISION NOT NULL,
  notas TEXT,
  pago_frecuencia TEXT NOT NULL DEFAULT 'ANUAL' CHECK (pago_frecuencia IN ('MENSUAL', 'ANUAL')),
  pago_inicio DATE NOT NULL,
  pago_fin DATE NOT NULL,
  pago_inicio_monto DOUBLE PRECISION,
  pago_inicio_tipo TEXT CHECK (pago_inicio_tipo IN ('VALOR', 'PORCENTAJE')),
  pago_fin_monto DOUBLE PRECISION,
  pago_fin_tipo TEXT CHECK (pago_fin_tipo IN ('VALOR', 'PORCENTAJE')),
  venta_realizada INTEGER NOT NULL DEFAULT 0,
  venta_realizada_en TIMESTAMPTZ,
  destacada INTEGER NOT NULL DEFAULT 0,
  real_fecha_inicio DATE,
  real_fecha_fin DATE,
  real_hectareas DOUBLE PRECISION,
  real_precio_usd_ha DOUBLE PRECISION,
  real_total_usd DOUBLE PRECISION,
  real_notas TEXT,
  real_pago_frecuencia TEXT CHECK (real_pago_frecuencia IN ('MENSUAL', 'ANUAL')),
  real_pago_inicio DATE,
  real_pago_fin DATE,
  real_pago_inicio_monto DOUBLE PRECISION,
  real_pago_inicio_tipo TEXT CHECK (real_pago_inicio_tipo IN ('VALOR', 'PORCENTAJE')),
  real_pago_fin_monto DOUBLE PRECISION,
  real_pago_fin_tipo TEXT CHECK (real_pago_fin_tipo IN ('VALOR', 'PORCENTAJE')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ventas_arr_periodo
  ON VENTAS_ARRENDAMIENTO(fecha_inicio DESC, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_arr_empresa
  ON VENTAS_ARRENDAMIENTO(empresa, fecha_inicio DESC);

CREATE TABLE IF NOT EXISTS VENTA_SUB_RUBROS (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id),
  nombre TEXT NOT NULL,
  grupo TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venta_sub_rubros_cuenta_nombre ON VENTA_SUB_RUBROS (cuenta_id, LOWER(nombre));

CREATE TABLE IF NOT EXISTS VENTA_SUB_RUBRO_ITEMS (
  id SERIAL PRIMARY KEY,
  sub_rubro_id INTEGER NOT NULL REFERENCES VENTA_SUB_RUBROS(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (sub_rubro_id, nombre)
);

CREATE TABLE IF NOT EXISTS VENTA_GRUPO_ICONOS (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id),
  grupo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'imagen',
  archivo TEXT NOT NULL DEFAULT '',
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venta_grupo_iconos_cuenta_grupo ON VENTA_GRUPO_ICONOS (cuenta_id, LOWER(grupo));

CREATE TABLE IF NOT EXISTS STOCK_GANADERO_LOTE (
  id SERIAL PRIMARY KEY,
  nombre_archivo TEXT NOT NULL DEFAULT '',
  filas INTEGER NOT NULL DEFAULT 0,
  importado_en TIMESTAMPTZ DEFAULT NOW(),
  cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id)
);

CREATE TABLE IF NOT EXISTS STOCK_GANADERO_REGISTRO (
  id SERIAL PRIMARY KEY,
  lote_id INTEGER NOT NULL REFERENCES STOCK_GANADERO_LOTE(id) ON DELETE CASCADE,
  eid TEXT NOT NULL,
  vid TEXT NOT NULL DEFAULT '',
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL DEFAULT '',
  condicion TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_reg_lote ON STOCK_GANADERO_REGISTRO(lote_id);
CREATE INDEX IF NOT EXISTS idx_stock_reg_eid ON STOCK_GANADERO_REGISTRO(eid);
CREATE INDEX IF NOT EXISTS idx_stock_reg_fecha ON STOCK_GANADERO_REGISTRO(fecha);

CREATE TABLE IF NOT EXISTS STOCK_GANADERO_DISPOSITIVO (
  clave TEXT PRIMARY KEY,
  eid TEXT NOT NULL DEFAULT '',
  sexo TEXT NOT NULL DEFAULT '',
  edad INTEGER,
  nacimiento_mes INTEGER,
  nacimiento_anio INTEGER,
  observaciones TEXT NOT NULL DEFAULT '',
  empresa TEXT NOT NULL DEFAULT '',
  grupo TEXT NOT NULL DEFAULT '',
  grupo_libre TEXT NOT NULL DEFAULT '',
  potrero TEXT NOT NULL DEFAULT '',
  raza TEXT NOT NULL DEFAULT '',
  color_caravana TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT '',
  tipo_baja TEXT NOT NULL DEFAULT '',
  numero_guia TEXT NOT NULL DEFAULT '',
  baja_mes INTEGER,
  baja_anio INTEGER,
  cabana_premium BOOLEAN NOT NULL DEFAULT FALSE,
  nombre_cabana TEXT NOT NULL DEFAULT '',
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS STOCK_GANADERO_DISPOSITIVO_HISTORIAL (
  id SERIAL PRIMARY KEY,
  clave TEXT NOT NULL,
  campo TEXT NOT NULL,
  etiqueta TEXT NOT NULL DEFAULT '',
  valor_anterior TEXT NOT NULL DEFAULT '',
  valor_nuevo TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  user_id INTEGER,
  user_email TEXT NOT NULL DEFAULT '',
  user_nombre TEXT NOT NULL DEFAULT '',
  origen TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_stock_disp_hist_clave ON STOCK_GANADERO_DISPOSITIVO_HISTORIAL(clave);
CREATE INDEX IF NOT EXISTS idx_stock_disp_hist_fecha ON STOCK_GANADERO_DISPOSITIVO_HISTORIAL(creado_en);

CREATE TABLE IF NOT EXISTS STOCK_GANADERO_AUDITORIA_MOVIMIENTO (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL DEFAULT '',
  user_nombre TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL,
  clave TEXT NOT NULL DEFAULT '',
  cantidad INTEGER NOT NULL DEFAULT 1,
  resumen TEXT NOT NULL DEFAULT '',
  detalle TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_audit_mov_user ON STOCK_GANADERO_AUDITORIA_MOVIMIENTO(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_audit_mov_creado ON STOCK_GANADERO_AUDITORIA_MOVIMIENTO(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_stock_audit_mov_tipo ON STOCK_GANADERO_AUDITORIA_MOVIMIENTO(tipo);

CREATE TABLE IF NOT EXISTS STOCK_GANADERO_RAZA (
  nombre TEXT PRIMARY KEY,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS STOCK_GANADERO_POTRERO (
  cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cuenta_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_stock_ganadero_potrero_cuenta
  ON STOCK_GANADERO_POTRERO(cuenta_id);

CREATE TABLE IF NOT EXISTS CAMPO_POTRERO_MAPA (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  geojson TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2d5a3d',
  hectareas REAL,
  notas TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campo_potrero_mapa_cuenta
  ON CAMPO_POTRERO_MAPA(cuenta_id);

CREATE TABLE IF NOT EXISTS CAMPO_MAPA_ELEMENTO (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  notas TEXT NOT NULL DEFAULT '',
  geojson TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2563eb',
  metadata TEXT NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campo_mapa_elemento_cuenta
  ON CAMPO_MAPA_ELEMENTO(cuenta_id);

CREATE TABLE IF NOT EXISTS STOCK_GANADERO_GRUPO (
  cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cuenta_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_stock_ganadero_grupo_cuenta
  ON STOCK_GANADERO_GRUPO(cuenta_id);

CREATE TABLE IF NOT EXISTS STOCK_EQUINO_LOTE (
  id SERIAL PRIMARY KEY,
  nombre_archivo TEXT NOT NULL DEFAULT '',
  filas INTEGER NOT NULL DEFAULT 0,
  importado_en TIMESTAMPTZ DEFAULT NOW(),
  cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id)
);

CREATE TABLE IF NOT EXISTS STOCK_EQUINO_REGISTRO (
  id SERIAL PRIMARY KEY,
  lote_id INTEGER NOT NULL REFERENCES STOCK_EQUINO_LOTE(id) ON DELETE CASCADE,
  eid TEXT NOT NULL,
  vid TEXT NOT NULL DEFAULT '',
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL DEFAULT '',
  condicion TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_equino_reg_lote ON STOCK_EQUINO_REGISTRO(lote_id);
CREATE INDEX IF NOT EXISTS idx_stock_equino_reg_eid ON STOCK_EQUINO_REGISTRO(eid);
CREATE INDEX IF NOT EXISTS idx_stock_equino_reg_fecha ON STOCK_EQUINO_REGISTRO(fecha);

CREATE TABLE IF NOT EXISTS STOCK_EQUINO_DISPOSITIVO (
  clave TEXT PRIMARY KEY,
  eid TEXT NOT NULL DEFAULT '',
  sexo TEXT NOT NULL DEFAULT '',
  edad INTEGER,
  nacimiento_mes INTEGER,
  nacimiento_anio INTEGER,
  observaciones TEXT NOT NULL DEFAULT '',
  empresa TEXT NOT NULL DEFAULT '',
  grupo TEXT NOT NULL DEFAULT '',
  grupo_libre TEXT NOT NULL DEFAULT '',
  potrero TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT '',
  tipo_baja TEXT NOT NULL DEFAULT '',
  numero_guia TEXT NOT NULL DEFAULT '',
  baja_mes INTEGER,
  baja_anio INTEGER,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS STOCK_EQUINO_DISPOSITIVO_HISTORIAL (
  id SERIAL PRIMARY KEY,
  clave TEXT NOT NULL,
  campo TEXT NOT NULL,
  etiqueta TEXT NOT NULL DEFAULT '',
  valor_anterior TEXT NOT NULL DEFAULT '',
  valor_nuevo TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  user_id INTEGER,
  user_email TEXT NOT NULL DEFAULT '',
  user_nombre TEXT NOT NULL DEFAULT '',
  origen TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_stock_equino_disp_hist_clave ON STOCK_EQUINO_DISPOSITIVO_HISTORIAL(clave);
CREATE INDEX IF NOT EXISTS idx_stock_equino_disp_hist_fecha ON STOCK_EQUINO_DISPOSITIVO_HISTORIAL(creado_en);

CREATE TABLE IF NOT EXISTS USERS (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'editor', 'gestor_n2', 'consulta')),
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  ultimo_acceso TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  avatar_tipo TEXT NOT NULL DEFAULT 'iniciales',
  avatar_archivo TEXT NOT NULL DEFAULT '',
  avatar_datos BYTEA,
  avatar_mime TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON USERS (LOWER(email));

CREATE TABLE IF NOT EXISTS USER_SESSIONS (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  expira_en TIMESTAMPTZ NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON USER_SESSIONS(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expira ON USER_SESSIONS(expira_en);

CREATE TABLE IF NOT EXISTS AUTH_AUDIT_LOG (
  id SERIAL PRIMARY KEY,
  evento TEXT NOT NULL,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  detalle TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_audit_creado ON AUTH_AUDIT_LOG(creado_en);

CREATE TABLE IF NOT EXISTS CHAT_MESSAGES (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attachment_tipo TEXT,
  attachment_nombre TEXT,
  attachment_mime TEXT,
  attachment_tamano INTEGER,
  attachment_archivo TEXT
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_general ON CHAT_MESSAGES(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_dm ON CHAT_MESSAGES(sender_id, recipient_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS CHAT_READ_STATE (
  user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
  peer_id INTEGER NOT NULL DEFAULT 0,
  last_read_message_id INTEGER NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, peer_id)
);

CREATE TABLE IF NOT EXISTS CHAT_WALLPAPER (
  user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
  peer_id INTEGER NOT NULL DEFAULT 0,
  wallpaper_id TEXT NOT NULL DEFAULT 'default',
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, peer_id)
);

CREATE TABLE IF NOT EXISTS CHAT_CHANNELS (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  peer_id INTEGER NOT NULL UNIQUE,
  es_sistema INTEGER NOT NULL DEFAULT 0,
  creado_por INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS CHAT_CHANNEL_MEMBERS (
  channel_id INTEGER NOT NULL REFERENCES CHAT_CHANNELS(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS ROLE_ESCRITURA (
  rol TEXT PRIMARY KEY CHECK (rol IN ('admin', 'editor', 'consulta')),
  puede_escribir INTEGER NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ROLE_PERMISOS (
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'editor', 'gestor_n2', 'consulta')),
  modulo TEXT NOT NULL,
  acceso INTEGER NOT NULL DEFAULT 0,
  solo_lectura INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rol, modulo)
);

CREATE TABLE IF NOT EXISTS ROLE_HOME_LAYOUT (
  rol TEXT NOT NULL CHECK (rol IN ('editor', 'gestor_n2', 'consulta')),
  panel_id TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (rol, panel_id)
);

CREATE TABLE IF NOT EXISTS DOC_DIGITAL_TIPOS_GASTO (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  origen TEXT NOT NULL DEFAULT '',
  destino TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1,
  campos_habilitados TEXT NOT NULL DEFAULT '[]',
  campos_requeridos TEXT NOT NULL DEFAULT '[]',
  valores_defecto TEXT NOT NULL DEFAULT '{}',
  mapeo_campos TEXT NOT NULL DEFAULT '{}',
  comision_config TEXT NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_digital_tipos_gasto_activo ON DOC_DIGITAL_TIPOS_GASTO(activo);

CREATE TABLE IF NOT EXISTS USER_VENCIMIENTOS_PREFS (
  cuenta_id INTEGER PRIMARY KEY REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
  jurisdiccion_id TEXT NOT NULL,
  jurisdiccion_ids TEXT,
  modalidad_pago TEXT NOT NULL CHECK (modalidad_pago IN ('contado', 'cuotas')),
  modalidad_pago_patente TEXT CHECK (modalidad_pago_patente IN ('contado', 'cuotas')),
  planes_cuotas_por_jurisdiccion TEXT,
  seguir_patente_sucive INTEGER NOT NULL DEFAULT 1,
  seguir_bps_caja_rural INTEGER NOT NULL DEFAULT 1,
  seguir_primaria_rural INTEGER NOT NULL DEFAULT 1,
  regimen_primaria_rural TEXT NOT NULL DEFAULT 'con_explotacion' CHECK (regimen_primaria_rural IN ('con_explotacion', 'sin_explotacion')),
  onboarding_completado INTEGER NOT NULL DEFAULT 0,
  actualizado_por_user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS NOTAS (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
  cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL DEFAULT '',
  contenido TEXT NOT NULL DEFAULT '',
  fijada INTEGER NOT NULL DEFAULT 0,
  compartida INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'default'
    CHECK (color IN ('default', 'yellow', 'green', 'blue', 'pink', 'purple')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notas_usuario_actualizado
  ON NOTAS(usuario_id, fijada DESC, actualizado_en DESC);

CREATE TABLE IF NOT EXISTS NOTAS_COMPARTIDAS (
  nota_id INTEGER NOT NULL REFERENCES NOTAS(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (nota_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_notas_compartidas_usuario
  ON NOTAS_COMPARTIDAS(usuario_id, nota_id);

CREATE TABLE IF NOT EXISTS scg_schema_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 1
);
INSERT INTO scg_schema_version (id, version) VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

-- Automatización de gastos recurrentes (presupuesto)
CREATE TABLE IF NOT EXISTS GASTO_AUTOMATIZACION (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  presupuesto_origen_id INTEGER REFERENCES PRESUPUESTO(id) ON DELETE SET NULL,
  empresa TEXT NOT NULL,
  codigo_proveedor TEXT NOT NULL DEFAULT '',
  razon_social_proveedor TEXT NOT NULL DEFAULT '',
  concepto TEXT NOT NULL,
  observaciones TEXT NOT NULL DEFAULT '',
  rubro TEXT NOT NULL,
  sub_rubro TEXT NOT NULL DEFAULT '',
  responsable_gasto TEXT NOT NULL DEFAULT '',
  funcionario_cedula TEXT NOT NULL DEFAULT '',
  nro_factura TEXT NOT NULL DEFAULT '',
  nro_operacion_origen TEXT NOT NULL DEFAULT '',
  pesos DOUBLE PRECISION NOT NULL DEFAULT 0,
  dolares_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  reales DOUBLE PRECISION NOT NULL DEFAULT 0,
  tc_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  tc_reales DOUBLE PRECISION NOT NULL DEFAULT 0,
  saldo_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  dia_mes INTEGER NOT NULL CHECK (dia_mes >= 1 AND dia_mes <= 31),
  intervalo_meses INTEGER NOT NULL DEFAULT 1,
  fecha_inicio TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  responsable_user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
  responsable_email TEXT NOT NULL DEFAULT '',
  responsable_nombre TEXT NOT NULL DEFAULT '',
  creado_por_user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
  creado_por_email TEXT NOT NULL DEFAULT '',
  creado_por_nombre TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gasto_auto_cuenta ON GASTO_AUTOMATIZACION(cuenta_id);

CREATE TABLE IF NOT EXISTS GASTO_AUTOMATIZACION_PENDIENTE (
  id SERIAL PRIMARY KEY,
  automatizacion_id INTEGER NOT NULL REFERENCES GASTO_AUTOMATIZACION(id) ON DELETE CASCADE,
  cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  fecha_programada TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente_aprobacion',
  presupuesto_id INTEGER REFERENCES PRESUPUESTO(id) ON DELETE SET NULL,
  gestionado_por_email TEXT NOT NULL DEFAULT '',
  gestionado_por_nombre TEXT NOT NULL DEFAULT '',
  gestionado_en TIMESTAMPTZ,
  nota_gestion TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (automatizacion_id, periodo)
);
CREATE INDEX IF NOT EXISTS idx_gasto_auto_pendiente_cuenta_estado
  ON GASTO_AUTOMATIZACION_PENDIENTE(cuenta_id, estado);
