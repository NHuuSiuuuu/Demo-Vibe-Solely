function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  const details = err.details || null;

  return res.status(status).json({ message, details });
}

module.exports = { errorHandler };
