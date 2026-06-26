const Alert = require("../models/Alert");
const Crane = require("../models/Crane");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/response");
const { ROLES } = require("../config/constants");

const buildAlertFilter = (user) => {
  if (user.role === ROLES.OPERATOR) {
    return {
      crane: { $in: user.assignedCranes },
    };
  }
  return {};
};

exports.getAlerts = asyncHandler(async (req, res) => {
  const { severity, resolved, type, limit = 50, page = 1 } = req.query;

  const filter = buildAlertFilter(req.user);

  if (severity) filter.severity = severity;
  if (resolved !== undefined) filter.isResolved = resolved === "true";
  if (type) filter.type = type;

  const skip = (page - 1) * limit;

  const [alerts, total] = await Promise.all([
    Alert.find(filter)
      .populate("crane", "registrationNumber")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip),
    Alert.countDocuments(filter),
  ]);

  sendResponse(res, 200, "Alerts fetched", {
    alerts,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    },
  });
});

exports.getAlertById = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id)
    .populate("crane")
    .populate("resolvedBy", "name email");

  if (!alert) throw new ApiError(404, "Alert not found.");

  sendResponse(res, 200, "Alert fetched", { alert });
});

exports.getUnresolvedAlerts = asyncHandler(async (req, res) => {
  const filter = {
    isResolved: false,
    ...buildAlertFilter(req.user),
  };

  const alerts = await Alert.find(filter)
    .populate("crane", "registrationNumber status")
    .sort({ severity: -1, createdAt: -1 })
    .limit(100);

  const summary = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  sendResponse(res, 200, "Unresolved alerts fetched", {
    alerts,
    summary,
  });
});

exports.getServiceAlerts = asyncHandler(async (req, res) => {
  const filter = {
    type: "service",
    isResolved: false,
    ...buildAlertFilter(req.user),
  };

  const alerts = await Alert.find(filter)
    .populate("crane", "registrationNumber model runtimeHours serviceThresholds nextServiceDate")
    .sort({ severity: -1, dueDate: 1, createdAt: -1 })
    .limit(100);

  sendResponse(res, 200, "Service alerts fetched", { alerts });
});

exports.resolveAlert = asyncHandler(async (req, res) => {
  const { notes } = req.body;

  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: req.user._id,
      notes,
    },
    { returnDocument: "after" }
  );

  if (!alert) throw new ApiError(404, "Alert not found.");

  if (global.io) {
    global.io.to("alerts-room").emit("alert-resolved", {
      alertId: alert._id,
      craneId: alert.crane,
      resolvedAt: alert.resolvedAt,
    });
    global.io.to("tracking-room").emit("dashboard:update", {
      type: "alert-resolved",
      alertId: alert._id,
      craneId: alert.crane,
      timestamp: alert.resolvedAt,
    });
  }

  sendResponse(res, 200, "Alert resolved", { alert });
});

exports.getAlertStats = asyncHandler(async (req, res) => {
  const filter = buildAlertFilter(req.user);

  const [
    totalAlerts,
    unresolvedAlerts,
    criticalAlerts,
    warningAlerts,
    alertsByType,
    alertsBySeverity,
  ] = await Promise.all([
    Alert.countDocuments(filter),
    Alert.countDocuments({ ...filter, isResolved: false }),
    Alert.countDocuments({ ...filter, severity: "critical" }),
    Alert.countDocuments({ ...filter, severity: "warning" }),
    Alert.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]),
    Alert.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  sendResponse(res, 200, "Alert stats fetched", {
    stats: {
      total: totalAlerts,
      unresolved: unresolvedAlerts,
      byType: alertsByType,
      bySeverity: alertsBySeverity,
      criticalCount: criticalAlerts,
      warningCount: warningAlerts,
    },
  });
});

exports.createAlert = asyncHandler(async (req, res) => {
  const { craneId, type, severity, message, metric, metricValue, threshold, serviceType, dueDate, componentName, description } = req.body;

  const crane = await Crane.findById(craneId);
  if (!crane) throw new ApiError(404, "Crane not found.");

  const alert = await Alert.create({
    crane: craneId,
    registrationNumber: crane.registrationNumber,
    type,
    severity,
    message,
    metric,
    metricValue,
    threshold,
    serviceType,
    dueDate,
    componentName,
    notes: description,
  });

  if (global.io) {
    const payload = {
      alertId: alert._id,
      craneId: alert.crane,
      registrationNumber: alert.registrationNumber,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.createdAt,
    };

    global.io.to("alerts-room").emit("new-alert", payload);
    global.io.to("alerts-room").emit("alert:new", payload);
    global.io.to("tracking-room").emit("dashboard:update", {
      type: "alert",
      craneId: alert.crane,
      severity: alert.severity,
      timestamp: alert.createdAt,
    });
  }

  sendResponse(res, 201, "Alert created", { alert });
});

exports.bulkResolveAlerts = asyncHandler(async (req, res) => {
  const { alertIds, notes } = req.body;

  if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
    throw new ApiError(400, "Alert IDs array is required.");
  }

  const result = await Alert.updateMany(
    { _id: { $in: alertIds } },
    {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: req.user._id,
      notes,
    }
  );

  sendResponse(res, 200, "Alerts resolved", {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
});
