const express = require("express");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const craneRoutes = require("./craneRoutes");
const fuelLogRoutes = require("./fuelLogRoutes");
const repairLogRoutes = require("./repairLogRoutes");
const trackingLogRoutes = require("./trackingLogRoutes");
const notificationRoutes = require("./notificationRoutes");
const alertRoutes = require("./alertRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/cranes", craneRoutes);
router.use("/fuel-logs", fuelLogRoutes);
router.use("/repair-logs", repairLogRoutes);
router.use("/tracking-logs", trackingLogRoutes);
router.use("/notifications", notificationRoutes);
router.use("/alerts", alertRoutes);

module.exports = router;

