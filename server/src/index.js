import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { usersRouter } from "./routes/users.js";
import { ordersRouter } from "./routes/orders.js";

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT;

const app = express();
app.use(
  cors({
    origin: ["*"],
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/users", usersRouter);
app.use("/api/orders", ordersRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
      console.log("Connected to MongoDB");
    });
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });
