const Crane = require("../models/Crane");
const Alert = require("../models/Alert");
const FuelLog = require("../models/FuelLog");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/response");
const { ROLES, CRANE_STATUS, NOTIFICATION_TYPES } = require("../config/constants");

const buildCraneFilter = (user) => {
  if (user.role === ROLES.OPERATOR) {
    return { assignedOperator: user._id, isActive: true };
  }
  return { isActive: true };
};

exports.getCranes = asyncHandler(async (req, res) => {
  const filter = buildCraneFilter(req.user);
  const cranes = await Crane.find(filter)
    .populate("assignedOperator", "name email role phone")
    .sort({ registrationNumber: 1 });
  sendResponse(res, 200, "Cranes fetched", { cranes, count: cranes.length });
});

exports.getCraneById = asyncHandler(async (req, res) => {
  const crane = await Crane.findById(req.params.id)
    .populate("assignedOperator", "name email phone")
    .populate("alerts");

  if (!crane || !crane.isActive) throw new ApiError(404, "Crane not found.");

  if (
    req.user.role === ROLES.OPERATOR &&
    crane.assignedOperator?._id?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Access denied to this crane.");
  }

  sendResponse(res, 200, "Crane fetched", { crane });
});

exports.createCrane = asyncHandler(async (req, res) => {
  const crane = await Crane.create(req.body);
  sendResponse(res, 201, "Crane created", { crane });
});

exports.updateCrane = asyncHandler(async (req, res) => {
  const crane = await Crane.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: "after",
    runValidators: true,
  });

  if (!crane) throw new ApiError(404, "Crane not found.");

  // Broadcast update via Socket.IO
  if (global.io) {
    global.io.to(`crane-${crane._id}`).emit("crane-updated", crane);
    global.io.to(`crane-${crane._id}`).emit("crane:update", crane);
    global.io.to("tracking-room").emit("dashboard:update", {
      type: "crane",
      craneId: crane._id,
      timestamp: new Date(),
    });
  }

  sendResponse(res, 200, "Crane updated", { crane });
});

exports.deleteCrane = asyncHandler(async (req, res) => {
  const crane = await Crane.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { returnDocument: "after" }
  );

  if (!crane) throw new ApiError(404, "Crane not found.");
  sendResponse(res, 200, "Crane deactivated");
});

exports.getDashboardKPIs = asyncHandler(async (req, res) => {
  const filter = buildCraneFilter(req.user);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalCount,
    activeCount,
    runningCount,
    underRepairCount,
    offlineCount,
    cranes,
    criticalAlerts,
    warningAlerts,
    fuelUsageToday,
  ] = await Promise.all([
    Crane.countDocuments(filter),
    Crane.countDocuments({ ...filter, status: CRANE_STATUS.ACTIVE }),
    Crane.countDocuments({ ...filter, status: CRANE_STATUS.RUNNING }),
    Crane.countDocuments({ ...filter, status: CRANE_STATUS.UNDER_REPAIR }),
    Crane.countDocuments({ ...filter, status: CRANE_STATUS.OFFLINE }),
    Crane.find(filter).select(
      "fuelLevel engineHealth engineTemperature runtimeHours status registrationNumber"
    ),
    Alert.countDocuments({ isResolved: false, severity: "critical" }),
    Alert.countDocuments({ isResolved: false, severity: "warning" }),
    FuelLog.aggregate([
      {
        $match: {
          type: "consumption",
          loggedAt: { $gte: startOfToday },
          ...(req.user.role === ROLES.OPERATOR ? { crane: { $in: req.user.assignedCranes } } : {}),
        },
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" },
          totalCost: { $sum: "$cost" },
          entries: { $sum: 1 },
        },
      },
    ]),
  ]);

  const avgFuelLevel =
    cranes.length > 0
      ? Math.round(cranes.reduce((sum, c) => sum + c.fuelLevel, 0) / cranes.length)
      : 0;

  const avgEngineHealth =
    cranes.length > 0
      ? Math.round(cranes.reduce((sum, c) => sum + c.engineHealth, 0) / cranes.length)
      : 100;

  const totalRuntimeHours = cranes.reduce((sum, c) => sum + c.runtimeHours, 0);

  // Count vehicles with issues
  const lowFuelCount = cranes.filter((c) => c.fuelLevel < 20).length;
  const poorHealthCount = cranes.filter((c) => c.engineHealth < 60).length;
  const overheatingCount = cranes.filter((c) => c.engineTemperature > 100).length;
  const breakdownRiskCount = cranes.filter((c) => calculateBreakdownRisk(c).score > 60).length;
  const todayFuel = fuelUsageToday[0] || { totalQuantity: 0, totalCost: 0, entries: 0 };

  sendResponse(res, 200, "Dashboard KPIs fetched", {
    kpis: {
      summary: {
        totalVehicles: totalCount,
        active: activeCount,
        running: runningCount,
        underRepair: underRepairCount,
        offline: offlineCount,
      },
      health: {
        avgFuelLevel,
        avgEngineHealth,
        totalRuntimeHours: Math.round(totalRuntimeHours),
        fuelUsageToday: Math.round(todayFuel.totalQuantity),
        fuelCostToday: Math.round(todayFuel.totalCost),
        fuelEntriesToday: todayFuel.entries,
      },
      alerts: {
        critical: criticalAlerts,
        warning: warningAlerts,
        lowFuel: lowFuelCount,
        poorHealth: poorHealthCount,
        overheating: overheatingCount,
        breakdownRisk: breakdownRiskCount,
      },
      efficiency: {
        operationalEfficiency: totalCount > 0 ? Math.max(0, 100 - (poorHealthCount / totalCount) * 100) : 0,
        availabilityRate: totalCount > 0 ? ((totalCount - underRepairCount - offlineCount) / totalCount) * 100 : 0,
      },
    },
  });
});

