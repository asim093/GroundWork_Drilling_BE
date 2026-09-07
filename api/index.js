import app from '../src/app.js';
import { connectDatabase } from '../src/config/db.js';

let connection;

export default async function handler(req, res) {
  if (!connection) {
    connection = connectDatabase();
  }

  try {
    await connection;
  } catch (error) {
    connection = undefined;
    res.status(503).json({ message: 'Database is unavailable' });
    return;
  }

  return app(req, res);
}
