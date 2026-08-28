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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uplDir));

app.get('/', (req, res) => {
  res.json({
    status:  'ok',
    message: 'PDF Engine API is running',
    version: '1.0.0',
    routes: [
      'POST   /api/auth/login',
      'GET    /api/auth/me',
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

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

app.use((err, req, res, next) => {
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
  console.log(`  ✓  Escalation job started\n`);
});
