import nodemailer from 'nodemailer';

// SMTP config from environment variables
const smtpHost = process.env.SMTP_HOST || 'smtp.ethereal.email';
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const mailFrom = process.env.MAIL_FROM || '"Store Management System" <no-reply@store.org>';

let transporter = null;

if (smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

export async function sendEmail({ to, subject, text, html }) {
  if (!to) return;
  console.log(`✉️ Sending email notification to: ${to} (Subject: ${subject})`);
  
  if (!transporter) {
    console.log(`💡 SMTP credentials not configured in .env. Logging mail content:`);
    console.log(`-----------------------------------------`);
    console.log(`FROM: ${mailFrom}`);
    console.log(`TO: ${to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`TEXT: ${text}`);
    console.log(`-----------------------------------------`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: mailFrom,
      to,
      subject,
      text,
      html,
    });
    console.log(`✅ Email sent: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send email notification to ${to}:`, error.message);
  }
}
