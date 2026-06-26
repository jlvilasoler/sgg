import "./pdf-node-polyfills.js";
import { createWorker } from "tesseract.js";

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
    PDFParse?: new (opts: { data: Uint8Array }) => {
      getText: () => Promise<{ text?: string }>;
      destroy: () => Promise<void>;
    };
  };
  const PDFParse = mod.PDFParse;
  if (!PDFParse) throw new Error("No se pudo cargar el lector PDF");

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
