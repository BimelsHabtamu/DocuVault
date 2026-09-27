import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../utils/roles';
import logo from '/public/logo.png';
import './WelcomePage.css';

export default function WelcomePage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [phase, setPhase] = useState('enter'); // enter → hold → exit

  useEffect(() => {
    // Wait for auth to settle before we know where to redirect
    if (isLoading) return;

    const destination = !user
      ? '/landing'
      : user.role === ROLES.RECIPIENT
        ? '/my-documents'
        : '/dashboard';

    // enter (0–600ms) → hold (600–1800ms) → exit fade (1800–2400ms) → navigate
    const holdTimer  = setTimeout(() => setPhase('exit'), 1800);
    const leaveTimer = setTimeout(() => navigate(destination, { replace: true }), 2400);

    return () => { clearTimeout(holdTimer); clearTimeout(leaveTimer); };
  }, [isLoading, user, navigate]);

  return (
    <div className={`wlc-root wlc-${phase}`}>
      {/* Animated background rings */}
      <div className="wlc-ring wlc-ring-1" />
      <div className="wlc-ring wlc-ring-2" />
      <div className="wlc-ring wlc-ring-3" />

      <div className="wlc-card">
        {/* Logo */}
        <div className="wlc-logo-wrap">
          <img src={logo} alt="DocuVault" className="wlc-logo" />
        </div>

        {/* Brand name */}
        <p className="wlc-welcome">Welcome to</p>
        <h1 className="wlc-title">DocuVault</h1>
        <p className="wlc-subtitle">Secure Sign Deliver</p>

        {/* Progress bar */}
        <div className="wlc-bar-track">
          <div className="wlc-bar-fill" />
        </div>
      </div>
    </div>
  );
}
