function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Centralized error handler — never leaks stack traces in production.
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({ message: `That ${field || 'value'} is already in use.` });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier.' });
  }
  if (err instanceof (require('multer').MulterError)) {
    return res.status(400).json({ message: err.message });
  }

  const status = err.statusCode || 500;
  const message = status === 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message;
  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };
