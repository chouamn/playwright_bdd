/**
 * FILE: src/data/JsonReader.ts
 *
 * RESPONSIBILITY
 *   Reads the expected content from resources/testdata/SpecText.json and checks that the
 *   requested section is well formed BEFORE any comparison starts.
 *   See the "_readme" section at the top of that file for the field meanings.
 *
 * WHO USES IT
 *   - ConfirmPage.validateLandingContent() -> JsonReader.getScreen('CONFIRM', language)
 *   - ConfirmPage.validateHelpText()       -> JsonReader.getHelp('CONFIRM', language)
 *   - VerifyPage.validateHelpText()        -> JsonReader.getHelp('VERIFY', language)
 *   The returned data is then passed to ContentValidator.
 *
 * VALIDATION SCOPE
 *   Only the section that is requested is validated (lazy validation). For example, a
 *   mistake in screens.LOGIN does not stop the VERIFY Help test, because screens.LOGIN
 *   is never requested. Unknown fields are ignored, not rejected.
 *   (ConfigReader separately scans the whole file for {CENSUS_DAY}.)
 */

import * as fs from 'fs';
import * as path from 'path';

/** Languages stored in SpecText.json. The current scenarios use 'EN' only (see CustomWorld.language). */
export type Language = 'EN' | 'ES';
/** Keys under "screens" in SpecText.json. */
export type ScreenName = 'LOGIN' | 'CONFIRM' | 'VERIFY';
/** Keys under "helpModals" in SpecText.json. */
export type HelpScreenName = 'CONFIRM' | 'VERIFY';

/** One expected text block (a paragraph, heading, option, button...). */
export interface ExpectedBlock {
  /** Free label used in error messages, e.g. "heading", "paragraph". */
  type?: string;
  /** Single-line text. Use either `text` or `lines`. */
  text?: string;
  /**
   * Multi-line text: one entry per line (lines separated by <br> in the DOM).
   * Use "" for an intentional, visible blank line (e.g. <br><br>).
   */
  lines?: string[];
  /** true = the whole block is bold. */
  bold?: boolean;
  /** Only these fragments are bold; all other text must be non-bold. */
  boldText?: string[];
  /** Optional: only these fragments are underlined (checked only when present). */
  underlineText?: string[];
  /** Optional: only these fragments are italic (checked only when present). */
  italicText?: string[];
  /** Optional: expected HTML tag of the block element, e.g. "h1", "p". */
  tag?: string;
  /** Optional: computed CSS values on the block element, e.g. { "fontSize": "24px" }. */
  style?: Record<string, string>;
}

/** Expected landing-page content of one screen in one language (screens.<SCREEN>.<LANG>). */
export interface ExpectedScreen {
  content: ExpectedBlock[];
}

/** Expected Help modal content of one screen in one language (helpModals.<SCREEN>.<LANG>). */
export interface ExpectedHelp {
  /** Text of the modal title, e.g. "Help". */
  title: string;
  /** Text of the Close button, e.g. "Close". */
  closeButton: string;
  /** Help paragraphs, top to bottom. */
  content: ExpectedBlock[];
}

/** Shape of the whole SpecText.json file. */
interface SpecTextFile {
  screens: Record<ScreenName, Record<Language, ExpectedScreen>>;
  helpModals: Record<HelpScreenName, Record<Language, ExpectedHelp>>;
}

const SPEC_FILE = path.resolve(process.cwd(), 'resources', 'testdata', 'SpecText.json');

/** The parsed file, kept after the first read so the file is read only once per run. */
let cache: SpecTextFile | undefined;

/** True for a plain JSON object ({ ... }), false for arrays, null, strings, numbers. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for a string that contains at least one non-space character. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** True for a list whose items are all strings (an empty list also counts). */
function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Reads and parses SpecText.json (only the first time; later calls return the cache)
 * and checks the top-level shape: an object with "screens" and "helpModals" objects.
 *
 * @returns the parsed file
 * @throws Error when the file is missing, is not valid JSON, or has the wrong top-level shape
 */
