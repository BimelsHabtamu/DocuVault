/**
 * RecipientQrVerifyPage — /doc/:token/verify
 *
 * This page is opened on the PHONE after scanning the QR code.
 * It calls POST /api/access/:token/verify to mark the session as QR-verified,
 * then shows a simple confirmation.
 * The PC browser is polling and will automatically advance to the next stage.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

// Always use relative /api paths — the Vite proxy forwards them to localhost:5000.
// Works on PC (via proxy) AND on phone via ngrok (ngrok tunnels the full Vite dev server).
const API = '/api';

export default function RecipientQrVerifyPage() {
  const { token } = useParams();
  // status: loading | success | already | error
  const [status, setStatus] = useState('loading');
  const [docName, setDocName] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }

    // First load the session to get the document name for display
    fetch(`${API}/access/${token}`)
      .then(async r => {
        if (!r.ok) { setStatus('error'); return; }
        const data = await r.json();
        setDocName(data.template_name || 'Document');

        // Now mark as QR verified
        return fetch(`${API}/access/${token}/verify`, { method: 'POST' });
      })
      .then(async r => {
        if (!r) return; // already handled above
        const data = await r.json();
        if (!r.ok) { setStatus('error'); return; }
        setStatus(data.already_verified ? 'already' : 'success');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  const statusConfig = {
    loading: {
      bg:    'bg-indigo-50',
      icon:  (
        <svg className="animate-spin w-10 h-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      ),
      title: 'Verifying…',
      body:  'Please wait while we verify your identity.',
      color: 'text-indigo-700',
    },
    success: {
      bg:    'bg-emerald-50',
      icon:  (
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
          <svg className="w-9 h-9 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      ),
      title: '✓ Verification Complete',
      body:  'Your identity has been verified. Return to your computer — the document page has been automatically unlocked.',
      color: 'text-emerald-700',
    },
    already: {
      bg:    'bg-blue-50',
      icon:  (
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-9 h-9 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
      ),
      title: 'Already Verified',
      body:  'This document has already been verified. Return to your computer to access it.',
      color: 'text-blue-700',
    },
    error: {
      bg:    'bg-red-50',
      icon:  (
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-9 h-9 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
      ),
      title: 'Verification Failed',
      body:  'This link is invalid or has expired. Please ask the sender to resend the document.',
      color: 'text-red-700',
    },
  };

  const cfg = statusConfig[status];

  return (
    <div className={`min-h-screen ${cfg.bg} flex flex-col items-center justify-center px-5 py-12`}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center
          bg-gradient-to-br from-blue-500 to-indigo-600">
          <span className="text-white font-black text-sm">D</span>
        </div>
        <span className="font-bold text-lg text-gray-900">DocuVault</span>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-md
        w-full max-w-sm px-7 py-8 text-center space-y-4">
        <div className="flex justify-center">{cfg.icon}</div>

        {docName && status !== 'loading' && (
          <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded-lg px-3 py-1.5">
            {docName}
          </p>
        )}

        <h1 className={`text-lg font-bold ${cfg.color}`}>{cfg.title}</h1>
        <p className="text-sm text-gray-500 leading-relaxed">{cfg.body}</p>

        {(status === 'success' || status === 'already') && (
          <div className="mt-2 bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">
              You can now close this tab and return to the computer where you opened the document link.
            </p>
          </div>
        )}
      </div>

      <p className="mt-8 text-[11px] text-gray-400 text-center">
        Powered by DocuVault · Secure Document Management
      </p>
    </div>
  );
}
