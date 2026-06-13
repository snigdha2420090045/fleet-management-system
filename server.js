require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const SimulationService = require("./services/SimulationService");

const PORT = process.env.PORT || 5000;
const SIMULATION_INTERVAL_MS = 2500;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  },
});

global.io = io;

let simulationService = null;
let isShuttingDown = false;

io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on("subscribe-tracking", () => {
    socket.join("tracking-room");
  });

  socket.on("subscribe-alerts", () => {
    socket.join("alerts-room");
  });

  socket.on("subscribe-crane", (craneId) => {
    if (!craneId) return;
    socket.join(`crane-${craneId}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });

  socket.on("error", (error) => {
    console.error(`[Socket.IO] Error from ${socket.id}:`, error);
  });
});

const startServer = async () => {
  await connectDB();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Fleet Management API running on port ${PORT}`);
    console.log("Socket.IO ready for real-time updates");

    simulationService = new SimulationService(io);
    simulationService.start(SIMULATION_INTERVAL_MS);
  });
};

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully...`);

  try {
    if (simulationService) {
      await simulationService.stop();
    }

    io.close();

    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000).unref();
  } catch (err) {
    console.error("Shutdown failed:", err);
    process.exit(1);
  }
};

startServer().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  gracefulShutdown("unhandledRejection");
});
