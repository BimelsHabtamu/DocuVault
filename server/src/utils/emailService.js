'use strict';

const tls   = require('tls');
const net   = require('net');
const fs    = require('fs');
const path  = require('path');
const require_dotenv = require('dotenv');
require_dotenv.config();

/* ── helpers ────────────────────────────────────────────────────────────────── */

function b64(s) { return Buffer.from(String(s)).toString('base64'); }

/** Escape lone dots on a line (SMTP transparency) */
function dotStuff(s) {
  return s.replace(/\r?\n\.\r?\n/g, '\n..\n');
}

/**
 * Convert an org logo URL to an inline base64 data URI so the image is
 * self-contained in the email and renders even on localhost / behind a firewall.
 *
 * Strategy:
 *  1. If the URL points to our own /uploads/logos/ path, resolve it directly
 *     from disk and base64-encode it — guaranteed to work in development.
 *  2. Otherwise leave the URL as-is (the caller may supply a public CDN URL).
 *  3. On any error (file missing, permission denied, etc.) fall back gracefully
 *     to the original URL string — email still sends, image may not load.
 */
function resolveLogoToDataUri(logoUrl) {
  if (!logoUrl) return logoUrl;

  try {
    // Match our own upload URL pattern: anything ending in /uploads/logos/<filename>
    const match = logoUrl.match(/\/uploads\/logos\/([^/?#]+)$/);
    if (match) {
      const filename = match[1];
      const LOGO_DIR = path.join(__dirname, '..', '..', 'storage', 'logos');
      const filePath = path.join(LOGO_DIR, filename);

      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        // Determine MIME type from extension
        const ext = path.extname(filename).toLowerCase().replace('.', '');
        const mime = ext === 'svg' ? 'image/svg+xml'
          : ext === 'png'  ? 'image/png'
          : ext === 'webp' ? 'image/webp'
          : ext === 'gif'  ? 'image/gif'
          : 'image/jpeg'; // default: jpg/jpeg
        return `data:${mime};base64,${data.toString('base64')}`;
      }
    }
  } catch (err) {
    console.warn('[email] logo base64 conversion failed, using original URL:', err.message);
  }

  // Fallback: return original URL unchanged
  return logoUrl;
}

/** Minimal quoted-printable safe content-transfer for HTML bodies */
function buildMimeMessage({ from, to, subject, html, attachments }) {
  const boundary = 'boundary_' + Date.now().toString(36);
  const toList = Array.isArray(to) ? to.join(', ') : to;

  const hasAttachments = attachments && attachments.length > 0;

  if (!hasAttachments) {
    // Simple message: headers + HTML body
    const encoded = Buffer.from(html || '').toString('base64')
      .match(/.{1,76}/g).join('\r\n');
    return [
      `From: ${from}`,
      `To: ${toList}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encoded,
    ].join('\r\n');
  }

  // With attachments: multipart/mixed
  const htmlEncoded = Buffer.from(html || '').toString('base64')
    .match(/.{1,76}/g).join('\r\n');

  const parts = [
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlEncoded,
  ];

  for (const att of attachments) {
    const data = Buffer.isBuffer(att.content)
      ? att.content.toString('base64')
      : Buffer.from(att.content).toString('base64');
    const chunks = data.match(/.{1,76}/g).join('\r\n');
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      chunks
    );
  }
  parts.push(`--${boundary}--`);

  return [
    `From: ${from}`,
    `To: ${toList}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    parts.join('\r\n'),
  ].join('\r\n');
}


function smtpSend({ host, port, user, pass, from, to, mimeMessage, timeoutMs = 20000 }) {
  return new Promise((resolve, reject) => {
    const toList = Array.isArray(to) ? to : [to];
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error('SMTP connection timed out after ' + timeoutMs + 'ms'));
    }, timeoutMs);

    const sock = tls.connect({ host, port, rejectUnauthorized: false }, () => {
      // connected
    });

    sock.setEncoding('utf8');
    let buf = '';
    let step = 0;

    function send(line) {
      sock.write(line + '\r\n');
    }

    function fail(msg) {
      clearTimeout(timer);
      sock.destroy();
      reject(new Error(msg));
    }

    sock.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    sock.on('data', (chunk) => {
      buf += chunk;
      // SMTP responses end with \r\n; wait for a complete line
      if (!buf.endsWith('\n')) return;
      const line = buf.trim();
      buf = '';

      // Extract numeric code
      const code = parseInt(line, 10);

      switch (step) {
        case 0: // greeting
          if (code !== 220) return fail('SMTP greeting error: ' + line);
          step = 1;
          send('EHLO localhost');
          break;

        case 1: // EHLO — may be multi-line (250-...)
          if (!line.match(/^250 /m) && !line.match(/^250$/m)) return; // still reading
          step = 2;
          send('AUTH LOGIN');
          break;

        case 2: // AUTH LOGIN prompt for username
          if (code !== 334) return fail('AUTH LOGIN failed: ' + line);
          step = 3;
          send(b64(user));
          break;

        case 3: // AUTH LOGIN prompt for password
          if (code !== 334) return fail('AUTH LOGIN password prompt error: ' + line);
          step = 4;
          send(b64(pass));
          break;

        case 4: // AUTH result
          if (code !== 235) return fail('Authentication failed (' + code + '): ' + line);
          step = 5;
          send('MAIL FROM:<' + from + '>');
          break;

        case 5: // MAIL FROM
          if (code !== 250) return fail('MAIL FROM rejected: ' + line);
          step = 6;
          // Send first RCPT TO
          send('RCPT TO:<' + toList[0] + '>');
          break;

        case 6: // RCPT TO (handle multi-recipient if needed)
          if (code !== 250) return fail('RCPT TO rejected: ' + line);
          step = 7;
          send('DATA');
          break;

        case 7: // DATA prompt
          if (code !== 354) return fail('DATA command rejected: ' + line);
          step = 8;
          sock.write(mimeMessage + '\r\n.\r\n');
          break;

        case 8: // message accepted
          if (code !== 250) return fail('Message rejected: ' + line);
          step = 9;
          send('QUIT');
          break;

        case 9: // QUIT
          clearTimeout(timer);
          sock.destroy();
          resolve({ messageId: '<smtp-' + Date.now() + '@' + host + '>', response: line });
          break;
      }
    });
  });
}

