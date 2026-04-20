import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "./models/User.js";

const jwtSecret = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required");
}
const JWT_SECRET: string = jwtSecret;

type JwtPayload = {
  userId: string;
};

export type AuthenticatedRequest = Request & {
  auth?: { userId: string };
};

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signAuthToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET);
}

function verifyAuthToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded || typeof decoded !== "object" || !("userId" in decoded)) {
    throw new Error("Invalid token payload");
  }
  return decoded as JwtPayload;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const decoded = verifyAuthToken(token);
    const user = await User.findById(decoded.userId).select("_id").lean();
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.auth = { userId: decoded.userId };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
