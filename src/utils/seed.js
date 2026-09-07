import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import User from '../models/User.js';

const upsertUser = async ({ name, email, password, role }) => {
  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`User already exists: ${email}`);
    return;
  }

  await User.create({ name, email, password, role, active: true });
  console.log(`Created ${role}: ${email} / ${password}`);
};

const seed = async () => {
  try {
    await connectDatabase();

    await upsertUser({
      name: 'Groundwork Admin',
      email: env.seedAdminEmail,
      password: env.seedAdminPassword,
      role: 'admin'
    });

    await upsertUser({
      name: 'Field Operator',
      email: env.seedOperatorEmail,
      password: env.seedOperatorPassword,
      role: 'operator'
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`Seed failed: ${error.message}`);
    process.exit(1);
  }
};

seed();
