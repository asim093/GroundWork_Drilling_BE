import TimeLogEntry from '../models/TimeLogEntry.js';
import Job from '../models/Job.js';
import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';
import {
  resolveDateRange,
  computeSchedulingRows,
  buildPeriodSummary,
  buildEntryHoursBreakdown,
  buildClientHoursReport,
  buildEmployeeHoursReport,
  buildManagerHoursReport,
  buildConsumablesLedger,
  buildConsumablesMonthlyBreakdown,
  buildFuelLedger,
  buildFuelMonthlyBreakdown
} from '../utils/reporting.js';
import {
  buildHoursReportWorkbookBuffer,
  buildHoursReportPdfBuffer,
  buildConsumablesReportWorkbookBuffer,
  buildConsumablesReportPdfBuffer,
  buildFuelReportWorkbookBuffer,
  buildFuelReportPdfBuffer,
  exportFilename,
  EXPORT_CONTENT_TYPES
} from '../utils/reportExport.js';
import {
  startOfUtcDay,
  isWithinShift,
  findActivityLineOverlap,
  findActivityCoverageGap
} from '../utils/timeLog.js';

const SORTABLE_FIELDS = ['date', 'createdAt', 'updatedAt', 'status'];
const JOB_PROJECTION =
  'jobNumber clientName jobLocation clientJobNumber drillNumber scheduledDate status rigNumber siteManagers rosterEmployeeIds';
const JOB_POPULATE = {
  path: 'jobId',
  select: JOB_PROJECTION,
  populate: [
    { path: 'rigNumber', select: 'name' },
    { path: 'rosterEmployeeIds', select: 'name employeeType' }
  ]
};
const ACTIVITY_POPULATE = {
  path: 'activityLines.activityId',
  select: 'name categoryId',
  populate: { path: 'categoryId', select: 'name' }
};
const CREW_POPULATE = { path: 'crew.employeeId', select: 'name employeeType' };
const USER_PROJECTION = 'name email role employeeType employeeCategory';

