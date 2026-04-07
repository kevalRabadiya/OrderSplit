import { Router } from "express";
import type { FilterQuery } from "mongoose";
import mongoose from "mongoose";
import { HttpError, isHttpError } from "../httpError.js";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import {
  calculateTotal,
  mapPricingErrorToHttp,
  type ExtraItemsInput,
  type ParsedExtraItems,
} from "../pricing.js";

export const ordersRouter = Router();

type OrderBody = Record<string, unknown>;

function normalizeExtraItems(body: OrderBody) {
  const e = (body.extraItems ?? {}) as ExtraItemsInput;
  return {
    roti: e.roti,
    rice: e.rice,
    sabji1: e.sabji1,
    sabji2: e.sabji2,
    dalRiceType: e.dalRiceType,
  };
}

function normalizeThaliIds(body: OrderBody): number[] {
  if (Array.isArray(body.thaliIds)) {
    const out: number[] = [];
    for (const raw of body.thaliIds) {
      const id = Number(raw);
      if (!Number.isInteger(id) || id < 1 || id > 5) {
        throw new HttpError(
          400,
          "each thaliIds entry must be an integer from 1 to 5"
        );
      }
      out.push(id);
    }
    return out;
  }
  const t = body.thaliId;
  if (t === undefined || t === null || t === "" || t === "none") {
    return [];
  }
  const id = Number(t);
  if (!Number.isInteger(id) || id < 1 || id > 5) {
    throw new HttpError(400, "thaliId must be null or an integer 1–5");
  }
  return [id];
}

type LeanOrderLike = {
  thaliIds?: number[];
  thaliId?: number | null;
  deletedAt?: Date | null;
} & Record<string, unknown>;

function mergedThaliIds(order: LeanOrderLike | null | undefined): number[] {
  if (!order) return [];
  if (Array.isArray(order.thaliIds) && order.thaliIds.length > 0) {
    return order.thaliIds;
  }
  if (order.thaliId != null) return [order.thaliId];
  return [];
}

function serializeOrder(order: LeanOrderLike | null | undefined) {
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

function orderPayloadFromBody(body: OrderBody) {
  const thaliIds = normalizeThaliIds(body);
  const extraItems = normalizeExtraItems(body);
  const dateKey = body.date
    ? String(body.date).slice(0, 10)
    : todayDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new HttpError(400, "date must be YYYY-MM-DD");
  }
  let total: number;
  let parsedExtras: ParsedExtraItems;
  try {
    ({ total, parsedExtras } = calculateTotal({ thaliIds, extraItems }));
  } catch (e) {
    const mapped = mapPricingErrorToHttp(e);
    if (mapped) throw mapped;
    throw e;
  }
  const extraItemsDoc = {
    roti: parsedExtras.roti,
    rice: parsedExtras.rice,
    sabji1: parsedExtras.sabji1,
    sabji2: parsedExtras.sabji2,
    dalRiceType: parsedExtras.dalRiceType,
    sabji: 0,
    dalRice: 0,
  };
  return { dateKey, thaliIds, extraItems: extraItemsDoc, total };
}

function resolveDateKeyFromQuery(query: Record<string, unknown>) {
  const dateKey =
    query.date != null ? String(query.date).slice(0, 10) : todayDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new HttpError(400, "date must be YYYY-MM-DD");
  }
  return dateKey;
}

function parseHistoryDate(value: unknown, fallback: string) {
  const s = value != null ? String(value).slice(0, 10) : fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new HttpError(400, "from and to must be YYYY-MM-DD");
  }
  return s;
}

