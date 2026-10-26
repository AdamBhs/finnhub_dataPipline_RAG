import express from "express";
import cors from "cors";
import "dotenv/config";
import marketRoutes from "./routes/market.routes.js";
import { connectCassandra } from "./db/cassandra.js";
import healthRoutes from "./routes/health.routes.js";
import agentRoutes from "./routes/agent.routes.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }),
);
//
app.use(express.json());

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/market-data", marketRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

async function startServer(): Promise<void> {
  try {
    await connectCassandra();

    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
}

void startServer();