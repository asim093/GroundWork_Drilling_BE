import TimeLogEntry from '../models/TimeLogEntry.js';
import Job from '../models/Job.js';
import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';

const SORTABLE_FIELDS = ['date', 'createdAt', 'updatedAt', 'status'];
const JOB_PROJECTION = 'jobNumber clientName jobLocation clientJobNumber drillType scheduledDate status';
const USER_PROJECTION = 'name email role';

const EDITABLE_FIELDS = [
  'date',
  'timeIn',
  'timeOut',
  'assistantName',
  'assistantTimeIn',
  'assistantTimeOut',
  'timeStarted',
  'timeFinished',
  'hoursOnSite',
  'standbyHours',
  'otherHours',
  'mileageStart',
  'mileageEnd',
  'mileageTotal',
  'wellTag',
  'recoveryPercent',
  'activityLines',
  'fuel',
  'consumables'
];

const pickEditableFields = (body) => {
  const result = {};

  EDITABLE_FIELDS.forEach((field) => {
    if (body[field] !== undefined) {
      result[field] = body[field];
    }
  });

  return result;
};

const populateEntry = (entry) =>
  entry.populate([
    { path: 'jobId', select: JOB_PROJECTION },
    { path: 'userId', select: USER_PROJECTION }
  ]);

const buildDateRange = (query) => {
  const range = {};

  if (query.date) {
    const start = new Date(query.date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    range.$gte = start;
    range.$lt = end;
  }

  if (query.from) {
    range.$gte = new Date(query.from);
  }

  if (query.to) {
    range.$lte = new Date(query.to);
  }

  return Object.keys(range).length > 0 ? range : null;
};

const listEntries = async (req, res, baseFilter) => {
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: 'date'
  });

  const filter = { ...baseFilter };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.job) {
    filter.jobId = req.query.job;
  }

  if (req.query.user) {
    filter.userId = req.query.user;
  }

  const dateRange = buildDateRange(req.query);
  if (dateRange) {
    filter.date = dateRange;
  }

  const [data, total] = await Promise.all([
    TimeLogEntry.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('jobId', JOB_PROJECTION)
      .populate('userId', USER_PROJECTION),
    TimeLogEntry.countDocuments(filter)
  ]);

  res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
};

export const listTimeLogs = async (req, res) => {
  await listEntries(req, res, {});
};

export const listMyTimeLogs = async (req, res) => {
  await listEntries(req, res, { userId: req.user.id });
};

export const getTimeLog = async (req, res) => {
  const entry = await TimeLogEntry.findById(req.params.id)
    .populate('jobId', JOB_PROJECTION)
    .populate('userId', USER_PROJECTION);

  if (!entry) {
    res.status(404).json({ message: 'Time log not found' });
    return;
  }

  const isOwner = entry.userId?._id?.equals(req.user.id);

  if (req.user.role !== 'admin' && !isOwner) {
    res.status(403).json({ message: 'You do not have permission to view this time log' });
    return;
  }

  res.json({ data: entry });
};

export const createTimeLog = async (req, res) => {
  const { jobId } = req.body;
  const job = await Job.findById(jobId);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  const isAssigned = job.assignedUserIds.some((id) => id.equals(req.user.id));

  if (!isAssigned) {
    res.status(403).json({ message: 'You are not assigned to this job' });
    return;
  }

  const entry = await TimeLogEntry.create({
    ...pickEditableFields(req.body),
    jobId,
    userId: req.user.id,
    status: 'draft'
  });

  await populateEntry(entry);

  res.status(201).json({ data: entry });
};

export const updateTimeLog = async (req, res) => {
  const entry = await TimeLogEntry.findById(req.params.id);

  if (!entry) {
    res.status(404).json({ message: 'Time log not found' });
    return;
  }

  if (!entry.userId.equals(req.user.id)) {
    res.status(403).json({ message: 'You can only edit your own time logs' });
    return;
  }

  if (entry.status === 'submitted') {
    res.status(409).json({ message: 'This time log has been submitted and can no longer be edited' });
    return;
  }

  Object.assign(entry, pickEditableFields(req.body));
  await entry.save();
  await populateEntry(entry);

  res.json({ data: entry });
};

export const submitTimeLog = async (req, res) => {
  const entry = await TimeLogEntry.findById(req.params.id);

  if (!entry) {
    res.status(404).json({ message: 'Time log not found' });
    return;
  }

  if (!entry.userId.equals(req.user.id)) {
    res.status(403).json({ message: 'You can only submit your own time logs' });
    return;
  }

  if (entry.status === 'submitted') {
    res.status(409).json({ message: 'This time log has already been submitted' });
    return;
  }

  entry.status = 'submitted';
  await entry.save();
  await populateEntry(entry);

  res.json({ data: entry });
};
