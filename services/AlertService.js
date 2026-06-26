const { NOTIFICATION_TYPES } = require("../config/constants");
const Alert = require("../models/Alert");
const Notification = require("../models/Notification");
const User = require("../models/User");

class AlertService {
  static generateCraneAlerts(crane, update) {
    const alerts = [];

    if (update.fuelLevel < 20) {
      alerts.push({
        craneId: crane._id,
        registrationNumber: crane.registrationNumber,
        type: NOTIFICATION_TYPES.FUEL,
        severity: "warning",
        message: `Crane ${crane.registrationNumber}: Low fuel (${update.fuelLevel.toFixed(1)}%)`,
      });
    }

    if (update.engineHealth < 60) {
      alerts.push({
        craneId: crane._id,
        registrationNumber: crane.registrationNumber,
        type: NOTIFICATION_TYPES.WARNING,
        severity: "critical",
        message: `Crane ${crane.registrationNumber}: Engine degraded (${update.engineHealth.toFixed(1)}%)`,
      });
    }

    if (update.engineTemperature > 100) {
      alerts.push({
        craneId: crane._id,
        registrationNumber: crane.registrationNumber,
        type: NOTIFICATION_TYPES.CRITICAL,
        severity: "critical",
        message: `Crane ${crane.registrationNumber}: Overheating (${update.engineTemperature.toFixed(1)}C)`,
      });
    }

    if (update.fuelLevel < 10) {
      alerts.push({
        craneId: crane._id,
        registrationNumber: crane.registrationNumber,
        type: NOTIFICATION_TYPES.BREAKDOWN,
        severity: "critical",
        message: `Crane ${crane.registrationNumber}: CRITICAL - Fuel critical, breakdown imminent`,
      });
    }

    return alerts;
  }

  static generateServiceAlerts(crane, now = new Date()) {
    const alerts = [];
    const thresholds = crane.serviceThresholds || {};
    const runtimeHours = Number(crane.runtimeHours || 0);
    const usageLimit = Number(thresholds.usageHours || 500);
    const serviceIntervalDays = Number(thresholds.timeIntervalDays || 30);
    const lastServiceDate = crane.lastServiceDate ? new Date(crane.lastServiceDate) : null;
    const nextServiceDate = crane.nextServiceDate ? new Date(crane.nextServiceDate) : null;
    const daysSinceService = lastServiceDate ? Math.floor((now - lastServiceDate) / 86400000) : null;

    if (runtimeHours >= usageLimit) {
      alerts.push({
        craneId: crane._id,
        registrationNumber: crane.registrationNumber,
        type: NOTIFICATION_TYPES.SERVICE,
        severity: runtimeHours >= usageLimit * 1.15 ? "critical" : "warning",
        message: `Crane ${crane.registrationNumber}: Usage-based service due after ${Math.round(runtimeHours)} runtime hours`,
        metric: "runtime",
        metricValue: runtimeHours,
        threshold: usageLimit,
        serviceType: "Usage-based",
        description: "Operating hour threshold reached. Schedule maintenance inspection.",
      });
    }

    if ((daysSinceService !== null && daysSinceService >= serviceIntervalDays) || (nextServiceDate && nextServiceDate <= now)) {
      alerts.push({
        craneId: crane._id,
        registrationNumber: crane.registrationNumber,
        type: NOTIFICATION_TYPES.SERVICE,
        severity: nextServiceDate && nextServiceDate < now ? "critical" : "warning",
        message: `Crane ${crane.registrationNumber}: Time-based service interval reached`,
        metric: "serviceTime",
        metricValue: daysSinceService || serviceIntervalDays,
        threshold: serviceIntervalDays,
        serviceType: "Time-based",
        dueDate: nextServiceDate || now,
        description: "Calendar service interval reached. Review service schedule.",
      });
    }

    for (const component of thresholds.components || []) {
      const thresholdHours = Number(component.thresholdHours || 0);
      const lastServicedAtHours = Number(component.lastServicedAtHours || 0);
      if (thresholdHours > 0 && runtimeHours - lastServicedAtHours >= thresholdHours) {
        alerts.push({
          craneId: crane._id,
          registrationNumber: crane.registrationNumber,
          type: NOTIFICATION_TYPES.SERVICE,
          severity: runtimeHours - lastServicedAtHours >= thresholdHours * 1.15 ? "critical" : "warning",
          message: `Crane ${crane.registrationNumber}: ${component.name || "Component"} service cycle reached`,
          metric: "component",
          metricValue: runtimeHours - lastServicedAtHours,
          threshold: thresholdHours,
          serviceType: "Component-based",
          componentName: component.name || "Component",
          description: `${component.name || "Component"} service threshold reached. Inspect and replace if required.`,
        });
      }
    }

    return alerts;
  }

  static async persistAlerts(alerts) {
    if (!alerts.length) return [];

    const savedAlerts = [];

    for (const item of alerts) {
      const existing = await Alert.findOne({
        crane: item.craneId,
        type: item.type,
        metric: item.metric,
        threshold: item.threshold,
        serviceType: item.serviceType,
        componentName: item.componentName,
        isResolved: false,
      });

      if (existing) continue;

      const alert = await Alert.create({
        crane: item.craneId,
        registrationNumber: item.registrationNumber,
        type: item.type,
        severity: item.severity,
        message: item.message,
        metric: item.metric,
        metricValue: item.metricValue,
        threshold: item.threshold,
        serviceType: item.serviceType,
        dueDate: item.dueDate,
        componentName: item.componentName,
        notes: item.description,
      });

      savedAlerts.push(alert);
      await this.createNotifications(alert, item.description);
    }

    return savedAlerts;
  }

  static async createNotifications(alert, description) {
    const recipients = await User.find({
      isActive: true,
      $or: [
        { role: { $in: ["admin", "manager"] } },
        { assignedCranes: alert.crane },
      ],
    }).select("_id");

    if (!recipients.length) return;

    await Notification.insertMany(
      recipients.map((recipient) => ({
        recipient: recipient._id,
        crane: alert.crane,
        type: alert.type,
        title: alert.type === NOTIFICATION_TYPES.SERVICE ? "Service alert generated" : "Fleet alert generated",
        message: alert.message,
        metadata: {
          alertId: alert._id,
          severity: alert.severity,
          serviceType: alert.serviceType,
          description,
        },
      })),
      { ordered: false }
    );
  }
}

module.exports = AlertService;
