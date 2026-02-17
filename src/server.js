require("dotenv").config();
const express = require("express");
const Redis = require("ioredis");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const jobRoutes = require("./routes/jobRoutes");
const proxyRoutes = require("./routes/proxyRoutes");
const statsRoutes = require("./routes/statsRoutes");
const connectMongo = require("./config/mongo.config");
const Job = require("./models/job.model");

const app = express();
app.use(express.json());

// -------------------
// START EVERYTHING INSIDE ASYNC FUNCTION
// -------------------
async function startServer() {
  try {
    // 🔥 WAIT FOR MONGO CONNECTION
    await connectMongo();
    console.log("✅ MongoDB Connected");

    // -------------------
    // CORS
    // -------------------
    app.use(
      cors({
        origin: [
          "http://localhost:8080",
          "https://frontend-web-c2zuzjwft-nitin-580s-projects.vercel.app",
        ],
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "x-api-key"],
      })
    );

    // -------------------
    // Redis
    // -------------------
    const redis = new Redis(process.env.REDIS_URL);
    const subscriber = new Redis(process.env.REDIS_URL);

    console.log("✅ Redis Connected");

    // -------------------
    // Health
    // -------------------
    app.get("/health", async (req, res) => {
      try {
        await redis.ping();
        res.json({ status: "ok" });
      } catch {
        res.status(500).json({ status: "error" });
      }
    });

    // -------------------
    // API KEY
    // -------------------
    app.use((req, res, next) => {
      if (req.headers["x-api-key"] !== process.env.API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });

    // -------------------
    // Routes
    // -------------------
    app.use("/api", jobRoutes);
    app.use("/api/proxy", proxyRoutes);
    app.use("/api/stats", statsRoutes);

    // -------------------
    // HTTP + SOCKET
    // -------------------
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:8080",
          "https://frontend-web-c2zuzjwft-nitin-580s-projects.vercel.app",
        ],
      },
    });

    io.on("connection", async (socket) => {
      console.log("🟢 WebSocket connected:", socket.id);

      try {
        // 🔥 SAFE analytics fetch (mongo is ready now)
        const total = await Job.countDocuments();
        const completed = await Job.countDocuments({ status: "completed" });
        const failed = await Job.countDocuments({ status: "failed" });
        const running = await Job.countDocuments({ status: "running" });

        const successRate =
          total > 0
            ? `${((completed / total) * 100).toFixed(2)}%`
            : "0%";

        socket.emit("analyticsUpdate", {
          total,
          completed,
          failed,
          running,
          successRate,
        });

      } catch (err) {
        console.error("Analytics fetch failed:", err.message);
      }

      socket.on("disconnect", () => {
        console.log("🔴 WebSocket disconnected:", socket.id);
      });
    });

    // -------------------
    // Redis PubSub
    // -------------------
    subscriber.subscribe("jobEvents");

    subscriber.on("message", async (channel, message) => {
      if (channel !== "jobEvents") return;

      const data = JSON.parse(message);

      io.emit("jobUpdate", data);

      try {
        const total = await Job.countDocuments();
        const completed = await Job.countDocuments({ status: "completed" });
        const failed = await Job.countDocuments({ status: "failed" });
        const running = await Job.countDocuments({ status: "running" });

        const successRate =
          total > 0
            ? `${((completed / total) * 100).toFixed(2)}%`
            : "0%";

        io.emit("analyticsUpdate", {
          total,
          completed,
          failed,
          running,
          successRate,
        });
      } catch (err) {
        console.error("Realtime analytics failed:", err.message);
      }
    });

    // -------------------
    server.listen(3000, () => {
      console.log("🚀 Server running on port 3000");
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

// 🔥 Start
startServer();