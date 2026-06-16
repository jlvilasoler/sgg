import type { IncomingMessage, ServerResponse } from "http";
import app from "../server/dist/index.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

export default function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return new Promise((resolve, reject) => {
    res.on("finish", () => resolve());
    res.on("error", reject);
    app(req, res);
  });
}
