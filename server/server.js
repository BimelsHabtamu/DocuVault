const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');
const fs      = require('fs');

dotenv.config();

// ── Mandatory environment variable check ─────────────────────────────────────
// Runs before anything else. Crashes loudly on missing critical config so the
// developer fixes it immediately rather than discovering it at runtime.
(function checkEnv() {
  const REQUIRED = [
    ['JWT_SECRET',            'Used to sign auth tokens. Use a long random string.'],
    ['DOWNLOAD_TOKEN_SECRET', 'Used to sign delivery download tokens.'],
    ['MAIL_HOST',             'SMTP host  — e.g. smtp.gmail.com'],
    ['MAIL_PORT',             'SMTP port  — e.g. 587'],
    ['MAIL_USER',             'SMTP login — your sending email address'],
    ['MAIL_PASS',             'SMTP password / App Password for Gmail'],
    ['CLIENT_URL',            'Frontend URL — e.g. http://localhost:5173'],
  ];

  const missing = REQUIRED.filter(([key]) => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('  ✗  DocuVault — Missing required environment variables');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    missing.forEach(([key, hint]) => {
      console.error(`  ${key}`);
      console.error(`      → ${hint}\n`);
    });
    console.error('  Edit server/.env and add the missing values, then restart.\n');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
})();

const app = express();

// ── FR-026: Clock consistency check ──────────────────────────────────────────
// Compares Node.js process clock against the MySQL server clock at startup.
// Warns if drift > 5 seconds. All security-critical timestamps (approved_at,
// audit_logs.timestamp, otp_expiry, otp_locked_until) use MySQL NOW() so they
// are mutually consistent. True NTP sync must be done at OS level:
//   Windows: w32tm /resync   Linux: timedatectl set-ntp true
async function checkClockDrift(db) {
  try {
    const [[row]] = await db.query('SELECT UTC_TIMESTAMP() AS db_utc');
    const nodeUtc  = new Date();
    const dbUtc    = new Date(row.db_utc);
    const driftSec = Math.round(Math.abs(nodeUtc - dbUtc) / 1000);
    if (driftSec > 5) {
      console.error(`\n  ⚠  CLOCK DRIFT: Node=${nodeUtc.toISOString()} DB=${dbUtc.toISOString()} diff=${driftSec}s`);
      console.error(`     Fix: sync OS clock with NTP (Windows: w32tm /resync | Linux: timedatectl set-ntp true)\n`);
    } else {
      console.log(`  ✓  Clock check — Node↔MySQL drift: ${driftSec}s (UTC)`);
    }
  } catch (err) {
    console.warn(`  ⚠  Clock check skipped: ${err.message}`);
  }
}

const pdfDir = path.join(__dirname, 'storage/pdfs');
const uplDir = path.join(__dirname, 'storage/uploads');
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
if (!fs.existsSync(uplDir)) fs.mkdirSync(uplDir, { recursive: true });
if (!fs.existsSync(path.join(uplDir, 'signatures'))) fs.mkdirSync(path.join(uplDir, 'signatures'), { recursive: true });

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(uplDir));

app.get('/', (req, res) => {
  res.json({
    status:  'ok',
    message: 'PDF Engine API is running',
    version: '1.0.0',
    routes: [
      'POST   /api/auth/login',
      'GET    /api/auth/me',
      'GET    /api/users/me/settings',
      'PUT    /api/users/me/settings',
      'POST   /api/users/me/change-email',
      'GET    /api/users/verify-email',
      'POST   /api/users/me/cancel-email-change',
      'POST   /api/users/me/resend-email-verification',
      'POST   /api/users/me/avatar',
      'POST   /api/users/me/signature',
      'POST   /api/users/change-password',
      'GET    /api/users',
      'POST   /api/users',
      'GET    /api/templates',
      'POST   /api/templates',
      'POST   /api/documents/generate',
      'POST   /api/documents/preview',
      'GET    /api/documents',
      'POST   /api/esign/request',
      'POST   /api/esign/otp/send',
      'POST   /api/esign/otp/verify',
      'POST   /api/esign/approve',
      'POST   /api/esign/reject',
      'GET    /api/esign/pending',
      'POST   /api/delivery/deliver',
      'GET    /api/delivery/download',
      'GET    /api/verify/:doc_uuid',
      'POST   /api/verify/upload',
      'GET    /api/audit',
      'GET    /api/audit/dashboard',
    ]
  });
});

app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/users',         require('./routes/userRoutes'));
app.use('/api/settings',      require('./routes/settingsRoutes'));
app.use('/api/templates',     require('./routes/templateRoutes'));
app.use('/api/documents',     require('./routes/documentRoutes'));
app.use('/api/esign',         require('./routes/esignRoutes'));
app.use('/api/delivery',      require('./routes/deliveryRoutes'));
app.use('/api/verify',        require('./routes/verifyRoutes'));
app.use('/api/audit',         require('./routes/auditRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/upload',        require('./routes/uploadRoutes'));
app.use('/api/recipient',     require('./routes/recipientRoutes'));
app.use('/api/access',        require('./routes/recipientAccessRoutes'));
app.use('/api/datasource',    require('./routes/datasourceRoutes'));

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

// ── Global error handler ───────────────────────────────────────────────────
// Must have 4 parameters so Express recognises it as an error handler.
// Maps multer LIMIT_FILE_SIZE errors to HTTP 413 (BR-002) so the client
// receives a clear response instead of a generic 500.
app.use((err, req, res, next) => {
  // Multer file-size limit exceeded (BR-002)
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: `File too large. Maximum allowed size is 5 MB (BR-002).`,
    });
  }
  // Multer unexpected field or other multer error
  if (err && err.name === 'MulterError') {
    return res.status(400).json({
      message: `Upload error: ${err.message}`,
    });
  }
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`\n  ✓  DocuVault server running on http://localhost:${PORT}`);

  // ── Verify SMTP connection on startup ──────────────────────────────────
  // If mail credentials are wrong, log a clear error immediately so the
  // developer knows emails will fail before they run any workflow.
  try {
    const nodemailer = require('nodemailer');
    const testTransport = nodemailer.createTransport({
      host:   process.env.MAIL_HOST,
      port:   Number(process.env.MAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
    await testTransport.verify();
    console.log(`  ✓  SMTP connected — emails ready (${process.env.MAIL_USER})`);
  } catch (smtpErr) {
    console.error(`\n  ✗  SMTP connection FAILED: ${smtpErr.message}`);
    console.error(`     Host: ${process.env.MAIL_HOST}:${process.env.MAIL_PORT}`);
    console.error(`     User: ${process.env.MAIL_USER}`);
    console.error(`     Fix your MAIL_* credentials in server/.env\n`);
    // Do NOT exit — server still works but emails will throw at send time
  }

  require('./services/escalationService').startEscalationJob();
  console.log(`  ✓  Escalation job started`);

  require('./services/archiveService').startArchiveJob();
  console.log(`  ✓  Archive job started (FR-040)\n`);

  // FR-026: Check Node↔MySQL clock drift on startup
  const db = require('./config/db');
  await checkClockDrift(db);
});
