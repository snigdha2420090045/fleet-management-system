const express = require("express");
const {
  getRepairLogs,
  createRepairLog,
  updateRepairLog,
} = require("../controllers/repairLogController");
const { protect } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(protect);

router.get("/", getRepairLogs);
router.post("/", authorize(ROLES.ADMIN, ROLES.MANAGER), createRepairLog);
router.put("/:id", authorize(ROLES.ADMIN, ROLES.MANAGER), updateRepairLog);

module.exports = router;
