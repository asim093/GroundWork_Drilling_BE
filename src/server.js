import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';

const start = async () => {
  try {
    await connectDatabase();
    console.log('Connected to MongoDB');

    app.listen(env.port, () => {
      console.log(`Server listening on port ${env.port}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

start();
