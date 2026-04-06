import { Router } from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { calculateTotal } from "../pricing.js";

export const ordersRouter = Router();

function normalizeExtraItems(body) {
  const e = body?.extraItems ?? {};
  return {
    roti: e.roti,
    sabji: e.sabji,
    dalRice: e.dalRice,
    rice: e.rice,
  };
}

function normalizeThaliId(body) {
  const t = body?.thaliId;
  if (t === undefined || t === null || t === "" || t === "none") {
    return null;
  }
  return t;
}

function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

ordersRouter.post("/preview", async (req, res, next) => {
  try {
    const thaliId = normalizeThaliId(req.body);
    const extraItems = normalizeExtraItems(req.body);
    let total;
    try {
      ({ total } = calculateTotal({ thaliId, extraItems }));
    } catch (e) {
      if (e.code === "INVALID_THALI" || e.code === "INVALID_EXTRA") {
        return res.status(400).json({ error: e.message });
      }
      throw e;
    }
    res.json({ totalAmount: total });
  } catch (e) {
    next(e);
  }
});

ordersRouter.post("/", async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId || !mongoose.isValidObjectId(String(userId))) {
      return res.status(400).json({ error: "valid userId is required" });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ error: "User not found" });

    const thaliId = normalizeThaliId(req.body);
    const extraItems = normalizeExtraItems(req.body);
    const dateKey = req.body.date
      ? String(req.body.date).slice(0, 10)
      : todayDateKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    let total;
    try {
      ({ total } = calculateTotal({ thaliId, extraItems }));
    } catch (e) {
      if (e.code === "INVALID_THALI" || e.code === "INVALID_EXTRA") {
        return res.status(400).json({ error: e.message });
      }
      throw e;
    }

    const order = await Order.findOneAndUpdate(
      { userId, dateKey },
      {
        userId,
        dateKey,
        thaliId: thaliId == null ? null : Number(thaliId),
        extraItems: {
          roti: Number(extraItems.roti) || 0,
          sabji: Number(extraItems.sabji) || 0,
          dalRice: Number(extraItems.dalRice) || 0,
          rice: Number(extraItems.rice) || 0,
        },
        totalAmount: total,
        createdAt: new Date(),
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.status(201).json({
      totalAmount: total,
      order,
    });
  } catch (e) {
    next(e);
  }
});

ordersRouter.get("/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(String(userId))) {
      return res.status(400).json({ error: "invalid userId" });
    }
    const dateKey =
      req.query.date != null
        ? String(req.query.date).slice(0, 10)
        : todayDateKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    const order = await Order.findOne({ userId, dateKey }).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (e) {
    next(e);
  }
});
