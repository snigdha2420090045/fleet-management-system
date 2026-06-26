const mongoose = require("mongoose");
const { NOTIFICATION_TYPES } = require("../config/constants");

const alertSchema = new mongoose.Schema(
  {
    crane: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crane",
      required: true,
    },
    registrationNumber: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
    },
    message: { type: String, required: true },
    metric: {
      type: String,
      enum: ["fuel", "engineHealth", "engineTemp", "oilPressure", "batteryHealth", "runtime", "serviceTime", "component"],
    },
    metricValue: { type: Number },
    threshold: { type: Number },
    serviceType: {
      type: String,
      enum: ["Usage-based", "Time-based", "Component-based"],
    },
    dueDate: { type: Date },
    componentName: { type: String, trim: true },
    isResolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: { type: String },
  },
  { timestamps: true }
);

alertSchema.index({ crane: 1, createdAt: -1 });
alertSchema.index({ severity: 1, isResolved: 1 });
alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Alert", alertSchema);
