import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Location from '../models/Location.js';
import RigNumber from '../models/RigNumber.js';
import Consumable from '../models/Consumable.js';
import ActivityCategory from '../models/ActivityCategory.js';
import Activity from '../models/Activity.js';
import TimeLogEntry from '../models/TimeLogEntry.js';
import {
  SEED_LOCATIONS,
  SEED_RIG_NUMBERS,
  SEED_CONSUMABLES,
  SEED_ACTIVITY_CATEGORIES,
  SEED_ACTIVITIES,
  SEED_EMPLOYEES
} from '../config/masterData.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const exactNameQuery = (name) => ({
  name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
});

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
    const existing = await Model.findOne(exactNameQuery(name));
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
  await seedNamedList(Consumable, merged, 'Consumables (base)');

  const fileEntries = JSON.parse(
    readFileSync(new URL('../data/consumables-seed.json', import.meta.url), 'utf8')
  );

  let created = 0;
  let grouped = 0;

  for (const { name, group } of fileEntries) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      continue;
    }

    const existing = await Consumable.findOne(exactNameQuery(trimmed));

    if (existing) {
      if (!existing.group && group) {
        existing.group = group;
        await existing.save();
        grouped += 1;
      }
    } else {
      await Consumable.create({ name: trimmed, group: group || '' });
      created += 1;
    }
  }

  console.log(
    `Consumables (file merge): ${created} new, ${grouped} existing given a group, ${await Consumable.countDocuments()} total`
  );
};

const seedActivities = async () => {
  await seedNamedList(ActivityCategory, SEED_ACTIVITY_CATEGORIES, 'Activity categories');

  const categories = await ActivityCategory.find();
  const categoryIdByName = new Map(categories.map((cat) => [cat.name.toLowerCase(), cat._id]));

  let created = 0;

  for (const { activity, category } of SEED_ACTIVITIES) {
    const existing = await Activity.findOne(exactNameQuery(activity));
    if (!existing) {
      await Activity.create({
        name: activity,
        categoryId: categoryIdByName.get(category.toLowerCase()) || null
      });
      created += 1;
    }
  }

  console.log(`Activities: ${created} created, ${await Activity.countDocuments()} total`);
};

const seedEmployees = async () => {
  let created = 0;

  for (const { name, employeeType } of SEED_EMPLOYEES) {
    const existing = await Employee.findOne(exactNameQuery(name));
    if (!existing) {
      await Employee.create({ name, employeeType, employeeCategory: 'Local' });
      created += 1;
    }
  }

  console.log(`Employees: ${created} created, ${await Employee.countDocuments()} total`);
};

export const seedBase = async () => {
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
  await seedActivities();
  await seedEmployees();

  await mongoose.connection.close();
};

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  seedBase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`Seed failed: ${error.message}`);
      process.exit(1);
    });
}
