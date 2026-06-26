const express = require("express");
const {
  getAlerts,
  getAlertById,
  getUnresolvedAlerts,
  resolveAlert,
  getAlertStats,
  getServiceAlerts,
  createAlert,
  bulkResolveAlerts,
} = require("../controllers/alertController");
const { protect } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(protect);

router.get("/", getAlerts);
router.get("/unresolved/list", getUnresolvedAlerts);
router.get("/stats/summary", getAlertStats);
router.get("/service/list", getServiceAlerts);
router.get("/:id", getAlertById);
router.post("/", authorize(ROLES.ADMIN, ROLES.MANAGER), createAlert);
router.put("/:id/resolve", resolveAlert);
router.post("/bulk/resolve", authorize(ROLES.ADMIN, ROLES.MANAGER), bulkResolveAlerts);

module.exports = router;
