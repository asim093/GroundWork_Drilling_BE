import Job from '../models/Job.js';
import User from '../models/User.js';
import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';

const SORTABLE_FIELDS = ['scheduledDate', 'jobNumber', 'clientName', 'createdAt'];
const EDITABLE_FIELDS = [
  'jobNumber',
  'clientName',
  'jobLocation',
  'clientJobNumber',
  'drillType',
  'scheduledDate',
  'status'
];
const ASSIGNED_USER_PROJECTION = 'name email role active';

const pickEditableFields = (body) => {
  const result = {};

  EDITABLE_FIELDS.forEach((field) => {
    if (body[field] !== undefined) {
      result[field] = body[field] === '' ? null : body[field];
    }
  });

  return result;
};

export const listJobs = async (req, res) => {
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: 'scheduledDate'
  });

  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.assignedUser) {
    filter.assignedUserIds = req.query.assignedUser;
  }

  const [data, total] = await Promise.all([
    Job.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('assignedUserIds', ASSIGNED_USER_PROJECTION),
    Job.countDocuments(filter)
  ]);

  res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
};

export const listAssignedJobs = async (req, res) => {
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: 'scheduledDate'
  });

  const filter = { assignedUserIds: req.user.id };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [data, total] = await Promise.all([
    Job.find(filter).sort(sort).skip(skip).limit(limit),
    Job.countDocuments(filter)
  ]);

  res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
};

export const getAssignedJob = async (req, res) => {
  const job = await Job.findOne({ _id: req.params.id, assignedUserIds: req.user.id });

  if (!job) {
    res.status(404).json({ message: 'Job not found or not assigned to you' });
    return;
  }

  res.json({ data: job });
};

export const getJob = async (req, res) => {
  const job = await Job.findById(req.params.id).populate(
    'assignedUserIds',
    ASSIGNED_USER_PROJECTION
  );

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  res.json({ data: job });
};

export const createJob = async (req, res) => {
  const job = await Job.create(pickEditableFields(req.body));
  await job.populate('assignedUserIds', ASSIGNED_USER_PROJECTION);

  res.status(201).json({ data: job });
};

export const updateJob = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  Object.assign(job, pickEditableFields(req.body));
  await job.save();
  await job.populate('assignedUserIds', ASSIGNED_USER_PROJECTION);

  res.json({ data: job });
};

export const setJobAssignments = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  const uniqueUserIds = [...new Set(req.body.userIds.map(String))];

  if (uniqueUserIds.length > 0) {
    const matchedCount = await User.countDocuments({ _id: { $in: uniqueUserIds } });

    if (matchedCount !== uniqueUserIds.length) {
      res.status(422).json({ message: 'One or more selected users do not exist' });
      return;
    }
  }

  job.assignedUserIds = uniqueUserIds;
  await job.save();
  await job.populate('assignedUserIds', ASSIGNED_USER_PROJECTION);

  res.json({ data: job });
};
