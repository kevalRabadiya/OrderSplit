import { Router } from "express";
import { LightBill } from "../models/LightBill.js";

export const lightBillRouter = Router();

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

lightBillRouter.get("/", async (req, res, next) => {
  try {
    const raw = req.query.year;
    const year =
      typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: "year must be 2000–2100" });
    }
    const yStart = `${year}-01`;
    const yEnd = `${year}-12`;
    const rows = await LightBill.find({
      fromMonthKey: { $lte: yEnd },
      toMonthKey: { $gte: yStart },
    })
      .sort({ fromMonthKey: 1, toMonthKey: 1 })
      .lean();
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

lightBillRouter.put("/", async (req, res, next) => {
  try {
    const body = req.body as {
      fromMonthKey?: unknown;
      toMonthKey?: unknown;
      amount?: unknown;
    };
    const fromMonthKey =
      typeof body.fromMonthKey === "string" ? body.fromMonthKey : "";
    const toMonthKey =
      typeof body.toMonthKey === "string" ? body.toMonthKey : "";
    if (!MONTH_KEY_RE.test(fromMonthKey) || !MONTH_KEY_RE.test(toMonthKey)) {
      return res
        .status(400)
        .json({ error: "fromMonthKey and toMonthKey must be YYYY-MM" });
    }
    if (fromMonthKey > toMonthKey) {
      return res
        .status(400)
        .json({ error: "fromMonthKey must be on or before toMonthKey" });
    }
    const n = typeof body.amount === "number" ? body.amount : Number(body.amount);
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({ error: "amount must be a number >= 0" });
    }

    const row = await LightBill.findOneAndUpdate(
      { fromMonthKey, toMonthKey },
      { $set: { fromMonthKey, toMonthKey, amount: n } },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.json(row);
  } catch (e) {
    next(e);
  }
});
