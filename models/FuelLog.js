const mongoose = require("mongoose");
const { FUEL_LOG_TYPES } = require("../config/constants");

const fuelLogSchema = new mongoose.Schema(
  {
    crane: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crane",
      required: true,
    },
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(FUEL_LOG_TYPES),
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    cost: { type: Number, min: 0, default: 0 },
    fuelLevelBefore: { type: Number, min: 0, max: 100 },
    fuelLevelAfter: { type: Number, min: 0, max: 100 },
    station: { type: String, trim: true },
    odometer: { type: Number },
    notes: { type: String, trim: true },
    isAnomaly: { type: Boolean, default: false },
    loggedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

fuelLogSchema.index({ crane: 1, loggedAt: -1 });

module.exports = mongoose.model("FuelLog", fuelLogSchema);
