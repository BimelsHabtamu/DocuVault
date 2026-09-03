const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST,
  port:   Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

function brand(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:#111827;padding:20px 28px;display:flex;align-items:center;gap:12px">
      <div style="width:32px;height:32px;background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:8px;display:flex;align-items:center;justify-content:center">
        <span style="color:#fff;font-weight:700;font-size:14px">D</span>
      </div>
      <span style="color:#fff;font-weight:700;font-size:16px">DocuVault</span>
    </div>
    <div style="padding:28px">${body}</div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">
      This is an automated message from DocuVault — Internal Document System.<br/>Do not reply to this email.
    </div>
  </div></body></html>`;
}

function h(text) { return `<h2 style="margin:0 0 12px;font-size:18px;color:#111827">${text}</h2>`; }
function p(text) { return `<p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6">${text}</p>`; }
function docBadge(uuid) { return `<div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin:12px 0;font-family:monospace;font-size:13px;color:#1d4ed8">${uuid}</div>`; }
function btn(text, url) { return `<a href="${url}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;margin-top:8px">${text}</a>`; }

const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

async function send(to, subject, html) {
  // Email is mandatory — always attempt real delivery.
  // If MAIL_USER is missing the server startup check in server.js will have warned already.
  await transporter.sendMail({
    from:    `"DocuVault" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
}

async function sendOtpEmail(toEmail, approverName, otp, docUuid) {
  await send(toEmail, `OTP Code for Document ${docUuid}`,
    brand('OTP for Signature',
      h('Your One-Time Password') +
      p(`Hello <strong>${approverName}</strong>, you have been requested to sign document:`) +
      docBadge(docUuid) +
      p('Your 6-digit OTP is:') +
      `<div style="font-size:32px;font-weight:900;letter-spacing:8px;color:#1d4ed8;margin:16px 0">${otp}</div>` +
      p('<strong>This OTP expires in 5 minutes.</strong> Do not share it with anyone.')
    )
  );
}

async function sendDocReadyEmail(toEmail, approverName, docUuid, generatorName) {
  await send(toEmail, `Action Required: Document ${docUuid} needs your signature`,
    brand('Signature Request',
      h('Document Ready for Your Signature') +
      p(`Hello <strong>${approverName}</strong>,`) +
      p(`<strong>${generatorName}</strong> has requested your e-signature on the following document:`) +
      docBadge(docUuid) +
      p('Please log in to DocuVault to review and sign this document.') +
      btn('Review & Sign Document', `${baseUrl}/approvals`)
    )
  );
}

// ── FR-022 + FR-023 combined: signature request email with review link + OTP ──
// reviewLink = /review/:raw_token  — opens the PDF review page directly.
// otp = 6-digit code the approver enters on that page to confirm identity.
async function sendSignatureRequestWithOtpEmail(toEmail, approverName, docUuid, generatorName, otp, reviewLink) {
  const actionUrl = reviewLink || `${baseUrl}/approvals`;
  await send(toEmail, `Action Required: Review & Sign Document ${docUuid}`,
    brand('Signature Request + OTP',
      h('Document Ready for Your Signature') +
      p(`Hello <strong>${approverName}</strong>,`) +
      p(`<strong>${generatorName}</strong> has requested your e-signature on the following document:`) +
      docBadge(docUuid) +
      `<div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:10px;
        padding:16px 20px;margin:16px 0">
        <p style="margin:0 0 8px;font-size:13px;color:#374151;font-weight:600">
          Your One-Time Password (OTP)
        </p>
        <div style="font-size:34px;font-weight:900;letter-spacing:10px;color:#1d4ed8;
          margin:8px 0">${otp}</div>
        <p style="margin:8px 0 0;font-size:12px;color:#6b7280">
          ⏱ Valid for <strong>24 hours</strong>. Do not share this code with anyone.
        </p>
      </div>` +
      p('How to sign this document:') +
      `<ol style="font-size:13px;color:#374151;line-height:1.8;padding-left:20px;margin:0 0 16px">
        <li>Click <strong>"Review &amp; Sign Document"</strong> below.</li>
        <li>Read the PDF carefully in the browser.</li>
        <li>Enter the <strong>6-digit OTP</strong> shown above to confirm your identity.</li>
        <li>Click <strong>Approve &amp; Sign</strong> — or <strong>Reject</strong> with a reason.</li>
      </ol>` +
      btn('Review &amp; Sign Document →', actionUrl) +
      p('<span style="font-size:11px;color:#9ca3af">This link is personal and expires in 24 hours. If you did not expect this request, please contact your system administrator.</span>')
    )
  );
}

async function sendDocSignedEmail(toEmail, generatorName, docUuid, approverName) {
  await send(toEmail, `Document ${docUuid} has been signed`,
    brand('Document Signed',
      h('✓ Document Signed Successfully') +
      p(`Hello <strong>${generatorName}</strong>,`) +
      p(`Your document has been digitally signed by <strong>${approverName}</strong>.`) +
      docBadge(docUuid) +
      p('You can now deliver this document to the recipient.') +
      btn('View Document', `${baseUrl}/documents`)
    )
  );
}

async function sendDocRejectedEmail(toEmail, generatorName, docUuid, approverName, reason) {
  await send(toEmail, `Document ${docUuid} has been rejected`,
    brand('Document Rejected',
      h('✗ Document Rejected') +
      p(`Hello <strong>${generatorName}</strong>,`) +
      p(`Your document has been rejected by <strong>${approverName}</strong>.`) +
      docBadge(docUuid) +
      `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;margin:12px 0"><strong style="color:#dc2626">Rejection Reason:</strong><br/><span style="color:#374151;font-size:13px">${reason}</span></div>` +
      p('The document has been reverted to Draft status. Please make the necessary corrections and resubmit.') +
      btn('View Document', `${baseUrl}/documents`)
    )
  );
}

async function sendDeliveryEmail(toEmail, recipientName, docUuid, downloadLink, pdfPath) {
  const attachments = pdfPath && require('fs').existsSync(pdfPath)
    ? [{ path: pdfPath, filename: `${docUuid}.pdf` }] : [];
  const html = brand('Document Delivery',
    h('Your Document is Ready') +
    p(`Hello <strong>${recipientName || toEmail}</strong>,`) +
    p('A document has been prepared and delivered to you from DocuVault.') +
    docBadge(docUuid) +
    btn('Download Document', downloadLink) +
    p('<span style="font-size:12px;color:#9ca3af">This download link expires in 7 days.</span>')
  );
  await transporter.sendMail({
    from:        `"DocuVault" <${process.env.MAIL_USER}>`,
    to:          toEmail,
    subject:     `Your Document ${docUuid} is Ready`,
    html,
    attachments,
  });
}

async function sendRejectionEmail(toEmail, generatorName, docUuid, reason) {
  await sendDocRejectedEmail(toEmail, generatorName, docUuid, 'an approver', reason);
}

async function send24hrReminderEmail(toEmail, approverName, docUuid) {
  await send(toEmail, `Reminder: Document ${docUuid} awaiting your signature (24h)`,
    brand('Signature Reminder',
      h('⏰ Reminder: Document Awaiting Signature') +
      p(`Hello <strong>${approverName}</strong>,`) +
      p('This is a reminder that the following document has been waiting for your signature for <strong>24 hours</strong>:') +
      docBadge(docUuid) +
      p('Please review and sign at your earliest convenience.') +
      btn('Review & Sign Now', `${baseUrl}/approvals`)
    )
  );
}

async function send72hrEscalationEmail(toEmail, name, docUuid, role) {
  await send(toEmail, `Escalation: Document ${docUuid} unsigned for 72 hours`,
    brand('Signature Escalation',
      h('🚨 Document Unsigned for 72 Hours') +
      p(`Hello <strong>${name}</strong>,`) +
      p(`The following document has been <strong>unsigned for 72 hours</strong> and requires immediate attention:`) +
      docBadge(docUuid) +
      (role === 'approver'
        ? p('Please sign this document as soon as possible to avoid further escalation.') + btn('Sign Now', `${baseUrl}/approvals`)
        : p('This document was sent for signature 72 hours ago and has not been signed yet.') + btn('View Status', `${baseUrl}/documents`)
      )
    )
  );
}

// ── NEW RECIPIENT ACCOUNT: Set Password + Access Document ────────────────────
// Sent when recipient email does NOT exist → auto-created account (Option C)
async function sendSetPasswordEmail(toEmail, recipientName, setPasswordLink, docUuid) {
  await send(toEmail, `Set your password to access your document on DocuVault`,
    brand('Welcome to DocuVault',
      h('A document has been shared with you') +
      p(`Hello <strong>${recipientName || toEmail}</strong>,`) +
      p('A document has been prepared and delivered to you through DocuVault. To access it, you need to set a password for your new account.') +
      docBadge(docUuid) +
      `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:16px 0">
        <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#1d4ed8">Step 1 — Set your password</p>
        <p style="margin:0 0 12px;font-size:13px;color:#374151">Click the button below to create your password. This link expires in <strong>48 hours</strong>.</p>
        <a href="${setPasswordLink}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600">Set My Password & View Document →</a>
      </div>` +
      `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:12px 0">
        <p style="margin:0;font-size:13px;font-weight:600;color:#16a34a">Step 2 — After setting your password</p>
        <p style="margin:4px 0 0;font-size:13px;color:#374151">You will be automatically taken to your document where you can scan the QR code to verify its authenticity and download it.</p>
      </div>` +
      p('<span style="font-size:12px;color:#9ca3af">If you did not expect this email, please ignore it. No account will be activated without setting a password.</span>')
    )
  );
}

// ── EXISTING RECIPIENT ACCOUNT: Login + Document Link ────────────────────────
// Sent when recipient email already EXISTS in the system (Option C)
async function sendDocumentAccessEmail(toEmail, recipientName, loginLink, docUuid) {
  await send(toEmail, `Your document ${docUuid} is ready on DocuVault`,
    brand('Document Ready',
      h('Your Document is Ready') +
      p(`Hello <strong>${recipientName || toEmail}</strong>,`) +
      p('A document has been prepared and delivered to you through DocuVault.') +
      docBadge(docUuid) +
      p('Log in to your DocuVault account to view, verify, and download your document.') +
      btn('View My Document →', loginLink) +
      p('<span style="font-size:12px;color:#9ca3af">You will be taken directly to your document after logging in.</span>')
    )
  );
}

// ── SUPER ADMIN DOWNLOAD NOTIFICATION ────────────────────────────────────────
// Sent to all super_admins when a recipient downloads a document
async function sendAdminDownloadNotificationEmail(toEmail, adminName, recipientName, recipientEmail, docUuid, downloadedAt) {
  const timeStr = new Date(downloadedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });
  await send(toEmail, `Document ${docUuid} was downloaded by recipient`,
    brand('Download Notification',
      h('📥 Recipient Downloaded a Document') +
      p(`Hello <strong>${adminName}</strong>,`) +
      p('A recipient has downloaded their document. Details below:') +
      docBadge(docUuid) +
      `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px">
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:8px 0;color:#6b7280;width:140px">Recipient Name</td>
          <td style="padding:8px 0;color:#111827;font-weight:600">${recipientName || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:8px 0;color:#6b7280">Recipient Email</td>
          <td style="padding:8px 0;color:#111827">${recipientEmail}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280">Downloaded At</td>
          <td style="padding:8px 0;color:#111827">${timeStr}</td>
        </tr>
      </table>` +
      btn('View Delivery Logs', `${baseUrl}/delivery-logs`)
    )
  );
}

