const express = require("express");
const { body, param } = require("express-validator");
const {
  getCranes,
  getCraneById,
  createCrane,
  updateCrane,
  deleteCrane,
  getDashboardKPIs,
  getLiveTracking,
  getVehicleAlerts,
  getBreakdownPrediction,
} = require("../controllers/craneController");
const { protect } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { ROLES, CRANE_STATUS } = require("../config/constants");

const router = express.Router();

router.use(protect);

const validateCrane = [
  body("registrationNumber").trim().notEmpty().withMessage("Registration number is required"),
  body("model").trim().notEmpty().withMessage("Model is required"),
  body("manufacturer").trim().optional(),
  body("year").optional().isInt({ min: 1900, max: 2100 }).withMessage("Year must be valid"),
  body("status")
    .optional()
    .isIn(Object.values(CRANE_STATUS))
    .withMessage(`Status must be one of: ${Object.values(CRANE_STATUS).join(", ")}`),
  body("fuelLevel").optional().isFloat({ min: 0, max: 100 }).withMessage("Fuel level must be 0-100"),
  body("engineHealth").optional().isFloat({ min: 0, max: 100 }).withMessage("Engine health must be 0-100"),
  body("batteryHealth").optional().isFloat({ min: 0, max: 100 }).withMessage("Battery health must be 0-100"),
  body("location.coordinates").optional().isArray({ min: 2, max: 2 }).withMessage("Coordinates must be [lng, lat]"),
  body("location.coordinates.*").optional().isFloat().withMessage("Coordinates must contain numeric values"),
  body("location.coordinates.0")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),
  body("location.coordinates.1")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),
];

const validateCraneId = param("id").isMongoId().withMessage("Invalid crane ID");

router.get("/dashboard/kpis", getDashboardKPIs);
router.get("/tracking/live", getLiveTracking);
router.get("/:id/prediction", validateCraneId, validate, getBreakdownPrediction);
router.get("/:id/alerts", validateCraneId, validate, getVehicleAlerts);
router.get("/", getCranes);
router.get("/:id", validateCraneId, validate, getCraneById);
router.post("/", authorize(ROLES.ADMIN), validateCrane, validate, createCrane);
router.put("/:id", authorize(ROLES.ADMIN), validateCraneId, validateCrane, validate, updateCrane);
router.delete("/:id", authorize(ROLES.ADMIN), validateCraneId, validate, deleteCrane);

module.exports = router;
