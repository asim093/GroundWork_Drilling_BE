import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import User from '../models/User.js';
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
const PERSONAL_TEST_EMAIL = 'asimusman8899@gmail.com';

const round1 = (value) => Math.round(value * 10) / 10;
const between = (min, max) => min + Math.random() * (max - min);
const pad = (value) => String(value).padStart(2, '0');
const emailFor = (name) => `${name.toLowerCase().split(' ').join('.')}@${DEMO_DOMAIN}`;

const DEMO_OPERATORS = [
  { name: 'Sam Alpha', employeeType: 'Driller' },
  { name: 'Jordan Bravo', employeeType: 'Driller' },
  { name: 'Casey Charlie', employeeType: 'Helper' },
  { name: 'Riley Delta', employeeType: 'Helper' },
  { name: 'Morgan Echo', employeeType: 'Supervisor' },
  { name: 'Taylor Foxtrot', employeeType: 'Supervisor' },
  { name: 'Jamie Golf', employeeType: 'Foreman' },
  { name: 'Avery Hotel', employeeType: 'Project Manager' },
  { name: 'Quinn India', employeeType: 'Driller Trainee' },
  { name: 'Drew Juliet', employeeType: '5th Man' }
];

const DEMO_ASSISTANTS = ['Kai Kilo', 'Nova Lima', 'Reed Mike'];

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
  'Sam Alpha': { eligibleMeters: 560, eligibleCount: 8, missCount: 2, draftCount: 1, prevCount: 6 },
  'Jordan Bravo': { eligibleMeters: 1250, eligibleCount: 12, missCount: 2, draftCount: 1, prevCount: 6 },
  'Casey Charlie': { eligibleMeters: 520, eligibleCount: 8, missCount: 1, draftCount: 1, prevCount: 5 },
  'Riley Delta': { eligibleMeters: 1160, eligibleCount: 11, missCount: 2, draftCount: 1, prevCount: 5 },
  'Morgan Echo': { eligibleMeters: 3900, eligibleCount: 15, missCount: 2, draftCount: 1, prevCount: 6 },
  'Taylor Foxtrot': { eligibleMeters: 6400, eligibleCount: 16, missCount: 2, draftCount: 1, prevCount: 6 }
};
const DEFAULT_PLAN = {
  eligibleMeters: 380,
  eligibleCount: 4,
  missCount: 1,
  draftCount: 1,
  prevCount: 3
};

const removePersonalTestAccount = async () => {
  const account = await User.findOne({ email: PERSONAL_TEST_EMAIL });
  if (!account) {
    console.log(`Personal test account ${PERSONAL_TEST_EMAIL} not present`);
    return;
  }

  const entries = await TimeLogEntry.deleteMany({ userId: account._id });
  const touchedJobIds = (await Job.find({ assignedUserIds: account._id }).select('_id')).map(
    (job) => job._id
  );
  await Job.updateMany(
    { assignedUserIds: account._id },
    { $pull: { assignedUserIds: account._id } }
  );

  const orphanedJobs = await Job.find({
    _id: { $in: touchedJobIds },
    assignedUserIds: { $size: 0 }
  }).select('_id');
  const orphanedJobIds = orphanedJobs.map((job) => job._id);
  await TimeLogEntry.deleteMany({ jobId: { $in: orphanedJobIds } });
  const removedJobs = await Job.deleteMany({ _id: { $in: orphanedJobIds } });

  await User.deleteOne({ _id: account._id });
  console.log(
    `Removed personal test account ${PERSONAL_TEST_EMAIL} — ${entries.deletedCount} time logs, ${removedJobs.deletedCount} now-empty job(s)`
  );
};

const removeStrandedTestJobs = async () => {
  const unassigned = await Job.find({
    assignedUserIds: { $size: 0 },
    jobNumber: { $not: { $regex: `^${DEMO_JOB_PREFIX}` } }
  }).select('_id jobNumber');

  const strandedIds = [];
  for (const job of unassigned) {
    const hasEntries = await TimeLogEntry.exists({ jobId: job._id });
    if (!hasEntries) {
      strandedIds.push(job._id);
    }
  }

  if (!strandedIds.length) {
    return;
  }

  const removed = await Job.deleteMany({ _id: { $in: strandedIds } });
  console.log(`Removed ${removed.deletedCount} stranded unassigned non-demo test job(s)`);
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
    `Cleared previous demo data — users: ${users.deletedCount}, jobs: ${jobs.deletedCount}, time logs: ${entries.deletedCount}`
  );
};

