const RepairLog = require("../models/RepairLog");
const Crane = require("../models/Crane");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/response");
const { ROLES, CRANE_STATUS } = require("../config/constants");

exports.getRepairLogs = asyncHandler(async (req, res) => {
  const { craneId, status } = req.query;
  const filter = {};
  if (craneId) filter.crane = craneId;
  if (status) filter.status = status;

  if (req.user.role === ROLES.OPERATOR) {
    filter.crane = craneId ? craneId : { $in: req.user.assignedCranes };
  }

  const logs = await RepairLog.find(filter)
    .populate("crane", "registrationNumber model")
    .populate("reportedBy", "name role")
    .sort({ createdAt: -1 });

  sendResponse(res, 200, "Repair logs fetched", { logs, count: logs.length });
});

exports.createRepairLog = asyncHandler(async (req, res) => {
  const crane = await Crane.findById(req.body.crane);
  if (!crane) throw new ApiError(404, "Crane not found.");

  const log = await RepairLog.create({
    ...req.body,
    reportedBy: req.user._id,
  });

  if (req.body.status === "in_progress") {
    crane.status = CRANE_STATUS.UNDER_REPAIR;
    await crane.save();
  }

  sendResponse(res, 201, "Repair log created", { log });
});

exports.updateRepairLog = asyncHandler(async (req, res) => {
  const log = await RepairLog.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!log) throw new ApiError(404, "Repair log not found.");

  if (req.body.status === "completed") {
    await Crane.findByIdAndUpdate(log.crane, {
      status: CRANE_STATUS.ACTIVE,
      lastServiceDate: new Date(),
      nextServiceDate: log.nextServicePrediction,
    });
  }

  sendResponse(res, 200, "Repair log updated", { log });
});
