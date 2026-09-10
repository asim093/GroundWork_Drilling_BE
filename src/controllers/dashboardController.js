import User from '../models/User.js';
import Job from '../models/Job.js';
import TimeLogEntry from '../models/TimeLogEntry.js';
import BonusConfig from '../models/BonusConfig.js';
import {
  resolveDateRange,
  monthLabel,
  computeSchedulingRows,
  buildTotals
} from '../utils/reporting.js';

const JOB_STATUSES = ['scheduled', 'in-progress', 'submitted', 'archived'];

const countByStatus = (jobs) =>
  JOB_STATUSES.reduce((acc, status) => {
    acc[status] = jobs.filter((job) => job.status === status).length;
    return acc;
  }, {});

const recentEntryShape = (entry) => ({
  id: entry.id,
  date: entry.date,
  status: entry.status,
  jobNumber: entry.jobId?.jobNumber || null,
  clientName: entry.jobId?.clientName || null,
  operator: entry.userId?.name || null
});

const ACTIVITY_DAYS = 7;

const activityWindowStart = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (ACTIVITY_DAYS - 1))
  );
};

const buildDailyActivity = (entries) => {
  const now = new Date();
  const buckets = [];

  for (let offset = ACTIVITY_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset)
    );
    buckets.push({
      date: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      count: 0
    });
  }

  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  entries.forEach((entry) => {
    const bucket = byDate.get(new Date(entry.updatedAt).toISOString().slice(0, 10));
    if (bucket) {
      bucket.count += 1;
    }
  });

  return buckets;
};

const adminDashboard = async () => {
  const { from, to } = resolveDateRange({});

  const [
    operatorTotal,
    operatorActive,
    operatorPending,
    jobs,
    monthEntries,
    monthDraftCount,
    scheduledJobs,
    recent,
    activityEntries
  ] = await Promise.all([
    User.countDocuments({ role: 'operator' }),
    User.countDocuments({ role: 'operator', active: true }),
    User.countDocuments({ role: 'operator', passwordSet: false }),
    Job.find().select('status').lean(),
    TimeLogEntry.find({ status: 'submitted', date: { $gte: from, $lte: to } })
      .populate('jobId', 'jobNumber clientName')
      .lean(),
    TimeLogEntry.countDocuments({ status: 'draft', date: { $gte: from, $lte: to } }),
    Job.find({ scheduledDate: { $gte: from, $lte: to }, status: { $ne: 'archived' } })
      .populate('assignedUserIds', 'name email')
      .lean(),
    TimeLogEntry.find({ status: 'submitted' })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('jobId', 'jobNumber clientName')
      .populate('userId', 'name'),
    TimeLogEntry.find({ status: 'submitted', updatedAt: { $gte: activityWindowStart() } })
      .select('updatedAt')
      .lean()
  ]);

  const [jobEntries, bonusConfig] = await Promise.all([
    TimeLogEntry.find({ jobId: { $in: scheduledJobs.map((job) => job._id) } })
      .select('jobId userId date status')
      .lean(),
    BonusConfig.getSingleton()
  ]);
  const schedulingRows = computeSchedulingRows(scheduledJobs, jobEntries);
  const schedulingCounts = { submitted: 0, draft: 0, missing: 0 };
  schedulingRows.forEach((row) => {
    schedulingCounts[row.status] += 1;
  });

  const totals = buildTotals(monthEntries, bonusConfig.recoveryThreshold);

  return {
    role: 'admin',
    operators: { total: operatorTotal, active: operatorActive, pendingInvite: operatorPending },
    jobs: { total: jobs.length, byStatus: countByStatus(jobs) },
    thisMonth: {
      label: monthLabel(from),
      from,
      to,
      scheduling: schedulingCounts,
      timeLogs: { submitted: monthEntries.length, draft: monthDraftCount },
      totals: totals.totals,
      bonusEligibility: totals.bonusEligibility
    },
    submissionActivity: buildDailyActivity(activityEntries),
    recentSubmissions: recent.map(recentEntryShape)
  };
};

