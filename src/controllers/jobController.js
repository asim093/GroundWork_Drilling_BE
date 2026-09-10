import Job from '../models/Job.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import TimeLogEntry from '../models/TimeLogEntry.js';
import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';
import { startOfUtcDay } from '../utils/timeLog.js';
import { SHIFTS } from '../config/masterData.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchFilter = (search) => {
  const term = String(search || '').trim();
  if (!term) {
    return null;
  }
  const rx = { $regex: escapeRegex(term), $options: 'i' };
  return { $or: [{ jobNumber: rx }, { clientName: rx }, { jobLocation: rx }] };
};

const SORTABLE_FIELDS = ['scheduledDate', 'jobNumber', 'clientName', 'createdAt'];
const EDITABLE_FIELDS = [
  'jobNumber',
  'clientName',
  'jobLocation',
  'clientJobNumber',
  'drillNumber',
  'rigNumber',
  'scheduledDate',
  'status'
];
const ASSIGNED_USER_PROJECTION = 'name email role active';
const RIG_NUMBER_POPULATE = { path: 'rigNumber', select: 'name active' };

const pickEditableFields = (body) => {
  const result = {};

  EDITABLE_FIELDS.forEach((field) => {
    if (body[field] !== undefined) {
      result[field] = body[field] === '' ? null : body[field];
    }
  });

  return result;
};

const resolveAssignments = async (userIds) => {
  const unique = [...new Set((userIds || []).map(String))];

  if (unique.length > 0) {
    const matchedCount = await User.countDocuments({ _id: { $in: unique } });

    if (matchedCount !== unique.length) {
      return null;
    }
  }

  return unique;
};

const resolveSiteManagers = async (siteManagers) => {
  if (!Array.isArray(siteManagers)) {
    return undefined;
  }

  const seen = new Set();
  const cleaned = [];

  for (const entry of siteManagers) {
    const userId = String(entry?.userId || '');
    const shift = entry?.shift;

    if (!userId || !SHIFTS.includes(shift)) {
      return null;
    }

    const key = `${userId}|${shift}`;
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push({ userId, shift });
    }
  }

  const uniqueUserIds = [...new Set(cleaned.map((entry) => entry.userId))];
  if (uniqueUserIds.length > 0) {
    const count = await User.countDocuments({ _id: { $in: uniqueUserIds }, role: 'operator' });
    if (count !== uniqueUserIds.length) {
      return null;
    }
  }

  return cleaned;
};

const resolveRoster = async (rosterEmployeeIds) => {
  if (!Array.isArray(rosterEmployeeIds)) {
    return undefined;
  }

  const unique = [...new Set(rosterEmployeeIds.map(String))];
  if (unique.length > 0) {
    const count = await Employee.countDocuments({ _id: { $in: unique } });
    if (count !== unique.length) {
      return null;
    }
  }

  return unique;
};

const applyJobRelations = async (job, body) => {
  const siteManagers = await resolveSiteManagers(body.siteManagers);
  if (siteManagers === null) {
    return 'One or more selected site managers are invalid';
  }
  if (siteManagers !== undefined) {
    job.siteManagers = siteManagers;
    job.assignedUserIds = [...new Set(siteManagers.map((entry) => entry.userId))];
  } else if (Array.isArray(body.assignedUserIds)) {
    const assignments = await resolveAssignments(body.assignedUserIds);
    if (assignments === null) {
      return 'One or more selected operators do not exist';
    }
    job.assignedUserIds = assignments;
  }

  const roster = await resolveRoster(body.rosterEmployeeIds);
  if (roster === null) {
    return 'One or more selected employees do not exist';
  }
  if (roster !== undefined) {
    job.rosterEmployeeIds = roster;
  }

  return null;
};

const JOB_POPULATE = [
  { path: 'assignedUserIds', select: ASSIGNED_USER_PROJECTION },
  { path: 'siteManagers.userId', select: 'name email role active' },
  { path: 'rosterEmployeeIds', select: 'name employeeType employeeCategory active' },
  RIG_NUMBER_POPULATE
];

