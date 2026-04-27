import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { usersRouter } from "./routes/users.js";
import { authRouter } from "./routes/auth.js";
import { ordersRouter } from "./routes/orders.js";
import { housekeeperRouter } from "./routes/housekeeper.js";
import { lightBillRouter } from "./routes/lightBill.js";
import { depositRouter } from "./routes/deposit.js";
import { startDailyReportJob } from "./jobs/dailyReportJob.js";

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = Number(process.env.PORT) || 5000;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

const app = express();

app.use(
  cors({
    origin: true,
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
app.use("/api/auth", authRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/housekeeper", housekeeperRouter);
app.use("/api/light-bill", lightBillRouter);
app.use("/api/deposit", depositRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on ${process.env.NODE_ENV === "production" ?  `Production`  : `http://localhost:${PORT}`}`);
      console.log("Connected to MongoDB");
      startDailyReportJob();
    });
  })
  .catch((err: unknown) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });
