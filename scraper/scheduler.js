/*
 * Long-running process: fires dailyRun() (bookings + confirmation texts) and
 * salesRun() (sales table) once a day each, on their own cron schedules.
 * Intended to run under a process manager (pm2, Windows Task Scheduler
 * launching `npm run scraper:start` at boot, a systemd unit on the eventual
 * VPS, etc.) — this file itself does not daemonize.
 *
 * Usage: npm run scraper:start
 */
import "dotenv/config";
import cron from "node-cron";
import { dailyRun } from "./dailyRun.js";
import { salesRun } from "./salesRun.js";

const bookingsSchedule = process.env.DAILY_RUN_CRON || "0 7 * * *"; // 7am local by default
const salesSchedule = process.env.SALES_RUN_CRON || "0 8 * * *"; // 8am local by default — after bookings

for (const [name, expr] of [
  ["DAILY_RUN_CRON", bookingsSchedule],
  ["SALES_RUN_CRON", salesSchedule],
]) {
  if (!cron.validate(expr)) {
    console.error(`[scraper] invalid ${name} expression: "${expr}"`);
    process.exit(1);
  }
}

console.log(`[scraper] scheduler started — bookings at "${bookingsSchedule}", sales at "${salesSchedule}"`);

function scheduleJob(expr, name, fn) {
  let running = false;
  cron.schedule(expr, async () => {
    if (running) {
      console.warn(`[scraper] previous ${name} run still in progress — skipping this trigger`);
      return;
    }
    running = true;
    try {
      await fn();
    } catch (e) {
      console.error(`[scraper] scheduled ${name} run failed:`, e);
    } finally {
      running = false;
    }
  });
}

scheduleJob(bookingsSchedule, "bookings", dailyRun);
scheduleJob(salesSchedule, "sales", salesRun);