export const listJobs = async (req, res) => {
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: 'createdAt',
    defaultOrder: 'desc'
  });

  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  } else {
    filter.status = { $ne: 'archived' };
  }

  if (req.query.assignedUser) {
    filter.assignedUserIds = req.query.assignedUser;
  }

  if (req.query.rigNumber) {
    filter.rigNumber = req.query.rigNumber;
  }

  const term = String(req.query.search || '').trim();
  if (term) {
    const rx = { $regex: escapeRegex(term), $options: 'i' };
    const matchedOperators = await User.find({ role: 'operator', name: rx }).select('_id').lean();
    filter.$or = [
      { jobNumber: rx },
      { clientName: rx },
      { jobLocation: rx },
      { clientJobNumber: rx },
      { drillNumber: rx },
      { assignedUserIds: { $in: matchedOperators.map((operator) => operator._id) } }
    ];
  }

  if (req.query.from || req.query.to) {
    filter.scheduledDate = {};
    if (req.query.from) {
      filter.scheduledDate.$gte = new Date(req.query.from);
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      to.setUTCHours(23, 59, 59, 999);
      filter.scheduledDate.$lte = to;
    }
  }

  const [data, total] = await Promise.all([
    Job.find(filter).sort(sort).skip(skip).limit(limit).populate(JOB_POPULATE),
    Job.countDocuments(filter)
  ]);

  res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
};

export const listAssignedJobs = async (req, res) => {
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: 'createdAt',
    defaultOrder: 'desc'
  });

  const filter = { assignedUserIds: req.user.id, status: { $ne: 'archived' } };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const searchFilter = buildSearchFilter(req.query.search);
  if (searchFilter) {
    Object.assign(filter, searchFilter);
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter).sort(sort).skip(skip).limit(limit).populate(RIG_NUMBER_POPULATE),
    Job.countDocuments(filter)
  ]);

  const today = startOfUtcDay(new Date());
  const todayEntries = await TimeLogEntry.find({
    userId: req.user.id,
    jobId: { $in: jobs.map((job) => job._id) },
    date: today
  })
    .select('jobId status')
    .lean();
  const todayByJob = new Map(todayEntries.map((entry) => [String(entry.jobId), entry]));

  const data = jobs.map((job) => {
    const entry = todayByJob.get(job.id);
    return {
      ...job.toJSON(),
      todayLog: entry ? { id: String(entry._id), status: entry.status } : null
    };
  });

  res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
};

export const getAssignedJob = async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.id,
    assignedUserIds: req.user.id,
    status: { $ne: 'archived' }
  })
    .populate(RIG_NUMBER_POPULATE)
    .populate({ path: 'siteManagers.userId', select: 'name' })
    .populate({ path: 'rosterEmployeeIds', select: 'name employeeType active' });

  if (!job) {
    res.status(404).json({ message: 'Job not found or not assigned to you' });
    return;
  }

  res.json({ data: job });
};

export const getJob = async (req, res) => {
  const job = await Job.findById(req.params.id).populate(JOB_POPULATE);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  res.json({ data: job });
};

export const createJob = async (req, res) => {
  const job = new Job(pickEditableFields(req.body));

  const relationError = await applyJobRelations(job, req.body);
  if (relationError) {
    res.status(422).json({ message: relationError });
    return;
  }

  await job.save();
  await job.populate(JOB_POPULATE);

  res.status(201).json({ data: job });
};

export const updateJob = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  Object.assign(job, pickEditableFields(req.body));

  const relationError = await applyJobRelations(job, req.body);
  if (relationError) {
    res.status(422).json({ message: relationError });
    return;
  }

  await job.save();
  await job.populate(JOB_POPULATE);

  res.json({ data: job });
};

export const setJobAssignments = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  const assignments = await resolveAssignments(req.body.userIds);

  if (assignments === null) {
    res.status(422).json({ message: 'One or more selected users do not exist' });
    return;
  }

  job.assignedUserIds = assignments;
  await job.save();
  await job.populate(JOB_POPULATE);

  res.json({ data: job });
};

export const archiveJob = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  if (job.status === 'archived') {
    res.status(409).json({ message: 'This job is already archived' });
    return;
  }

  job.previousStatus = job.status;
  job.status = 'archived';
  await job.save();
  await job.populate(JOB_POPULATE);

  res.json({ data: job });
};

export const unarchiveJob = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  if (job.status !== 'archived') {
    res.status(409).json({ message: 'This job is not archived' });
    return;
  }

  job.status =
    job.previousStatus && job.previousStatus !== 'archived' ? job.previousStatus : 'scheduled';
  job.previousStatus = null;
  await job.save();
  await job.populate(JOB_POPULATE);

  res.json({ data: job });
};
