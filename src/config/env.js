import dotenv from 'dotenv';

dotenv.config();

const requiredKeys = ['MONGODB_URI', 'JWT_SECRET'];
const missingKeys = requiredKeys.filter((key) => !process.env[key]);

if (missingKeys.length > 0) {
  throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@groundworkdrilling.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
  seedOperatorEmail: process.env.SEED_OPERATOR_EMAIL || 'operator@groundworkdrilling.com',
  seedOperatorPassword: process.env.SEED_OPERATOR_PASSWORD || 'Operator123!'
};
