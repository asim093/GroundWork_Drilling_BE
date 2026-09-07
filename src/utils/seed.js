import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import User from '../models/User.js';
import Location from '../models/Location.js';
import RigNumber from '../models/RigNumber.js';
import Consumable from '../models/Consumable.js';
import BonusConfig from '../models/BonusConfig.js';
import TimeLogEntry from '../models/TimeLogEntry.js';
import {
  SEED_LOCATIONS,
  SEED_RIG_NUMBERS,
  SEED_CONSUMABLES,
  SEED_BONUS_CONFIG
} from '../config/masterData.js';

const upsertUser = async ({ name, email, password, role }) => {
  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`User already exists: ${email}`);
    return;
  }

  await User.create({ name, email, password, role, active: true, passwordSet: true });
  console.log(`Created ${role}: ${email} / ${password}`);
};

const seedNamedList = async (Model, names, label) => {
  let created = 0;

  for (const name of names) {
    const existing = await Model.findOne({
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });
    if (!existing) {
      await Model.create({ name });
      created += 1;
    }
  }

  console.log(`${label}: ${created} created, ${await Model.countDocuments()} total`);
};

const seedConsumables = async () => {
  const fromEntries = await TimeLogEntry.distinct('consumables.itemName');
  const merged = [
    ...new Set(
      [...SEED_CONSUMABLES, ...fromEntries]
        .map((name) => String(name || '').trim())
        .filter((name) => name && name.toLowerCase() !== 'other')
    )
  ];
  await seedNamedList(Consumable, merged, 'Consumables');
};

const seedBonusConfig = async () => {
  const existing = await BonusConfig.findOne();
  if (existing) {
    console.log('BonusConfig already exists — left as is');
    return;
  }
  await BonusConfig.create(SEED_BONUS_CONFIG);
  console.log('BonusConfig seeded (threshold 85, Supervisor/Driller/Helper tiers)');
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

    await seedNamedList(Location, SEED_LOCATIONS, 'Locations');
    await seedNamedList(RigNumber, SEED_RIG_NUMBERS, 'Rig numbers');
    await seedConsumables();
    await seedBonusConfig();

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`Seed failed: ${error.message}`);
    process.exit(1);
  }
};

seed();
