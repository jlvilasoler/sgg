import type { IncomingMessage, ServerResponse } from "http";
import "../server/dist/pdf-node-polyfills.js";
import app from "../server/dist/index.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

export default function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return new Promise((resolve, reject) => {
    res.on("finish", () => resolve());
    res.on("error", reject);
    try {
      app(req, res);
    } catch (err) {
      console.error("[SAG API] Error al invocar Express:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : "Error interno",
          })
        );
      }
      resolve();
    }
  });
}
