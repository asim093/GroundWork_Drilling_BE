import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Job from '../models/Job.js';
import TimeLogEntry from '../models/TimeLogEntry.js';
import Location from '../models/Location.js';
import RigNumber from '../models/RigNumber.js';
import Activity from '../models/Activity.js';
import Consumable from '../models/Consumable.js';
import BonusConfig from '../models/BonusConfig.js';

const DEMO_DOMAIN = 'groundworkdrilling.demo';
const DEMO_JOB_PREFIX = 'DEMO-';
const DEMO_PASSWORD = '12345678';

const round1 = (value) => Math.round(value * 10) / 10;
const between = (min, max) => min + Math.random() * (max - min);
const pad = (value) => String(value).padStart(2, '0');
const emailFor = (name) => `${name.toLowerCase().split(' ').join('.')}@${DEMO_DOMAIN}`;

const DEMO_SITE_MANAGERS = [
  { name: 'Morgan Reyes', employeeType: 'Supervisor' },
  { name: 'Taylor Quinn', employeeType: 'Supervisor' },
  { name: 'Jordan Blake', employeeType: 'Foreman' }
];

const DEMO_CLIENTS = [
  'Aurora Metals',
  'Northreef Exploration',
  'Blackstone Resources',
  'Copperline Mining',
  'Granite Peak Gold',
  'Silverwind Minerals',
  'Ironbark Resources',
  'Deepcore Exploration',
  'Summit Ridge Mining',
  'Palladium Bay Metals',
  'Redrock Exploration',
  'Cascade Gold'
];

const now = new Date();
const CURRENT = { year: now.getUTCFullYear(), month: now.getUTCMonth() };
const PREVIOUS =
  CURRENT.month === 0
    ? { year: CURRENT.year - 1, month: 11 }
    : { year: CURRENT.year, month: CURRENT.month - 1 };

const dayDate = ({ year, month }, day) => new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
const spreadDay = (index) => 1 + ((index * 11) % 28);

const BONUS_PLAN = {
  'Morgan Reyes': { eligibleMeters: 3200, eligibleCount: 12, missCount: 3, draftCount: 1, prevCount: 6 },
  'Taylor Quinn': { eligibleMeters: 6500, eligibleCount: 15, missCount: 2, draftCount: 1, prevCount: 6 },
  'Jordan Blake': { eligibleMeters: 900, eligibleCount: 6, missCount: 2, draftCount: 2, prevCount: 4 }
};
const DEFAULT_PLAN = {
  eligibleMeters: 700,
  eligibleCount: 5,
  missCount: 1,
  draftCount: 1,
  prevCount: 3
};

const clearDemoData = async () => {
  const demoUsers = await User.find({
    email: { $regex: `@${DEMO_DOMAIN}$`, $options: 'i' }
  }).select('_id');
  const demoUserIds = demoUsers.map((user) => user._id);
  const demoJobs = await Job.find({ jobNumber: { $regex: `^${DEMO_JOB_PREFIX}` } }).select('_id');
  const demoJobIds = demoJobs.map((job) => job._id);

  const entries = await TimeLogEntry.deleteMany({
    $or: [{ userId: { $in: demoUserIds } }, { jobId: { $in: demoJobIds } }]
  });
  const jobs = await Job.deleteMany({ jobNumber: { $regex: `^${DEMO_JOB_PREFIX}` } });
  const users = await User.deleteMany({ email: { $regex: `@${DEMO_DOMAIN}$`, $options: 'i' } });

  console.log(
    `Cleared previous demo data — site managers: ${users.deletedCount}, jobs: ${jobs.deletedCount}, time logs: ${entries.deletedCount}`
  );
};

