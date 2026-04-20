import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    address: { type: String, trim: true, default: "" },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, required: true, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export const User = mongoose.model("User", userSchema);