exports.getLiveTracking = asyncHandler(async (req, res) => {
  const filter = buildCraneFilter(req.user);

  const cranes = await Crane.find(filter)
    .select("registrationNumber location speed status fuelLevel engineHealth engineTemperature")
    .lean();

  const trackingData = cranes.map((crane) => ({
    id: crane._id,
    registrationNumber: crane.registrationNumber,
    lat: crane.location.coordinates[1],
    lng: crane.location.coordinates[0],
    speed: crane.speed,
    status: crane.status,
    fuelLevel: crane.fuelLevel,
    engineHealth: crane.engineHealth,
    engineTemperature: crane.engineTemperature,
  }));

  sendResponse(res, 200, "Live tracking fetched", { tracking: trackingData });
});

exports.getVehicleAlerts = asyncHandler(async (req, res) => {
  const craneId = req.params.craneId || req.params.id;
  const { resolved } = req.query;

  const crane = await Crane.findById(craneId);
  if (!crane) throw new ApiError(404, "Crane not found.");

  const filter = { crane: craneId };
  if (resolved !== undefined) {
    filter.isResolved = resolved === "true";
  }

  const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(50);

  sendResponse(res, 200, "Alerts fetched", { alerts, count: alerts.length });
});

exports.getBreakdownPrediction = asyncHandler(async (req, res) => {
  const craneId = req.params.craneId || req.params.id;

  const crane = await Crane.findById(craneId);
  if (!crane) throw new ApiError(404, "Crane not found.");

  const risk = calculateBreakdownRisk(crane);
  const recommendations = generateMaintenanceRecommendations(crane);

  sendResponse(res, 200, "Breakdown prediction fetched", {
    crane: {
      id: crane._id,
      registrationNumber: crane.registrationNumber,
    },
    prediction: {
      riskLevel: risk.level,
      riskScore: risk.score,
      estimatedDaysToFailure: risk.daysToFailure,
      description: risk.description,
      factors: risk.factors,
    },
    recommendations,
  });
});

function calculateBreakdownRisk(crane) {
  const factors = [];
  let riskScore = 0;

  // Engine health factor
  if (crane.engineHealth < 60) {
    riskScore += 30;
    factors.push("Engine health degraded");
  } else if (crane.engineHealth < 80) {
    riskScore += 15;
  }

  // Fuel level factor
  if (crane.fuelLevel < 10) {
    riskScore += 20;
    factors.push("Critical fuel level");
  } else if (crane.fuelLevel < 20) {
    riskScore += 10;
    factors.push("Low fuel level");
  }

  // Temperature factor
  if (crane.engineTemperature > 110) {
    riskScore += 25;
    factors.push("Engine overheating");
  } else if (crane.engineTemperature > 100) {
    riskScore += 15;
    factors.push("Engine temperature elevated");
  }

  // Runtime hours factor
  if (crane.runtimeHours > 4000) {
    riskScore += 20;
    factors.push("High runtime hours");
  }

  // Battery health factor
  if (crane.batteryHealth < 80) {
    riskScore += 10;
    factors.push("Battery health declining");
  }

  const daysToFailure = riskScore > 80 ? Math.max(1, 10 - Math.floor(riskScore / 10)) : null;

  const level = riskScore > 80 ? "CRITICAL" : riskScore > 60 ? "HIGH" : riskScore > 40 ? "MEDIUM" : "LOW";

  return {
    score: Math.round(riskScore),
    level,
    daysToFailure,
    factors,
    description:
      level === "CRITICAL"
        ? "Vehicle is at critical risk of breakdown. Immediate maintenance recommended."
        : level === "HIGH"
        ? "Vehicle shows signs of degradation. Schedule maintenance soon."
        : level === "MEDIUM"
        ? "Vehicle performance is acceptable. Monitor closely."
        : "Vehicle is in good condition.",
  };
}

function generateMaintenanceRecommendations(crane) {
  const recommendations = [];

  if (crane.engineHealth < 70) {
    recommendations.push({
      priority: "HIGH",
      action: "Full engine diagnostic",
      estimatedCost: 2000,
      estimatedTime: "4-6 hours",
    });
  }

  if (crane.runtimeHours > 3500 && (!crane.lastServiceDate || Date.now() - crane.lastServiceDate > 60 * 24 * 60 * 60 * 1000)) {
    recommendations.push({
      priority: "HIGH",
      action: "Scheduled maintenance",
      estimatedCost: 1500,
      estimatedTime: "2-3 hours",
    });
  }

  if (crane.engineTemperature > 100) {
    recommendations.push({
      priority: "MEDIUM",
      action: "Radiator and cooling system inspection",
      estimatedCost: 800,
      estimatedTime: "2 hours",
    });
  }

  if (crane.oilPressure < 30) {
    recommendations.push({
      priority: "MEDIUM",
      action: "Oil and filter change",
      estimatedCost: 500,
      estimatedTime: "1 hour",
    });
  }

  if (crane.batteryHealth < 85) {
    recommendations.push({
      priority: "LOW",
      action: "Battery condition check",
      estimatedCost: 300,
      estimatedTime: "30 minutes",
    });
  }

  return recommendations;
}
