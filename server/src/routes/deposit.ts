import { Router } from "express";
import mongoose from "mongoose";
import { Deposit } from "../models/Deposit.js";
import { User } from "../models/User.js";

export const depositRouter = Router();

const SINGLETON_KEY = "current";

type AllocationInput = {
  userId?: unknown;
  amount?: unknown;
};

depositRouter.get("/", async (_req, res, next) => {
  try {
    const row = await Deposit.findOne({ singletonKey: SINGLETON_KEY }).lean();
    if (!row) {
      return res.json({
        singletonKey: SINGLETON_KEY,
        totalAmount: 0,
        allocations: [],
      });
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

depositRouter.put("/", async (req, res, next) => {
  try {
    const body = req.body as {
      totalAmount?: unknown;
      allocations?: unknown;
    };
    const totalAmount = Number(body.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      return res.status(400).json({ error: "totalAmount must be a number >= 0" });
    }

    const rawAllocs = Array.isArray(body.allocations) ? body.allocations : [];
    const merged = new Map<string, number>();

    for (const raw of rawAllocs) {
      const item = raw as AllocationInput;
      const userId = String(item.userId ?? "");
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ error: "allocations[].userId must be a valid user id" });
      }
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: "allocations[].amount must be a number >= 0" });
      }
      if (amount === 0) continue;
      merged.set(userId, (merged.get(userId) || 0) + amount);
    }

    const userIds = [...merged.keys()];
    if (userIds.length > 0) {
      const usersFound = await User.find({
        _id: { $in: userIds },
      })
        .select("_id")
        .lean();
      const foundSet = new Set(usersFound.map((u) => String(u._id)));
      const missing = userIds.find((id) => !foundSet.has(id));
      if (missing) {
        return res.status(400).json({ error: `Unknown userId in allocations: ${missing}` });
      }
    }

    const normalized = [...merged.entries()].map(([userId, amount]) => ({
      userId,
      amount: Number(amount.toFixed(2)),
    }));
    const allocatedTotal = normalized.reduce((s, a) => s + a.amount, 0);
    if (allocatedTotal > totalAmount + 0.0001) {
      return res
        .status(400)
        .json({ error: "Total allocated amount cannot exceed totalAmount" });
    }

    const row = await Deposit.findOneAndUpdate(
      { singletonKey: SINGLETON_KEY },
      {
        $set: {
          singletonKey: SINGLETON_KEY,
          totalAmount: Number(totalAmount.toFixed(2)),
          allocations: normalized,
        },
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.json(row);
  } catch (e) {
    next(e);
  }
});
