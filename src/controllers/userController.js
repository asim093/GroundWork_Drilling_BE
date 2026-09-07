import User from '../models/User.js';
import { buildListOptions, buildPaginationMeta } from '../utils/listQuery.js';

const SORTABLE_FIELDS = ['name', 'email', 'createdAt'];

export const listUsers = async (req, res) => {
  const { page, limit, skip, sort } = buildListOptions(req.query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: 'createdAt'
  });

  const filter = {};

  if (req.query.role) {
    filter.role = req.query.role;
  }

  if (req.query.active === 'true') {
    filter.active = true;
  } else if (req.query.active === 'false') {
    filter.active = false;
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
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json({ data: user });
};

export const createUser = async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  const existing = await User.findOne({ email: String(email).toLowerCase() });

  if (existing) {
    res.status(409).json({ message: 'A user with this email already exists' });
    return;
  }

  const user = await User.create({ name, email, password, role, phone });

  res.status(201).json({ data: user });
};

export const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const { name, email, password, role, phone, active } = req.body;

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

  if (role !== undefined) {
    user.role = role;
  }

  if (phone !== undefined) {
    user.phone = phone;
  }

  if (active !== undefined) {
    user.active = active;
  }

  if (password) {
    user.password = password;
  }

  await user.save();

  res.json({ data: user });
};
