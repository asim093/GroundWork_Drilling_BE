import crypto from 'crypto';
import { env } from '../config/env.js';

export const createInviteToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + env.inviteExpiryHours * 60 * 60 * 1000);

  return { rawToken, tokenHash, expiresAt };
};

export const hashInviteToken = (rawToken) =>
  crypto.createHash('sha256').update(String(rawToken)).digest('hex');

export const buildInviteLink = (rawToken, email) => {
  const url = new URL('/set-password', env.clientOrigin);
  url.searchParams.set('token', rawToken);
  url.searchParams.set('email', email);
  return url.toString();
};
