const express = require("express");
const {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);
router.post("/", authorize(ROLES.ADMIN, ROLES.MANAGER), createNotification);

module.exports = router;
