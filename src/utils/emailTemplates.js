import { env } from '../config/env.js';

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const inviteEmail = ({ name, link, expiryHours }) => {
  const safeName = escapeHtml(name || 'there');
  const subject = `Set up your ${env.appName} account`;

  const text = [
    `Hi ${name || 'there'},`,
    '',
    `You have been added as an operator on ${env.appName}.`,
    'Use the link below to choose your password and activate your account:',
    '',
    link,
    '',
    `This link expires in ${expiryHours} hours.`,
    'If you were not expecting this email you can ignore it.'
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f6f8;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e8eb;">
            <tr>
              <td style="background-color:#1971c2;padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(env.appName)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 12px;font-size:16px;color:#1a1b1e;">Hi ${safeName},</p>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#495057;">
                  You have been added as an operator on ${escapeHtml(env.appName)}. Choose your
                  password to activate your account and start logging time &amp; material.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:#1971c2;">
                      <a href="${link}" style="display:block;padding:14px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;text-align:center;">
                        Set your password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:12px;color:#868e96;">
                  This link expires in ${expiryHours} hours. If the button does not work, copy this URL into your browser:
                </p>
                <p style="margin:0;font-size:12px;word-break:break-all;color:#1971c2;">${escapeHtml(link)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #e6e8eb;">
                <p style="margin:0;font-size:11px;color:#adb5bd;">
                  If you were not expecting this email you can safely ignore it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
};