const createDemoUsers = async () => {
  const docs = DEMO_OPERATORS.map((operator) => ({
    name: operator.name,
    email: emailFor(operator.name),
    password: DEMO_PASSWORD,
    role: 'operator',
    employeeType: operator.employeeType,
    employeeCategory: 'Local',
    active: true,
    passwordSet: true
  }));
  const created = await User.create(docs);
  console.log(`Created ${created.length} demo operators`);
  return created;
};

const createDemoAssistants = async () => {
  const docs = DEMO_ASSISTANTS.map((name) => ({
    name,
    email: emailFor(name),
    password: DEMO_PASSWORD,
    role: 'operator',
    employeeType: 'Assistant',
    employeeCategory: 'Local',
    active: true,
    passwordSet: true
  }));
  const created = await User.create(docs);
  console.log(`Created ${created.length} demo assistants`);
  return created;
};

const buildJobPlan = () => [
  { suffix: '001', when: CURRENT, offsetDay: 3, status: 'scheduled' },
  { suffix: '002', when: CURRENT, offsetDay: 6, status: 'scheduled' },
  { suffix: '003', when: PREVIOUS, offsetDay: 9, status: 'archived' },
  { suffix: '004', when: CURRENT, offsetDay: 2, status: 'scheduled' },
  { suffix: '005', when: CURRENT, offsetDay: 8, status: 'scheduled' },
  { suffix: '006', when: CURRENT, offsetDay: 11, status: 'scheduled' },
  { suffix: '007', when: CURRENT, offsetDay: 14, status: 'scheduled' },
  { suffix: '008', when: PREVIOUS, offsetDay: 4, status: 'archived' },
  { suffix: '009', when: PREVIOUS, offsetDay: 16, status: 'scheduled' },
  { suffix: '010', when: CURRENT, offsetDay: 5, status: 'scheduled' },
  { suffix: '011', when: PREVIOUS, offsetDay: 20, status: 'archived' },
  { suffix: '012', when: PREVIOUS, offsetDay: 12, status: 'scheduled' }
];

