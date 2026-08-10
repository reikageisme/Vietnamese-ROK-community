import nodemailer from "nodemailer";

type Message = { to: string; subject: string; text: string; html: string };

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function mailer() {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "mailpit",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return transporter;
}

export async function sendEmail(message: Message) {
  await mailer().sendMail({ from: process.env.EMAIL_FROM ?? "RokViet Hub <no-reply@rokviet.local>", ...message });
}

export function verificationEmail(to: string, url: string) {
  return sendEmail({
    to,
    subject: "Xác thực email RokViet Hub",
    text: `Xác thực email trong 24 giờ: ${url}`,
    html: `<p>Chào mừng bạn đến RokViet Hub.</p><p><a href="${url}">Xác thực email</a> (liên kết hết hạn sau 24 giờ).</p>`,
  });
}

export function passwordResetEmail(to: string, url: string) {
  return sendEmail({
    to,
    subject: "Đặt lại mật khẩu RokViet Hub",
    text: `Đặt lại mật khẩu trong 1 giờ: ${url}`,
    html: `<p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu.</p><p><a href="${url}">Đặt lại mật khẩu</a> (liên kết hết hạn sau 1 giờ).</p>`,
  });
}

export function securityNoticeEmail(to: string, action: string) {
  return sendEmail({
    to,
    subject: "Cảnh báo bảo mật RokViet Hub",
    text: `${action}. Nếu không phải bạn, hãy đặt lại mật khẩu và liên hệ quản trị viên ngay.`,
    html: `<p>${action}.</p><p>Nếu không phải bạn, hãy đặt lại mật khẩu và liên hệ quản trị viên ngay.</p>`,
  });
}
