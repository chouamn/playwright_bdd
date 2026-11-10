/**
 * FILE: src/config/ConfigReader.ts
 *
 * RESPONSIBILITY
 *   Reads the UAT environment settings from resources/environment/.env.uat and gives
 *   the rest of the framework typed, validated access to them (URL, browser, timeout,
 *   Census IDs, Census Day).
 *
 * WHO USES IT
 *   - Hooks.ts          -> ConfigReader.validate(), .browser, .headless, .defaultTimeout
 *   - LoginPage.ts      -> ConfigReader.baseUrl (opens the login page)
 *   - LoginSteps.ts     -> ConfigReader.validCensusId (typed into the Census ID box)
 *   - ContentValidator  -> ConfigReader.censusDay (replaces {CENSUS_DAY} in SpecText.json)
 *
 * IMPORTANT RULE
 *   Values already set in the terminal (e.g. PowerShell: $env:BASE_URL="...") win over
 *   the file, because dotenv never overwrites an existing environment variable.
 *
 * This framework runs against Census UAT only.
 */

// Node.js built-ins: `path` builds file paths that work on Windows and Linux; `fs` checks
// that files exist and reads them.
import * as path from 'path';
import * as fs from 'fs';
// dotenv copies the KEY=value lines of a .env file into process.env.
import * as dotenv from 'dotenv';

/** The three browser engines Playwright supports. BROWSER in .env.uat must be one of them. */
export type BrowserName = 'chromium' | 'firefox' | 'webkit';

// Absolute paths, resolved from the folder npm is run from (the project root).
const ENV_FILE = path.resolve(process.cwd(), 'resources', 'environment', '.env.uat');
const SPEC_TEXT_FILE = path.resolve(process.cwd(), 'resources', 'testdata', 'SpecText.json');

// Load .env.uat once, when this file is first imported. If the file is missing nothing
// is loaded here; validate() reports the missing file with a clear message later.
if (fs.existsSync(ENV_FILE)) {
  // dotenv never overwrites variables that are already set in the shell.
  dotenv.config({ path: ENV_FILE });
}

/** Variables that must be filled in before a real test run. */
const REQUIRED_VARIABLES = ['BASE_URL', 'VALID_CENSUS_ID'] as const;

/** A value containing any of these (any letter case) is an unfilled placeholder. */
const PLACEHOLDER_MARKERS = ['your-', 'update_me', 'your_value', 'placeholder'];

/**
 * Reads one environment variable.
 *
 * @param name variable name, e.g. 'BASE_URL'
 * @returns the value with surrounding spaces removed, or '' when it is not set
 */
function read(name: string): string {
  return (process.env[name] ?? '').trim();
}

/**
 * True when a value is empty or still a placeholder such as "your-census-uat-url".
 *
 * @param value the value read from the environment
 * @returns true = the tester has not filled this value in yet
 */
function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return value === '' || PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * True when the value is a full http:// or https:// URL.
 * `new URL()` throws for text that is not a URL, so the error is caught and turned into `false`.
 *
 * @example isValidUrl('https://example-uat.census.gov') // true
 * @example isValidUrl('example-uat.census.gov')         // false (no protocol)
 */
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * True when SpecText.json uses {CENSUS_DAY} in its expected content.
 * Comment keys (starting with "_") are ignored.
 *
 * Why: CENSUS_DAY is only required when the JSON actually contains the placeholder.
 * Today it does (VERIFY screen + VERIFY Help), so CENSUS_DAY is required for every run.
 *
 * Used by: validate() below.
 */
function specTextUsesCensusDay(): boolean {
  if (!fs.existsSync(SPEC_TEXT_FILE)) return false;
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(SPEC_TEXT_FILE, 'utf-8'));
  } catch {
    return false; // JsonReader reports invalid JSON with its own clear message
  }
  // Recursive search through every string, list and object in the JSON file.
  const search = (node: unknown): boolean => {
    if (typeof node === 'string') return node.includes('{CENSUS_DAY}');
    if (Array.isArray(node)) return node.some(search);
    if (node && typeof node === 'object') {
      // Skip "_readme", "_todo", "_source"... so a note that mentions {CENSUS_DAY} does not count.
      return Object.entries(node).some(([key, value]) => !key.startsWith('_') && search(value));
    }
    return false;
  };
  return search(json);
}

/**
 * Typed access to the .env.uat settings.
 *
 * Every value is a getter, so it is read from process.env at the moment it is used.
 *
 * @example
 *   await page.goto(ConfigReader.baseUrl);
 *   const id = ConfigReader.validCensusId;
 */
