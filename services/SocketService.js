class SocketService {
  constructor(io) {
    this.io = io;
  }

  emitCraneUpdate(update, timestamp = new Date()) {
    if (!this.io) return;

    const craneId = update.craneId.toString();
    const coordinates = update.location.coordinates;

    const trackingPayload = {
      craneId,
      location: coordinates,
      speed: update.speed,
      fuelLevel: update.fuelLevel,
      engineHealth: update.engineHealth,
      engineTemperature: update.engineTemperature,
      status: update.status,
      timestamp,
    };

    const cranePayload = {
      id: craneId,
      craneId,
      location: coordinates,
      fuelLevel: update.fuelLevel,
      engineHealth: update.engineHealth,
      engineTemperature: update.engineTemperature,
      oilPressure: update.oilPressure,
      batteryHealth: update.batteryHealth,
      speed: update.speed,
      status: update.status,
      timestamp,
    };

    this.emit("tracking-room", "live-tracking-update", trackingPayload);
    this.emit("tracking-room", "tracking:update", trackingPayload);
    this.emit(`crane-${craneId}`, "crane-update", cranePayload);
    this.emit(`crane-${craneId}`, "crane:update", cranePayload);
  }

  emitAlert(alert, timestamp = new Date()) {
    if (!this.io) return;

    const payload = {
      alertId: alert._id?.toString(),
      craneId: (alert.craneId || alert.crane).toString(),
      registrationNumber: alert.registrationNumber,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      serviceType: alert.serviceType,
      dueDate: alert.dueDate,
      description: alert.notes || alert.description,
      timestamp,
    };

    this.emit("alerts-room", "new-alert", payload);
    this.emit("alerts-room", "alert:new", payload);
  }

  emitFuelUpdate(payload, timestamp = new Date()) {
    if (!this.io) return;

    this.emit("tracking-room", "fuel:update", {
      ...payload,
      timestamp,
    });
  }

  emitDashboardUpdate(payload = {}, timestamp = new Date()) {
    if (!this.io) return;

    this.emit("tracking-room", "dashboard:update", {
      ...payload,
      timestamp,
    });
  }

  emit(room, event, payload) {
    try {
      this.io.to(room).emit(event, payload);
    } catch (err) {
      console.error(`[SocketService] Failed to emit ${event} to ${room}:`, err.message);
    }
  }
}

module.exports = SocketService;
