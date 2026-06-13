const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const authorize = (...roles) => {
  return asyncHandler((req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "You do not have permission to perform this action.");
    }
    next();
  });
};

module.exports = authorize;

