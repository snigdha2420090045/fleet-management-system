const express = require("express");
const {
  getFuelLogs,
  createFuelLog,
  getFuelAnalytics,
} = require("../controllers/fuelLogController");
const { protect } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(protect);

router.get("/analytics", authorize(ROLES.ADMIN, ROLES.MANAGER), getFuelAnalytics);
router.get("/", getFuelLogs);
router.post("/", authorize(ROLES.ADMIN, ROLES.MANAGER), createFuelLog);

module.exports = router;
