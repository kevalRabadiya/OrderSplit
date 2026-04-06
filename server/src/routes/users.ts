import { Router } from "express";
import { User } from "../models/User.js";

export const usersRouter = Router();

usersRouter.post("/", async (req, res, next) => {
  try {
    const { name, phone, address } = req.body as {
      name?: unknown;
      phone?: unknown;
      address?: unknown;
    };
    if (!name || !phone) {
      return res.status(400).json({ error: "name and phone are required" });
    }
    const user = await User.create({
      name: String(name).trim(),
      phone: String(phone).trim(),
      address: address != null ? String(address).trim() : "",
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

usersRouter.get("/", async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (e) {
    next(e);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) {
    next(e);
  }
});