function buildOrderUpdate(
  userId: string,
  payload: ReturnType<typeof orderPayloadFromBody>
) {
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
    const body = req.body as OrderBody;
    let thaliIds: number[];
    try {
      thaliIds = normalizeThaliIds(body);
    } catch (e) {
      if (isHttpError(e)) {
        return res.status(e.statusCode).json({ error: e.message });
      }
      throw e;
    }
    const extraItems = normalizeExtraItems(body);
    let total: number;
    try {
      ({ total } = calculateTotal({ thaliIds, extraItems }));
    } catch (e) {
      const mapped = mapPricingErrorToHttp(e);
      if (mapped) {
        return res.status(mapped.statusCode).json({ error: mapped.message });
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
    const body = req.body as OrderBody & { userId?: unknown };
    const { userId } = body;
    if (!userId || !mongoose.isValidObjectId(String(userId))) {
      return res.status(400).json({ error: "valid userId is required" });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ error: "User not found" });

    let payload: ReturnType<typeof orderPayloadFromBody>;
    try {
      payload = orderPayloadFromBody(body);
    } catch (e) {
      if (isHttpError(e)) {
        return res.status(e.statusCode).json({ error: e.message });
      }
      throw e;
    }

    const order = await Order.findOneAndUpdate(
      { userId, dateKey: payload.dateKey },
      buildOrderUpdate(String(userId), payload),
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.status(201).json({
      totalAmount: payload.total,
      order: serializeOrder(order ?? undefined),
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

    let payload: ReturnType<typeof orderPayloadFromBody>;
    try {
      payload = orderPayloadFromBody(req.body as OrderBody);
    } catch (e) {
      if (isHttpError(e)) {
        return res.status(e.statusCode).json({ error: e.message });
      }
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
      order: serializeOrder(order ?? undefined),
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
    let dateKey: string;
    try {
      dateKey = resolveDateKeyFromQuery(
        req.query as Record<string, unknown>
      );
    } catch (e) {
      if (isHttpError(e)) {
        return res.status(e.statusCode).json({ error: e.message });
      }
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

type HistoryFilter = FilterQuery<{
  dateKey: string;
  deletedAt: null;
  userId?: string;
}>;

ordersRouter.get("/", async (req, res, next) => {
  try {
    const today = todayDateKey();
    const q = req.query as Record<string, unknown>;
    let from: string;
    let to: string;
    try {
      from = parseHistoryDate(q.from, today);
      to = parseHistoryDate(q.to != null ? q.to : null, from);
    } catch (e) {
      if (isHttpError(e)) {
        return res.status(e.statusCode).json({ error: e.message });
      }
      throw e;
    }
    if (from > to) {
      return res.status(400).json({ error: "from must be on or before to" });
    }
    const filter: HistoryFilter = {
      dateKey: { $gte: from, $lte: to },
      deletedAt: null,
    };
    if (q.userId != null && String(q.userId).trim() !== "") {
      const uid = String(q.userId);
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
      const { userId: rawUserId, ...orderRest } = doc as LeanOrderLike & {
        userId?: unknown;
      };
      let user: { _id: string; name?: string; phone?: string } | null = null;
      let userIdStr = "";
      if (
        rawUserId &&
        typeof rawUserId === "object" &&
        rawUserId !== null &&
        "_id" in rawUserId
      ) {
        const u = rawUserId as {
          _id: mongoose.Types.ObjectId;
          name?: string;
          phone?: string;
        };
        user = {
          _id: u._id.toString(),
          name: u.name,
          phone: u.phone,
        };
        userIdStr = user._id;
      } else if (rawUserId) {
        userIdStr = String(rawUserId);
      }
      const oid =
        rawUserId &&
        typeof rawUserId === "object" &&
        rawUserId !== null &&
        "_id" in rawUserId
          ? (rawUserId as { _id: mongoose.Types.ObjectId })._id
          : rawUserId;
      const serialized = serializeOrder({
        ...orderRest,
        userId: oid,
      } as LeanOrderLike);
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
    let dateKey: string;
    try {
      dateKey = resolveDateKeyFromQuery(
        req.query as Record<string, unknown>
      );
    } catch (e) {
      if (isHttpError(e)) {
        return res.status(e.statusCode).json({ error: e.message });
      }
      throw e;
    }
    const order = await Order.findOne({
      userId,
      dateKey,
      deletedAt: null,
    }).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(serializeOrder(order));
  } catch (e) {
    next(e);
  }
});
