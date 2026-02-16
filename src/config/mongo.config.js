const mongoose = require("mongoose");

mongoose.set("bufferCommands", false); // prevents silent buffering

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = connectMongo;