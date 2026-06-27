import nodemailer from "nodemailer";
import { APP_FULL_NAME, APP_NAME } from "./brand.js";
import { getAllowedClientOrigins } from "./auth-security.js";

export function buildPasswordResetUrl(rawToken: string): string {
  const base = getAllowedClientOrigins()[0] ?? "http://127.0.0.1:5173";
  const url = new URL(base);
  url.searchParams.set("reset", rawToken);
  return url.toString();
}

export function isPasswordResetEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY?.trim()) return true;
  if (process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim()) return true;
  return false;
}

function buildResetEmailHtml(nombre: string, resetUrl: string): string {
  const safeName = nombre.trim() || "Usuario";
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a2e24;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #d8e0da;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:28px 28px 20px;background:linear-gradient(145deg,#1a3d2e,#2d5a3d);color:#f8f6f0;">
            <p style="margin:0 0 6px;font-size:13px;opacity:0.9;">${APP_NAME}</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;">Restablecer contraseña</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Hola <strong>${safeName}</strong>,</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.55;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta en
              <strong>${APP_FULL_NAME}</strong>. Si fuiste vos, hacé clic en el botón de abajo.
            </p>
            <p style="margin:0 0 24px;text-align:center;">
              <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#f0b90b;color:#181a20;text-decoration:none;font-weight:600;border-radius:6px;font-size:15px;">
                Crear nueva contraseña
              </a>
            </p>
            <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#5c6b63;">
              El enlace vence en <strong>1 hora</strong> y solo puede usarse una vez.
            </p>
            <p style="margin:0;font-size:12px;line-height:1.5;color:#7a8a82;word-break:break-all;">
              Si el botón no funciona, copiá este enlace en el navegador:<br>
              <a href="${resetUrl}" style="color:#2d5a3d;">${resetUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 24px;border-top:1px solid #e8eeea;background:#f8faf9;font-size:12px;line-height:1.5;color:#7a8a82;">
            Si no solicitaste este cambio, ignorá este mensaje. Tu contraseña actual seguirá siendo la misma.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendViaResend(opts: {
  to: string;
  nombre: string;
  resetUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from =
    process.env.EMAIL_FROM?.trim() || `${APP_NAME} <onboarding@resend.dev>`;
  const subject = `Restablecer contraseña — ${APP_NAME}`;
  const html = buildResetEmailHtml(opts.nombre, opts.resetUrl);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [opts.to], subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${detail.slice(0, 200)}`);
  }
}

async function sendViaSmtp(opts: {
  to: string;
  nombre: string;
  resetUrl: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "1" || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM!.trim();

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });

  await transport.sendMail({
    from,
    to: opts.to,
    subject: `Restablecer contraseña — ${APP_NAME}`,
    html: buildResetEmailHtml(opts.nombre, opts.resetUrl),
  });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  nombre: string;
  resetUrl: string;
}): Promise<void> {
  if (process.env.RESEND_API_KEY?.trim()) {
    await sendViaResend(opts);
    return;
  }
  if (process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim()) {
    await sendViaSmtp(opts);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[SGG Auth] Email no configurado. Enlace de recuperación para ${opts.to}:\n${opts.resetUrl}`
    );
    return;
  }
  throw new Error("Servicio de email no configurado");
}
