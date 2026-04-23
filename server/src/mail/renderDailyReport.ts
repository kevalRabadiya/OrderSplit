import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import hbs from "hbs";
import type { DailyOrderReport } from "../reports/dailyOrderReport.js";

type TemplateFn = (context: DailyOrderReportTemplateContext) => string;

type DailyOrderReportTemplateContext = {
  dateKey: string;
  generatedAtIst: string;
  historyRows: Array<{
    createdAtIst: string;
    userName: string;
    userPhone: string;
    thaliLine: string;
    extrasLine: string;
    description: string;
    totalAmount: number;
  }>;
  summary: DailyOrderReport["summary"];
  optimization: DailyOrderReport["optimization"];
};

let templateCache: TemplateFn | null = null;

function templateCandidatePaths() {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFile);
  return [
    path.join(thisDir, "templates", "dailyReport.hbs"),
    path.join(process.cwd(), "src", "mail", "templates", "dailyReport.hbs"),
  ];
}

async function readTemplateSource(): Promise<string> {
  for (const candidate of templateCandidatePaths()) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // Try next location.
    }
  }
  throw new Error("dailyReport.hbs template file not found.");
}

function getCompiledTemplate(source: string): TemplateFn {
  const engine = (hbs as unknown as {
    handlebars: { compile: (tpl: string) => TemplateFn };
  }).handlebars;
  return engine.compile(source);
}

function formatNowIst() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

export async function renderDailyReportHtml(report: DailyOrderReport): Promise<string> {
  if (!templateCache) {
    const source = await readTemplateSource();
    templateCache = getCompiledTemplate(source);
  }
  const context: DailyOrderReportTemplateContext = {
    dateKey: report.dateKey,
    generatedAtIst: formatNowIst(),
    historyRows: report.historyRows,
    summary: report.summary,
    optimization: report.optimization,
  };
  return templateCache(context);
}
