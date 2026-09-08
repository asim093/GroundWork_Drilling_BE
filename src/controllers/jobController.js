import Job from '../models/Job.js';
import User from '../models/User.js';
import TimeLogEntry from '../models/TimeLogEntry.js';
import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';
import { startOfUtcDay } from '../utils/timeLog.js';

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
  'drillType',
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

const JOB_POPULATE = [
  { path: 'assignedUserIds', select: ASSIGNED_USER_PROJECTION },
  RIG_NUMBER_POPULATE
];

export const listJobs = async (req, res) => {
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: 'scheduledDate'
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

  const [data, total] = await Promise.all([
    Job.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('assignedUserIds', ASSIGNED_USER_PROJECTION)
      .populate(RIG_NUMBER_POPULATE),
    Job.countDocuments(filter)
  ]);

  res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
};

export const listAssignedJobs = async (req, res) => {
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: 'scheduledDate'
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
  }).populate(RIG_NUMBER_POPULATE);

  if (!job) {
    res.status(404).json({ message: 'Job not found or not assigned to you' });
    return;
  }

  res.json({ data: job });
};

export const getJob = async (req, res) => {
  const job = await Job.findById(req.params.id)
    .populate('assignedUserIds', ASSIGNED_USER_PROJECTION)
    .populate(RIG_NUMBER_POPULATE);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  res.json({ data: job });
};

export const createJob = async (req, res) => {
  const job = new Job(pickEditableFields(req.body));

  if (Array.isArray(req.body.assignedUserIds)) {
    const assignments = await resolveAssignments(req.body.assignedUserIds);

    if (assignments === null) {
      res.status(422).json({ message: 'One or more selected operators do not exist' });
      return;
    }

    job.assignedUserIds = assignments;
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

  if (Array.isArray(req.body.assignedUserIds)) {
    const assignments = await resolveAssignments(req.body.assignedUserIds);

    if (assignments === null) {
      res.status(422).json({ message: 'One or more selected operators do not exist' });
      return;
    }

    job.assignedUserIds = assignments;
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
