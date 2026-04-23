import "dotenv/config";
import mongoose from "mongoose";
import { runDailyReportJobNow } from "../jobs/dailyReportJob.js";

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }
  await mongoose.connect(MONGODB_URI);
  try {
    const dateKey = process.argv[2];
    const result = await runDailyReportJobNow(dateKey);
    if (result.sent) {
      console.log(
        `Sent daily report for ${result.dateKey} with ${result.orderCount} orders.`
      );
    } else {
      console.log(`Skipped: ${result.reason}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
