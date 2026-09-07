import TimeLogEntry from '../models/TimeLogEntry.js';
import Job from '../models/Job.js';
import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';
import {
  resolveDateRange,
  monthLabel,
  startOfUtcMonth,
  endOfUtcMonth,
  computeSchedulingRows,
  buildTotals,
  buildEntryBreakdown,
  buildGroups
} from '../utils/reporting.js';

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

const SCHEDULING_SORT_FIELDS = ['scheduledDate', 'jobNumber', 'clientName'];

export const listScheduling = async (req, res) => {
  const { from, to } = resolveDateRange(req.query);
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SCHEDULING_SORT_FIELDS,
    defaultSort: 'scheduledDate'
  });

  const jobFilter = { scheduledDate: { $gte: from, $lte: to } };
  if (req.query.job) {
    jobFilter._id = req.query.job;
  }

  const jobs = await Job.find(jobFilter)
    .sort(sort)
    .populate('assignedUserIds', 'name email');

  const jobIds = jobs.map((job) => job._id);
  const entries = await TimeLogEntry.find({ jobId: { $in: jobIds } })
    .select('jobId userId date status')
    .lean();

  let rows = computeSchedulingRows(jobs, entries);

  if (req.query.status) {
    rows = rows.filter((row) => row.status === req.query.status);
  }

  const total = rows.length;

  res.json({
    data: rows.slice(skip, skip + limit),
    pagination: buildPaginationMeta(page, limit, total)
  });
};

const fetchSubmittedEntries = (from, to) =>
  TimeLogEntry.find({ status: 'submitted', date: { $gte: from, $lte: to } })
    .populate('jobId', 'jobNumber clientName')
    .populate('userId', 'name email')
    .lean();

export const reportsSummary = async (req, res) => {
  const { from, to } = resolveDateRange(req.query);
  const entries = await fetchSubmittedEntries(from, to);

  const data = {
    from,
    to,
    ...buildTotals(entries),
    entries: buildEntryBreakdown(entries)
  };

  if (req.query.groupBy === 'user' || req.query.groupBy === 'job') {
    data.groupBy = req.query.groupBy;
    data.groups = buildGroups(entries, req.query.groupBy);
  }

  res.json({ data });
};

export const reportsMonthlyComparison = async (req, res) => {
  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getUTCFullYear();
  const month = req.query.month ? Number(req.query.month) : now.getUTCMonth() + 1;

  const currentFrom = startOfUtcMonth(year, month - 1);
  const currentTo = endOfUtcMonth(year, month - 1);
  const previousFrom = startOfUtcMonth(year, month - 2);
  const previousTo = endOfUtcMonth(year, month - 2);

  const [currentEntries, previousEntries] = await Promise.all([
    fetchSubmittedEntries(currentFrom, currentTo),
    fetchSubmittedEntries(previousFrom, previousTo)
  ]);

  res.json({
    data: {
      current: {
        label: monthLabel(currentFrom),
        from: currentFrom,
        to: currentTo,
        ...buildTotals(currentEntries)
      },
      previous: {
        label: monthLabel(previousFrom),
        from: previousFrom,
        to: previousTo,
        ...buildTotals(previousEntries)
      }
    }
  });
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