const loadReferenceData = async () => {
  const [locations, rigs, bonusConfig, employees] = await Promise.all([
    Location.find({ active: true }),
    RigNumber.find({ active: true }),
    BonusConfig.getSingleton(),
    Employee.find({ active: true })
  ]);

  if (!locations.length || !rigs.length) {
    throw new Error('Baseline master data is missing. Run "npm run seed" before "npm run seed:demo".');
  }

  if (employees.length < 4) {
    throw new Error('Employee roster is missing. Run "npm run seed" before "npm run seed:demo".');
  }

  const activityNames = [
    'Coring (Drilling)',
    'Pulling & Pumping down the inner tube',
    'Hole conditioning',
    'Reaming and back reaming of casing and rods',
    'Pull and run rods to grease rods',
    'Set up rig at commencement of a drill hole',
    'Safety meetings'
  ];
  const activities = await Activity.find({ name: { $in: activityNames } });
  if (activities.length < 3) {
    throw new Error('Seeded activities are missing. Run "npm run seed" before "npm run seed:demo".');
  }

  const bit =
    (await Consumable.findOne({ group: 'Bits', active: true }))?.name || 'NQ HAYDEN 8AA';
  const grease =
    (await Consumable.findOne({ name: /grease/i, active: true }))?.name || 'DUCO ROD GREASE';

  return {
    locations,
    rigs,
    bonusConfig,
    employees,
    activityIds: activities.map((activity) => activity._id),
    consumables: { bit, grease }
  };
};

const createDemoSiteManagers = async () => {
  const docs = DEMO_SITE_MANAGERS.map((manager) => ({
    name: manager.name,
    email: emailFor(manager.name),
    password: DEMO_PASSWORD,
    role: 'operator',
    employeeType: manager.employeeType,
    employeeCategory: 'Local',
    active: true,
    passwordSet: true
  }));
  const created = await User.create(docs);
  console.log(`Created ${created.length} demo site managers`);
  return created;
};

const buildJobPlan = () => [
  { suffix: '001', when: CURRENT, offsetDay: 3, status: 'scheduled', bothShifts: true },
  { suffix: '002', when: CURRENT, offsetDay: 6, status: 'scheduled', bothShifts: false },
  { suffix: '003', when: PREVIOUS, offsetDay: 9, status: 'archived', bothShifts: false },
  { suffix: '004', when: CURRENT, offsetDay: 2, status: 'scheduled', bothShifts: true },
  { suffix: '005', when: CURRENT, offsetDay: 8, status: 'scheduled', bothShifts: false },
  { suffix: '006', when: CURRENT, offsetDay: 11, status: 'scheduled', bothShifts: false },
  { suffix: '007', when: CURRENT, offsetDay: 14, status: 'scheduled', bothShifts: true },
  { suffix: '008', when: PREVIOUS, offsetDay: 4, status: 'archived', bothShifts: false },
  { suffix: '009', when: PREVIOUS, offsetDay: 16, status: 'scheduled', bothShifts: false },
  { suffix: '010', when: CURRENT, offsetDay: 5, status: 'scheduled', bothShifts: true },
  { suffix: '011', when: PREVIOUS, offsetDay: 20, status: 'archived', bothShifts: false },
  { suffix: '012', when: PREVIOUS, offsetDay: 12, status: 'scheduled', bothShifts: false }
];

const createDemoJobs = async (siteManagers, employees, locations, rigs) => {
  const plan = buildJobPlan();
  const jobDocs = plan.map((entry, index) => {
    const dayManager = siteManagers[index % siteManagers.length];
    const nightManager = siteManagers[(index + 1) % siteManagers.length];

    const managers = [{ userId: dayManager._id, shift: 'Day' }];
    if (entry.bothShifts) {
      managers.push({ userId: nightManager._id, shift: 'Night' });
    }

    const rosterEmployeeIds = [0, 3, 6, 9].map(
      (step) => employees[(index + step) % employees.length]._id
    );

    return {
      jobNumber: `${DEMO_JOB_PREFIX}${entry.suffix}`,
      clientName: DEMO_CLIENTS[index % DEMO_CLIENTS.length],
      jobLocation: locations[index % locations.length].name,
      rigNumber: rigs[index % rigs.length]._id,
      scheduledDate: dayDate(entry.when, entry.offsetDay),
      status: entry.status,
      previousStatus: entry.status === 'archived' ? 'scheduled' : null,
      siteManagers: managers,
      rosterEmployeeIds,
      assignedUserIds: [...new Set(managers.map((manager) => String(manager.userId)))].map(
        (id) => new mongoose.Types.ObjectId(id)
      )
    };
  });

  const created = await Job.create(jobDocs);
  console.log(
    `Created ${created.length} demo jobs (${created.filter((job) => job.status === 'archived').length} archived)`
  );
  return created;
};

