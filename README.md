# SCG — Sistema de Contabilidad Ganadera

Stack: **React + TypeScript + HTML/CSS** (frontend) y **Node.js + Express + TypeScript** (API).

Empresas: **GANADERA GUAVIYU** y **GANADERA CHIVILCOY**.  
Datos en SQLite, tabla **`PRESUPUESTO`**.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (incluye `npm`)

## Inicio rápido (localhost)

**Opción 1 — Doble clic:** `iniciar.bat`

**Opción 2 — Terminal:**

```powershell
cd "c:\Users\jlvil\OneDrive\Escritorio\SCG"
npm run install:all
npm run dev
```

Abrí en el navegador: **http://localhost:5173**

| Servicio | URL |
|----------|-----|
| Interfaz React (Vite) | http://localhost:5173 |
| API REST | http://localhost:3001/api |

Vite redirige las peticiones `/api` al servidor automáticamente.

## Estructura

```
SCG/
├── client/          React + TypeScript + Vite
│   └── src/
├── server/          Express + TypeScript + SQLite
│   └── src/
├── data/            Base scg_contabilidad.db (se crea sola)
├── package.json     npm run dev (ambos servicios)
└── iniciar.bat
```

## Tablas

**PRESUPUESTO** — gastos de funcionamiento.  
**PROVEEDORES** — catálogo con Cód., Razón social, RUT, Dirección, Ciudad (501 proveedores precargados; podés agregar más).

En **Registrar gasto** buscá el proveedor por código o nombre y se completan solos código y razón social.

Pestaña **Proveedores**: alta, edición, búsqueda y eliminación. El botón *Nuevo* sugiere el siguiente código libre.

## Campos PRESUPUESTO

Empresa, Fecha, Código proveedor, Razón social, Concepto, Rubro, Nro. factura, Pesos $, USD, Reales, TC USD, TC Reales, Saldo USD.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run install:all` | Instala dependencias raíz, server y client |
| `npm run dev` | API + React en modo desarrollo |
| `npm run build` | Compila client y server |

## Base de datos

Archivo: `data/scg_contabilidad.db` — copiá esa carpeta para respaldo.
