require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Crane = require("./models/Crane");
const FuelLog = require("./models/FuelLog");
const RepairLog = require("./models/RepairLog");
const TrackingLog = require("./models/TrackingLog");
const Notification = require("./models/Notification");
const Alert = require("./models/Alert");
const {
  ROLES,
  CRANE_STATUS,
  ENGINE_STATUS,
  TRACKING_SOURCE,
  FUEL_LOG_TYPES,
  REPAIR_STATUS,
  NOTIFICATION_TYPES,
} = require("./config/constants");

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fleet_management";
    await mongoose.connect(mongoUri);
    console.log("✓ Connected to MongoDB");

    // Clear collections
    await User.deleteMany({});
    await Crane.deleteMany({});
    await FuelLog.deleteMany({});
    await RepairLog.deleteMany({});
    await TrackingLog.deleteMany({});
    await Notification.deleteMany({});
    await Alert.deleteMany({});
    console.log("✓ Cleared existing data");

    // Create users
    const adminUser = await User.create({
      name: "Admin User",
      email: "admin@fleet.com",
      username: "admin",
      password: "admin123",
      role: ROLES.ADMIN,
      phone: "+1234567890",
    });

    const managerUser = await User.create({
      name: "Manager User",
      email: "manager@fleet.com",
      username: "manager",
      password: "manager123",
      role: ROLES.MANAGER,
      phone: "+1234567891",
    });

    const operators = [];
    for (let i = 1; i <= 10; i++) {
      const operator = await User.create({
        name: `Operator ${i}`,
        email: `operator${i}@fleet.com`,
        username: `operator${i}`,
        password: "operator123",
        role: ROLES.OPERATOR,
        phone: `+123456789${i}`,
      });
      operators.push(operator);
    }

    console.log("✓ Created 12 users (1 admin, 1 manager, 10 operators)");

    // Create cranes
    const cranes = [];
    const craneModels = [
      "Liebherr LTM 1200",
      "Tadano GR-600XL",
      "Komatsu LR800",
      "Manitowoc 18000",
      "Zoomlion QUY50",
    ];
    const manufacturers = ["Liebherr", "Tadano", "Komatsu", "Manitowoc", "Zoomlion"];
    const statusValues = Object.values(CRANE_STATUS);

    // NYC area coordinates for more realistic locations
    const centerLat = 40.7128;
    const centerLng = -74.006;

    for (let i = 1; i <= 50; i++) {
      const operator = operators[(i - 1) % operators.length];
      const latitude = centerLat + (Math.random() - 0.5) * 0.15;
      const longitude = centerLng + (Math.random() - 0.5) * 0.15;
      const isRunning = Math.random() > 0.5;

      const crane = await Crane.create({
        registrationNumber: `CRANE-${String(i).padStart(4, "0")}`,
        model: craneModels[i % craneModels.length],
        manufacturer: manufacturers[i % manufacturers.length],
        year: 2020 + (i % 5),
        status: isRunning ? CRANE_STATUS.RUNNING : statusValues[i % statusValues.length],
        assignedOperator: operator._id,
        fuelLevel: Math.floor(Math.random() * 100),
        engineHealth: 70 + Math.random() * 30,
        engineTemperature: isRunning ? 70 + Math.random() * 40 : 20 + Math.random() * 30,
        oilPressure: 40 + Math.random() * 20,
        batteryHealth: 85 + Math.random() * 15,
        runtimeHours: Math.floor(Math.random() * 5000),
        idleHours: Math.floor(Math.random() * 3000),
        lastServiceDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        nextServiceDate: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000),
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        speed: isRunning ? Math.random() * 60 : 0,
        isActive: true,
      });
      cranes.push(crane);
      operator.assignedCranes.push(crane._id);
    }

    // Save all operators with their assigned cranes
    for (let operator of operators) {
      await operator.save();
    }

    console.log("✓ Created 50 cranes");

    // Create fuel logs
    for (let i = 0; i < 50; i++) {
      await FuelLog.create({
        crane: cranes[i]._id,
        loggedBy: managerUser._id,
        type: FUEL_LOG_TYPES.REFILL,
        quantity: 100 + Math.random() * 200,
        cost: 500 + Math.random() * 1500,
        fuelLevelBefore: Math.floor(Math.random() * 50),
        fuelLevelAfter: 80 + Math.random() * 20,
        station: `Station-${i % 5}`,
        odometer: Math.floor(Math.random() * 50000),
        notes: `Regular refill for crane ${i + 1}`,
      });

      await FuelLog.create({
        crane: cranes[i]._id,
        loggedBy: operators[i % operators.length]._id,
        type: FUEL_LOG_TYPES.CONSUMPTION,
        quantity: 20 + Math.random() * 60,
        fuelLevelBefore: 100,
        fuelLevelAfter: 50 + Math.random() * 40,
        notes: `Daily consumption for crane ${i + 1}`,
      });
    }

    console.log("✓ Created fuel logs");

    // Create repair logs
    for (let i = 0; i < 30; i++) {
      await RepairLog.create({
        crane: cranes[i]._id,
        reportedBy: operators[i % operators.length]._id,
        mechanic: `Mechanic-${i % 5}`,
        title: `Service ${i + 1}`,
        description: `Routine maintenance and inspection for crane ${i + 1}`,
        status: [REPAIR_STATUS.SCHEDULED, REPAIR_STATUS.COMPLETED, REPAIR_STATUS.IN_PROGRESS][i % 3],
        cost: 500 + Math.random() * 2000,
        spareParts: [
          { name: "Oil Filter", quantity: 2, cost: 100 },
          { name: "Hydraulic Hose", quantity: 1, cost: 300 },
        ],
        scheduledDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
        completedDate: i % 3 === 1 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null,
        nextServicePrediction: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      });
    }

    console.log("✓ Created repair logs");

    // Create tracking logs
    for (let i = 0; i < 50; i++) {
      await TrackingLog.create({
        crane: cranes[i]._id,
        location: {
          type: "Point",
          coordinates: cranes[i].location.coordinates,
        },
        speed: Math.random() * 60,
        heading: Math.floor(Math.random() * 360),
        altitude: 0,
        engineStatus: cranes[i].status === CRANE_STATUS.RUNNING ? ENGINE_STATUS.ON : ENGINE_STATUS.OFF,
        fuelLevel: cranes[i].fuelLevel,
        source: TRACKING_SOURCE.GPS,
      });
    }

    console.log("✓ Created tracking logs");

    // Create alerts
    for (let i = 0; i < 15; i++) {
      const crane = cranes[i];
      const alertType = [
        NOTIFICATION_TYPES.FUEL,
        NOTIFICATION_TYPES.WARNING,
        NOTIFICATION_TYPES.CRITICAL,
        NOTIFICATION_TYPES.SERVICE,
      ][i % 4];

      await Alert.create({
        crane: crane._id,
        registrationNumber: crane.registrationNumber,
        type: alertType,
        severity: i % 3 === 0 ? "critical" : i % 2 === 0 ? "warning" : "info",
        message: `Alert for crane ${crane.registrationNumber}: System issue detected`,
        metric: ["fuel", "engineHealth", "engineTemp"][i % 3],
        metricValue: Math.random() * 100,
        threshold: 50,
        isResolved: i % 4 === 0,
      });
    }

    console.log("✓ Created alerts");

    // Create notifications
    for (let i = 0; i < 20; i++) {
      await Notification.create({
        recipient: operators[i % operators.length]._id,
        crane: cranes[i]._id,
        type: [
          NOTIFICATION_TYPES.FUEL,
          NOTIFICATION_TYPES.SERVICE,
          NOTIFICATION_TYPES.WARNING,
          NOTIFICATION_TYPES.INFO,
        ][i % 4],
        title: `Crane ${i + 1} - Notification`,
        message: `This is a sample notification for crane ${i + 1}`,
        isRead: i % 3 === 0,
        readAt: i % 3 === 0 ? new Date() : null,
      });
    }

    console.log("✓ Created notifications");

    console.log("\n✅ Database seeded successfully!");
    console.log("\n📋 Default Users:");
    console.log("  Admin:      admin / admin123");
    console.log("  Manager:    manager / manager123");
    console.log("  Operators:  operator1-10 / operator123");
    console.log("\n📊 Data Summary:");
    console.log("  • 50 Cranes");
    console.log("  • 100 Fuel Logs");
    console.log("  • 30 Repair Logs");
    console.log("  • 50 Tracking Logs");
    console.log("  • 15 Alerts");
    console.log("  • 20 Notifications");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding error:", error.message);
    process.exit(1);
  }
};

seedDatabase();
