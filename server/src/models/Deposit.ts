import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const depositSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: "current",
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    allocations: {
      type: [allocationSchema],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
);

export const Deposit = mongoose.model("Deposit", depositSchema);
