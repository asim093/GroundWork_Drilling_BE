import dotenv from 'dotenv';

dotenv.config();

const requiredKeys = ['MONGODB_URI', 'JWT_SECRET'];
const missingKeys = requiredKeys.filter((key) => !process.env[key]);

if (missingKeys.length > 0) {
  throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
}

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);

const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins,
  clientOrigin: clientOrigins[0],
  appName: process.env.APP_NAME || 'Groundwork Drilling',
  inviteExpiryHours: Number(process.env.INVITE_EXPIRY_HOURS) || 168,
  smtp: {
    configured: smtpConfigured,
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@groundworkdrilling.com'
  },
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@groundworkdrilling.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
  seedOperatorEmail: process.env.SEED_OPERATOR_EMAIL || 'operator@groundworkdrilling.com',
  seedOperatorPassword: process.env.SEED_OPERATOR_PASSWORD || 'Operator123!'
};