const operatorDashboard = async (userId) => {
  const { from, to } = resolveDateRange({});

  const [
    assignedJobs,
    myDraft,
    mySubmitted,
    monthSubmitted,
    monthEntries,
    recent,
    activityEntries,
    bonusConfig
  ] = await Promise.all([
    Job.find({ assignedUserIds: userId, status: { $ne: 'archived' } }).select('status').lean(),
    TimeLogEntry.countDocuments({ userId, status: 'draft' }),
    TimeLogEntry.countDocuments({ userId, status: 'submitted' }),
    TimeLogEntry.countDocuments({
      userId,
      status: 'submitted',
      date: { $gte: from, $lte: to }
    }),
    TimeLogEntry.find({ userId, status: 'submitted', date: { $gte: from, $lte: to } }).lean(),
    TimeLogEntry.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('jobId', 'jobNumber clientName')
      .populate('userId', 'name'),
    TimeLogEntry.find({ userId, status: 'submitted', updatedAt: { $gte: activityWindowStart() } })
      .select('updatedAt')
      .lean(),
    BonusConfig.getSingleton()
  ]);

  const totals = buildTotals(monthEntries, bonusConfig.recoveryThreshold);

  return {
    role: 'operator',
    assignedJobs: { total: assignedJobs.length, byStatus: countByStatus(assignedJobs) },
    myTimeLogs: { draft: myDraft, submitted: mySubmitted, thisMonthSubmitted: monthSubmitted },
    thisMonth: { label: monthLabel(from), from, to, totals: totals.totals },
    submissionActivity: buildDailyActivity(activityEntries),
    recentEntries: recent.map(recentEntryShape)
  };
};

export const getDashboard = async (req, res) => {
  const data =
    req.user.role === 'admin' ? await adminDashboard() : await operatorDashboard(req.user.id);

  res.json({ data });
};

const adminAttention = async () => {
  const { from, to } = resolveDateRange({});

  const [scheduledJobs, pendingInvites] = await Promise.all([
    Job.find({ scheduledDate: { $gte: from, $lte: to }, status: { $ne: 'archived' } })
      .populate('assignedUserIds', 'name')
      .lean(),
    User.find({ role: 'operator', active: true, passwordSet: false })
      .select('name email')
      .lean()
  ]);

  const jobEntries = await TimeLogEntry.find({
    jobId: { $in: scheduledJobs.map((job) => job._id) }
  })
    .select('jobId userId date status')
    .lean();

  const missing = computeSchedulingRows(scheduledJobs, jobEntries).filter(
    (row) => row.status === 'missing'
  );

  return [
    ...missing.map((row) => ({
      id: `missing-${row.jobNumber}`,
      type: 'missing-submission',
      title: `Job ${row.jobNumber} has no submission`,
      subtitle: row.clientName || 'Scheduled this month',
      to: '/admin/scheduling'
    })),
    ...pendingInvites.map((operator) => ({
      id: `invite-${operator._id}`,
      type: 'pending-invite',
      title: `${operator.name} hasn't accepted their invite`,
      subtitle: operator.email,
      to: '/admin/users'
    }))
  ];
};

const operatorAttention = async (userId) => {
  const drafts = await TimeLogEntry.find({ userId, status: 'draft' })
    .sort({ updatedAt: -1 })
    .populate('jobId', 'jobNumber')
    .lean();

  return drafts.map((entry) => ({
    id: `draft-${entry._id}`,
    type: 'draft',
    title: `Unsent draft for job ${entry.jobId?.jobNumber || '—'}`,
    subtitle: entry.date ? new Date(entry.date).toISOString().slice(0, 10) : 'No date set',
    to: `/operator/log/${entry._id}`
  }));
};

export const getAttention = async (req, res) => {
  const items =
    req.user.role === 'admin' ? await adminAttention() : await operatorAttention(req.user.id);

  res.json({ data: { count: items.length, items } });
};
