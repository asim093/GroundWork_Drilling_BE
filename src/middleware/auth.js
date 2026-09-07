import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);

    if (!user || !user.active) {
      res.status(401).json({ message: 'Account is inactive or no longer exists' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
