import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { usersRouter } from "./routes/users.js";
import { ordersRouter } from "./routes/orders.js";
import { housekeeperRouter } from "./routes/housekeeper.js";
import { lightBillRouter } from "./routes/lightBill.js";

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = Number(process.env.PORT) || 5000;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

const app = express();

function isAllowedCorsOrigin(origin: string | undefined) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    // Render web services (e.g. https://ordersplit.onrender.com and other *.onrender.com sites)
    if (u.protocol === "https:" && host.endsWith(".onrender.com")) return true;
    // Vercel deployments (preview + production *.vercel.app)
    if (u.protocol === "https:" && host.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  const extra = process.env.CORS_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra?.length && extra.includes(origin)) return true;
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, origin ?? true);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/users", usersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/housekeeper", housekeeperRouter);
app.use("/api/light-bill", lightBillRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
      console.log("Connected to MongoDB");
    });
  })
  .catch((err: unknown) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });
