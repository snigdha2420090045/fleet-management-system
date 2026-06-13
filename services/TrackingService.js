const TrackingLog = require("../models/TrackingLog");
const { CRANE_STATUS, ENGINE_STATUS, TRACKING_SOURCE } = require("../config/constants");
const { retry } = require("../utils/retryHelper");

const VALID_COORDINATE_DEFAULT = [-74.006, 40.7128];

const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const normalizeCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return VALID_COORDINATE_DEFAULT;
  }

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return VALID_COORDINATE_DEFAULT;
  }

  return [clamp(lng, -180, 180, VALID_COORDINATE_DEFAULT[0]), clamp(lat, -90, 90, VALID_COORDINATE_DEFAULT[1])];
};

const normalizeSource = (source, fallback = TRACKING_SOURCE.MANUAL) => {
  return Object.values(TRACKING_SOURCE).includes(source) ? source : fallback;
};

const engineStatusFromCraneStatus = (status) => {
  if (status === CRANE_STATUS.RUNNING) return ENGINE_STATUS.ON;
  if (status === CRANE_STATUS.IDLE || status === CRANE_STATUS.ACTIVE) return ENGINE_STATUS.IDLE;
  return ENGINE_STATUS.OFF;
};

const normalizeEngineStatus = (engineStatus, craneStatus) => {
  if (Object.values(ENGINE_STATUS).includes(engineStatus)) return engineStatus;
  return engineStatusFromCraneStatus(craneStatus);
};

const buildTrackingDocument = (update) => ({
  crane: update.craneId || update.crane,
  location: {
    type: "Point",
    coordinates: normalizeCoordinates(update.location?.coordinates || update.coordinates),
  },
  speed: clamp(update.speed, 0, 300, 0),
  heading: clamp(update.heading, 0, 360, 0),
  altitude: Number.isFinite(Number(update.altitude)) ? Number(update.altitude) : 0,
  engineStatus: normalizeEngineStatus(update.engineStatus, update.status),
  fuelLevel: update.fuelLevel === undefined ? undefined : clamp(update.fuelLevel, 0, 100, 0),
  source: normalizeSource(update.source, TRACKING_SOURCE.SIMULATOR),
  recordedAt: update.recordedAt || new Date(),
});

class TrackingService {
  static normalizeCoordinates(coordinates) {
    return normalizeCoordinates(coordinates);
  }

  static normalizeEngineStatus(engineStatus, craneStatus) {
    return normalizeEngineStatus(engineStatus, craneStatus);
  }

  static normalizeSource(source, fallback) {
    return normalizeSource(source, fallback);
  }

  static buildTrackingDocument(update) {
    return buildTrackingDocument(update);
  }

  static async createManualLog(payload) {
    const document = buildTrackingDocument({
      ...payload,
      source: normalizeSource(payload.source, TRACKING_SOURCE.MANUAL),
    });

    return TrackingLog.create(document);
  }

  static async saveSimulationLogs(updates) {
    if (!updates.length) return;

    const documents = updates.map((update) =>
      buildTrackingDocument({
        ...update,
        source: TRACKING_SOURCE.SIMULATOR,
      })
    );

    await retry(
      () => TrackingLog.insertMany(documents, { ordered: false }),
      { maxAttempts: 3, baseDelayMs: 150, maxDelayMs: 1000 }
    );
  }
}

module.exports = TrackingService;
