const mongoose = require("mongoose");
const { REPAIR_STATUS } = require("../config/constants");

const repairLogSchema = new mongoose.Schema(
  {
    crane: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crane",
      required: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mechanic: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(REPAIR_STATUS),
      default: REPAIR_STATUS.SCHEDULED,
    },
    cost: { type: Number, min: 0, default: 0 },
    spareParts: [{ name: String, quantity: Number, cost: Number }],
    invoiceUrl: { type: String },
    photoUrls: [{ type: String }],
    scheduledDate: { type: Date },
    completedDate: { type: Date },
    nextServicePrediction: { type: Date },
  },
  { timestamps: true }
);

repairLogSchema.index({ crane: 1, createdAt: -1 });
repairLogSchema.index({ status: 1 });

module.exports = mongoose.model("RepairLog", repairLogSchema);
