const FuelLog = require("../models/FuelLog");
const Crane = require("../models/Crane");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/response");
const { ROLES } = require("../config/constants");

exports.getFuelLogs = asyncHandler(async (req, res) => {
  const { craneId } = req.query;
  const filter = {};

  if (craneId) filter.crane = craneId;

  if (req.user.role === ROLES.OPERATOR) {
    const assigned = req.user.assignedCranes.map((id) => id.toString());
    if (craneId && !assigned.includes(craneId)) {
      throw new ApiError(403, "Access denied.");
    }
    filter.crane = craneId ? craneId : { $in: req.user.assignedCranes };
  }

  const logs = await FuelLog.find(filter)
    .populate("crane", "registrationNumber model")
    .populate("loggedBy", "name role")
    .sort({ loggedAt: -1 });

  sendResponse(res, 200, "Fuel logs fetched", { logs, count: logs.length });
});

exports.createFuelLog = asyncHandler(async (req, res) => {
  const crane = await Crane.findById(req.body.crane);
  if (!crane) throw new ApiError(404, "Crane not found.");

  const log = await FuelLog.create({
    ...req.body,
    loggedBy: req.user._id,
  });

  if (req.body.fuelLevelAfter !== undefined) {
    crane.fuelLevel = req.body.fuelLevelAfter;
    await crane.save();
  }

  sendResponse(res, 201, "Fuel log created", { log });
});

exports.getFuelAnalytics = asyncHandler(async (req, res) => {
  const { craneId, from, to } = req.query;
  const match = { type: "consumption" };
  if (craneId) match.crane = craneId;
  if (from || to) {
    match.loggedAt = {};
    if (from) match.loggedAt.$gte = new Date(from);
    if (to) match.loggedAt.$lte = new Date(to);
  }

  const analytics = await FuelLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$crane",
        totalConsumed: { $sum: "$quantity" },
        totalCost: { $sum: "$cost" },
        entries: { $sum: 1 },
      },
    },
  ]);

  sendResponse(res, 200, "Fuel analytics fetched", { analytics });
});