const createDemoJobs = async (users, locations, rigs) => {
  const plan = buildJobPlan();
  const jobDocs = plan.map((entry, index) => {
    const assignedIndexes = [0, 1, 3, 5, 7].map((step) => (index + step) % plan.length);
    const assignedUserIds = users
      .filter((_, userIndex) => assignedIndexes.includes(userIndex))
      .map((user) => user._id);

    return {
      jobNumber: `${DEMO_JOB_PREFIX}${entry.suffix}`,
      clientName: DEMO_CLIENTS[index % DEMO_CLIENTS.length],
      jobLocation: locations[index % locations.length].name,
      rigNumber: rigs[index % rigs.length]._id,
      scheduledDate: dayDate(entry.when, entry.offsetDay),
      status: entry.status,
      previousStatus: entry.status === 'archived' ? 'scheduled' : null,
      assignedUserIds
    };
  });

  const created = await Job.create(jobDocs);
  console.log(`Created ${created.length} demo jobs (${created.filter((j) => j.status === 'archived').length} archived)`);
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

const buildEntry = ({ job, userId, when, day, status, meters, recoveryRatio, seed, activityIds, consumables }) => {
  const lines = buildActivityLines(meters, recoveryRatio, activityIds, seed);
  const lineHours = lines.length * 4.5;

  return {
    jobId: job._id,
    userId,
    date: dayDate(when, day),
    shift: seed % 2 === 0 ? 'Day' : 'Night',
    timeIn: seed % 2 === 0 ? '06:30' : '18:30',
    timeOut: seed % 2 === 0 ? '18:30' : '06:30',
    assistantName: '',
    assistantTimeIn: '',
    assistantTimeOut: '',
    timeStarted: '07:00',
    timeFinished: '18:00',
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

const createDemoEntries = async (users, jobs, activityIds, consumables) => {
  const jobByNumber = new Map(jobs.map((job) => [job.jobNumber, job]));
  const isCurrentScheduled = (job) =>
    job.status !== 'archived' &&
    job.scheduledDate >= dayDate(CURRENT, 1) &&
    job.scheduledDate <= dayDate(CURRENT, 28);

  const RESERVED = new Set(['DEMO-005', 'DEMO-007']);

  const routableJobsFor = (user) =>
    jobs.filter(
      (job) =>
        job.assignedUserIds.some((id) => id.equals(user._id)) &&
        isCurrentScheduled(job) &&
        !RESERVED.has(job.jobNumber)
    );

  const anyAssignedFor = (user) =>
    jobs.filter(
      (job) =>
        job.assignedUserIds.some((id) => id.equals(user._id)) &&
        job.status !== 'archived' &&
        !RESERVED.has(job.jobNumber)
    );

  const docs = [];

  users.forEach((user) => {
    const plan = BONUS_PLAN[user.name] || DEFAULT_PLAN;
    const currentJobs = routableJobsFor(user);
    const previousJobs = anyAssignedFor(user);
    let index = 0;

    for (let i = 0; i < plan.eligibleCount; i += 1) {
      docs.push(
        buildEntry({
          job: currentJobs[index % currentJobs.length],
          userId: user._id,
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
      docs.push(
        buildEntry({
          job: currentJobs[index % currentJobs.length],
          userId: user._id,
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
      docs.push(
        buildEntry({
          job: currentJobs[index % currentJobs.length],
          userId: user._id,
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
      docs.push(
        buildEntry({
          job: previousJobs[prevIndex % previousJobs.length],
          userId: user._id,
          when: PREVIOUS,
          day: spreadDay(prevIndex),
          status: i === plan.prevCount - 1 ? 'draft' : 'submitted',
          meters: round1(between(70, 220)),
          recoveryRatio: between(0.76, 0.95),
          seed: prevIndex + 1,
          activityIds,
          consumables
        })
      );
      prevIndex += 1;
    }
  });

  const draftJob = jobByNumber.get('DEMO-005');
  draftJob.assignedUserIds.slice(0, 3).forEach((operatorId, position) => {
    docs.push(
      buildEntry({
        job: draftJob,
        userId: operatorId,
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

  const created = await TimeLogEntry.insertMany(docs, { ordered: true });
  const submitted = created.filter((entry) => entry.status === 'submitted').length;
  console.log(
    `Created ${created.length} demo time logs (${submitted} submitted, ${created.length - submitted} draft)`
  );
  return created;
};

const loadReferenceData = async () => {
  const [locations, rigs, bonusConfig] = await Promise.all([
    Location.find({ active: true }),
    RigNumber.find({ active: true }),
    BonusConfig.getSingleton()
  ]);

  if (!locations.length || !rigs.length) {
    throw new Error('Baseline master data is missing. Run "npm run seed" before "npm run seed:demo".');
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
    activityIds: activities.map((activity) => activity._id),
    consumables: { bit, grease }
  };
};

const printSummary = (users) => {
  console.log('');
  console.log('Demo operators (password for all: ' + DEMO_PASSWORD + '):');
  users.forEach((user) => {
    console.log(`  ${user.name.padEnd(16)} ${user.email.padEnd(40)} ${user.employeeType}`);
  });
  console.log('');
  console.log(
    `Data window: previous month ${PREVIOUS.year}-${pad(PREVIOUS.month + 1)}, current month ${CURRENT.year}-${pad(CURRENT.month + 1)}`
  );
};

const seedDemo = async () => {
  try {
    await connectDatabase();

    await removePersonalTestAccount();
    await removeStrandedTestJobs();
    await clearDemoData();

    const reference = await loadReferenceData();
    const users = await createDemoUsers();
    const assistants = await createDemoAssistants();
    const jobs = await createDemoJobs(users, reference.locations, reference.rigs);
    await createDemoEntries(users, jobs, reference.activityIds, reference.consumables);

    printSummary([...users, ...assistants]);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`Demo seed failed: ${error.message}`);
    process.exit(1);
  }
};

seedDemo();
