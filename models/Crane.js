const mongoose = require("mongoose");
const { CRANE_STATUS } = require("../config/constants");

const craneSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    model: { type: String, required: true, trim: true },
    manufacturer: { type: String, trim: true },
    year: { type: Number },
    imageUrl: { type: String },
    status: {
      type: String,
      enum: Object.values(CRANE_STATUS),
      default: CRANE_STATUS.IDLE,
    },
    assignedOperator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    fuelLevel: { type: Number, min: 0, max: 100, default: 0 },
    engineHealth: { type: Number, min: 0, max: 100, default: 100 },
    engineTemperature: { type: Number, default: 0 },
    oilPressure: { type: Number, default: 0 },
    batteryHealth: { type: Number, min: 0, max: 100, default: 100 },
    runtimeHours: { type: Number, default: 0 },
    idleHours: { type: Number, default: 0 },
    lastServiceDate: { type: Date },
    nextServiceDate: { type: Date },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [-74.006, 40.7128],
        validate: {
          validator: function (v) {
            return Array.isArray(v) && v.length === 2 && !isNaN(v[0]) && !isNaN(v[1]);
          },
          message: "Location coordinates must be [longitude, latitude]",
        },
      },
    },
    speed: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    alerts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Alert",
      },
    ],
    maintenanceHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RepairLog",
      },
    ],
  },
  { timestamps: true }
);

craneSchema.index({ location: "2dsphere" });
craneSchema.index({ status: 1 });
craneSchema.index({ assignedOperator: 1 });

module.exports = mongoose.model("Crane", craneSchema);
