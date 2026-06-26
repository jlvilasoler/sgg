import "./pdf-node-polyfills.js";
import { createRequire } from "module";
import { createWorker } from "tesseract.js";

let pdfWorkerConfigurado = false;

/**
 * En Vercel (serverless) pdfjs-dist intenta cargar pdf.worker.mjs con un import
 * dinámico que el bundler no rastrea, y falla con "Cannot find module ...pdf.worker.mjs".
 * Resolvemos la ruta real del worker empaquetado y se la pasamos a pdf-parse.
 */
function configurarPdfWorker(PDFParse: {
  setWorker?: (workerSrc: string) => string;
}): void {
  if (pdfWorkerConfigurado || typeof PDFParse.setWorker !== "function") return;
  try {
    const require = createRequire(import.meta.url);
    const workerPath = require.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    const { pathToFileURL } = require("url") as typeof import("url");
    PDFParse.setWorker(pathToFileURL(workerPath).href);
    pdfWorkerConfigurado = true;
  } catch {
    /* Si no se puede resolver, pdf-parse usará su resolución por defecto. */
  }
}

async function ocrImageBuffer(buffer: Buffer): Promise<string> {
  const worker = await createWorker("spa");
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

async function pdfTextBuffer(buffer: Buffer): Promise<string> {
  const mod = (await import("pdf-parse")) as {
    PDFParse?: (new (opts: { data: Uint8Array }) => {
      getText: () => Promise<{ text?: string }>;
      destroy: () => Promise<void>;
    }) & { setWorker?: (workerSrc: string) => string };
  };
  const PDFParse = mod.PDFParse;
  if (!PDFParse) throw new Error("No se pudo cargar el lector PDF");

  configurarPdfWorker(PDFParse);

  const data = new Uint8Array(buffer);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function extractTextFromBrouDocument(
  buffer: Buffer,
  mime: string,
  filename: string
): Promise<string> {
  const lower = (mime || "").toLowerCase();
  const name = filename.toLowerCase();

  if (lower === "application/pdf" || name.endsWith(".pdf")) {
    const text = await pdfTextBuffer(buffer);
    if (text.trim().length >= 40) return text;
    throw new Error("El PDF no contiene texto legible. Probá con una captura o foto del comprobante.");
  }

  if (
    lower.startsWith("image/") ||
    /\.(png|jpe?g|webp|bmp|gif)$/i.test(name)
  ) {
    return ocrImageBuffer(buffer);
  }

  throw new Error("Formato no soportado. Usá PDF o imagen (PNG, JPG, WebP).");
}
