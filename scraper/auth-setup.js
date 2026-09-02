/*
 * One-time (and occasional re-auth) interactive login capture.
 *
 * Run this whenever the daily scraper reports the goldadam session expired.
 * It opens a real, visible browser window so you can:
 *   1. Confirm your US VPN is connected.
 *   2. Log into agent.goldadam.us with your Gmail account.
 *   3. Approve the Google mobile push prompt.
 * Once it detects you're past login (route selector / bookings visible), it
 * saves the session to scraper/.auth/storageState.json and exits. The daily
 * headless job reuses that file — no further manual login until it expires.
 *
 * Usage: npm run scraper:auth-setup
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchHeadedContext, isLoggedIn, GOLDADAM_URL, STORAGE_STATE_PATH } from "./lib/goldadamSession.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  console.log(`Opening ${GOLDADAM_URL} — make sure your US VPN is connected.`);
  const { browser, context, page } = await launchHeadedContext();
  await page.goto(GOLDADAM_URL, { waitUntil: "domcontentloaded" }).catch(() => {});

  console.log("Log in with your Gmail account and approve the mobile push prompt.");
  console.log("Waiting up to 5 minutes for login to complete...");

  const start = Date.now();
  const timeoutMs = 5 * 60 * 1000;
  let loggedIn = false;
  while (Date.now() - start < timeoutMs) {
    if (await isLoggedIn(page)) {
      loggedIn = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (!loggedIn) {
    console.error("Timed out waiting for login. No session was saved — run this again when ready.");
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`Session saved to ${STORAGE_STATE_PATH}`);
  await browser.close();
}

main().catch((e) => {
  console.error("auth-setup failed:", e);
  process.exit(1);
});
