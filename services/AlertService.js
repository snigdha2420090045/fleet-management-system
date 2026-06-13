const { NOTIFICATION_TYPES } = require("../config/constants");

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
}

module.exports = AlertService;
