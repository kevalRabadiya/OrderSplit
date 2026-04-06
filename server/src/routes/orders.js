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

/**
 * @returns {number[]}
 * @throws {{ statusCode: number, message: string }}
 */
function normalizeThaliIds(body) {
  if (Array.isArray(body?.thaliIds)) {
    const out = [];
    for (const raw of body.thaliIds) {
      const id = Number(raw);
      if (!Number.isInteger(id) || id < 1 || id > 5) {
        const err = new Error(
          "each thaliIds entry must be an integer from 1 to 5"
        );
        err.statusCode = 400;
        throw err;
      }
      out.push(id);
    }
    return out;
  }
  const t = body?.thaliId;
  if (t === undefined || t === null || t === "" || t === "none") {
    return [];
  }
  const id = Number(t);
  if (!Number.isInteger(id) || id < 1 || id > 5) {
    const err = new Error("thaliId must be null or an integer 1–5");
    err.statusCode = 400;
    throw err;
  }
  return [id];
}

function mergedThaliIds(order) {
  if (!order) return [];
  if (Array.isArray(order.thaliIds) && order.thaliIds.length > 0) {
    return order.thaliIds;
  }
  if (order.thaliId != null) return [order.thaliId];
  return [];
}

function serializeOrder(order) {
  if (!order) return order;
  const thaliIds = mergedThaliIds(order);
  const { deletedAt: _d, ...rest } = order;
  return { ...rest, thaliIds };
}

function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @throws {{ statusCode: number, message: string }}
 */
function orderPayloadFromBody(body) {
  const thaliIds = normalizeThaliIds(body);
  const extraItems = normalizeExtraItems(body);
  const dateKey = body.date
    ? String(body.date).slice(0, 10)
    : todayDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const err = new Error("date must be YYYY-MM-DD");
    err.statusCode = 400;
    throw err;
  }
  let total;
  try {
    ({ total } = calculateTotal({ thaliIds, extraItems }));
  } catch (e) {
    if (e.code === "INVALID_THALI" || e.code === "INVALID_EXTRA") {
      const err = new Error(e.message);
      err.statusCode = 400;
      throw err;
    }
    throw e;
  }
  const extraItemsDoc = {
    roti: Number(extraItems.roti) || 0,
    sabji: Number(extraItems.sabji) || 0,
    dalRice: Number(extraItems.dalRice) || 0,
    rice: Number(extraItems.rice) || 0,
  };
  return { dateKey, thaliIds, extraItems: extraItemsDoc, total };
}

function resolveDateKeyFromQuery(query) {
  const dateKey =
    query.date != null ? String(query.date).slice(0, 10) : todayDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const err = new Error("date must be YYYY-MM-DD");
    err.statusCode = 400;
    throw err;
  }
  return dateKey;
}

function parseHistoryDate(value, fallback) {
  const s = value != null ? String(value).slice(0, 10) : fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const err = new Error("from and to must be YYYY-MM-DD");
    err.statusCode = 400;
    throw err;
  }
  return s;
}

function buildOrderUpdate(userId, payload) {
  return {
    $set: {
      userId,
      dateKey: payload.dateKey,
      thaliIds: payload.thaliIds,
      extraItems: payload.extraItems,
      totalAmount: payload.total,
      createdAt: new Date(),
      deletedAt: null,
    },
    $unset: { thaliId: "" },
  };
}

ordersRouter.post("/preview", async (req, res, next) => {
  try {
    let thaliIds;
    try {
      thaliIds = normalizeThaliIds(req.body);
    } catch (e) {
      if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
      throw e;
    }
    const extraItems = normalizeExtraItems(req.body);
    let total;
    try {
      ({ total } = calculateTotal({ thaliIds, extraItems }));
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

    let payload;
    try {
      payload = orderPayloadFromBody(req.body);
    } catch (e) {
      if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
      throw e;
    }

    const order = await Order.findOneAndUpdate(
      { userId, dateKey: payload.dateKey },
      buildOrderUpdate(userId, payload),
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.status(201).json({
      totalAmount: payload.total,
      order: serializeOrder(order),
    });
  } catch (e) {
    next(e);
  }
});

ordersRouter.put("/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(String(userId))) {
      return res.status(400).json({ error: "invalid userId" });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ error: "User not found" });

    let payload;
    try {
      payload = orderPayloadFromBody(req.body);
    } catch (e) {
      if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
      throw e;
    }

    const existing = await Order.findOne({
      userId,
      dateKey: payload.dateKey,
      deletedAt: null,
    }).lean();
    if (!existing) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = await Order.findOneAndUpdate(
      { userId, dateKey: payload.dateKey },
      buildOrderUpdate(userId, payload),
      { new: true, runValidators: true }
    ).lean();

    res.json({
      totalAmount: payload.total,
      order: serializeOrder(order),
    });
  } catch (e) {
    next(e);
  }
});

ordersRouter.delete("/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(String(userId))) {
      return res.status(400).json({ error: "invalid userId" });
    }
    let dateKey;
    try {
      dateKey = resolveDateKeyFromQuery(req.query);
    } catch (e) {
      if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
      throw e;
    }
    const updated = await Order.findOneAndUpdate(
      { userId, dateKey, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    ).lean();
    if (!updated) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

ordersRouter.get("/", async (req, res, next) => {
  try {
    const today = todayDateKey();
    let from;
    let to;
    try {
      from = parseHistoryDate(req.query.from, today);
      to = parseHistoryDate(
        req.query.to != null ? req.query.to : null,
        from
      );
    } catch (e) {
      if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
      throw e;
    }
    if (from > to) {
      return res
        .status(400)
        .json({ error: "from must be on or before to" });
    }
    const filter = {
      dateKey: { $gte: from, $lte: to },
      deletedAt: null,
    };
    if (req.query.userId != null && String(req.query.userId).trim() !== "") {
      const uid = String(req.query.userId);
      if (!mongoose.isValidObjectId(uid)) {
        return res.status(400).json({ error: "invalid userId" });
      }
      filter.userId = uid;
    }
    const docs = await Order.find(filter)
      .sort({ dateKey: -1, createdAt: -1 })
      .populate("userId", "name phone")
      .lean();
    const rows = docs.map((doc) => {
      const { userId: rawUserId, ...orderRest } = doc;
      let user = null;
      let userIdStr = "";
      if (rawUserId && typeof rawUserId === "object" && rawUserId._id) {
        user = {
          _id: rawUserId._id.toString(),
          name: rawUserId.name,
          phone: rawUserId.phone,
        };
        userIdStr = user._id;
      } else if (rawUserId) {
        userIdStr = String(rawUserId);
      }
      const serialized = serializeOrder({
        ...orderRest,
        userId: rawUserId?._id ?? rawUserId,
      });
      return {
        ...serialized,
        userId: userIdStr,
        user,
      };
    });
    res.json(rows);
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
    let dateKey;
    try {
      dateKey = resolveDateKeyFromQuery(req.query);
    } catch (e) {
      if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
      throw e;
    }
    const order = await Order.findOne({ userId, dateKey, deletedAt: null }).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(serializeOrder(order));
  } catch (e) {
    next(e);
  }
});
