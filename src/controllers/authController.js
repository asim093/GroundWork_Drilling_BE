import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { hashInviteToken } from '../utils/invite.js';

const createToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  active: user.active,
  pendingInvite: !user.passwordSet
});

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');

  if (!user || !user.passwordSet || !(await user.comparePassword(password))) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  if (!user.active) {
    res.status(403).json({ message: 'This account has been deactivated' });
    return;
  }

  res.json({ token: createToken(user), user: toPublicUser(user) });
};

export const getCurrentUser = async (req, res) => {
  res.json({ user: toPublicUser(req.user) });
};

export const getInvite = async (req, res) => {
  const user = await User.findOne({
    inviteTokenHash: hashInviteToken(req.query.token),
    inviteTokenExpires: { $gt: new Date() }
  });

  if (!user) {
    res.status(400).json({ message: 'This invitation link is invalid or has expired' });
    return;
  }

  res.json({ data: { name: user.name, email: user.email } });
};

export const acceptInvite = async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    inviteTokenHash: hashInviteToken(token),
    inviteTokenExpires: { $gt: new Date() }
  }).select('+password');

  if (!user) {
    res.status(400).json({ message: 'This invitation link is invalid or has expired' });
    return;
  }

  user.password = password;
  user.passwordSet = true;
  user.active = true;
  user.inviteTokenHash = undefined;
  user.inviteTokenExpires = undefined;
  await user.save();

  res.json({ token: createToken(user), user: toPublicUser(user) });
};
