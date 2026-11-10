/**
 * FILE: src/utils/Hooks.ts
 *
 * RESPONSIBILITY
 *   Cucumber hooks: code that runs automatically around the scenarios.
 *
 *   BeforeAll  (once per run)      validate .env.uat, launch the browser
 *   Before     (before each scen.) new browser context + trace recording + page -> CustomWorld
 *   After      (after each scen.)  on failure: screenshot + trace; always: close the context
 *   AfterAll   (once per run)      close the browser
 *
 *   Hooks are not called during the dry run (npm run test:dry-run), so the dry run works
 *   before .env.uat and the locators are filled in.
 */

import { After, AfterAll, Before, BeforeAll, Status, setDefaultTimeout } from '@cucumber/cucumber';
import * as fs from 'fs';
import * as path from 'path';
// One launcher per browser engine; ConfigReader.browser picks which one is used.
import { Browser, chromium, firefox, webkit } from 'playwright';
import { ConfigReader } from '../config/ConfigReader';
import { CustomWorld } from './CustomWorld';

// Output folders for failure evidence (created only when needed).
const SCREENSHOT_DIR = path.resolve('reports', 'screenshots');
const TRACE_DIR = path.resolve('reports', 'traces');

// Playwright waits up to DEFAULT_TIMEOUT per action. A Cucumber step may do several
// actions, so the step timeout is twice that; Playwright's clearer error shows first.
setDefaultTimeout(ConfigReader.defaultTimeout * 2);

/** The single browser shared by all scenarios of this run (each scenario gets its own context). */
let browser: Browser | undefined;

/**
 * Runs once before the first scenario.
 * 1. ConfigReader.validate() stops the run with a clear message if .env.uat is not filled in.
 * 2. Launches the configured browser (BROWSER) in headless or headed mode (HEADLESS).
 */
BeforeAll(async function () {
  ConfigReader.validate();
  const launcher = { chromium, firefox, webkit }[ConfigReader.browser];
  browser = await launcher.launch({ headless: ConfigReader.headless });
});

/**
 * Runs before every scenario.
 * A new browser context = a clean session (no cookies from earlier scenarios),
 * so scenarios cannot affect each other.
 *
 * @param pickle Cucumber's description of the scenario; pickle.name is the scenario name
 */
Before(async function (this: CustomWorld, { pickle }) {
  if (!browser) throw new Error('Browser was not started (see the BeforeAll error above).');
  const context = await browser.newContext();
  // Every Playwright action/wait in this context fails after DEFAULT_TIMEOUT ms.
  context.setDefaultTimeout(ConfigReader.defaultTimeout);
  // Trace is recorded for every scenario but only SAVED when the scenario fails.
  await context.tracing.start({ title: pickle.name, screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  // Hand the browser objects to the World; this also creates the Page Objects.
  this.initPages(browser, context, page);
});

/**
 * Runs after every scenario, passed or failed.
 * Each part has its own try/catch so a problem saving evidence never hides the real
 * test result, and `finally` makes sure the context is always closed.
 *
 * @param pickle the scenario (name used in file names)
 * @param result the scenario result (status PASSED / FAILED / ...)
 */
After(async function (this: CustomWorld, { pickle, result }) {
  if (!this.context) return; // Before hook failed before a context existed
  const failed = result?.status === Status.FAILED;
  // e.g. "ISR_Verify_Screen_Help_Text_Validation_2026-11-10T14-03-22-123Z"
  const fileName = `${safeFileName(pickle.name)}_${timestamp()}`;

  // 1. Failure screenshot (full page), saved to disk AND embedded in the HTML report.
  try {
    if (failed && this.page && !this.page.isClosed()) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const screenshotPath = path.join(SCREENSHOT_DIR, `${fileName}.png`);
      const image = await this.page.screenshot({ path: screenshotPath, fullPage: true });
      this.attach(image, 'image/png'); // also embedded in the HTML report
      this.attach(`Screenshot: ${path.relative(process.cwd(), screenshotPath)}`, 'text/plain');
    }
  } catch (error) {
    console.warn(`Could not capture failure screenshot: ${(error as Error).message}`);
  }

  // 2. Playwright trace: saved as a .zip for failures, discarded for passes.
  try {
    if (failed) {
      fs.mkdirSync(TRACE_DIR, { recursive: true });
      const tracePath = path.join(TRACE_DIR, `${fileName}.zip`);
      await this.context.tracing.stop({ path: tracePath });
      const relative = path.relative(process.cwd(), tracePath);
      this.attach(`Trace: ${relative}\nOpen it with: npx playwright show-trace "${relative}"`, 'text/plain');
    } else {
      await this.context.tracing.stop(); // passed: discard the trace
    }
  } catch (error) {
    console.warn(`Could not save Playwright trace: ${(error as Error).message}`);
  } finally {
    // 3. Always close this scenario's context (and its page).
    await this.context.close();
  }
});

/** Runs once after the last scenario: closes the shared browser (if it was started). */
AfterAll(async function () {
  await browser?.close();
});

/**
 * Turns a scenario name into a safe file name: anything other than letters, digits,
 * "-" and "_" becomes "_", leading/trailing "_" are removed, max 80 characters.
 *
 * @example safeFileName('ISR Login with a valid Census ID') // "ISR_Login_with_a_valid_Census_ID"
 */
function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

/**
 * Current time for file names, with ":" and "." replaced (not allowed in Windows file names).
 *
 * @example timestamp() // "2026-11-10T14-03-22-123Z"
 */
function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
