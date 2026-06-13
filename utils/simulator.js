const SimulationService = require("../services/SimulationService");

let simulationService = null;

const startSimulation = (io, updateIntervalMs = 2500) => {
  if (!simulationService) {
    simulationService = new SimulationService(io);
  }

  simulationService.start(updateIntervalMs);
  return simulationService;
};

module.exports = startSimulation;
