/**
 * FaqPage — /faq
 * All-roles help page. No login required to access (but kept behind ProtectedRoute
 * so the sidebar is visible). Each FAQ item is an accordion panel.
 */

import { useState } from 'react';

const FAQS = [
  {
    q: 'How do I generate a document?',
    a: `Go to "My Documents" in the sidebar. Select an active template from the
        dropdown, enter the Record ID (e.g. Employee ID) for the person the document
        is for, click "Preview" to see the filled-in content, then click "Generate"
        to produce the final PDF. A dialog will immediately ask you to assign an
        approver — complete that step so the document can move forward.`,
  },
  {
    q: 'How do I request an e-signature (send for approval)?',
    a: `After generating a document you are prompted to select an approver right away.
        If you skipped that step, open "Document Tracking", find the document with
        status Draft, and click the "Assign Approver" action. The system sends the
        approver a one-time secure review link by email.`,
  },
  {
    q: 'How does OTP approval work?',
    a: `When a document is sent for approval, the assigned approver receives an email
        with a one-time review link. Opening that link asks for a 6-digit OTP that is
        emailed separately. After entering the correct OTP the approver can read the
        full PDF, then choose Approve or Reject. The OTP expires after 15 minutes;
        after 3 failed attempts the link is locked for 15 minutes.`,
  },
  {
    q: 'How do I approve or reject a document?',
    a: `Approvers see pending requests under "Pending Approvals" in the sidebar, or by
        clicking the link in the notification email. Open the request, enter the OTP,
        review the PDF, then click Approve or Reject. A rejection requires a reason
        which is forwarded to the document generator.`,
  },
  {
    q: 'How does Secure Delivery work?',
    a: `After a document is approved and signed, the generator can send it to the
        recipient via "Document Tracking → Deliver". The recipient receives a one-time
        secure link by email. They open the link, verify their identity with an OTP,
        preview the PDF, confirm or reject ownership, then download the document.
        The link is single-use and expires after 7 days.`,
  },
  {
    q: 'How do I verify a document?',
    a: `Go to "Verify Document" in the sidebar (no account required). You can verify
        by typing the Document ID printed in the PDF footer (format: DOC-YYYYMMDD-XXXXX),
        or by uploading the PDF file itself. The system recomputes the SHA-256 hash and
        compares it to the original — reporting Authentic, Tampered, or Revoked.`,
  },
  {
    q: 'What does the QR code on the document mean?',
    a: `Every generated PDF contains two QR codes in the footer. The left QR encodes
        a JSON payload containing the Document ID, the issue timestamp, a SHA-256
        content hash, and the verification URL — scanning it lets anyone verify the
        document's authenticity. The right QR encodes an opaque delivery ID and
        reports VALID / REVOKED / INVALID instantly when scanned.`,
  },
  {
    q: 'How do I change my profile or password?',
    a: `Click "My Settings → Profile" in the sidebar (visible to every role). You can
        upload a new profile photo, update your name, email address, or phone number,
        and change your password. Your current password is required to set a new one.
        Changes take effect immediately.`,
  },
  {
    q: 'How do I switch between Light and Dark mode?',
    a: `Click "Theme" at the bottom of the sidebar, or use the toggle button (☀/🌙)
        in the top navigation bar. Your preference is saved locally and persists
        across sessions and page refreshes.`,
  },
  {
    q: 'Who do I contact for system support?',
    a: `Contact your System Administrator. They can manage user accounts, reset
        passwords, configure templates, and adjust system settings. If you do not
        know who that is, contact your organisation's IT department.`,
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item${open ? ' faq-item-open' : ''}`}>
      <button type="button" className="faq-question" onClick={() => setOpen((o) => !o)}
        aria-expanded={open}>
        <span>{q}</span>
        <svg className="faq-chevron" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="faq-answer">{a}</div>}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="faq-page">
      <h1 className="faq-page-title">FAQ &amp; Help Center</h1>
      <p className="faq-page-subtitle">
        Answers to common questions about using DocuVault.
      </p>
      <div className="faq-list">
        {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
      </div>
    </div>
  );
}
