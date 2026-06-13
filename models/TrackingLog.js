const mongoose = require("mongoose");
const { ENGINE_STATUS, TRACKING_SOURCE } = require("../config/constants");

const trackingLogSchema = new mongoose.Schema(
  {
    crane: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crane",
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (v) {
            return Array.isArray(v) && v.length === 2 && !isNaN(v[0]) && !isNaN(v[1]);
          },
          message: "Location coordinates must be [longitude, latitude]",
        },
      },
    },
    speed: { type: Number, default: 0, min: 0 },
    heading: { type: Number, min: 0, max: 360 },
    altitude: { type: Number, default: 0 },
    engineStatus: {
      type: String,
      enum: Object.values(ENGINE_STATUS),
      default: ENGINE_STATUS.OFF,
    },
    fuelLevel: { type: Number, min: 0, max: 100 },
    source: {
      type: String,
      enum: Object.values(TRACKING_SOURCE),
      default: TRACKING_SOURCE.GPS,
    },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

trackingLogSchema.index({ crane: 1, recordedAt: -1 });
trackingLogSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("TrackingLog", trackingLogSchema);
