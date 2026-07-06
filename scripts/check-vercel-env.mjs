console.log(
  JSON.stringify({
    resend: Boolean(process.env.RESEND_API_KEY?.trim()),
    resend_len: (process.env.RESEND_API_KEY || "").length,
    email_from: Boolean(process.env.EMAIL_FROM?.trim()),
    email_from_len: (process.env.EMAIL_FROM || "").length,
    database: Boolean(process.env.DATABASE_URL?.trim()),
    database_len: (process.env.DATABASE_URL || "").length,
  })
);
