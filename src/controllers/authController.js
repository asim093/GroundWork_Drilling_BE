import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';

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
  active: user.active
});

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
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
