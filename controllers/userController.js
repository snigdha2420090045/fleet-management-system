const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/response");

exports.getUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select("-password")
    .populate("assignedCranes", "registrationNumber model");
  sendResponse(res, 200, "Users fetched", { users });
});

exports.getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select("-password")
    .populate("assignedCranes");

  if (!user) throw new ApiError(404, "User not found.");
  sendResponse(res, 200, "User fetched", { user });
});

exports.createUser = asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  sendResponse(res, 201, "User created", {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
    },
  });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!user) throw new ApiError(404, "User not found.");
  sendResponse(res, 200, "User updated", { user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!user) throw new ApiError(404, "User not found.");
  sendResponse(res, 200, "User deactivated");
});

exports.assignCranes = asyncHandler(async (req, res) => {
  const { craneIds } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { assignedCranes: craneIds },
    { new: true, runValidators: true }
  ).populate("assignedCranes", "registrationNumber model");

  if (!user) throw new ApiError(404, "User not found.");
  sendResponse(res, 200, "Cranes assigned", { user });
});