const EDITABLE_FIELDS = [
  'date',
  'shift',
  'crew',
  'timeIn',
  'timeOut',
  'timeStarted',
  'timeFinished',
  'hoursOnSite',
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
    JOB_POPULATE,
    { path: 'userId', select: USER_PROJECTION },
    ACTIVITY_POPULATE,
    CREW_POPULATE
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
    defaultSort: 'date',
    defaultOrder: 'desc'
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
    .populate(JOB_POPULATE)
    .populate('userId', USER_PROJECTION)
    .populate(ACTIVITY_POPULATE)
    .populate(CREW_POPULATE);

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
  const { jobId, shift } = req.body;
  const job = await Job.findById(jobId);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  const managesShift = (job.siteManagers || []).some(
    (manager) => manager.userId.equals(req.user.id) && manager.shift === shift
  );

  if (!managesShift) {
    res.status(403).json({ message: `You are not the site manager for the ${shift} shift on this job` });
    return;
  }

  if (job.status === 'archived') {
    res.status(409).json({ message: 'This job is archived and no longer accepts time logs' });
    return;
  }

  const day = startOfUtcDay(req.body.date || new Date());
  const existing = await TimeLogEntry.findOne({ jobId, date: day, shift });

  if (existing) {
    await populateEntry(existing);
    res.status(200).json({ data: existing, existed: true });
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

  const isAdmin = req.user.role === 'admin';

  if (!isAdmin && !entry.userId.equals(req.user.id)) {
    res.status(403).json({ message: 'You can only edit your own time logs' });
    return;
  }

  if (!isAdmin && entry.status === 'submitted') {
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

  const jobFilter = { scheduledDate: { $gte: from, $lte: to }, status: { $ne: 'archived' } };
  if (req.query.job) {
    jobFilter._id = req.query.job;
  }

  const jobs = await Job.find(jobFilter)
    .sort(sort)
    .populate('siteManagers.userId', 'name');

  const jobIds = jobs.map((job) => job._id);
  const entries = await TimeLogEntry.find({ jobId: { $in: jobIds } })
    .select('jobId date shift status crew')
    .populate('crew.employeeId', 'name employeeType')
    .lean();

  let rows = computeSchedulingRows(jobs, entries);

  if (req.query.status) {
    rows = rows.filter((row) => row.status === req.query.status);
  }

  if (req.query.shift) {
    rows = rows.filter((row) => row.shift === req.query.shift);
  }

  const total = rows.length;

  res.json({
    data: rows.slice(skip, skip + limit),
    pagination: buildPaginationMeta(page, limit, total)
  });
};

const fetchSubmittedEntries = (from, to, extra = {}) =>
  TimeLogEntry.find({ status: 'submitted', date: { $gte: from, $lte: to }, ...extra })
    .populate('jobId', 'jobNumber clientName')
    .populate('userId', 'name email employeeType employeeCategory')
    .populate('crew.employeeId', 'name employeeType')
    .lean();

const buildEntryFilter = async (query) => {
  const extra = {};
  if (query.user) {
    extra.userId = query.user;
  }
  if (query.employee) {
    extra['crew.employeeId'] = query.employee;
  }
  if (query.job) {
    extra.jobId = query.job;
  }
  return extra;
};

const filterByClientName = (entries, clientName) =>
  clientName ? entries.filter((entry) => entry.jobId?.clientName === clientName) : entries;

export const reportsHours = async (req, res) => {
  const { from, to } = resolveDateRange(req.query);
  const extra = await buildEntryFilter(req.query);
  const entries = filterByClientName(await fetchSubmittedEntries(from, to, extra), req.query.client);

  const scope = req.query.scope === 'employee' ? 'employee' : req.query.scope === 'manager' ? 'manager' : 'client';

  const data = { from, to, scope, entryCount: entries.length };
  if (scope === 'employee') {
    data.employees = buildEmployeeHoursReport(entries);
  } else if (scope === 'manager') {
    data.managers = buildManagerHoursReport(entries);
  } else {
    const clientReport = buildClientHoursReport(entries);
    data.jobs = clientReport.jobs;
    data.totals = clientReport.totals;
  }

  res.json({ data });
};

export const reportsConsumables = async (req, res) => {
  const { from, to } = resolveDateRange(req.query);
  const entries = await fetchSubmittedEntries(from, to, await buildEntryFilter(req.query));
  const items = buildConsumablesLedger(entries);
  const monthly = buildConsumablesMonthlyBreakdown(entries);

  res.json({ data: { from, to, items, monthly: monthly.length > 1 ? monthly : [] } });
};

export const reportsFuel = async (req, res) => {
  const { from, to } = resolveDateRange(req.query);
  const entries = await fetchSubmittedEntries(from, to, await buildEntryFilter(req.query));
  const byType = buildFuelLedger(entries);
  const monthly = buildFuelMonthlyBreakdown(entries);

  res.json({ data: { from, to, byType, monthly: monthly.length > 1 ? monthly : [] } });
};

export const reportsMine = async (req, res) => {
  const { from, to } = resolveDateRange(req.query);
  const entries = await fetchSubmittedEntries(from, to, { userId: req.user.id });
  const summary = buildPeriodSummary(entries);
  const entryBreakdown = buildEntryHoursBreakdown(entries);

  res.json({
    data: {
      from,
      to,
      entryCount: summary.entryCount,
      totals: summary.totals,
      consumables: summary.consumables,
      entries: entryBreakdown
    }
  });
};

const sendReportFile = async (res, { format, base, buildBuffer, meta }) => {
  const filename = exportFilename(base, format, meta);
  const buffer = await buildBuffer(format, meta);

  res.setHeader('Content-Type', EXPORT_CONTENT_TYPES[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
};

export const reportsHoursExport = async (req, res) => {
  const { from, to } = resolveDateRange(req.query);
  const extra = await buildEntryFilter(req.query);
  const entries = filterByClientName(await fetchSubmittedEntries(from, to, extra), req.query.client);
  const scope = req.query.scope === 'employee' ? 'employee' : req.query.scope === 'manager' ? 'manager' : 'client';

  const report = { scope };
  if (scope === 'employee') {
    report.employees = buildEmployeeHoursReport(entries);
  } else if (scope === 'manager') {
    report.managers = buildManagerHoursReport(entries);
  } else {
    Object.assign(report, buildClientHoursReport(entries));
  }

  await sendReportFile(res, {
    format: req.query.format,
    base: 'groundwork-hours-report',
    buildBuffer: (format, meta) =>
      format === 'pdf' ? buildHoursReportPdfBuffer(report, meta) : buildHoursReportWorkbookBuffer(report, meta),
    meta: { title: 'Groundwork Drilling — Hours Report', scope, from, to }
  });
};

export const reportsConsumablesExport = async (req, res) => {
  const { from, to } = resolveDateRange(req.query);
  const entries = await fetchSubmittedEntries(from, to, await buildEntryFilter(req.query));
  const items = buildConsumablesLedger(entries);
  const monthly = buildConsumablesMonthlyBreakdown(entries);

  await sendReportFile(res, {
    format: req.query.format,
    base: 'groundwork-consumables-report',
    buildBuffer: (format, meta) =>
      format === 'pdf'
        ? buildConsumablesReportPdfBuffer({ items, monthly: monthly.length > 1 ? monthly : [] }, meta)
        : buildConsumablesReportWorkbookBuffer({ items, monthly: monthly.length > 1 ? monthly : [] }, meta),
    meta: { title: 'Groundwork Drilling — Consumables Report', from, to }
  });
};

export const reportsFuelExport = async (req, res) => {
  const { from, to } = resolveDateRange(req.query);
  const entries = await fetchSubmittedEntries(from, to, await buildEntryFilter(req.query));
  const byType = buildFuelLedger(entries);
  const monthly = buildFuelMonthlyBreakdown(entries);

  await sendReportFile(res, {
    format: req.query.format,
    base: 'groundwork-fuel-report',
    buildBuffer: (format, meta) =>
      format === 'pdf'
        ? buildFuelReportPdfBuffer({ byType, monthly: monthly.length > 1 ? monthly : [] }, meta)
        : buildFuelReportWorkbookBuffer({ byType, monthly: monthly.length > 1 ? monthly : [] }, meta),
    meta: { title: 'Groundwork Drilling — Fuel Report', from, to }
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

  const missingActivity = entry.activityLines.findIndex(
    (line) => !line.activityId && !line.description
  );
  if (missingActivity !== -1) {
    res
      .status(422)
      .json({ message: `Select an activity for line ${missingActivity + 1} before submitting` });
    return;
  }

  if (!entry.crew.length) {
    res.status(422).json({ message: 'Add at least one crew member before submitting' });
    return;
  }

  const halfTimedCrew = entry.crew.findIndex(
    (member) => Boolean(member.timeIn) !== Boolean(member.timeOut)
  );
  if (halfTimedCrew !== -1) {
    res.status(422).json({
      message: `Crew member ${halfTimedCrew + 1}: enter both time in and time out, or leave both blank`
    });
    return;
  }

  const windowStart = entry.timeIn || entry.timeStarted;
  const windowEnd = entry.timeOut || entry.timeFinished;
  if (windowStart && windowEnd) {
    const outOfWindow = entry.activityLines.findIndex(
      (line) =>
        !isWithinShift(line.timeFrom, windowStart, windowEnd) ||
        !isWithinShift(line.timeTo, windowStart, windowEnd)
    );
    if (outOfWindow !== -1) {
      res.status(422).json({
        message: `Line ${outOfWindow + 1}: activity time is outside the on-site window (Time In to Time Out)`
      });
      return;
    }

    const overlap = findActivityLineOverlap(entry.activityLines, windowStart, windowEnd);
    if (overlap?.type === 'reversed') {
      res.status(422).json({
        message: `Line ${overlap.index + 1}: Time To must be after Time From`
      });
      return;
    }
    if (overlap?.type === 'overlap') {
      res.status(422).json({
        message: `Lines ${overlap.indexA + 1} and ${overlap.indexB + 1} overlap — activity lines cannot cover the same time twice`
      });
      return;
    }

    const gap = findActivityCoverageGap(entry.activityLines, windowStart, windowEnd);
    if (gap) {
      res.status(422).json({
        message: `You're missing an activity between ${gap.from} and ${gap.to} — please add it before submitting.`
      });
      return;
    }
  }

  entry.status = 'submitted';
  await entry.save();
  await populateEntry(entry);

  res.json({ data: entry });
};