const buildActivityLines = (totalMeters, recoveryRatio, activityIds, seed) => {
  const lineCount = totalMeters > 130 ? 2 : 1;
  const windows = [
    { from: '07:00', to: '11:30' },
    { from: '12:00', to: '16:30' }
  ];
  const lines = [];
  let depth = round1(between(2, 40));

  for (let line = 0; line < lineCount; line += 1) {
    const done = lines.reduce((sum, existing) => sum + (existing.depthTo - existing.depthFrom), 0);
    const meters =
      line === lineCount - 1 ? round1(totalMeters - done) : round1(totalMeters / lineCount);
    const depthFrom = round1(depth);
    const depthTo = round1(depth + meters);

    lines.push({
      boreholeRef: '',
      description: '',
      activityId: activityIds[(seed + line) % activityIds.length],
      comments: line === 0 ? '' : 'Core run resumed after tool inspection',
      depth: null,
      depthFrom,
      depthTo,
      recoveryMeters: round1(meters * recoveryRatio),
      timeFrom: windows[line].from,
      timeTo: windows[line].to,
      chargeTime: null,
      ncTime: null
    });
    depth = depthTo;
  }

  return lines;
};

const buildEntry = ({ job, userId, shift, when, day, status, meters, recoveryRatio, seed, activityIds, consumables }) => {
  const lines = buildActivityLines(meters, recoveryRatio, activityIds, seed);
  const lineHours = lines.length * 4.5;
  const isDay = shift === 'Day';

  return {
    jobId: job._id,
    userId,
    date: dayDate(when, day),
    shift,
    timeIn: isDay ? '06:30' : '18:30',
    timeOut: isDay ? '18:30' : '06:30',
    assistantName: '',
    assistantTimeIn: '',
    assistantTimeOut: '',
    timeStarted: isDay ? '07:00' : '19:00',
    timeFinished: isDay ? '18:00' : '06:00',
    hoursOnSite: round1(lineHours + between(0.5, 1.6)),
    standbyHours: seed % 4 === 0 ? round1(between(0.5, 2)) : null,
    otherHours: seed % 6 === 0 ? round1(between(0.5, 1)) : null,
    mileageStart: null,
    mileageEnd: null,
    wellTag: {
      installed: seed % 5 === 0,
      decommissioned: false,
      locatesProvidedBy: seed % 5 === 0 ? 'Client survey crew' : ''
    },
    activityLines: lines,
    fuel: {
      dyedLt: seed % 3 === 0 ? round1(between(40, 90)) : null,
      dieselLt: round1(between(120, 260)),
      gasolineLt: seed % 4 === 0 ? round1(between(10, 30)) : null
    },
    consumables:
      seed % 2 === 0
        ? [{ itemName: consumables.bit, qtyTaken: 1, qtyReturned: 0, qtyUsed: 1 }]
        : [
            { itemName: consumables.bit, qtyTaken: 1, qtyReturned: 0, qtyUsed: 1 },
            { itemName: consumables.grease, qtyTaken: 2, qtyReturned: 1, qtyUsed: 1 }
          ],
    status
  };
};

