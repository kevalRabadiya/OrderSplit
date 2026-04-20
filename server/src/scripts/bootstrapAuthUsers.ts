import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { hashPassword, normalizeUsername } from "../auth.js";
import { User } from "../models/User.js";

const MONGODB_URI = process.env.MONGODB_URI;
const TEMP_PASSWORD = process.env.AUTH_TEMP_PASSWORD ?? "1234";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required");
}
const mongoUri: string = MONGODB_URI;

if (TEMP_PASSWORD.length < 4) {
  throw new Error("AUTH_TEMP_PASSWORD must be at least 4 characters");
}

function slugify(input: string) {
  const out = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return out || "user";
}

async function buildUniqueUsername(baseRaw: string, used: Set<string>) {
  const base = normalizeUsername(baseRaw);
  let attempt = base;
  let idx = 1;
  while (used.has(attempt) || (await User.exists({ username: attempt }))) {
    idx += 1;
    attempt = `${base}${idx}`;
  }
  used.add(attempt);
  return attempt;
}

async function run() {
  await mongoose.connect(mongoUri);
  const users = await User.find({
    $or: [{ username: { $exists: false } }, { passwordHash: { $exists: false } }],
  });
  if (users.length === 0) {
    console.log("No users require auth bootstrap.");
    await mongoose.disconnect();
    return;
  }

  const used = new Set<string>();
  const generated: Array<{ userId: string; name: string; email: string; username: string }> = [];
  const passwordHash = await hashPassword(TEMP_PASSWORD);

  for (const user of users) {
    const fromName = slugify(user.name || "");
    const emailLocal = (user.email || "").split("@").at(0) ?? "";
    const fromEmail = slugify(emailLocal);
    const base = fromName !== "user" ? fromName : fromEmail;
    const username = await buildUniqueUsername(base, used);
    user.username = username;
    user.passwordHash = passwordHash;
    if (typeof user.tokenVersion !== "number") {
      user.tokenVersion = 0;
    }
    await user.save();
    generated.push({
      userId: String(user._id),
      name: user.name,
      email: user.email,
      username,
    });
  }

  const reportDir = path.resolve(process.cwd(), "migration-reports");
  await fs.mkdir(reportDir, { recursive: true });
  const file = path.join(reportDir, `auth-bootstrap-${Date.now()}.csv`);
  const header = "userId,name,email,username,tempPassword\n";
  const rows = generated
    .map((r) => `${r.userId},"${r.name}","${r.email}",${r.username},${TEMP_PASSWORD}`)
    .join("\n");
  await fs.writeFile(file, `${header}${rows}\n`, "utf8");

  console.log(`Bootstrapped ${generated.length} users.`);
  console.log(`Credentials report: ${file}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
