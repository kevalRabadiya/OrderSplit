import { Router } from "express";
import {
  comparePassword,
  hashPassword,
  normalizeUsername,
  requireAuth,
  signAuthToken,
  type AuthenticatedRequest,
} from "../auth.js";
import { User } from "../models/User.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RegisterBody = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  username?: unknown;
  password?: unknown;
};

authRouter.post("/register", async (req, res, next) => {
  try {
    const { name, phone, email, address, username, password } = req.body as RegisterBody;
    if (!name || !phone || !email || !username || !password) {
      return res.status(400).json({
        error: "name, phone, email, username, and password are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ error: "email must be a valid email address" });
    }

    const normalizedUsername = normalizeUsername(String(username));
    if (normalizedUsername.length < 3) {
      return res.status(400).json({ error: "username must be at least 3 characters" });
    }

    const plainPassword = String(password);
    if (plainPassword.length < 4) {
      return res.status(400).json({ error: "password must be at least 4 characters" });
    }

    const passwordHash = await hashPassword(plainPassword);
    const user = await User.create({
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: normalizedEmail,
      address: address != null ? String(address).trim() : "",
      username: normalizedUsername,
      passwordHash,
      tokenVersion: 0,
    });

    const token = signAuthToken({ userId: String(user._id) });
     res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        address: user.address,
        username: user.username,
      },
    });
  } catch (e) {
    if (
      typeof e === "object" &&
      e != null &&
      "code" in e &&
      (e as { code?: unknown }).code === 11000
    ) {
      return res.status(400).json({ error: "email or username already exists" });
    }
    next(e);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body as { username?: unknown; password?: unknown };
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const normalizedUsername = normalizeUsername(String(username));
    const user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isMatch = await comparePassword(String(password), user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = signAuthToken({ userId: String(user._id) });
     res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        address: user.address,
        username: user.username,
      },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // Intentionally no-op: sessions are persistent and are not revoked on logout.
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
