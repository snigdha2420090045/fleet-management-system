const Crane = require("../models/Crane");
const { CRANE_STATUS } = require("../config/constants");
const { retry } = require("../utils/retryHelper");
const AlertService = require("./AlertService");
const SocketService = require("./SocketService");
const TrackingService = require("./TrackingService");

const DEFAULT_INTERVAL_MS = 2500;
const MIN_INTERVAL_MS = 2000;
const MAX_INTERVAL_MS = 3000;

const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

class SimulationService {
  static activeInstance = null;

  constructor(io) {
    this.io = io;
    this.socketService = new SocketService(io);
    this.running = false;
    this.timeoutId = null;
    this.inFlight = false;
    this.intervalMs = DEFAULT_INTERVAL_MS;
  }

  async start(updateIntervalMs = DEFAULT_INTERVAL_MS) {
    if (SimulationService.activeInstance && SimulationService.activeInstance !== this) {
      console.warn("[SimulationService] Simulation already running in another instance");
      return SimulationService.activeInstance;
    }

    if (this.running) {
      console.warn("[SimulationService] Already running");
      return this;
    }

    this.intervalMs = clamp(updateIntervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS, DEFAULT_INTERVAL_MS);
    this.running = true;
    SimulationService.activeInstance = this;

    console.log(`[SimulationService] Started simulation loop (${this.intervalMs}ms)`);
    this.scheduleNextCycle(0);
    return this;
  }

  async stop() {
    if (!this.running) return;

    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    await this.waitForInFlight();

    if (SimulationService.activeInstance === this) {
      SimulationService.activeInstance = null;
    }

    console.log("[SimulationService] Stopped simulation loop");
  }

  scheduleNextCycle(delayMs = this.intervalMs) {
    if (!this.running) return;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.runCycle().catch((err) => {
        console.error("[SimulationService] Cycle error:", err.message);
      });
    }, delayMs);
  }

  async runCycle() {
    if (!this.running) return;

    if (this.inFlight) {
      console.warn("[SimulationService] Skipping cycle because previous cycle is still running");
      this.scheduleNextCycle();
      return;
    }

    this.inFlight = true;

    try {
      await this.updateCycle();
    } finally {
      this.inFlight = false;
      this.scheduleNextCycle();
    }
  }

  async waitForInFlight() {
    const startedAt = Date.now();
    while (this.inFlight && Date.now() - startedAt < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async updateCycle() {
    const cranes = await Crane.find({ isActive: true }).lean();
    if (cranes.length === 0) return;

    const updates = [];
    const alerts = [];

    for (const crane of cranes) {
      try {
        const update = this.generateCraneUpdate(crane);
        updates.push(update);
        alerts.push(...AlertService.generateCraneAlerts(crane, update));
      } catch (err) {
        console.error(`[SimulationService] Error processing crane ${crane._id}:`, err.message);
      }
    }

    await this.persistUpdates(updates);
    this.broadcastUpdates(updates);
    this.broadcastAlerts(alerts);
  }

  generateCraneUpdate(crane) {
    const currentCoordinates = TrackingService.normalizeCoordinates(crane.location?.coordinates);
    const currentLng = currentCoordinates[0];
    const currentLat = currentCoordinates[1];
    const status = Object.values(CRANE_STATUS).includes(crane.status) ? crane.status : CRANE_STATUS.IDLE;

    const newLng = clamp(currentLng + (Math.random() - 0.5) * 0.002, -180, 180, currentLng);
    const newLat = clamp(currentLat + (Math.random() - 0.5) * 0.002, -90, 90, currentLat);
    const currentFuelLevel = clamp(crane.fuelLevel, 0, 100, 0);
    const currentEngineHealth = clamp(crane.engineHealth, 0, 100, 100);
    const currentBatteryHealth = clamp(crane.batteryHealth, 0, 100, 100);
    const currentRuntimeHours = Math.max(0, Number(crane.runtimeHours) || 0);

    const fuelConsumption = status === CRANE_STATUS.RUNNING ? Math.random() * 1.5 : Math.random() * 0.3;
    const newFuelLevel = clamp(currentFuelLevel - fuelConsumption, 0, 100, currentFuelLevel);

    let engineHealthChange = 0;
    if (status === CRANE_STATUS.RUNNING) {
      engineHealthChange = -Math.random() * 0.05;
    } else if (status === CRANE_STATUS.IDLE) {
      engineHealthChange = -Math.random() * 0.02;
    }

    const newEngineHealth = clamp(currentEngineHealth + engineHealthChange, 0, 100, currentEngineHealth);
    const currentEngineTemp = Number.isFinite(Number(crane.engineTemperature)) ? Number(crane.engineTemperature) : 70;
    const engineTemperature =
      status === CRANE_STATUS.RUNNING
        ? clamp(70 + Math.random() * 50, 30, 120, 70)
        : clamp(currentEngineTemp - Math.random() * 5, 30, 120, currentEngineTemp);

    return {
      craneId: crane._id,
      location: { type: "Point", coordinates: [newLng, newLat] },
      fuelLevel: newFuelLevel,
      engineHealth: newEngineHealth,
      engineTemperature,
      oilPressure: clamp(35 + Math.random() * 30, 0, 100, 35),
      batteryHealth: clamp(currentBatteryHealth - Math.random() * 0.1, 80, 100, currentBatteryHealth),
      speed: status === CRANE_STATUS.RUNNING ? clamp(Math.random() * 60, 0, 300, 0) : 0,
      runtimeHours: status === CRANE_STATUS.RUNNING ? currentRuntimeHours + 0.0014 : currentRuntimeHours,
      status,
      registrationNumber: crane.registrationNumber,
      assignedOperator: crane.assignedOperator,
      engineStatus: TrackingService.normalizeEngineStatus(undefined, status),
      heading: Math.floor(Math.random() * 360),
      altitude: 0,
    };
  }

  async persistUpdates(updates) {
    if (!updates.length) return;

    const results = await Promise.allSettled([
      TrackingService.saveSimulationLogs(updates),
      this.saveCraneUpdates(updates),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[SimulationService] DB write failed after retries:", result.reason.message);
      }
    }
  }

  async saveCraneUpdates(updates) {
    const craneUpdateOps = updates.map((u) => ({
      updateOne: {
        filter: { _id: u.craneId },
        update: {
          $set: {
            location: u.location,
            fuelLevel: u.fuelLevel,
            engineHealth: u.engineHealth,
            engineTemperature: u.engineTemperature,
            oilPressure: u.oilPressure,
            batteryHealth: u.batteryHealth,
            speed: u.speed,
            runtimeHours: u.runtimeHours,
          },
        },
      },
    }));

    await retry(
      () => Crane.bulkWrite(craneUpdateOps, { ordered: false }),
      { maxAttempts: 3, baseDelayMs: 150, maxDelayMs: 1000 }
    );
  }

  broadcastUpdates(updates) {
    const timestamp = new Date();
    for (const update of updates) {
      this.socketService.emitCraneUpdate(update, timestamp);
    }
  }

  broadcastAlerts(alerts) {
    if (!alerts.length) return;

    const timestamp = new Date();
    for (const alert of alerts) {
      this.socketService.emitAlert(alert, timestamp);
    }
  }
}

module.exports = SimulationService;
