const express = require("express");
const { body, query } = require("express-validator");
const {
  getTrackingLogs,
  createTrackingLog,
  getLiveLocations,
} = require("../controllers/trackingLogController");
const { protect } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { ROLES, ENGINE_STATUS, TRACKING_SOURCE } = require("../config/constants");

const router = express.Router();

router.use(protect);

const validateGetLogs = [
  query("craneId").notEmpty().withMessage("craneId query parameter is required"),
  query("from").optional().isISO8601().withMessage("from must be valid ISO date"),
  query("to").optional().isISO8601().withMessage("to must be valid ISO date"),
  query("limit").optional().isInt({ min: 1, max: 1000 }).withMessage("limit must be 1-1000"),
];

const validateCreateLog = [
  body("crane").isMongoId().withMessage("Valid crane ID is required"),
  body("coordinates").isArray({ min: 2, max: 2 }).withMessage("Coordinates must be [lng, lat]"),
  body("coordinates.*").isFloat().withMessage("Coordinates must contain numeric values"),
  body("coordinates.0").isFloat({ min: -180, max: 180 }).withMessage("Longitude must be between -180 and 180"),
  body("coordinates.1").isFloat({ min: -90, max: 90 }).withMessage("Latitude must be between -90 and 90"),
  body("speed").optional().isFloat({ min: 0 }).withMessage("Speed must be >= 0"),
  body("engineStatus")
    .optional()
    .isIn(Object.values(ENGINE_STATUS))
    .withMessage(`Engine status must be one of: ${Object.values(ENGINE_STATUS).join(", ")}`),
  body("fuelLevel").optional().isFloat({ min: 0, max: 100 }).withMessage("Fuel level must be 0-100"),
  body("source")
    .optional()
    .isIn(Object.values(TRACKING_SOURCE))
    .withMessage(`Source must be one of: ${Object.values(TRACKING_SOURCE).join(", ")}`),
];

router.get("/live", getLiveLocations);
router.get("/", validateGetLogs, validate, getTrackingLogs);
router.post("/", authorize(ROLES.ADMIN, ROLES.MANAGER), validateCreateLog, validate, createTrackingLog);

module.exports = router;
