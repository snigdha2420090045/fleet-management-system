const TrackingLog = require("../models/TrackingLog");
const Crane = require("../models/Crane");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/response");
const { ROLES } = require("../config/constants");
const TrackingService = require("../services/TrackingService");

exports.getTrackingLogs = asyncHandler(async (req, res) => {
  const { craneId, from, to, limit = 100 } = req.query;
  if (!craneId) throw new ApiError(400, "craneId is required.");

  if (req.user.role === ROLES.OPERATOR) {
    const assignedCranes = Array.isArray(req.user.assignedCranes) ? req.user.assignedCranes : [];
    const assigned = assignedCranes.map((id) => id.toString());
    if (!assigned.includes(craneId)) {
      throw new ApiError(403, "Access denied.");
    }
  }

  const filter = { crane: craneId };
  if (from || to) {
    filter.recordedAt = {};
    if (from) filter.recordedAt.$gte = new Date(from);
    if (to) filter.recordedAt.$lte = new Date(to);
  }

  const logs = await TrackingLog.find(filter)
    .sort({ recordedAt: -1 })
    .limit(Number(limit));

  sendResponse(res, 200, "Tracking logs fetched", { logs, count: logs.length });
});

exports.createTrackingLog = asyncHandler(async (req, res) => {
  const { crane, coordinates, speed, engineStatus, fuelLevel } = req.body;

  const craneDoc = await Crane.findById(crane);
  if (!craneDoc) throw new ApiError(404, "Crane not found.");

  const log = await TrackingService.createManualLog({
    crane,
    coordinates,
    speed,
    engineStatus,
    fuelLevel,
    source: req.body.source,
  });

  craneDoc.location = { type: "Point", coordinates: TrackingService.normalizeCoordinates(coordinates) };
  if (speed !== undefined) craneDoc.speed = speed;
  if (fuelLevel !== undefined) craneDoc.fuelLevel = fuelLevel;
  await craneDoc.save();

  sendResponse(res, 201, "Tracking log created", { log });
});

exports.getLiveLocations = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.user.role === ROLES.OPERATOR) {
    filter.assignedOperator = req.user._id;
  }

  const cranes = await Crane.find(filter).select(
    "registrationNumber model status location speed fuelLevel engineHealth assignedOperator"
  );

  sendResponse(res, 200, "Live locations fetched", { cranes });
});
