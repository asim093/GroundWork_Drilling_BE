import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Job from '../models/Job.js';
import TimeLogEntry from '../models/TimeLogEntry.js';
import { seedBase } from './seed.js';
import { seedDemo } from './seedDemo.js';

const wipeDisposableCollections = async () => {
  await connectDatabase();

  const [logs, jobs, employees, users] = await Promise.all([
    TimeLogEntry.deleteMany({}),
    Job.deleteMany({}),
    Employee.deleteMany({}),
    User.deleteMany({})
  ]);

  console.log(
    `Wiped — time logs: ${logs.deletedCount}, jobs: ${jobs.deletedCount}, employees: ${employees.deletedCount}, users: ${users.deletedCount}`
  );

  await mongoose.connection.close();
};

export const resetDatabase = async () => {
  await wipeDisposableCollections();
  await seedBase();
  await seedDemo();
};

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`Reset failed: ${error.message}`);
      process.exit(1);
    });
}