const createDemoEntries = async (siteManagers, jobs, activityIds, consumables) => {
  const RESERVED = new Set(['DEMO-005', 'DEMO-007']);

  const isCurrentScheduled = (job) =>
    job.status !== 'archived' &&
    job.scheduledDate >= dayDate(CURRENT, 1) &&
    job.scheduledDate <= dayDate(CURRENT, 28);

  const shiftForManager = (job, managerId) =>
    job.siteManagers.find((manager) => manager.userId.equals(managerId))?.shift || 'Day';

  const jobsForManager = (managerId, { currentOnly }) =>
    jobs.filter(
      (job) =>
        job.siteManagers.some((manager) => manager.userId.equals(managerId)) &&
        !RESERVED.has(job.jobNumber) &&
        (currentOnly ? isCurrentScheduled(job) : job.status !== 'archived')
    );

  const docs = [];

  siteManagers.forEach((manager) => {
    const plan = BONUS_PLAN[manager.name] || DEFAULT_PLAN;
    const currentJobs = jobsForManager(manager._id, { currentOnly: true });
    const anyJobs = jobsForManager(manager._id, { currentOnly: false });

    if (!currentJobs.length || !anyJobs.length) {
      return;
    }

    let index = 0;

    for (let i = 0; i < plan.eligibleCount; i += 1) {
      const job = currentJobs[index % currentJobs.length];
      docs.push(
        buildEntry({
          job,
          userId: manager._id,
          shift: shiftForManager(job, manager._id),
          when: CURRENT,
          day: spreadDay(index),
          status: 'submitted',
          meters: round1(plan.eligibleMeters / plan.eligibleCount),
          recoveryRatio: between(0.88, 0.96),
          seed: index,
          activityIds,
          consumables
        })
      );
      index += 1;
    }

    for (let i = 0; i < plan.missCount; i += 1) {
      const job = currentJobs[index % currentJobs.length];
      docs.push(
        buildEntry({
          job,
          userId: manager._id,
          shift: shiftForManager(job, manager._id),
          when: CURRENT,
          day: spreadDay(index),
          status: 'submitted',
          meters: round1(between(45, 120)),
          recoveryRatio: between(0.72, 0.83),
          seed: index,
          activityIds,
          consumables
        })
      );
      index += 1;
    }

    for (let i = 0; i < plan.draftCount; i += 1) {
      const job = currentJobs[index % currentJobs.length];
      docs.push(
        buildEntry({
          job,
          userId: manager._id,
          shift: shiftForManager(job, manager._id),
          when: CURRENT,
          day: spreadDay(index),
          status: 'draft',
          meters: round1(between(60, 140)),
          recoveryRatio: between(0.8, 0.95),
          seed: index,
          activityIds,
          consumables
        })
      );
      index += 1;
    }

    let prevIndex = 0;
    for (let i = 0; i < plan.prevCount; i += 1) {
      const job = anyJobs[prevIndex % anyJobs.length];
      docs.push(
        buildEntry({
          job,
          userId: manager._id,
          shift: shiftForManager(job, manager._id),
          when: PREVIOUS,
          day: spreadDay(prevIndex),
          status: 'submitted',
          meters: round1(between(90, 220)),
          recoveryRatio: between(0.8, 0.95),
          seed: prevIndex + 1,
          activityIds,
          consumables
        })
      );
      prevIndex += 1;
    }
  });

  const draftJob = jobs.find((job) => job.jobNumber === 'DEMO-005');
  if (draftJob) {
    draftJob.siteManagers.forEach((manager, position) => {
      docs.push(
        buildEntry({
          job: draftJob,
          userId: manager.userId,
          shift: manager.shift,
          when: CURRENT,
          day: 4 + position * 5,
          status: 'draft',
          meters: round1(between(80, 160)),
          recoveryRatio: between(0.82, 0.94),
          seed: position,
          activityIds,
          consumables
        })
      );
    });
  }

  const created = await TimeLogEntry.insertMany(docs, { ordered: true });
  const submitted = created.filter((entry) => entry.status === 'submitted').length;
  console.log(
    `Created ${created.length} demo time logs (${submitted} submitted, ${created.length - submitted} draft)`
  );
  return created;
};

const printSummary = (siteManagers, employees) => {
  console.log('');
  console.log('Demo site managers (password for all: ' + DEMO_PASSWORD + '):');
  siteManagers.forEach((user) => {
    console.log(`  ${user.name.padEnd(16)} ${user.email.padEnd(40)} ${user.employeeType}`);
  });
  console.log('');
  console.log(`Employee roster: ${employees.length} non-login employees`);
  console.log(
    `Data window: previous month ${PREVIOUS.year}-${pad(PREVIOUS.month + 1)}, current month ${CURRENT.year}-${pad(CURRENT.month + 1)}`
  );
};

export const seedDemo = async () => {
  await connectDatabase();

  await clearDemoData();

  const reference = await loadReferenceData();
  const siteManagers = await createDemoSiteManagers();
  const jobs = await createDemoJobs(
    siteManagers,
    reference.employees,
    reference.locations,
    reference.rigs
  );
  await createDemoEntries(siteManagers, jobs, reference.activityIds, reference.consumables);

  printSummary(siteManagers, reference.employees);

  await mongoose.connection.close();
};

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  seedDemo()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`Demo seed failed: ${error.message}`);
      process.exit(1);
    });
}
