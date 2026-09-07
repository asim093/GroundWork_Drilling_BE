import mongoose from 'mongoose';
import { env } from './env.js';

const connectionStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export const connectDatabase = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10
  });
  return mongoose.connection;
};

export const getDatabaseState = () =>
  connectionStates[mongoose.connection.readyState] || 'unknown';

export const isDatabaseConnected = () => mongoose.connection.readyState === 1;
