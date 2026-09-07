import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

const getTransporter = () => {
  if (!env.smtp.configured) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined
    });
  }
  return transporter;
};

export const sendMail = async ({ to, subject, text, html }) => {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.log(`[mailer] SMTP not configured. Email to ${to} not sent. Subject: ${subject}`);
    return { delivered: false };
  }

  try {
    await activeTransporter.sendMail({ from: env.smtp.from, to, subject, text, html });
    return { delivered: true };
  } catch (error) {
    console.error(`[mailer] Failed to send email to ${to}: ${error.message}`);
    return { delivered: false };
  }
};
