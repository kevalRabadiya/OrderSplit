import cron from "node-cron";
import { sendDailyReportEmail } from "../mail/mailer.js";
import { renderDailyReportHtml } from "../mail/renderDailyReport.js";
import { buildDailyOrderReport, getTodayDateKeyIST } from "../reports/dailyOrderReport.js";

const DEFAULT_CRON = "30 14 * * *";
const DEFAULT_TZ = "Asia/Kolkata";

export type DailyJobResult =
  | { sent: false; reason: string; dateKey: string }
  | { sent: true; dateKey: string; orderCount: number };

export async function runDailyReportJobNow(dateKey = getTodayDateKeyIST()): Promise<DailyJobResult> {
  const report = await buildDailyOrderReport(dateKey);
  if (!report.hasOrders) {
    return { sent: false, reason: "No orders today; email skipped.", dateKey };
  }
  const html = await renderDailyReportHtml(report);
  await sendDailyReportEmail({
    subject: `Daily order report (${dateKey})`,
    html,
  });
  return {
    sent: true,
    dateKey,
    orderCount: report.summary.orderCount,
  };
}

export function startDailyReportJob() {
  const scheduleExpr = process.env.DAILY_REPORT_CRON?.trim() || DEFAULT_CRON;
  const timezone = process.env.DAILY_REPORT_TIMEZONE?.trim() || DEFAULT_TZ;
  if (!cron.validate(scheduleExpr)) {
    throw new Error(
      `Invalid DAILY_REPORT_CRON: "${scheduleExpr}". Expected a valid cron expression.`
    );
  }
  const task = cron.schedule(
    scheduleExpr,
    async () => {
      try {
        const result = await runDailyReportJobNow();
        if (result.sent) {
          console.log(
            `[daily-report] Sent report for ${result.dateKey} (${result.orderCount} orders).`
          );
        } else {
          console.log(`[daily-report] ${result.reason} (${result.dateKey})`);
        }
      } catch (error) {
        console.error("[daily-report] Failed to run:", error);
      }
    },
    {
      timezone,
    }
  );

  console.log(
    `[daily-report] Scheduler started: cron="${scheduleExpr}", timezone="${timezone}".`
  );
  return task;
}
