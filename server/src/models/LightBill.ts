import mongoose from "mongoose";

const monthKeyRe = /^\d{4}-\d{2}$/;

const lightBillSchema = new mongoose.Schema(
  {
    fromMonthKey: {
      type: String,
      required: true,
      match: monthKeyRe,
      index: true,
    },
    toMonthKey: {
      type: String,
      required: true,
      match: monthKeyRe,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true, versionKey: false }
);

lightBillSchema.index({ fromMonthKey: 1, toMonthKey: 1 }, { unique: true });

export const LightBill = mongoose.model("LightBill", lightBillSchema);