// ── EMAIL CHANGE VERIFICATION ─────────────────────────────────────────────────
// Sent to the NEW email address when a user requests an email change.
// The old email stays active until this link is clicked.
async function sendEmailVerificationEmail(toNewEmail, userName, verifyLink, oldEmail) {
  await send(
    toNewEmail,
    'Verify your new email address — DocuVault',
    brand('Email Verification',
      h('Verify Your New Email Address') +
      p(`Hello <strong>${userName}</strong>,`) +
      p('You requested to change your DocuVault email address. Click the button below to confirm this is really you.') +
      `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;
        padding:14px 16px;margin:16px 0">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280">Changing from</p>
        <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151">${oldEmail}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280">Changing to</p>
        <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#1d4ed8">${toNewEmail}</p>
        <a href="${verifyLink}"
          style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
            padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600">
          Confirm New Email Address →
        </a>
      </div>` +
      p('<strong>This link expires in 24 hours.</strong>') +
      p('<span style="font-size:12px;color:#9ca3af">If you did not request this change, you can safely ignore this email. Your current email address will remain unchanged.</span>')
    )
  );
}

// ── RECIPIENT DELIVERY EMAIL (no-login token-based access) ───────────────────
// Sent to ANY recipient email when a generator delivers a document.
// The recipient does NOT need a DocuVault account.
// The link opens /doc/:rawToken — a public page that gates access behind
// QR verification + explicit ON toggle before revealing View/Download.
async function sendRecipientDeliveryEmail(toEmail, recipientName, docName, docUuid, accessLink) {
  await send(
    toEmail,
    `You have received a document — DocuVault`,
    brand('Document Delivery',
      h('You Have Received a Document') +
      p(`Hello <strong>${recipientName || toEmail}</strong>,`) +
      p('A document has been securely prepared and delivered to you through DocuVault.') +
      `<div style="background:#f8faff;border:1px solid #c7d2fe;border-radius:10px;
        padding:16px 20px;margin:16px 0">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr>
            <td style="padding:5px 0;color:#6b7280;width:130px;vertical-align:top">Document</td>
            <td style="padding:5px 0;color:#111827;font-weight:600">${docName}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#6b7280;vertical-align:top">Document ID</td>
            <td style="padding:5px 0;font-family:monospace;font-size:12px;color:#1d4ed8">${docUuid}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#6b7280;vertical-align:top">Recipient</td>
            <td style="padding:5px 0;color:#111827">${recipientName || toEmail}</td>
          </tr>
        </table>
      </div>` +
      p('Click the button below to securely access your document. You will be asked to verify your identity using your phone\'s camera before the document becomes available.') +
      `<div style="text-align:center;margin:24px 0">
        <a href="${accessLink}"
          style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
            padding:13px 32px;border-radius:10px;font-size:14px;font-weight:700;
            letter-spacing:0.01em">
          Open Document →
        </a>
      </div>` +
      `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;
        padding:12px 16px;margin:16px 0">
        <p style="margin:0;font-size:12px;color:#92400e">
          🔒 <strong>Secure Access:</strong> This link is unique to you.
          You will need to scan a QR code with your phone to verify the document before downloading.
          This link expires in <strong>7 days</strong>.
        </p>
      </div>` +
      p('<span style="font-size:11px;color:#9ca3af">If you were not expecting this document, you can safely ignore this email.</span>')
    )
  );
}
// Sent to the user's current email after a successful password change.
// Security alert — lets them know if someone else changed it.
async function sendPasswordChangedEmail(toEmail, userName) {
  const timeStr = new Date().toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });
  await send(
    toEmail,
    'Your DocuVault password was changed',
    brand('Password Changed',
      h('Your Password Was Changed') +
      p(`Hello <strong>${userName}</strong>,`) +
      p(`Your DocuVault account password was successfully changed on <strong>${timeStr}</strong>.`) +
      `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;
        padding:12px 16px;margin:16px 0;display:flex;align-items:flex-start;gap:10px">
        <span style="font-size:18px;line-height:1">⚠️</span>
        <p style="margin:0;font-size:13px;color:#92400e">
          <strong>Was this you?</strong> If you made this change, no action is needed.<br/>
          If you did <strong>not</strong> change your password, contact your system administrator immediately.
        </p>
      </div>` +
      btn('Go to DocuVault', `${baseUrl}/login`)
    )
  );
}

module.exports = {
  sendOtpEmail,
  sendDocReadyEmail,
  sendSignatureRequestWithOtpEmail,
  sendDocSignedEmail,
  sendDocRejectedEmail,
  sendDeliveryEmail,
  sendRejectionEmail,
  send24hrReminderEmail,
  send72hrEscalationEmail,
  sendSetPasswordEmail,
  sendDocumentAccessEmail,
  sendAdminDownloadNotificationEmail,
  sendEmailVerificationEmail,
  sendPasswordChangedEmail,
  sendRecipientDeliveryEmail,
};
