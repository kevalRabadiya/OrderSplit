import mongoose from "mongoose";

const extraItemsSchema = new mongoose.Schema(
  {
    roti: { type: Number, default: 0, min: 0 },
    sabji: { type: Number, default: 0, min: 0 },
    dalRice: { type: Number, default: 0, min: 0 },
    rice: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    /** @deprecated legacy single thali; use thaliIds */
    thaliId: { type: Number, default: null },
    thaliIds: {
      type: [Number],
      default: [],
    },
    extraItems: { type: extraItemsSchema, default: () => ({}) },
    totalAmount: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now },
    /** Soft delete: set when “deleted”; omitted or null means active */
    deletedAt: { type: Date, default: null },
  },
  { versionKey: false }
);

orderSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

export const Order = mongoose.model("Order", orderSchema);