function load(): SpecTextFile {
  if (!cache) {
    if (!fs.existsSync(SPEC_FILE)) {
      throw new Error(`Expected content file not found: ${SPEC_FILE}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(SPEC_FILE, 'utf-8'));
    } catch (error) {
      // Typical cause: a missing comma or quote. The JSON error message gives the position.
      throw new Error(`SpecText.json is not valid JSON: ${(error as Error).message}`);
    }

    // JSON.parse only checks syntax. Check the top-level shape the framework relies on.
    if (!isObject(parsed)) {
      throw new Error(`SpecText.json must contain a JSON object at the top level: ${SPEC_FILE}`);
    }
    if (!isObject(parsed.screens)) {
      throw new Error(`SpecText.json is missing the "screens" object (or it is not an object): ${SPEC_FILE}`);
    }
    if (!isObject(parsed.helpModals)) {
      throw new Error(`SpecText.json is missing the "helpModals" object (or it is not an object): ${SPEC_FILE}`);
    }

    cache = parsed as unknown as SpecTextFile;
  }
  return cache;
}

/**
 * Checks that a content list exists and that every block in it is usable.
 * All problems are reported together so they can be fixed in one pass.
 *
 * @param content the "content" value read from the JSON (any type until checked)
 * @param where   path used in messages, e.g. "screens.CONFIRM.EN"
 * @returns the same list, typed as ExpectedBlock[]
 * @throws Error "No expected content ..." when the list is missing or empty,
 *         or "Invalid expected content ..." listing every malformed block
 */
function ensureContent(content: unknown, where: string): ExpectedBlock[] {
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error(`No expected content for ${where} in SpecText.json. Add it (see the _todo notes in that section).`);
  }

  const problems: string[] = [];
  content.forEach((block: unknown, index: number) => {
    // Block numbers in messages start at 1, the same way a tester counts them.
    const label = `${where}.content[${index}] (block ${index + 1})`;

    if (!isObject(block)) {
      problems.push(`${label} must be an object like { "text": "..." }`);
      return;
    }

    const hasText = block.text !== undefined;
    const hasLines = block.lines !== undefined;

    // Rule: exactly one of "text" or "lines".
    if (hasText && hasLines) {
      problems.push(`${label} has both "text" and "lines". Use "text" for one line OR "lines" for several lines, not both.`);
    } else if (!hasText && !hasLines) {
      problems.push(`${label} needs a "text" or a "lines" property.`);
    } else if (hasText && !isNonEmptyString(block.text)) {
      problems.push(`${label} "text" must be a non-empty string.`);
    } else if (hasLines) {
      if (!Array.isArray(block.lines) || block.lines.length === 0) {
        problems.push(`${label} "lines" must be a non-empty list of strings.`);
      } else {
        // "" is allowed: it is an intentional blank line. But at least one line needs text.
        block.lines.forEach((line: unknown, lineIndex: number) => {
          if (typeof line !== 'string') {
            problems.push(`${label} "lines"[${lineIndex}] must be a string ("" for a blank line).`);
          }
        });
        if (!block.lines.some((line: unknown) => isNonEmptyString(line))) {
          problems.push(`${label} "lines" must contain at least one line with text.`);
        }
      }
    }

    // Optional fields: not required, but when present they must have the right type.
    if (block.type !== undefined && typeof block.type !== 'string') {
      problems.push(`${label} "type" must be a string, e.g. "paragraph".`);
    }
    if (block.bold !== undefined && typeof block.bold !== 'boolean') {
      problems.push(`${label} "bold" must be true or false (without quotes).`);
    }
    for (const field of ['boldText', 'underlineText', 'italicText'] as const) {
      if (block[field] !== undefined && !isStringList(block[field])) {
        problems.push(`${label} "${field}" must be a list of strings, e.g. ["Help"].`);
      }
    }
    if (block.tag !== undefined && typeof block.tag !== 'string') {
      problems.push(`${label} "tag" must be a string, e.g. "p".`);
    }
    if (block.style !== undefined) {
      if (!isObject(block.style)) {
        problems.push(`${label} "style" must be an object, e.g. { "color": "#000000" }.`);
      } else {
        for (const [property, value] of Object.entries(block.style)) {
          if (typeof value !== 'string') {
            problems.push(`${label} "style.${property}" must be a string, e.g. "700" (with quotes).`);
          }
        }
      }
    }
  });

  if (problems.length > 0) {
    throw new Error(`Invalid expected content in SpecText.json:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
  return content as ExpectedBlock[];
}

/**
 * Public API used by the Page Objects.
 *
 * @example
 *   const expected = JsonReader.getHelp('VERIFY', 'EN');
 *   // expected.title === "Help", expected.content = list of Help paragraphs
 */
export const JsonReader = {
  /** Absolute path of SpecText.json. */
  specFile: SPEC_FILE,

  /**
   * Expected landing-page content for a screen, e.g. getScreen('CONFIRM', 'EN').
   *
   * Used by: ConfirmPage.validateLandingContent()
   *
   * @param screen   'LOGIN' | 'CONFIRM' | 'VERIFY'
   * @param language 'EN' | 'ES'
   * @returns the screens.<screen>.<language> section, after validation
   * @throws Error when the section is missing, empty or malformed
   */
  getScreen(screen: ScreenName, language: Language): ExpectedScreen {
    // Optional chaining (?.) returns undefined instead of crashing when a key is missing;
    // ensureContent() then reports "No expected content".
    const entry = load().screens?.[screen]?.[language];
    ensureContent(entry?.content, `screens.${screen}.${language}`);
    return entry;
  },

  /**
   * Expected Help modal content for a screen, e.g. getHelp('VERIFY', 'EN').
   *
   * Used by: ConfirmPage.validateHelpText(), VerifyPage.validateHelpText()
   *
   * @param screen   'CONFIRM' | 'VERIFY'
   * @param language 'EN' | 'ES'
   * @returns the helpModals.<screen>.<language> section (title, closeButton, content), after validation
   * @throws Error when the content is missing/malformed, or title/closeButton are invalid
   */
  getHelp(screen: HelpScreenName, language: Language): ExpectedHelp {
    const entry = load().helpModals?.[screen]?.[language];
    const where = `helpModals.${screen}.${language}`;
    ensureContent(entry?.content, where);

    // title and closeButton must always be strings. They must have text in English;
    // in Spanish "" is allowed because the Spanish content is not finished yet.
    const problems: string[] = [];
    for (const field of ['title', 'closeButton'] as const) {
      const value: unknown = entry[field];
      if (typeof value !== 'string') {
        problems.push(`${where}.${field} is missing or is not a string.`);
      } else if (language === 'EN' && value.trim().length === 0) {
        problems.push(`${where}.${field} must not be empty for English.`);
      }
    }
    if (problems.length > 0) {
      throw new Error(`Invalid Help modal fields in SpecText.json:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    }
    return entry;
  },
};
