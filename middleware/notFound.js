const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const notFound = asyncHandler((req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
});

module.exports = notFound;

