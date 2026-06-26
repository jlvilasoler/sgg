/**
 * pdfjs-dist (usado por pdf-parse 2.x) requiere DOMMatrix, que no existe en Node
 * serverless (Vercel). Este shim debe cargarse antes de importar pdf-parse.
 */
import DOMMatrixShim from "@thednp/dommatrix";

type DomMatrixCtor = typeof globalThis.DOMMatrix;

if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = DOMMatrixShim as unknown as DomMatrixCtor;
}
