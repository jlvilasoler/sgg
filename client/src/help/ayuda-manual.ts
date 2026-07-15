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
      "SAG (Sistema de Administración Ganadera) centraliza la operación diaria de una explotación: gastos y presupuesto, tributos, divisas, ventas, personal, stock animal, mapa del predio, tareas de campo y comunicación del equipo. Todo se organiza por cuenta, con usuarios y permisos según el rol de cada integrante.",
    procesoOperativo: [
      "Configurar catálogos base (rubros, proveedores, responsables) y el layout del Inicio por tipo de cuenta.",
      "Arrancar el día desde Inicio: KPIs, vencimientos, tareas y pendientes de aprobación.",
      "Registrar la operación: gastos, ventas, lecturas de stock, mapa y tareas.",
      "Consultar al Asistente o a listados/resúmenes para decidir; coordinar por chat y notas.",
    ],
    bloques: [
      {
        titulo: "Estructura de la app",
        parrafos: [
          "El menú principal agrupa módulos por área: finanzas, operaciones (mapa), tareas, stock y comunicación.",
          "Cada módulo tiene su propio panel interno con subsecciones (por ejemplo, Presupuesto incluye ingresar gasto, listado, automatización, notas de crédito y control de gestión).",
          "El botón de inicio en la barra superior siempre vuelve al menú principal.",
          "La flecha «atrás» recorre el historial de pantallas visitadas en la sesión.",
        ],
      },
      {
        titulo: "Multi-empresa",
        parrafos: [
          "Una cuenta puede tener varias empresas operativas (establecimientos, sociedades internas, etc.).",
          "Al registrar gastos o stock, elegí la empresa operativa correspondiente para que los reportes queden bien segmentados.",
          "En Mi cuenta podés definir si al iniciar sesión usás modo consolidado o elegís empresa.",
        ],
      },
    ],
  },
  {
    id: "inicio-navegacion",
    label: "Inicio y navegación",
    subtitle: "Dashboard, pantalla completa, paneles y menú",
    icon: "config_rubros",
    grupo: "general",
    destacado: true,
    intro:
      "La pantalla de Inicio es el tablero operativo después de iniciar sesión: indicadores (ganado, tesorería, financiero), mapa del predio, vencimientos, stock por potrero, tareas del día, pizarrón de notas, actividad de la cuenta y accesos rápidos. Qué ves depende de tu rol y de cómo esté configurado el layout.",
    procesoOperativo: [
      "Revisá los KPIs de ganado, por cobrar y gastos/ventas del ejercicio.",
      "Si hay pagos automáticos pendientes de aprobación, resolvelos desde el panel de Inicio.",
      "Mirá vencimientos próximos, tareas del día y el mapa del predio.",
      "Usá pantalla completa para ver el tablero sin menú lateral y con más espacio.",
      "Entrá a cualquier módulo desde el menú izquierdo, la búsqueda o los accesos rápidos.",
    ],
    bloques: [
      {
        titulo: "Menú lateral y búsqueda",
        pasos: [
          "En el menú de la izquierda elegí el módulo (Presupuesto, Stock, Mapa, Tareas, etc.).",
          "Usá «Buscar en módulos…» para filtrar por nombre.",
          "Los módulos que usaste recientemente suelen aparecer primero en accesos rápidos.",
        ],
        consejos: [
          "Si no ves un módulo, tu rol no tiene permiso o el administrador no lo habilitó: consultá con quien administre la cuenta.",
        ],
      },
      {
        titulo: "Indicadores del Inicio",
        parrafos: [
          "Ganado: stock activo, machos/hembras y estado de ventas cuando hay datos del simulador.",
          "Tesorería: montos por cobrar (arrendamientos, ganado, agricultura) del ejercicio.",
          "Financiero: gastos del mes, gastos del año y ventas del ejercicio.",
        ],
      },
      {
        titulo: "Paneles del tablero",
        parrafos: [
          "Pizarrón: notas destacadas (recordatorios sticky).",
          "Tareas operativas: rutinas del día, con acceso a crear o abrir el almanaque.",
          "Tu predio: vista previa satelital del mapa (potreros y marcaciones).",
          "Calendario tributario: próximos vencimientos (contribución, SUCIVE, etc.).",
          "Stock ganadero · Animales por potrero: totales, distribución por sexo, ocupación y dotación (UG/ha) por potrero.",
          "Actividad de cuenta: últimos guardados del equipo.",
          "Accesos rápidos: módulos según tu perfil y uso reciente.",
          "Asistente (Admin / Gestor N1): mini chat en Inicio para consultas rápidas.",
          "Pendientes de automatización: aprobar u omitir gastos programados del mes.",
        ],
      },
      {
        titulo: "Pantalla completa",
        pasos: [
          "En Inicio, usá el botón de maximizar (arriba a la derecha) para abrir el tablero a pantalla completa.",
          "En ese modo se priorizan KPIs, stock por potrero, mapa, vencimientos y tareas; se ocultan pizarrón, actividad y accesos rápidos para ganar espacio.",
          "Salí con el mismo botón o con la tecla Esc.",
        ],
        consejos: [
          "Si ya cargaste stock por potrero una vez, al volver a pantalla completa se muestran primero los últimos datos mientras se actualizan.",
        ],
      },
      {
        titulo: "Personalizar tu Inicio",
        parrafos: [
          "En Mi cuenta → Inicio podés mostrar, ocultar y reordenar los bloques que te permite tu perfil.",
          "El administrador define el techo por tipo de cuenta (Admin, Gestor N1/N2, Consulta) en Configuración → layout de Inicio.",
        ],
      },
      {
        titulo: "Barra superior",
        parrafos: [
          "Logo / Inicio: vuelve al menú principal.",
          "Atrás: regresa a la pantalla anterior.",
          "Tu nombre o avatar: abre Mi cuenta (perfil, contraseña, empresas, layout de Inicio).",
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
      "1. Configuración (una vez o cuando cambia algo): rubros, proveedores, responsables, usuarios y layout de Inicio por rol.",
      "2. Mañana en Inicio: KPIs, vencimientos, tareas del día y pendientes de automatización.",
      "3. Durante el día: registrar gastos (o dejar que la automatización proponga), ventas, lecturas EID y notas.",
      "4. Campo: actualizar mapa (potreros/marcaciones) y marcar tareas en el almanaque.",
      "5. Consultas: Asistente para indicadores; Control de Gestión y listados para detalle.",
      "6. Cierre: chat, notas pendientes y revisión del listado de gastos del día.",
      "7. Fin de mes: resumen financiero, RRHH y revisión de dotación / stock por potrero.",
    ],
    bloques: [
      {
        titulo: "Buenas prácticas",
        consejos: [
          "Registrá el gasto el mismo día del comprobante; si es recurrente, usá Automatización y aprobá desde Inicio.",
          "Adjuntá o fotografiá el documento cuando el módulo lo permita.",
          "Mantené el stock y los potreros del mapa al día: alimentan el panel Animales por potrero y la ocupación UG/ha.",
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
      "El módulo de Presupuesto y gastos es el núcleo financiero: permite cargar cada egreso con rubro, proveedor, responsable, empresa operativa y documentación adjunta. Incluye automatización de gastos recurrentes y notas de crédito.",
    procesoOperativo: [
      "Entrá a Presupuesto y gastos desde el menú principal.",
      "Elegí «Ingresar gasto» para un comprobante nuevo.",
      "Completá fecha, importe, rubro, proveedor, responsable y empresa operativa.",
      "Guardá el registro. Repetí por cada comprobante del día.",
      "Para gastos fijos, configurá Automatización y aprobá los pendientes desde Inicio.",
      "En «Presupuesto» (listado) filtrá por período, rubro o proveedor para revisar.",
      "Usá notas de crédito si necesitás anular o ajustar un gasto.",
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
        titulo: "Automatización de gastos",
        pasos: [
          "Presupuesto y gastos → Automatización.",
          "Definí un gasto recurrente (rubro, proveedor, importe, día o regla del mes).",
          "Cada período el sistema genera un pendiente de aprobación.",
          "Quien tiene permiso puede aprobar u omitir el pago desde el panel de Inicio o desde Automatización.",
        ],
        consejos: [
          "Útil para alquileres, servicios fijos o cuotas periódicas que no querés olvidar.",
        ],
      },
      {
        titulo: "Notas de crédito",
        parrafos: [
          "Desde Presupuesto podés emitir notas de crédito totales o parciales para anular o ajustar un gasto ya cargado.",
          "Queda trazabilidad del comprobante original y del ajuste.",
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
      "Configuración concentra los catálogos y herramientas administrativas de tu cuenta: rubros, proveedores, presupuesto asignado, layout del Inicio por tipo de cuenta, administración de stock, usuarios y más.",
    procesoOperativo: [
      "Ingresá a Configuración desde el menú principal.",
      "Completá primero: Asignación de presupuesto (responsables), Proveedores y Rubros.",
      "Definí qué bloques del Inicio ve cada tipo de cuenta (Admin, Gestor N1/N2, Consulta).",
      "Si administrás usuarios, creá cuentas con el rol adecuado y módulos permitidos.",
      "Usá Administración de Stock o Dotación ganadera cuando necesites mantener bases o categorías UG.",
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
        titulo: "Inicio por tipo de cuenta",
        pasos: [
          "Configuración → sección de layout / Inicio (según tu menú de Config).",
          "Elegí el tipo de cuenta (Administrador, Gestor N1, Gestor N2, Consulta).",
          "Activá o desactivá bloques: indicadores, pizarrón, mapa, vencimientos, stock por potrero, actividad, accesos rápidos, etc.",
          "Reordená los paneles con la vista previa y guardá.",
          "El Asistente en Inicio suele habilitarse para Administrador y Gestor N1.",
        ],
        consejos: [
          "Lo que configures aquí es el techo: cada usuario puede personalizar menos bloques en Mi cuenta → Inicio, nunca más de los que permite su rol.",
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
          "Rol Consulta: solo lectura. Gestores: operan módulos asignados. Admin: control total de la cuenta.",
        ],
      },
      {
        titulo: "Dotación y stock",
        parrafos: [
          "La configuración de dotación / categorías UG alimenta el cálculo de ocupación y UG/ha del panel Animales por potrero en Inicio.",
          "Administración de Stock permite tareas de mantenimiento de la base de dispositivos cuando hace falta.",
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
      {
        titulo: "Animales por potrero (Inicio)",
        parrafos: [
          "En Inicio, el panel Stock ganadero resume animales activos por potrero del mapa: totales, machos/hembras, ocupación % y dotación UG/ha.",
          "Usa el área de cada potrero dibujado en el mapa y las categorías de dotación configuradas.",
          "Desde ahí podés abrir Stock o el Mapa del campo para corregir ubicaciones o geometría.",
        ],
        consejos: [
          "Si ves muchos animales «sin potrero», asigná ubicación en las fichas o revisá el mapa.",
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
    subtitle: "Potreros, marcaciones, medición y capas de stock",
    icon: "stock_cabana",
    grupo: "campo",
    pantallaRelacionada: "campo_mapa",
    intro:
      "Vista satelital del predio para dibujar potreros y áreas, colocar marcadores y notas, medir distancias o superficies, y ver capas de dispositivos ganaderos o equinos. También alimenta la vista «Tu predio» y el panel Animales por potrero en Inicio.",
    procesoOperativo: [
      "Abrí Mapa del campo (menú Operaciones o Principal).",
      "Dibujá o editá potreros; nombrá cada uno y asociá empresa si corresponde.",
      "Agregá marcadores, notas u objetos según necesites.",
      "Activá capas de dispositivos para ubicar caravanas.",
      "Usá pantalla completa y etiquetas on/off desde los controles del mapa.",
    ],
    bloques: [
      {
        titulo: "Dibujar potreros",
        pasos: [
          "Seleccioná la herramienta de polígono / potrero en el menú lateral.",
          "Marcá vértices sobre el mapa y cerrá la figura.",
          "Asigná nombre (y color/estilo si está disponible).",
          "Guardá los cambios.",
        ],
      },
      {
        titulo: "Otras herramientas",
        parrafos: [
          "Marcadores y notas: puntos de referencia o recordatorios en el terreno.",
          "Líneas y áreas: trazos auxiliares o zonas que no son potreros de stock.",
          "Medición: distancia y área para cálculos rápidos en el campo.",
          "Clip / contorno: herramientas avanzadas de edición de geometría cuando están habilitadas.",
        ],
      },
      {
        titulo: "Capas y pantalla completa",
        parrafos: [
          "Las capas de stock ganadero o equino muestran dispositivos sobre el mapa.",
          "El botón de pantalla completa agranda el mapa; las etiquetas se pueden mostrar u ocultar desde el control flotante.",
        ],
        consejos: [
          "Definí primero los potreros grandes y luego subdivisiones.",
          "Un mapa actualizado mejora el resumen de Inicio (ocupación y animales por potrero).",
        ],
      },
    ],
  },
  {
    id: "tareas-operativas",
    label: "Tareas operativas",
    subtitle: "Almanaque, asignación y cumplimiento diario",
    icon: "stock_cabana",
    grupo: "campo",
    pantallaRelacionada: "tareas_operativas",
    intro:
      "Planificá rutinas en el almanaque, asignalas a usuarios, vinculalas a potreros o ubicaciones y registrá el cumplimiento día a día. En Inicio ves un resumen de «tareas del día».",
    procesoOperativo: [
      "Abrí Tareas operativas desde el menú.",
      "Creá una rutina con nombre, días, responsables y ubicación opcional.",
      "En el calendario, abrí el día y marcá lo completado o agregá observaciones.",
      "Seguí el % de avance del día y el historial de cumplimiento.",
    ],
    bloques: [
      {
        titulo: "Crear una rutina",
        pasos: [
          "Tareas operativas → crear rutina (o desde el botón en Inicio).",
          "Nombre, descripción y días de la semana en que aplica.",
          "Asigná uno o más usuarios responsables.",
          "Opcional: vinculá potrero, estancia o ubicación del mapa.",
        ],
      },
      {
        titulo: "Almanaque y registro",
        parrafos: [
          "El calendario muestra el mes y el detalle del día al hacer clic.",
          "Al completar una tarea queda constancia con fecha y usuario.",
          "Podés saltar al mapa si la tarea está asociada a un potrero.",
        ],
      },
      {
        titulo: "Panel en Inicio",
        parrafos: [
          "El bloque Tareas operativas del Inicio resume el día actual (por ejemplo «Sin rutinas hoy» o el listado pendiente).",
          "En pantalla completa suele ubicarse junto al calendario tributario y el mapa.",
        ],
      },
    ],
  },
  {
    id: "asistente",
    label: "Asistente",
    subtitle: "Consultas en lenguaje natural sobre tu cuenta",
    icon: "arquitectura_sistema",
    grupo: "general",
    pantallaRelacionada: "asistente",
    destacado: true,
    intro:
      "El Asistente responde preguntas sobre indicadores de tu cuenta: finanzas, stock, ventas, RRHH, divisas y más. Está disponible como módulo completo y, para Administrador y Gestor N1, como panel rápido en Inicio.",
    procesoOperativo: [
      "Abrí Asistente desde el menú o el panel del Inicio.",
      "Escribí o dictá una pregunta (por ejemplo: «¿cuánto gastamos este mes?» o «stock de hembras»).",
      "Revisá la respuesta y, si hace falta, pedí más detalle o abrí el módulo relacionado.",
    ],
    bloques: [
      {
        titulo: "Qué podés preguntar",
        parrafos: [
          "Gastos y presupuesto del mes o del ejercicio.",
          "Stock ganadero o equino, categorías y totales.",
          "Ventas, por cobrar, divisas y datos de personal cuando tenés permiso.",
        ],
        consejos: [
          "Cuanto más concreta la pregunta (período, empresa, rubro), mejor la respuesta.",
        ],
      },
      {
        titulo: "Inicio y voz",
        parrafos: [
          "En Inicio el mini panel permite consultas rápidas sin salir del tablero.",
          "Si está habilitado, podés usar entrada o salida por voz según el navegador.",
        ],
      },
      {
        titulo: "Permisos",
        parrafos: [
          "Solo ves datos de módulos a los que tu rol tiene acceso.",
          "Si el Asistente no aparece, el administrador puede habilitarlo en el layout de Inicio / menú por tipo de cuenta.",
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
      "Bloc de notas integrado: personales para cada usuario o compartidas con el equipo. Las notas destacadas aparecen en el Pizarrón del Inicio.",
    bloques: [
      {
        titulo: "Crear y organizar",
        pasos: [
          "Abrí Notas desde el menú o el Pizarrón del Inicio.",
          "Creá una nota nueva con título y cuerpo.",
          "Elegí si es personal o compartida con la cuenta.",
          "Editá o archivá cuando ya no la necesites.",
        ],
        consejos: [
          "Usá notas compartidas para listas de pendientes del equipo (reparaciones, compras, etc.).",
          "En pantalla completa del Inicio el Pizarrón se oculta para priorizar KPIs y operación de campo.",
        ],
      },
    ],
  },
  {
    id: "chat",
    label: "Chat interno",
    subtitle: "Mensajes con el equipo y solicitudes",
    icon: "usuarios_permisos_rol",
    grupo: "equipo",
    pantallaRelacionada: "chat",
    intro:
      "Comunicación interna entre usuarios de la cuenta: canal general, mensajes directos, canales de equipo y contactos externos autorizados. También podés gestionar solicitudes de contacto desde el avatar / Mi cuenta.",
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
        titulo: "Contactos externos y solicitudes",
        parrafos: [
          "Con permiso, podés invitar por email a contactos fuera de la cuenta.",
          "Deben aceptar la solicitud antes de chatear.",
          "Las solicitudes pendientes pueden aparecer como aviso junto a tu perfil hasta que las aceptes o pospongas.",
        ],
      },
    ],
  },
  {
    id: "usuarios-permisos",
    label: "Usuarios y permisos",
    subtitle: "Roles, módulos y layout de Inicio",
    icon: "usuarios_permisos_rol",
    grupo: "cuenta",
    intro:
      "Cada integrante tiene un rol que determina qué pantallas ve, si puede modificar datos y qué bloques del Inicio le corresponden. El administrador de la cuenta gestiona usuarios desde Configuración.",
    bloques: [
      {
        titulo: "Roles habituales",
        parrafos: [
          "Administrador de cuenta: acceso completo a configuración y todos los módulos habilitados.",
          "Gestor N1 / N2: operación diaria con distintos niveles de restricción (por ejemplo, Asistente en Inicio para N1).",
          "Consulta: lectura sin modificar.",
        ],
      },
      {
        titulo: "Módulos y paneles de Inicio",
        parrafos: [
          "Además del rol, cada usuario tiene módulos permitidos (presupuesto, stock, ventas, etc.).",
          "El layout de Inicio por tipo de cuenta define el techo de bloques visibles; el usuario puede reducir o reordenar dentro de ese techo en Mi cuenta.",
        ],
        consejos: [
          "Pedí al administrador ajustes de rol o de layout si necesitás ver un panel o módulo nuevo.",
        ],
      },
    ],
  },
  {
    id: "mi-cuenta",
    label: "Mi cuenta y perfil",
    subtitle: "Perfil, contraseña, empresas e Inicio",
    icon: "config_admin_cuenta",
    grupo: "cuenta",
    intro:
      "Desde tu nombre o avatar en la barra superior abrís Mi cuenta: foto, datos personales, contraseña, empresas operativas y personalización de los bloques de tu Inicio.",
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
          "Ingresá la actual y la nueva: al menos 10 caracteres, con mayúscula, minúscula, número y símbolo.",
          "Confirmá la nueva contraseña.",
          "Al cambiarla se cierran otras sesiones abiertas por seguridad.",
        ],
        consejos: [
          "Si olvidaste la contraseña en el login, usá la opción de recuperación cuando esté habilitada en tu entorno.",
        ],
      },
      {
        titulo: "Empresas y modo de inicio",
        parrafos: [
          "Podés revisar o completar datos de empresas (RUT, ejercicio fiscal, etc.) según tu permiso.",
          "Elegí si al entrar trabajás en modo consolidado o seleccionás una empresa operativa.",
        ],
      },
      {
        titulo: "Bloques de tu Inicio",
        pasos: [
          "Mi cuenta → Inicio (o «Bloques de tu inicio»).",
          "Activá o desactivá paneles dentro de lo que permite tu rol.",
          "Reordená y guardá «mi inicio».",
        ],
        consejos: [
          "No podés activar un bloque que el administrador deshabilitó para tu tipo de cuenta.",
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
  {
    id: "vencimientos-pagos-personalizados",
    label: "Personalizado",
    subtitle: "Préstamos y vencimientos propios",
    icon: "presupuesto_automatizacion",
    grupo: "cuenta",
    pantallaRelacionada: "vencimientos_impuestos",
    intro:
      "En Vencimientos → Personalizado podés cargar préstamos u otros pagos de la cuenta con entidad, tipo, tasa, cuotas y fechas. Aparecen en el semáforo y en la vista Total junto a los impuestos.",
    bloques: [
      {
        titulo: "Crear un pago",
        pasos: [
          "Vencimientos → Personalizado.",
          "Nuevo pago: entidad (ej. Banco República), tipo, tasa opcional y moneda.",
          "Indicá cantidad de cuotas y fecha de la primera, luego Generar cuotas mensuales.",
          "Ajustá fechas o montos si hace falta y guardá.",
        ],
        consejos: [
          "Marcá cada cuota como pagada cuando se abone; deja de aparecer en próximos vencimientos.",
          "Desde Total podés abrir el pago haciendo clic en la tarjeta correspondiente.",
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
