
const AppError = require('../utils/AppError');

function notFoundHandler(req, res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  // Default to 500 for anything that isn't an AppError
  let statusCode = err.statusCode || 500;
  let errorCode  = err.errorCode  || 'INTERNAL_ERROR';
  let message    = err.message    || 'Something went wrong';
  let meta       = err.meta       || null;


  // MySQL duplicate-entry error (ER_DUP_ENTRY)
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    errorCode  = 'DUPLICATE_ENTRY';
    message    = 'A record with that value already exists.';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode  = 'INVALID_TOKEN';
    message    = 'Invalid or malformed token.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode  = 'TOKEN_EXPIRED';
    message    = 'Your session has expired. Please log in again.';
  }

  // Multer file-size limit
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorCode  = 'FILE_TOO_LARGE';
    message    = 'Uploaded file exceeds the size limit.';
  }

  // SyntaxError in JSON body parsing
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode  = 'INVALID_JSON';
    message    = 'Request body contains invalid JSON.';
  }

  // ── Log non-operational (unexpected) errors at error level ───────────────
  const isOperational = err.isOperational === true;
  if (!isOperational) {
    console.error('[ErrorMiddleware] Unexpected error:', err);
  }

  const body = {
    success:   false,
    errorCode,
    message,
    ...(meta && { meta }),
  };

  // Expose stack trace only in development to avoid information leakage
  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = { errorHandler, notFoundHandler };
