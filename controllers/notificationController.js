const Notification = require("../models/Notification");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/response");

exports.getNotifications = asyncHandler(async (req, res) => {
  const filter = { recipient: req.user._id };
  if (req.query.isRead !== undefined) {
    filter.isRead = req.query.isRead === "true";
  }

  const notifications = await Notification.find(filter)
    .populate("crane", "registrationNumber model")
    .sort({ createdAt: -1 });

  sendResponse(res, 200, "Notifications fetched", {
    notifications,
    unreadCount: notifications.filter((n) => !n.isRead).length,
  });
});

exports.createNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.create(req.body);
  sendResponse(res, 201, "Notification created", { notification });
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) throw new ApiError(404, "Notification not found.");
  sendResponse(res, 200, "Notification marked as read", { notification });
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  sendResponse(res, 200, "All notifications marked as read");
});
