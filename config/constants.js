module.exports = {
  ROLES: {
    ADMIN: "admin",
    MANAGER: "manager",
    OPERATOR: "operator",
  },

  CRANE_STATUS: {
    ACTIVE: "active",
    IDLE: "idle",
    RUNNING: "running",
    UNDER_REPAIR: "under_repair",
    OFFLINE: "offline",
  },

  TRACKING_SOURCE: {
    GPS: "gps",
    MANUAL: "manual",
    SIMULATOR: "simulator",
  },

  ENGINE_STATUS: {
    ON: "on",
    OFF: "off",
    IDLE: "idle",
  },

  NOTIFICATION_TYPES: {
    CRITICAL: "critical",
    WARNING: "warning",
    SERVICE: "service",
    FUEL: "fuel",
    BREAKDOWN: "breakdown",
    INFO: "info",
  },

  FUEL_LOG_TYPES: {
    REFILL: "refill",
    CONSUMPTION: "consumption",
    THEFT_ALERT: "theft_alert",
  },

  REPAIR_STATUS: {
    SCHEDULED: "scheduled",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  },
};
