import User from '../models/User.js';
import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';
import { createInviteToken, buildInviteLink } from '../utils/invite.js';
import { inviteEmail } from '../utils/emailTemplates.js';
import { sendMail } from '../utils/mailer.js';
import { env } from '../config/env.js';

const SORTABLE_FIELDS = ['name', 'email', 'createdAt'];

const sendInvite = async (user) => {
  const { rawToken, tokenHash, expiresAt } = createInviteToken();

  user.inviteTokenHash = tokenHash;
  user.inviteTokenExpires = expiresAt;
  await user.save();

  const link = buildInviteLink(rawToken, user.email);
  const { subject, text, html } = inviteEmail({
    name: user.name,
    link,
    expiryHours: env.inviteExpiryHours
  });
  const { delivered } = await sendMail({ to: user.email, subject, text, html });

  return { link, delivered };
};

export const listUsers = async (req, res) => {
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: 'createdAt'
  });

  const filter = { role: 'operator' };

  if (req.query.active === 'true') {
    filter.active = true;
  } else if (req.query.active === 'false') {
    filter.active = false;
  }

  if (req.query.status === 'pending') {
    filter.passwordSet = false;
  } else if (req.query.status === 'active') {
    filter.passwordSet = true;
  }

  if (req.query.employeeType) {
    filter.employeeType = req.query.employeeType;
  }

  if (req.query.search) {
    const term = String(req.query.search).trim();
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } }
    ];
  }

  const [data, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter)
  ]);

  res.json({ data, pagination: buildPaginationMeta(page, limit, total) });
};

export const getUser = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'operator' });

  if (!user) {
    res.status(404).json({ message: 'Operator not found' });
    return;
  }

  res.json({ data: user });
};

export const createUser = async (req, res) => {
  const { name, email, phone, employeeType, employeeCategory } = req.body;

  const existing = await User.findOne({ email: String(email).toLowerCase() });

  if (existing) {
    res.status(409).json({ message: 'A user with this email already exists' });
    return;
  }

  const user = await User.create({
    name,
    email,
    phone,
    employeeType: employeeType || null,
    employeeCategory: employeeCategory || null,
    role: 'operator',
    passwordSet: false,
    active: true
  });

  const invite = await sendInvite(user);

  res.status(201).json({ data: user, invite });
};

export const updateUser = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'operator' });

  if (!user) {
    res.status(404).json({ message: 'Operator not found' });
    return;
  }

  const { name, email, phone, active, employeeType, employeeCategory } = req.body;

  if (email && String(email).toLowerCase() !== user.email) {
    const clash = await User.findOne({ email: String(email).toLowerCase() });

    if (clash) {
      res.status(409).json({ message: 'A user with this email already exists' });
      return;
    }

    user.email = email;
  }

  if (name !== undefined) {
    user.name = name;
  }

  if (phone !== undefined) {
    user.phone = phone;
  }

  if (active !== undefined) {
    user.active = active;
  }

  if (employeeType !== undefined) {
    user.employeeType = employeeType || null;
  }

  if (employeeCategory !== undefined) {
    user.employeeCategory = employeeCategory || null;
  }

  await user.save();

  res.json({ data: user });
};

export const resendInvite = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'operator' });

  if (!user) {
    res.status(404).json({ message: 'Operator not found' });
    return;
  }

  const invite = await sendInvite(user);

  res.json({ data: user, invite });
};
