import nodemailer from "nodemailer";

const DEFAULT_FROM = "kevaltest27@gmail.com";
const DEFAULT_TO = "kevalrabadiya27@gmail.com";

type MailOptions = {
  subject: string;
  html: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required for SMTP mail sending.`);
  }
  return value.trim();
}

function parsePort(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("SMTP_PORT must be a positive integer.");
  }
  return n;
}

function parseSecure(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function buildTransporter() {
  const host = getRequiredEnv("SMTP_HOST");
  const port = parsePort(getRequiredEnv("SMTP_PORT"));
  const user = getRequiredEnv("SMTP_USER");
  const pass = getRequiredEnv("SMTP_PASS");
  const secure = parseSecure(process.env.SMTP_SECURE);
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendDailyReportEmail(options: MailOptions) {
  const transporter = buildTransporter();
  const from = process.env.MAIL_FROM?.trim() || DEFAULT_FROM;
  const to = process.env.MAIL_TO?.trim() || DEFAULT_TO;
  await transporter.sendMail({
    from,
    to,
    subject: options.subject,
    html: options.html,
  });
}
