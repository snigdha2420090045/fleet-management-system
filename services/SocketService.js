class SocketService {
  constructor(io) {
    this.io = io;
  }

  emitCraneUpdate(update, timestamp = new Date()) {
    if (!this.io) return;

    const craneId = update.craneId.toString();
    const coordinates = update.location.coordinates;

    this.emit("tracking-room", "live-tracking-update", {
      craneId,
      location: coordinates,
      speed: update.speed,
      fuelLevel: update.fuelLevel,
      engineHealth: update.engineHealth,
      engineTemperature: update.engineTemperature,
      status: update.status,
      timestamp,
    });

    this.emit(`crane-${craneId}`, "crane-update", {
      id: craneId,
      location: coordinates,
      fuelLevel: update.fuelLevel,
      engineHealth: update.engineHealth,
      engineTemperature: update.engineTemperature,
      oilPressure: update.oilPressure,
      batteryHealth: update.batteryHealth,
      speed: update.speed,
      status: update.status,
      timestamp,
    });
  }

  emitAlert(alert, timestamp = new Date()) {
    if (!this.io) return;

    this.emit("alerts-room", "new-alert", {
      craneId: alert.craneId.toString(),
      registrationNumber: alert.registrationNumber,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
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
