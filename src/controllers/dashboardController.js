import User from '../models/User.js';
import Job from '../models/Job.js';
import TimeLogEntry from '../models/TimeLogEntry.js';
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
    recent
  ] = await Promise.all([
    User.countDocuments({ role: 'operator' }),
    User.countDocuments({ role: 'operator', active: true }),
    User.countDocuments({ role: 'operator', passwordSet: false }),
    Job.find().select('status').lean(),
    TimeLogEntry.find({ status: 'submitted', date: { $gte: from, $lte: to } })
      .populate('jobId', 'jobNumber clientName')
      .lean(),
    TimeLogEntry.countDocuments({ status: 'draft', date: { $gte: from, $lte: to } }),
    Job.find({ scheduledDate: { $gte: from, $lte: to } })
      .populate('assignedUserIds', 'name email')
      .lean(),
    TimeLogEntry.find({ status: 'submitted' })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('jobId', 'jobNumber clientName')
      .populate('userId', 'name')
  ]);

  const jobEntries = await TimeLogEntry.find({
    jobId: { $in: scheduledJobs.map((job) => job._id) }
  })
    .select('jobId userId date status')
    .lean();
  const schedulingRows = computeSchedulingRows(scheduledJobs, jobEntries);
  const schedulingCounts = { submitted: 0, draft: 0, missing: 0 };
  schedulingRows.forEach((row) => {
    schedulingCounts[row.status] += 1;
  });

  const totals = buildTotals(monthEntries);

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
    recentSubmissions: recent.map(recentEntryShape)
  };
};

const operatorDashboard = async (userId) => {
  const { from, to } = resolveDateRange({});

  const [assignedJobs, myDraft, mySubmitted, monthSubmitted, monthEntries, recent] = await Promise.all([
    Job.find({ assignedUserIds: userId }).select('status').lean(),
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
      .populate('userId', 'name')
  ]);

  const totals = buildTotals(monthEntries);

  return {
    role: 'operator',
    assignedJobs: { total: assignedJobs.length, byStatus: countByStatus(assignedJobs) },
    myTimeLogs: { draft: myDraft, submitted: mySubmitted, thisMonthSubmitted: monthSubmitted },
    thisMonth: { label: monthLabel(from), from, to, totals: totals.totals },
    recentEntries: recent.map(recentEntryShape)
  };
};

export const getDashboard = async (req, res) => {
  const data =
    req.user.role === 'admin' ? await adminDashboard() : await operatorDashboard(req.user.id);

  res.json({ data });
};
