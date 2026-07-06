import type { TabId } from "../components/Header";
import type { HubIconId } from "../components/icons/HubMenuIcons";

export type AyudaBloque = {
  titulo: string;
  parrafos?: string[];
  pasos?: string[];
  consejos?: string[];
};

export type AyudaArticulo = {
  id: string;
  label: string;
  subtitle: string;
  icon: HubIconId;
  grupo: AyudaGrupoId;
  intro: string;
  /** Flujo operativo recomendado de punta a punta. */
  procesoOperativo?: string[];
  bloques: AyudaBloque[];
  /** Módulo de la app relacionado (para botón «Ir al módulo»). */
  pantallaRelacionada?: TabId;
  destacado?: boolean;
};

export type AyudaGrupoId =
  | "general"
  | "finanzas"
  | "campo"
  | "equipo"
  | "cuenta";

export const AYUDA_GRUPOS: { id: AyudaGrupoId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "finanzas", label: "Finanzas y gestión" },
  { id: "campo", label: "Campo y stock" },
  { id: "equipo", label: "Equipo y comunicación" },
  { id: "cuenta", label: "Cuenta y permisos" },
];

export const AYUDA_ARTICULOS: AyudaArticulo[] = [
  {
    id: "vision-general",
    label: "Visión general de SAG",
    subtitle: "Qué es el sistema y cómo está organizado",
    icon: "arquitectura_sistema",
    grupo: "general",
    destacado: true,
    intro:
      "SAG (Sistema de Administración Ganadera) centraliza la operación diaria de una explotación: gastos y presupuesto, tributos, divisas, ventas, personal, stock animal y trabajo en el campo. Todo se organiza por cuenta de empresa, con usuarios y permisos según el rol de cada integrante.",
    procesoOperativo: [
      "Configurar catálogos base (rubros, proveedores, responsables) antes de cargar gastos.",
      "Registrar la operación diaria: gastos, lecturas de stock, tareas y notas.",
      "Consultar listados, resúmenes y calendarios para controlar y tomar decisiones.",
      "Usar chat y notas para coordinar al equipo en tiempo real.",
    ],
    bloques: [
      {
        titulo: "Estructura de la app",
        parrafos: [
          "El menú principal agrupa los módulos por área: finanzas, campo, tareas y comunicación.",
          "Cada módulo tiene su propio panel interno con subsecciones (por ejemplo, Presupuesto incluye ingresar gasto, listado y control de gestión).",
          "El botón de inicio en la barra superior siempre vuelve al menú principal.",
          "La flecha «atrás» recorre el historial de pantallas visitadas en la sesión.",
        ],
      },
      {
        titulo: "Multi-empresa",
        parrafos: [
          "Una cuenta puede tener varias empresas operativas (establecimientos, sociedades internas, etc.).",
          "Al registrar gastos o stock, elegí la empresa operativa correspondiente para que los reportes queden bien segmentados.",
        ],
      },
    ],
  },
  {
    id: "inicio-navegacion",
    label: "Inicio y navegación",
    subtitle: "Menú principal, accesos rápidos y búsqueda",
    icon: "config_rubros",
    grupo: "general",
    destacado: true,
    intro:
      "La pantalla de inicio es el punto de partida después de iniciar sesión. Desde ahí accedés a todos los módulos habilitados para tu usuario.",
    bloques: [
      {
        titulo: "Menú de módulos",
        pasos: [
          "Iniciá sesión con tu email y contraseña.",
          "En el menú principal, elegí el módulo que necesitás (Presupuesto, Stock, Configuración, etc.).",
          "Usá el buscador del menú para filtrar módulos por nombre.",
          "Los módulos recientes aparecen destacados para volver rápido a lo que usás seguido.",
        ],
      },
      {
        titulo: "Barra superior",
        parrafos: [
          "Logo / Inicio: vuelve al menú principal.",
          "Atrás: regresa a la pantalla anterior dentro de la app.",
          "Tu nombre: abre Mi cuenta (perfil, contraseña, foto).",
        ],
      },
      {
        titulo: "Indicadores en inicio",
        parrafos: [
          "El panel de inicio puede mostrar actividad reciente del equipo, vencimientos próximos de impuestos y una vista previa del mapa del campo.",
          "Las notas personales y compartidas también tienen acceso rápido desde el inicio.",
        ],
        consejos: [
          "Si no ves un módulo, es probable que tu rol no tenga permiso: consultá con el administrador de la cuenta.",
        ],
      },
    ],
  },
  {
    id: "flujo-operativo",
    label: "Flujo operativo diario",
    subtitle: "Proceso recomendado para operar con la app",
    icon: "prov_ingresar",
    grupo: "general",
    destacado: true,
    intro:
      "Este es el recorrido típico de una jornada de trabajo usando SAG, desde la preparación de catálogos hasta el control al cierre del día.",
    procesoOperativo: [
      "1. Configuración (una vez o cuando cambia algo): rubros, proveedores, responsables de presupuesto, usuarios.",
      "2. Mañana: revisar vencimientos de impuestos y cotizaciones de divisas si hay pagos en moneda extranjera.",
      "3. Durante el día: registrar cada gasto con su comprobante; cargar lecturas EID de stock; anotar tareas operativas.",
      "4. Campo: actualizar mapa de potreros y registrar trabajo en el almanaque de tareas.",
      "5. Cierre: revisar listado de gastos del día, notas pendientes y mensajes del chat.",
      "6. Fin de mes: usar Control de Gestión (resumen) y reportes de RRHH / ventas según corresponda.",
    ],
    bloques: [
      {
        titulo: "Buenas prácticas",
        consejos: [
          "Registrá el gasto el mismo día del comprobante para no acumular pendientes.",
          "Adjuntá o fotografiá el documento cuando el módulo lo permita.",
          "Mantené actualizado el stock con cada lectura de caravanas para que el mapa y los reportes sean confiables.",
          "Usá el mismo criterio de rubros en todo el equipo: definilo en Configuración y compartilo.",
        ],
      },
    ],
  },
  {
    id: "presupuesto-gastos",
    label: "Presupuesto y gastos",
    subtitle: "Ingresar, listar y controlar gastos",
    icon: "prov_ingresar",
    grupo: "finanzas",
    pantallaRelacionada: "registro",
    intro:
      "El módulo de Presupuesto y gastos es el núcleo financiero: permite cargar cada egreso con rubro, proveedor, responsable, empresa operativa y documentación adjunta.",
    procesoOperativo: [
      "Entrá a Presupuesto y gastos desde el menú principal.",
      "Elegí «Ingresar gasto» para un comprobante nuevo.",
      "Completá fecha, importe, rubro, proveedor, responsable y empresa operativa.",
      "Guardá el registro. Repetí por cada comprobante del día.",
      "En «Presupuesto» (listado) filtrá por período, rubro o proveedor para revisar.",
      "En «Control de Gestión» compará lo ejecutado contra lo presupuestado por empresa y rubro.",
    ],
    bloques: [
      {
        titulo: "Ingresar un gasto",
        pasos: [
          "Presupuesto y gastos → Ingresar gasto.",
          "Seleccioná la empresa operativa.",
          "Indicá fecha, número de operación (o dejá que el sistema asigne el siguiente).",
          "Elegí rubro y, si aplica, sub-rubro.",
          "Seleccioná proveedor y responsable (persona a quien se asigna el gasto).",
          "Ingresá importe, moneda y observaciones.",
          "Adjuntá el comprobante si tenés imagen o PDF.",
          "Guardá.",
        ],
      },
      {
        titulo: "Listado y edición",
        pasos: [
          "Presupuesto y gastos → Presupuesto (listado).",
          "Usá filtros por fecha, rubro, proveedor o texto.",
          "Hacé clic en un registro para ver detalle o editarlo.",
          "Solo usuarios con permiso de escritura pueden modificar o eliminar.",
        ],
      },
      {
        titulo: "Control de Gestión",
        parrafos: [
          "Muestra totales por empresa operativa y por rubro en el período elegido.",
          "Sirve para reuniones de control y para detectar desvíos respecto al presupuesto asignado.",
        ],
      },
      {
        titulo: "Antes de empezar",
        consejos: [
          "Configurá rubros, proveedores y responsables en Configuración → catálogos.",
          "Sin esos catálogos, no podrás completar correctamente el formulario de gasto.",
        ],
      },
    ],
  },
  {
    id: "vencimientos-impuestos",
    label: "Vencimientos de impuestos",
    subtitle: "Calendarios tributarios y alertas",
    icon: "config_responsables",
    grupo: "finanzas",
    pantallaRelacionada: "vencimientos_impuestos",
    intro:
      "Centraliza fechas de vencimiento de tributos rurales y obligaciones frecuentes en ganadería: contribución rural, patente SUCIVE, BPS caja rural, primaria rural y otros calendarios configurables.",
    procesoOperativo: [
      "Abrí Vencimientos Impuestos desde el menú.",
      "Seleccioná el calendario y el departamento o período que te interesa.",
      "Marcá o anotá los vencimientos próximos de tu operación.",
      "Configurá preferencias de alerta para recibir aviso al iniciar sesión.",
    ],
    bloques: [
      {
        titulo: "Consulta de calendarios",
        parrafos: [
          "Cada pestaña corresponde a un tipo de impuesto o aporte.",
          "Las fechas se muestran en formato calendario o listado según la vista.",
          "El sistema puede resaltar vencimientos próximos en el inicio de la app.",
        ],
      },
      {
        titulo: "Preferencias",
        pasos: [
          "Dentro del módulo, accedé a preferencias de usuario.",
          "Elegí qué calendarios querés ver por defecto.",
          "Activá alertas de vencimientos próximos si está disponible para tu cuenta.",
        ],
        consejos: [
          "Revisá este módulo al inicio de cada mes para planificar pagos.",
        ],
      },
    ],
  },
  {
    id: "configuracion",
    label: "Configuración",
    subtitle: "Catálogos, usuarios y ajustes de la cuenta",
    icon: "config_proveedores",
    grupo: "cuenta",
    pantallaRelacionada: "configuracion",
    intro:
      "Configuración concentra los catálogos y herramientas administrativas de tu cuenta: rubros, proveedores, presupuesto asignado, administración de stock, usuarios y más.",
    procesoOperativo: [
      "Ingresá a Configuración desde el menú principal.",
      "Completá primero: Asignación de presupuesto (responsables), Proveedores y Rubros.",
      "Si administrás usuarios, creá cuentas con el rol adecuado.",
      "Usá Administración de Stock solo cuando necesites vaciar o mantener la base de dispositivos.",
    ],
    bloques: [
      {
        titulo: "Catálogos operativos",
        parrafos: [
          "Asignación de presupuesto: personas a quien se imputan gastos.",
          "Proveedores: quién emitió la factura o recibo.",
          "Rubros y sub-rubros: clasificación contable y de gestión de los egresos.",
        ],
      },
      {
        titulo: "Usuarios y permisos",
        pasos: [
          "Configuración → Usuarios (solo administrador de cuenta).",
          "Creá el usuario con email, nombre y rol.",
          "Los roles definen qué módulos puede ver y si puede modificar datos.",
          "El usuario recibe acceso con la contraseña que le asignes o que configure.",
        ],
        consejos: [
          "Rol Lector: solo consulta. Gestor: opera módulos asignados. Admin: control total de la cuenta.",
        ],
      },
      {
        titulo: "Configuración SAG (plataforma)",
        parrafos: [
          "Opciones como catálogo sanitario, documentos digitales globales o arquitectura del sistema están reservadas a administradores de la plataforma.",
          "La mayoría de los operadores solo usan «Configuración cuenta».",
        ],
      },
    ],
  },
  {
    id: "divisas",
    label: "Divisas",
    subtitle: "Cotizaciones USD y BRL",
    icon: "divisas_usd",
    grupo: "finanzas",
    pantallaRelacionada: "divisas",
    intro:
      "Registrá y consultá tipos de cambio del dólar estadounidense y del real brasileño respecto al peso uruguayo, con historial y gráficos.",
    procesoOperativo: [
      "Abrí Divisas.",
      "Revisá la cotización del día o importá valores desde fuente externa si está habilitado.",
      "Para un día sin dato, cargá manualmente el tipo de cambio.",
      "Usá el historial para análisis de tendencia.",
    ],
    bloques: [
      {
        titulo: "Carga de cotización",
        pasos: [
          "Elegí el par de moneda (USD/UYU o USD/BRL según la vista).",
          "Indicá fecha y valor.",
          "Guardá el registro.",
        ],
      },
      {
        titulo: "Importación",
        parrafos: [
          "Si tu cuenta tiene habilitada la actualización automática, el sistema puede traer cotizaciones de fuentes públicas.",
          "Siempre podés corregir o completar con carga manual.",
        ],
      },
    ],
  },
  {
    id: "precios-ganado",
    label: "Precios de ganado",
    subtitle: "Referencias de gordo y reposición",
    icon: "ventas_ganado",
    grupo: "finanzas",
    pantallaRelacionada: "precios_ganado",
    intro:
      "Seguimiento de precios de mercado del ganado (gordo y reposición) en USD por kilogramo, con histórico semanal para apoyar decisiones de venta o compra.",
    bloques: [
      {
        titulo: "Uso operativo",
        pasos: [
          "Consultá la cotización más reciente al planificar una venta.",
          "Compará semanas anteriores para ver tendencia.",
          "Combiná con el simulador de ventas para estimar ingresos.",
        ],
      },
    ],
  },
  {
    id: "ingresos-ventas",
    label: "Ingresos por ventas",
    subtitle: "Simulador, ventas cerradas y rubros de ingreso",
    icon: "ventas_ingresar",
    grupo: "finanzas",
    pantallaRelacionada: "ingresos_ventas",
    intro:
      "Gestiona ingresos por venta de ganado, agricultura y arrendamientos. Incluye simulador de venta de ganado para proyectar resultados antes de cerrar la operación.",
    procesoOperativo: [
      "Para simular: Ingresos por ventas → Simulador → cargá categorías, pesos y precios de referencia.",
      "Cuando la venta es real: registrá la operación cerrada con datos definitivos.",
      "Consultá listados de ventas por período y tipo.",
    ],
    bloques: [
      {
        titulo: "Simulador de venta de ganado",
        pasos: [
          "Definí empresa operativa y parámetros de la tropa.",
          "Ingresá dispositivos o categorías con peso y precio.",
          "Revisá totales y escenarios antes de la negociación.",
          "Podés guardar la simulación para retomarla después.",
        ],
      },
      {
        titulo: "Ventas cerradas",
        parrafos: [
          "Al concretar la venta, pasá de simulación a registro real con los valores finales.",
          "Los ingresos quedan disponibles para reportes y control de gestión.",
        ],
      },
    ],
  },
  {
    id: "recursos-humanos",
    label: "Recursos Humanos",
    subtitle: "Funcionarios, sueldos y jornales",
    icon: "rrhh_funcionarios",
    grupo: "finanzas",
    pantallaRelacionada: "recursos_humanos",
    intro:
      "Administra funcionarios del establecimiento, pagos de sueldos y jornales, con vínculo opcional a gastos registrados en presupuesto.",
    procesoOperativo: [
      "Alta de funcionarios con datos básicos.",
      "Registro de pagos por período.",
      "Consulta de resúmenes y dashboard de RRHH.",
    ],
    bloques: [
      {
        titulo: "Funcionarios",
        pasos: [
          "Recursos Humanos → Funcionarios → nuevo.",
          "Completá nombre y datos de contacto.",
          "Activá o desactivá según siga en la nómina.",
        ],
      },
      {
        titulo: "Pagos",
        parrafos: [
          "Registrá sueldos fijos o jornales variables.",
          "El módulo permite ver totales por funcionario y por mes.",
        ],
      },
    ],
  },
  {
    id: "stock-ganadero",
    label: "Stock ganadero",
    subtitle: "Caravanas EID, dispositivos y sanidad",
    icon: "stock_dispositivos",
    grupo: "campo",
    pantallaRelacionada: "stock_ganadero",
    intro:
      "Base de datos de animales identificados con caravana electrónica (EID). Importá lecturas desde archivo del bastón lector o cargá manualmente; gestioná movimientos, salidas y fichas sanitarias.",
    procesoOperativo: [
      "Importá el archivo TXT/CSV del bastón o cargá lecturas manuales tras un rodeo.",
      "Revisá que empresa operativa y categoría sean correctas.",
      "Actualizá datos del animal (sexo, raza, potrero) en la ficha del dispositivo.",
      "Registrá salidas cuando animales dejan el stock.",
    ],
    bloques: [
      {
        titulo: "Importar lecturas",
        pasos: [
          "Stock Ganadero → Importar.",
          "Elegí archivo del lector o modo manual.",
          "Asociá empresa operativa y lote si corresponde.",
          "Confirmá la importación y revisá duplicados o errores.",
        ],
      },
      {
        titulo: "Dispositivos",
        parrafos: [
          "Cada caravana es un «dispositivo» con historial de lecturas y ubicación.",
          "Podés filtrar por empresa, potrero, sexo y estado.",
          "Las fotos y notas ayudan a identificar animales en el campo.",
        ],
      },
      {
        titulo: "Sanidad",
        parrafos: [
          "Desde la ficha del animal podés registrar tratamientos con productos del catálogo sanitario.",
          "Mantener sanidad al día es clave para trazabilidad y cumplimiento.",
        ],
      },
    ],
  },
  {
    id: "stock-equino",
    label: "Stock equino",
    subtitle: "Caravanas y dispositivos de equinos",
    icon: "stock_cabana",
    grupo: "campo",
    pantallaRelacionada: "stock_equino",
    intro:
      "Misma lógica que stock ganadero, adaptada a equinos: importación EID, fichas por dispositivo y control de salidas.",
    procesoOperativo: [
      "Importá lecturas del bastón o carga manual.",
      "Editá fichas con datos del caballo.",
      "Registrá bajas o transferencias por salidas.",
    ],
    bloques: [
      {
        titulo: "Diferencias con ganadero",
        parrafos: [
          "Los campos de la ficha están orientados a equinos (nombre, pelaje, disciplina, etc.).",
          "La base es independiente del stock bovino.",
        ],
      },
    ],
  },
  {
    id: "campo-mapa",
    label: "Mapa del campo",
    subtitle: "Potreros, áreas y dispositivos en vista satelital",
    icon: "stock_cabana",
    grupo: "campo",
    pantallaRelacionada: "campo_mapa",
    intro:
      "Vista de mapa satelital para dibujar potreros y áreas, ver dispositivos de stock dentro de cada lote y trabajar colaborativamente con el equipo.",
    procesoOperativo: [
      "Abrí Mapa del campo.",
      "Dibujá o editá polígonos de potreros sobre la imagen.",
      "Asigná nombre y empresa operativa a cada potrero.",
      "Activá capas de dispositivos para ver dónde están las caravanas.",
      "Usá el resumen por potrero para contar animales por categoría.",
    ],
    bloques: [
      {
        titulo: "Dibujar potreros",
        pasos: [
          "Seleccioná la herramienta de dibujo (polígono).",
          "Marcá vértices sobre el mapa y cerrá la figura.",
          "Asigná nombre, color y grosor de borde si lo deseás.",
          "Guardá los cambios.",
        ],
      },
      {
        titulo: "Trabajo en equipo",
        parrafos: [
          "Varios usuarios con permiso de stock pueden editar el mismo mapa.",
          "Los cambios se sincronizan al guardar.",
        ],
        consejos: [
          "Definí primero los potreros grandes y luego subdivisiones si hace falta.",
        ],
      },
    ],
  },
  {
    id: "tareas-operativas",
    label: "Tareas operativas",
    subtitle: "Almanaque, rutinas y registro de trabajo",
    icon: "stock_cabana",
    grupo: "campo",
    pantallaRelacionada: "tareas_operativas",
    intro:
      "Planificá rutinas semanales (almanaque), asignalas a integrantes del equipo y registrá lo hecho cada día. Se integra con potreros del mapa cuando aplica.",
    procesoOperativo: [
      "Creá tareas con nombre, días de la semana y responsables.",
      "Cada día, abrí el almanaque y marcá tareas completadas.",
      "Agregá registro con observaciones o ubicación en potrero.",
      "Revisá historial para seguimiento de cumplimiento.",
    ],
    bloques: [
      {
        titulo: "Crear una tarea",
        pasos: [
          "Tareas operativas → Nueva tarea.",
          "Nombre, descripción y días en que aplica.",
          "Asigná usuarios responsables.",
          "Opcional: vinculá un potrero del mapa.",
        ],
      },
      {
        titulo: "Registro diario",
        parrafos: [
          "El calendario muestra el día actual y las tareas pendientes.",
          "Al completar, queda constancia con fecha y usuario.",
        ],
      },
    ],
  },
  {
    id: "notas",
    label: "Notas",
    subtitle: "Apuntes personales y compartidos",
    icon: "config_rubros",
    grupo: "equipo",
    pantallaRelacionada: "notas",
    intro:
      "Bloc de notas integrado: personales para cada usuario o compartidas con el equipo de la cuenta.",
    bloques: [
      {
        titulo: "Crear y organizar",
        pasos: [
          "Abrí Notas desde el menú o el acceso rápido del inicio.",
          "Creá una nota nueva con título y cuerpo.",
          "Elegí si es personal o compartida con la cuenta.",
          "Editá o archivá cuando ya no la necesites.",
        ],
        consejos: [
          "Usá notas compartidas para listas de pendientes del equipo (reparaciones, compras, etc.).",
        ],
      },
    ],
  },
  {
    id: "chat",
    label: "Chat interno",
    subtitle: "Mensajes con el equipo",
    icon: "usuarios_permisos_rol",
    grupo: "equipo",
    pantallaRelacionada: "chat",
    intro:
      "Comunicación interna entre usuarios de la cuenta: canal general, mensajes directos, canales de equipo y contactos externos autorizados.",
    bloques: [
      {
        titulo: "Conversaciones",
        pasos: [
          "Abrí Chat desde el menú o el ícono del pie de página.",
          "Elegí canal general, un compañero o un canal de equipo.",
          "Escribí el mensaje y enviá; podés adjuntar archivos si está habilitado.",
        ],
      },
      {
        titulo: "Contactos externos",
        parrafos: [
          "Con permiso, podés invitar por email a contactos fuera de la cuenta.",
          "Deben aceptar la solicitud antes de chatear.",
        ],
      },
    ],
  },
  {
    id: "usuarios-permisos",
    label: "Usuarios y permisos",
    subtitle: "Roles y acceso a módulos",
    icon: "usuarios_permisos_rol",
    grupo: "cuenta",
    intro:
      "Cada integrante tiene un rol que determina qué pantallas ve y si puede modificar datos. El administrador de la cuenta gestiona usuarios desde Configuración.",
    bloques: [
      {
        titulo: "Roles habituales",
        parrafos: [
          "Administrador de cuenta: acceso completo a configuración y todos los módulos habilitados.",
          "Gestor N1 / N2: operación diaria con distintos niveles de restricción (por ejemplo, solo lectura en divisas).",
          "Lector: consulta sin modificar.",
        ],
      },
      {
        titulo: "Módulos por permiso",
        parrafos: [
          "Además del rol, cada usuario tiene una lista de módulos permitidos (presupuesto, stock, ventas, etc.).",
          "Si no tenés acceso a una pantalla, el menú no la muestra o indica falta de permiso.",
        ],
        consejos: [
          "Pedí al administrador ajustes de rol si necesitás cargar datos en un módulo nuevo.",
        ],
      },
    ],
  },
  {
    id: "mi-cuenta",
    label: "Mi cuenta y perfil",
    subtitle: "Foto, datos y contraseña",
    icon: "config_admin_cuenta",
    grupo: "cuenta",
    intro:
      "Desde tu nombre en la barra superior accedés a Mi cuenta: actualizar foto, datos personales y cambiar contraseña.",
    bloques: [
      {
        titulo: "Actualizar perfil",
        pasos: [
          "Clic en tu nombre → Mi cuenta.",
          "Subí una foto de perfil (formatos JPG, PNG, WebP).",
          "Modificá nombre u otros datos permitidos.",
          "Guardá los cambios.",
        ],
      },
      {
        titulo: "Contraseña",
        pasos: [
          "En Mi cuenta, sección Contraseña.",
          "Ingresá la actual y la nueva (mínimo según política del sistema).",
          "Al cambiar contraseña se cierra la sesión en otros dispositivos.",
        ],
      },
    ],
  },
  {
    id: "suscripcion",
    label: "Suscripción",
    subtitle: "Plan mensual de la cuenta",
    icon: "config_admin_cuenta",
    grupo: "cuenta",
    pantallaRelacionada: "configuracion",
    intro:
      "El administrador de la cuenta puede contratar un plan mensual mediante Mercado Pago. En modo prueba no se realizan cobros reales.",
    bloques: [
      {
        titulo: "Gestionar plan",
        pasos: [
          "Configuración → Suscripción.",
          "Revisá el estado (prueba, activa, pendiente).",
          "Elegí plan y seguí el checkout de Mercado Pago.",
          "Al volver, el estado se sincroniza automáticamente.",
        ],
        consejos: [
          "Usá credenciales y tarjetas de prueba cuando el entorno está en modo test.",
        ],
      },
    ],
  },
];

export function findAyudaArticulo(id: string): AyudaArticulo | undefined {
  return AYUDA_ARTICULOS.find((a) => a.id === id);
}

export function ayudaArticulosPorGrupo(grupo: AyudaGrupoId): AyudaArticulo[] {
  return AYUDA_ARTICULOS.filter((a) => a.grupo === grupo);
}

export function buscarAyudaArticulos(consulta: string): AyudaArticulo[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return AYUDA_ARTICULOS;
  return AYUDA_ARTICULOS.filter((a) => {
    const blob = [
      a.label,
      a.subtitle,
      a.intro,
      ...(a.procesoOperativo ?? []),
      ...a.bloques.flatMap((b) => [
        b.titulo,
        ...(b.parrafos ?? []),
        ...(b.pasos ?? []),
        ...(b.consejos ?? []),
      ]),
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}