export const ConfigReader = {
  /** Absolute path of .env.uat (used in error messages so the tester knows which file to fix). */
  envFile: ENV_FILE,

  /** BASE_URL: the UAT login page URL. Used by LoginPage.open(). */
  get baseUrl(): string {
    return read('BASE_URL');
  },

  /**
   * BROWSER: which Playwright browser engine to launch. Defaults to 'chromium'.
   * Used by Hooks.ts (BeforeAll) to pick the launcher.
   *
   * @throws Error when the value is not chromium, firefox or webkit
   */
  get browser(): BrowserName {
    const value = (read('BROWSER') || 'chromium').toLowerCase();
    if (value !== 'chromium' && value !== 'firefox' && value !== 'webkit') {
      throw new Error(`BROWSER must be chromium, firefox or webkit (found "${value}") in ${ENV_FILE}`);
    }
    return value;
  },

  /** Defaults to true. Set HEADLESS=false to see the browser window. */
  get headless(): boolean {
    // Anything other than the word "false" (any case) means headless.
    return read('HEADLESS').toLowerCase() !== 'false';
  },

  /**
   * DEFAULT_TIMEOUT: how long (milliseconds) Playwright waits for an element. Defaults to 30000.
   * Used by Hooks.ts for the browser context timeout and the Cucumber step timeout.
   *
   * @throws Error when the value is not a positive number
   */
  get defaultTimeout(): number {
    const value = Number(read('DEFAULT_TIMEOUT') || '30000');
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`DEFAULT_TIMEOUT must be a positive number of milliseconds in ${ENV_FILE}`);
    }
    return value;
  },

  /** VALID_CENSUS_ID: 12-digit test Census ID. Used by LoginSteps ("enters a valid 12-digit Census ID"). */
  get validCensusId(): string {
    return read('VALID_CENSUS_ID');
  },

  /** INVALID_CENSUS_ID: available for negative tests. No current scenario uses it. */
  get invalidCensusId(): string {
    return read('INVALID_CENSUS_ID');
  },

  /**
   * Census Day as displayed by the app. Replaces {CENSUS_DAY} in SpecText.json.
   * Used by ContentValidator when it resolves placeholders in expected text.
   *
   * @throws Error when CENSUS_DAY is empty or still a placeholder
   */
  get censusDay(): string {
    const value = read('CENSUS_DAY');
    if (isPlaceholder(value)) {
      throw new Error(
        `CENSUS_DAY is not set. Expected content uses {CENSUS_DAY}; set CENSUS_DAY in ${ENV_FILE} ` +
          `exactly as the application displays it.`,
      );
    }
    return value;
  },

  /**
   * Called once before the browser is launched (BeforeAll hook).
   * Lists every configuration problem at once and stops the run.
   * Not called during a dry run, so the dry run works with placeholder values.
   *
   * Checks, in order:
   *   1. .env.uat exists
   *   2. BASE_URL and VALID_CENSUS_ID are filled in
   *   3. BASE_URL is a full URL; VALID_CENSUS_ID is exactly 12 digits
   *   4. CENSUS_DAY is filled in IF SpecText.json uses {CENSUS_DAY}
   *   5. BROWSER and DEFAULT_TIMEOUT have valid values
   *
   * @throws Error listing every problem found (one per line)
   */
  validate(): void {
    if (!fs.existsSync(ENV_FILE)) {
      throw new Error(`Environment file not found: ${ENV_FILE}`);
    }

    // Problems are collected instead of thrown one by one, so the tester can fix them all at once.
    const problems: string[] = [];

    // 1. Required values must be filled in.
    for (const name of REQUIRED_VARIABLES) {
      if (isPlaceholder(read(name))) {
        problems.push(`${name} is empty or still a placeholder ("${read(name)}")`);
      }
    }

    // 2. Filled-in values must have the right format.
    const baseUrl = read('BASE_URL');
    if (!isPlaceholder(baseUrl) && !isValidUrl(baseUrl)) {
      problems.push(`BASE_URL must be a full http:// or https:// URL (found "${baseUrl}")`);
    }
    const censusId = read('VALID_CENSUS_ID');
    // ^\d{12}$ = exactly 12 digits, nothing before or after.
    if (!isPlaceholder(censusId) && !/^\d{12}$/.test(censusId)) {
      problems.push(`VALID_CENSUS_ID must be exactly 12 digits with no spaces or dashes (found "${censusId}")`);
    }

    // 3. CENSUS_DAY is needed only when SpecText.json uses {CENSUS_DAY}.
    if (specTextUsesCensusDay() && isPlaceholder(read('CENSUS_DAY'))) {
      problems.push(
        `CENSUS_DAY is empty or still a placeholder ("${read('CENSUS_DAY')}"). ` +
          `SpecText.json uses {CENSUS_DAY}; set it exactly as the application displays it (e.g. the date on the VERIFY screen).`,
      );
    }

    // 4. Format checks for optional settings. Reading each getter runs its own check;
    //    a thrown error is turned into one more line in the problem list.
    for (const check of [() => this.browser, () => this.defaultTimeout]) {
      try {
        check();
      } catch (error) {
        problems.push((error as Error).message);
      }
    }

    if (problems.length > 0) {
      throw new Error(`Update ${ENV_FILE} before running tests:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    }
  },
};
