const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Internal Server Error";
  let errorDetails = null;

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `${field} already exists.`;
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    errorDetails = Object.values(err.errors || {}).map((e) => e.message);
    message = errorDetails.length ? errorDetails.join(", ") : "Validation failed.";
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired.";
  }

  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    statusCode = 400;
    message = "Invalid JSON payload.";
  }

  if (statusCode < 400) {
    statusCode = 500;
  }

  if (statusCode >= 500) {
    console.error(`[${statusCode}] ${message}`, err);
    message = process.env.NODE_ENV === "production" ? "Internal Server Error" : message;
  } else {
    console.warn(`[${statusCode}] ${message}`);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(errorDetails && { errors: errorDetails }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