/* ── public sendMail ─────────────────────────────────────────────────────────── */
async function sendMail({ to, subject, html, attachments }) {
  const smtpHost = (process.env.SMTP_HOST || '').trim();

  if (!smtpHost) {
    const toAddr = Array.isArray(to) ? to.join(',') : to;
    console.log(`[email:DRY-RUN] To:${toAddr} | Subject:${subject}`);
    return { success: false, dryRun: true };
  }

  const isGmail = smtpHost.toLowerCase() === 'smtp.gmail.com';
  const smtpPort = isGmail ? 465 : (Number(process.env.SMTP_PORT) || 587);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASSWORD || '';

  // SMTP MAIL FROM must be a raw address only; display names belong in the MIME From header.
  const configuredFrom = (process.env.SMTP_FROM || '').trim();
  const fromAddr = (configuredFrom.match(/<([^>]+)>/)?.[1] || configuredFrom).trim();
  const envelopeFrom = fromAddr.includes('@')
    ? fromAddr
    : (smtpUser || 'no-reply@doc-automation.local').trim();
  const fromName = (process.env.SMTP_FROM_NAME || '').trim();
  const fromHeader = fromName
    ? `${fromName} <${envelopeFrom}>`
    : (configuredFrom && !configuredFrom.includes('@') ? `${configuredFrom} <${envelopeFrom}>` : envelopeFrom);
  const toList = Array.isArray(to) ? to : [to];

  try {
    const mime = buildMimeMessage({ from: fromHeader, to: toList, subject, html, attachments });
    const info = await smtpSend({
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass: smtpPass,
      from: envelopeFrom,
      to:   toList,
      mimeMessage: mime,
    });
    console.log(`[email] sent → ${toList.join(',')} | msgId:${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { success: false, error: err.message };
  }
}

/* ── Email rendering helpers ────────────────────────────────────────────────────── */

/** Escape dynamic values so user/organization input can never break the markup. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Human-readable label for a DocuVault role, e.g. super_admin → System Administrator */
function humanRole(role) {
  const labels = {
    super_admin: 'Super Administrator',
    system_admin: 'System Administrator',
    generator: 'Document Generator',
    approver: 'Approver',
    recipient: 'Recipient',
  };
  return labels[role] || (String(role || '').replace(/_/g, ' ') || 'Member').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * docuVaultShell — professional, responsive HTML email layout built strictly from
 * nested <table>s + inline styles (plus a small <style> block for mobile width
 * tweaks) so it renders reliably in Gmail, Outlook, Apple Mail and every other
 * major client. Includes the DocuVault brand header, an optional organization
 * logo/name, the content area, a security note band, and a full footer.
 */
function docuVaultShell({ preheader, orgName, orgLogoUrl, contentHtml, securityNoteHtml }) {
  const org  = esc(orgName || '');
  // Resolve logo to an inline data URI so it renders in email clients even on
  // localhost / behind a firewall. Falls back to the raw URL on any error.
  // Note: data URIs must NOT be HTML-escaped — only plain URLs need escaping.
  const rawLogo = orgLogoUrl ? resolveLogoToDataUri(orgLogoUrl) : '';
  const logo = rawLogo.startsWith('data:') ? rawLogo : esc(rawLogo);

  // Callers may supply their own security-notice copy (e.g. the welcome email adds
  // an "if you weren't expecting this, ignore it" line). When omitted, fall back to
  // the original generic invitation-link notice so existing callers (e.g. the
  // password-reset email) render byte-for-byte the same as before.
  const noteHtml = securityNoteHtml || `<strong style="color:#0F2747;letter-spacing:0.06em;text-transform:uppercase;">Security notice:</strong> This invitation link is <strong>single-use</strong> and will <strong>expire in 72 hours</strong>. After that time a new invitation must be sent.`;

  const orgHeader = logo ? `
        <tr>
          <td style="padding:18px 32px 0;text-align:center;">
            <img src="${logo}" alt="${org}" width="120" style="max-width:200px;max-height:56px;width:auto;height:auto;border:0;display:inline-block;" />
            ${org ? `<div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;color:#B6C6DB;">${org}</div>` : ''}
          </td>
        </tr>
` : (org ? `
        <tr>
          <td style="padding:18px 32px 0;text-align:center;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;color:#B6C6DB;">${org}</div>
          </td>
        </tr>
` : '');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${esc(preheader || 'DocuVault')}</title>
  <style type="text/css">
    @media only screen and (max-width:620px) {
      .dv-container { width: 100% !important; border-radius: 0 !important; }
      .dv-pad      { padding-left: 20px !important; padding-right: 20px !important; }
      .dv-btn      { width: 100% !important; }
      .dv-btn-a    { display: block !important; width: 100% !important; }
    }
    @media only screen and (max-width:420px) {
      .dv-brand-right { display: none !important; }
      .dv-pad { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
  <!--[if mso]>
    <style type="text/css">
      .dv-container { width: 600px !important; }
      table, td, tr { border-collapse: collapse; }
    </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#EEF2F7;width:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <span style="display:none !important;visibility:hidden;opacity:0;height:0;width:0;mso-hide:all;font-size:0;line-height:0;overflow:hidden;color:#EEF2F7;">${esc(preheader || '')}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF2F7;padding:32px 12px;">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="dv-container"
               style="width:600px;max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 12px 40px rgba(15,39,71,0.12);border:solid 1px #E3E9F2;">

          <!-- ── Header ── -->
          <tr>
            <td style="background-color:#0F2747;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:28px 32px 24px;">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td width="38" style="vertical-align:middle;">
                                <table role="presentation" width="34" height="34" cellpadding="0" cellspacing="0" border="0"
                                       style="width:34px;height:34px;background-color:#159A9C;border-radius:9px;text-align:center;">
                                  <tr><td align="center" style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;line-height:34px;">DV</td></tr>
                                </table>
                              </td>
                              <td style="padding-left:12px;vertical-align:middle;">
                                <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;letter-spacing:0.06em;color:#ffffff;line-height:1.1;">DOCUVAULT</div>
                                <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.16em;color:#27B8BA;text-transform:uppercase;margin-top:3px;">Secure Document Platform</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="right" class="dv-brand-right" style="vertical-align:middle;text-align:right;">
                          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;color:#8FB0CE;text-transform:uppercase;">Enterprise Document<br/>Management Suite</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:2px solid #0E7E80;height:2px;line-height:2px;font-size:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          ${orgHeader}

          <!-- ── Body ── -->
          <tr>
            <td style="padding:30px 40px 12px;" class="dv-pad">
              ${contentHtml}
            </td>
          </tr>

          <!-- ── Security note ── -->
          <tr>
            <td style="padding:8px 40px 28px;" class="dv-pad">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background-color:#F4F8FB;border:1px solid #DBE6F0;border-left-width:4px;border-left-color:#159A9C;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3D546E;">
                    <strong style="color:#0F2747;letter-spacing:0.06em;text-transform:uppercase;">Security notice:</strong> This invitation link is <strong>single-use</strong> and will <strong>expire in 72 hours</strong>. After that time a new invitation must be sent.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- ── Footer ── -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="dv-container"
               style="width:600px;max-width:600px;margin-top:22px;">
          <tr>
            <td align="center" style="padding:0 20px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.6;color:#8395A8;">
              <div style="font-weight:700;letter-spacing:0.1em;color:#0F2747;text-transform:uppercase;margin-bottom:6px;">DocuVault</div>
              <div style="margin-bottom:4px;">Powered by DocuVault</div>
              <div style="margin-bottom:4px;">${org || 'Your organization'}</div>
              <div>Create · Review · Approve · Sign · Deliver · Verify — securely</div>
              <div style="margin-top:8px;">This is an automated message from DocuVault on behalf of ${org || 'your organization'}. Please do not reply to this email.</div>
              <div style="margin-top:8px;">Questions? Contact your organization's system administrator.</div>
              <div style="margin-top:10px;border-top:1px solid #E3E9F2;padding-top:10px;">© ${new Date().getFullYear()} DocuVault · Secure Document Platform · All rights reserved.</div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ── Templates ────────────────────────────────────────────────────────────────── */
const templates = {
  docReadyForSigning: ({ approverName, docId, otpNote, reviewUrl, resubmitNote }) => ({
    subject: `Action required: Document ${docId} awaiting your signature`,
    html: `<p>Hi ${approverName},</p>
      <p>Document <b>${docId}</b> is awaiting your approval.</p>
      ${resubmitNote ? `<p><b>What was fixed:</b> ${resubmitNote}</p>` : ''}
      <p><a href="${reviewUrl}">Review the document</a> ${otpNote || ''}</p>`,
  }),

  docSigned: ({ generatorName, docId, reviewUrl }) => ({
    subject: `Document ${docId} has been signed`,
    html: `<p>Hi ${generatorName},</p>
      <p>Document <b>${docId}</b> was approved and digitally signed.</p>
      <p><a href="${reviewUrl}">Review the signed document</a></p>`,
  }),

  docRejected: ({ generatorName, docId, reason, reviewUrl, requiresLogin = false }) => ({
    subject: `Document ${docId} was rejected`,
    html: `<p>Hi ${generatorName},</p>
      <p>Document <b>${docId}</b> was rejected. <b>Reason:</b> ${reason}</p>
      <p>It has been reverted to Draft status.</p>
      <p><a href="${reviewUrl}">Review the document</a>${requiresLogin
        ? ' — sign in to open it.'
        : ' — one-time link, no login required.'}</p>`,
  }),

  reminder24h: ({ approverName, docId }) => ({
    subject: `Reminder: Document ${docId} still awaiting signature`,
    html: `<p>Hi ${approverName},</p><p>Document <b>${docId}</b> is still pending your review.</p>`,
  }),

  escalation72h: ({ generatorName, approverName, docId }) => ({
    subject: `Escalation: Document ${docId} unsigned for 72+ hours`,
    html: `<p>Document <b>${docId}</b> unsigned 72+ hrs. Generator:${generatorName} | Approver:${approverName}</p>`,
  }),

  deliveryReady: ({ recipientName, docId, downloadUrl }) => ({
    subject: `Your document ${docId} is ready`,
    html: `<p>Hi ${recipientName || 'there'},</p>
      <p><a href="${downloadUrl}">Open secure link</a> (expires 7 days)</p>`,
  }),

  secureLinkReady: ({ docId, downloadUrl }) => ({
    subject: `A document (${docId}) has been shared with you`,
    html: `<p>Hi,</p><p><a href="${downloadUrl}">Open secure link</a> (expires 7 days, single-use)</p>`,
  }),

  documentAttached: ({ docId }) => ({
    subject: `Document ${docId}`,
    html: `<p>Hi,</p><p>Please find your document attached (ID: <b>${docId}</b>).</p>`,
  }),

  passwordReset: ({ fullName, resetUrl, orgName = '', orgLogoUrl = '' }) => {
    const content = `
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;color:#0F2747;line-height:1.25;">Reset your password</p>
      <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#3D546E;">
        Hi ${esc(fullName || 'there')},</p>
      <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#3D546E;">
        We received a request to reset the password for your DocuVault account. No changes have been made yet.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0;text-align:center;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="dv-btn" style="width:260px;background-color:#159A9C;border-radius:10px;">
              <tr>
                <td align="center" class="dv-btn-a" style="border-radius:10px;padding:14px 28px;">
                  <a href="${esc(resetUrl)}" target="_blank"
                     style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.04em;color:#ffffff;text-decoration:none;">Reset Your Password</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748B;">
        This link is <strong>single-use</strong> and expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
      </p>`;
    return {
      subject: 'Reset your DocuVault password',
      html: docuVaultShell({ preheader: 'Reset your DocuVault password', orgName, orgLogoUrl, contentHtml: content }),
    };
  },

  welcome: ({ fullName, orgName, role, email, setPasswordUrl, orgLogoUrl = '', expiryHours = 72 }) => {
    const roleLabel = humanRole(role);
    const orgDisplay = orgName || 'your organization';
    const content = `
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;color:#0F2747;line-height:1.25;">Welcome, ${esc(fullName)}!</p>
      <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#3D546E;">
        You've been invited to join <strong style="color:#0F2747;">${esc(orgDisplay)}</strong> on <strong>DocuVault</strong>.
      </p>
      <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#3D546E;">
        Your account has been created as a <strong style="color:#0F2747;">${roleLabel}</strong>.
      </p>
      <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#3D546E;">
        DocuVault helps organizations create, review, approve, securely sign, deliver, and verify official documents in one place.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 20px;border:1px solid #E3E9F2;border-radius:12px;background-color:#F9FBFD;overflow:hidden;">
        <tr>
          <td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0F2747;border-bottom:1px solid #E3E9F2;background-color:#ffffff;font-weight:800;">Account details</td>
        </tr>
        <tr>
          <td style="padding:14px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;">
              <tr>
                <td width="130" style="padding:7px 0;color:#64748B;vertical-align:top;">Full name</td>
                <td style="padding:7px 0;color:#0F2747;font-weight:700;">${esc(fullName)}</td>
              </tr>
              <tr>
                <td width="130" style="padding:7px 0;color:#64748B;vertical-align:top;">Email address</td>
                <td style="padding:7px 0;color:#0F2747;font-weight:700;">${esc(email)}</td>
              </tr>
              <tr>
                <td width="130" style="padding:7px 0;color:#64748B;vertical-align:top;">Role</td>
                <td style="padding:7px 0;color:#0F2747;font-weight:700;">${roleLabel}</td>
              </tr>
              <tr>
                <td width="130" style="padding:7px 0;color:#64748B;vertical-align:top;">Organization</td>
                <td style="padding:7px 0;color:#0F2747;font-weight:700;">${esc(orgDisplay)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;text-align:center;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="dv-btn" style="width:280px;background-color:#159A9C;border-radius:10px;">
              <tr>
                <td align="center" class="dv-btn-a" style="border-radius:10px;padding:15px 30px;">
                  <a href="${esc(setPasswordUrl)}" target="_blank"
                     style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.04em;color:#ffffff;text-decoration:none;">Set Your Password</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748B;text-align:center;">
        Set your password to activate your account and get started.
      </p>`;
    return {
      subject: `Welcome to DocuVault${orgName ? ` — ${orgName}` : ''} · set your password`,
      html: docuVaultShell({
        preheader: `Welcome to DocuVault${orgName ? ` — ${orgName}` : ''}. Set your password to activate your account.`,
        orgName,
        orgLogoUrl,
        contentHtml: content,
      }),
    };
  },

  secureDeliveryReady: ({ recipientName, docId, secureUrl, otpCode }) => ({
    subject: `A document (${docId}) requires your confirmation`,
    html: `<p>Hi ${recipientName || 'there'},</p>
      <p>A document requires confirmation before download.</p>
      <p><a href="${secureUrl}">Open the secure document link</a> (single-use, 7 days).</p>
      <p>Your one-time code: <b>${otpCode}</b> (expires in 5 minutes).</p>`,
  }),

  secureDeliveryPlainCopy: ({ docId }) => ({
    subject: `Document ${docId} (copy)`,
    html: `<p>Hi,</p><p>Please find a copy of your document attached (ID: <b>${docId}</b>).</p>`,
  }),

  deliveryOwned: ({ generatorName, docId, recipientName, reviewUrl }) => ({
    subject: `Document ${docId} confirmed by recipient`,
    html: `<p>Hi ${generatorName || 'there'},</p>
      <p><b>${recipientName || 'The recipient'}</b> confirmed document <b>${docId}</b>.</p>
      <p><a href="${reviewUrl}" style="display:inline-block;padding:10px 20px;background:#0F2747;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">View Submitted Document</a></p>`,
  }),

  ownershipRejected: ({ generatorName, docId, recipientName, reason }) => ({
    subject: `Document ${docId} was rejected by the recipient`,
    html: `<p>Hi ${generatorName || 'there'},</p>
      <p><b>${recipientName || 'The recipient'}</b> rejected document <b>${docId}</b>.</p>
      <p><b>Reason:</b> ${reason}</p>
      <p>Download link blocked. Please verify recipient and re-send.</p>`,
  }),

  ownershipRejectedWithLink: ({ generatorName, docId, recipientName, reason, reviewUrl }) => ({
    subject: `Document ${docId} was rejected by the recipient`,
    html: `<p>Hi ${generatorName || 'there'},</p>
      <p><b>${recipientName || 'The recipient'}</b> rejected document <b>${docId}</b>.</p>
      <p><b>Reason:</b> ${reason}</p>
      <p><a href="${reviewUrl}" style="display:inline-block;padding:10px 20px;background:#6366F1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Review Rejection &amp; Edit / Resubmit</a></p>`,
  }),
};

module.exports = { sendMail, templates };
