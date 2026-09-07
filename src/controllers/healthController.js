import { getDatabaseState, isDatabaseConnected } from '../config/db.js';

export const getHealth = (req, res) => {
  const connected = isDatabaseConnected();

  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: getDatabaseState(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
};
