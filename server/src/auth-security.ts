import type { Request, Response, NextFunction } from "express";
import type { CorsOptions } from "cors";
import crypto from "crypto";

const IS_PROD = process.env.NODE_ENV === "production";

const DEV_CLIENT_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const API_WINDOW_MS = 60 * 1000;
const API_MAX_REQUESTS = 400;

interface RateBucket {
  count: number;
  resetAt: number;
}

const loginBuckets = new Map<string, RateBucket>();
const apiBuckets = new Map<string, RateBucket>();

function pruneBuckets(store: Map<string, RateBucket>, now: number): void {
  if (store.size < 500) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

function hitRateLimit(
  store: Map<string, RateBucket>,
  key: string,
  windowMs: number,
  max: number
): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  pruneBuckets(store, now);

  let bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { blocked: false, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string") return xf.split(",")[0]?.trim() || "unknown";
  return req.socket.remoteAddress || "unknown";
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isValidSessionTokenFormat(token: string | undefined): boolean {
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function requestHost(req: Request): string | null {
  const raw = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.split(",")[0].trim().toLowerCase();
}

function originMatchesHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

/** Vite puede usar 5174, 5175… si el puerto por defecto está ocupado. */
function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "http:" &&
      (host === "localhost" || host === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

/** SPA y API en el mismo dominio (p. ej. Vercel): el navegador puede omitir Origin. */
function isTrustedSameSiteRequest(req: Request): boolean {
  const host = requestHost(req);
  if (!host) return false;

  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    return originMatchesHost(origin, host);
  }

  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.length > 0) {
    try {
      return new URL(referer).host.toLowerCase() === host;
    } catch {
      return false;
    }
  }

  // En Vercel el frontend y /api comparten host; sin Origin ni Referer, confiar en el host.
  return process.env.VERCEL === "1";
}

/** Orígenes del frontend autorizados (CORS + anti-CSRF). */
export function getAllowedClientOrigins(): string[] {
  const origins = new Set<string>();
  const configured = process.env.SCG_CLIENT_ORIGIN?.trim();
  if (configured) {
    const localDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
    if (!IS_PROD || !localDevOrigin) origins.add(configured);
  }
  for (const key of [
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
  ] as const) {
    const value = process.env[key]?.trim();
    if (value) origins.add(value.startsWith("http") ? value : `https://${value}`);
  }
  const extra = process.env.SCG_CLIENT_ORIGINS?.trim();
  if (extra) {
    for (const part of extra.split(",")) {
      const o = part.trim();
      if (o) origins.add(o);
    }
  }
  if (!IS_PROD) {
    for (const origin of DEV_CLIENT_ORIGINS) origins.add(origin);
  }
  if (origins.size > 0) return [...origins];
  if (IS_PROD) {
    return ["http://127.0.0.1:5173"];
  }
  return [...DEV_CLIENT_ORIGINS];
}

export function isAllowedClientOrigin(origin: string, req?: Request): boolean {
  if (req) {
    const host = requestHost(req);
    if (host && originMatchesHost(origin, host)) return true;
  }
  if (!IS_PROD && isLocalDevOrigin(origin)) return true;
  const allowed = getAllowedClientOrigins();
  return allowed.some(
    (candidate) =>
      candidate.length === origin.length && constantTimeEqual(origin, candidate)
  );
}

export function getCorsOptions(): CorsOptions {
  return {
    origin(origin, callback) {
      if (!origin || isAllowedClientOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  };
}

export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (req.path.startsWith("/api")) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'"
    );
  }
  if (IS_PROD) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  res.removeHeader("X-Powered-By");
  next();
}

function requestOrigin(req: Request): string | null {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) return origin;

  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.length > 0) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/** Bloquea peticiones mutables con origen distinto al frontend autorizado. */
export function csrfOriginGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.path.startsWith("/api")) {
    next();
    return;
  }
  if (!WRITE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const origin = requestOrigin(req);
  if (!origin) {
    if (!IS_PROD || isTrustedSameSiteRequest(req)) {
      next();
      return;
    }
    res.status(403).json({ ok: false, error: "Origen no permitido" });
    return;
  }

  if (!isAllowedClientOrigin(origin, req)) {
    res.status(403).json({ ok: false, error: "Origen no permitido" });
    return;
  }

  next();
}

export function apiRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.path.startsWith("/api")) {
    next();
    return;
  }

  const ip = clientIp(req);
  const result = hitRateLimit(apiBuckets, `api:${ip}`, API_WINDOW_MS, API_MAX_REQUESTS);
  if (result.blocked) {
    res.setHeader("Retry-After", String(result.retryAfterSec));
    res.status(429).json({
      ok: false,
      error: "Demasiadas solicitudes. Esperá un momento e intentá de nuevo.",
    });
    return;
  }
  next();
}

export function loginRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = clientIp(req);
  const result = hitRateLimit(
    loginBuckets,
    `login:${ip}`,
    LOGIN_WINDOW_MS,
    LOGIN_MAX_ATTEMPTS
  );
  if (result.blocked) {
    res.setHeader("Retry-After", String(result.retryAfterSec));
    res.status(429).json({
      ok: false,
      error: "Demasiados intentos de acceso. Probá más tarde.",
    });
    return;
  }
  next();
}

const passwordChangeBuckets = new Map<string, RateBucket>();
const PASSWORD_CHANGE_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_CHANGE_MAX = 5;

export function hitPasswordChangeRateLimit(
  userId: number
): { blocked: boolean; retryAfterSec: number } {
  return hitRateLimit(
    passwordChangeBuckets,
    `pwd:${userId}`,
    PASSWORD_CHANGE_WINDOW_MS,
    PASSWORD_CHANGE_MAX
  );
}

/** Detalle de error solo en desarrollo; en producción respuesta genérica. */
export function clientSafeErrorDetail(
  err: unknown,
  fallback = "Error interno del servidor"
): string | undefined {
  if (IS_PROD || process.env.VERCEL === "1") return undefined;
  return err instanceof Error ? err.message : String(err);
}

export function clientSafeErrorMessage(
  err: unknown,
  fallback = "Error interno del servidor"
): string {
  if (IS_PROD || process.env.VERCEL === "1") return fallback;
  return err instanceof Error ? err.message : fallback;
}

export async function artificialLoginDelay(): Promise<void> {
  const ms = 350 + Math.floor(Math.random() * 250);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const PASSWORD_POLICY_HINT =
  "Mínimo 10 caracteres, con mayúscula, minúscula, número y símbolo especial.";

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) {
    return "La contraseña debe tener al menos 10 caracteres";
  }
  if (password.length > 128) {
    return "La contraseña no puede superar 128 caracteres";
  }
  if (!/[a-z]/.test(password)) {
    return "La contraseña debe incluir al menos una minúscula";
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una mayúscula";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un símbolo especial";
  }
  const lower = password.toLowerCase();
  const weak = ["password", "admin123", "12345678", "qwerty123", "admin2026"];
  if (weak.some((w) => lower.includes(w))) {
    return "Elegí una contraseña menos predecible";
  }
  return null;
}
