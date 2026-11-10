/**
 * FILE: src/utils/ContentValidator.ts
 *
 * RESPONSIBILITY
 *   Compares what HtmlStructure read from the page with what JsonReader read from
 *   SpecText.json, and fails the step with a readable list of differences.
 *
 * WHO USES IT
 *   - ConfirmPage.validateLandingContent() -> ContentValidator.validateScreen()
 *   - ConfirmPage / VerifyPage.validateHelpText() -> ContentValidator.validateHelp()
 *
 * FLOW
 *   expected blocks (JsonReader) --prepare()--> placeholders replaced, split into lines
 *   actual blocks (HtmlStructure.extract())
 *   compareBlocks() pairs expected with actual blocks, then compareBlock() checks each pair
 *   fail() throws one Error with every difference + the actual page content
 */

import { Locator } from 'playwright';
// ConfigReader supplies CENSUS_DAY for the {CENSUS_DAY} placeholder.
import { ConfigReader } from '../config/ConfigReader';
import { ExpectedBlock, ExpectedHelp, ExpectedScreen } from '../data/JsonReader';
import { ActualBlock, CAPTURED_STYLES, HtmlStructure } from './HtmlStructure';

/**
 * Compares the content shown in the browser with the expected content from SpecText.json.
 *
 * Checks, in this order:
 *   1. number and order of blocks (paragraphs, headings, options, buttons)
 *   2. exact text of every line, including spaces as displayed (lines = <br> separated)
 *   3. bold / non-bold for every character (always checked when the block's text matches)
 *   4. underline / italic (only when underlineText / italicText is given and the text matches)
 *   5. HTML tag and computed CSS (only when tag / style is given; checked even if the text differs)
 *
 * The differences detected are collected and reported together in one error.
 * Limitation: when a block's text or line count differs, its bold / italic / underline
 * checks are skipped, so formatting problems in that block show up only after the text is fixed.
 */

/**
 * CSS properties whose expected value is converted to the browser's own notation
 * before comparing, e.g. "#fff" / "white" -> "rgb(255, 255, 255)", "bold" -> "700".
 * Other properties are compared exactly as written (use the computed value, e.g. "24px").
 */
const NORMALIZED_STYLES = new Set<string>(['color', 'backgroundColor', 'fontWeight']);

/**
 * Values that depend on the surrounding element (or on the browser's defaults), so the
 * expected result is unknown until the page is rendered. Checked for EVERY supported
 * property and reported, never compared as literal text.
 */
const CONTEXT_DEPENDENT_VALUES = /^(inherit|initial|unset|revert|revert-layer|currentcolor|bolder|lighter)$/i;

/** Expected CSS value per "property:value", as the browser writes it (null = not valid CSS). */
type CssLookup = Map<string, string | null>;
const cssKey = (property: string, value: string) => `${property}:${value}`;

/** Placeholders allowed in SpecText.json and where their values come from. */
const PLACEHOLDERS: Record<string, () => string> = {
  CENSUS_DAY: () => ConfigReader.censusDay,
};

/**
 * Replaces every {NAME} placeholder in expected text with its value.
 *
 * @example resolvePlaceholders('Census Day is {CENSUS_DAY}.') // "Census Day is April 1, 2027." (illustrative value)
 * @throws Error for a placeholder that is not in PLACEHOLDERS, or when CENSUS_DAY is not set
 */
function resolvePlaceholders(value: string): string {
  return value.replace(/\{([A-Z_]+)\}/g, (match, name: string) => {
    const getValue = PLACEHOLDERS[name];
    if (!getValue) throw new Error(`Unknown placeholder ${match} in SpecText.json`);
    return getValue();
  });
}

/** An expected block made ready for comparison (placeholders replaced, split into lines). */
interface PreparedBlock {
  /** Name used in error messages, e.g. "Block 2 (question)". */
  label: string;
  /** Expected lines (one per <br>-separated line). */
  lines: string[];
  /** lines joined with "\n" (same index space as ActualBlock.text). */
  text: string;
  /** The original block from SpecText.json (bold, boldText, tag, style...). */
  source: ExpectedBlock;
}

/**
 * Expected text is NOT whitespace-collapsed, so intentional spacing in SpecText.json
 * is compared exactly. Only notation differences that the responder cannot see are
 * unified: &nbsp; (U+00A0) is written as ' ' (as on the actual side) and \r\n as \n.
 */
function normalizeExpected(value: string): string {
  return resolvePlaceholders(value).replace(/ /g, ' ').replace(/\r\n?/g, '\n');
}

/**
 * Turns one SpecText.json block into a PreparedBlock.
 *
 * @param block the expected block
 * @param index its position in the content list (0-based; shown as index + 1)
 */
function prepare(block: ExpectedBlock, index: number): PreparedBlock {
  // A "\n" inside "text" means a line break, the same as using "lines".
  const rawLines = block.lines ?? (block.text !== undefined ? block.text.split(/\r\n?|\n/) : []);
  if (rawLines.length === 0) {
    throw new Error(`SpecText.json block ${index + 1} has neither "text" nor "lines"`);
  }
  const lines = rawLines.map(normalizeExpected);
  return {
    label: `Block ${index + 1}${block.type ? ` (${block.type})` : ''}`,
    lines,
    text: lines.join('\n'),
    source: block,
  };
}

/**
 * Build a true/false mask over `text`: true where one of the fragments appears.
 * Every occurrence of a fragment is marked. A fragment that is empty or not found in
 * the expected text is a SpecText.json mistake and is added to `errors`.
 *
 * @example maskFromFragments('Why? Every...', ['Why?'], ...) // [true, true, true, true, false, ...]
 */
function maskFromFragments(text: string, fragments: string[], label: string, field: string, errors: string[]): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false);
  for (const rawFragment of fragments) {
    const fragment = normalizeExpected(rawFragment);
    if (fragment.length === 0) {
      errors.push(`${label}: ${field} contains an empty fragment (fix SpecText.json)`);
      continue;
    }
    let from = text.indexOf(fragment);
    if (from < 0) {
      errors.push(`${label}: ${field} fragment "${fragment}" does not appear in the expected text (fix SpecText.json)`);
      continue;
    }
    while (from >= 0) {
      for (let i = from; i < from + fragment.length; i++) mask[i] = true;
      from = text.indexOf(fragment, from + fragment.length);
    }
  }
  return mask;
}

/**
 * Compare expected vs actual format flags; report differing text segments.
 * Neighbouring characters with the same problem are grouped, so one message is
 * written per wrong segment, e.g.  Block 2 (question): "Help" should NOT be bold
 */
function compareFormat(
  label: string,
  formatName: string,
  text: string,
  expected: boolean[],
  actual: boolean[],
  errors: string[],
): void {
  let i = 0;
  while (i < text.length) {
    // Formatting of whitespace (space, tab, line break) is invisible, so it is not compared.
    const isSpace = /\s/.test(text[i]);
    if (isSpace || expected[i] === actual[i]) {
      i++;
      continue;
    }
    const shouldBe = expected[i];
    let end = i;
    while (end < text.length && (/\s/.test(text[end]) || (expected[end] === shouldBe && actual[end] !== shouldBe))) end++;
    const segment = text.slice(i, end).trim();
    errors.push(`${label}: "${segment}" should ${shouldBe ? '' : 'NOT '}be ${formatName}`);
    i = end;
  }
}

/** Show spaces/tabs so spacing differences are visible in error messages, e.g. "Your··answers". */
function showSpaces(value: string): string {
  return /( {2,}|\t|^ | $)/.test(value) ? `"${value}"  (spaces shown as ·: "${value.replace(/ /g, '·').replace(/\t/g, '→')}")` : `"${value}"`;
}

/**
 * Compares ONE expected block with ONE page block and adds any differences to `errors`.
 *
 * Order: line count + text -> (only if text matches) bold, underline, italic -> tag -> CSS.
 *
 * @param expected the prepared expected block
 * @param actual   the page block paired with it by compareBlocks()
 * @param errors   list that collects every difference (changed in place)
 * @param css      expected CSS values converted to browser notation (from lookUpCss)
 */
function compareBlock(expected: PreparedBlock, actual: ActualBlock, errors: string[], css: CssLookup): void {
  const { label, source } = expected;

  // Text and line breaks
  let textMatches = true;
  if (expected.lines.length !== actual.lines.length) {
    textMatches = false;
    errors.push(
      `${label}: expected ${expected.lines.length} line(s) but found ${actual.lines.length}\n` +
        `      expected: ${JSON.stringify(expected.lines)}\n      actual:   ${JSON.stringify(actual.lines)}`,
    );
  } else {
    expected.lines.forEach((line, i) => {
      if (line !== actual.lines[i]) {
        textMatches = false;
        errors.push(`${label}, line ${i + 1}: text differs\n      expected: ${showSpaces(line)}\n      actual:   ${showSpaces(actual.lines[i])}`);
      }
    });
  }

  // Bold / italic / underline are compared character by character, so they are
  // only checked when the text matches (otherwise the characters do not line up).
  if (textMatches) {
    // Bold / non-bold (always checked)
    const expectedBold = source.bold
      ? new Array<boolean>(expected.text.length).fill(true)
      : maskFromFragments(expected.text, source.boldText ?? [], label, 'boldText', errors);
    compareFormat(label, 'bold', expected.text, expectedBold, actual.format.bold, errors);

    // Underline / italic (checked only when specified)
    if (source.underlineText) {
      const mask = maskFromFragments(expected.text, source.underlineText, label, 'underlineText', errors);
      compareFormat(label, 'underlined', expected.text, mask, actual.format.underline, errors);
    }
    if (source.italicText) {
      const mask = maskFromFragments(expected.text, source.italicText, label, 'italicText', errors);
      compareFormat(label, 'italic', expected.text, mask, actual.format.italic, errors);
    }
  }

  // HTML tag and computed styles (checked only when specified). They describe the block
  // element itself, not its characters, so they are checked even when the text differs.
  if (source.tag && source.tag.toLowerCase() !== actual.tag) {
    errors.push(`${label}: expected <${source.tag.toLowerCase()}> but found <${actual.tag}>`);
  }
  for (const [name, value] of Object.entries(source.style ?? {})) {
    if (!(CAPTURED_STYLES as readonly string[]).includes(name)) {
      errors.push(`${label}: style "${name}" is not supported. Use one of: ${CAPTURED_STYLES.join(', ')}`);
      continue;
    }
    const written = String(value).trim();
    const browserValue = css.get(cssKey(name, written));
    if (browserValue === null) {
      errors.push(`${label}: style ${name} value "${written}" is not valid CSS for this property (fix SpecText.json)`);
      continue;
    }
    if (CONTEXT_DEPENDENT_VALUES.test(written)) {
      errors.push(
        `${label}: style ${name} value "${written}" depends on the surrounding element and cannot be checked. ` +
          `Use the explicit value instead (e.g. "rgb(0, 0, 0)" or "#000" for colors, "700" or "bold" for fontWeight, ` +
          `"16px" for fontSize, "left" for textAlign).`,
      );
      continue;
    }
    // Colors and font weights are compared in the browser's notation; other properties as written.
    const expectedValue = NORMALIZED_STYLES.has(name) && browserValue !== undefined ? browserValue : written;
    if (actual.style[name] !== expectedValue) {
      const converted = expectedValue !== written ? ` (= "${expectedValue}")` : '';
      errors.push(`${label}: style ${name} expected "${written}"${converted} but found "${actual.style[name]}"`);
    }
  }
}

/** Convert every expected style value to the browser's notation in one browser call. */
async function lookUpCss(anyElementOnPage: Locator, expectedBlocks: ExpectedBlock[]): Promise<CssLookup> {
  const declarations: { property: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const block of expectedBlocks) {
    for (const [property, value] of Object.entries(block.style ?? {})) {
      const written = String(value).trim();
      const key = cssKey(property, written);
      if (!(CAPTURED_STYLES as readonly string[]).includes(property) || seen.has(key)) continue;
      seen.add(key);
      declarations.push({ property, value: written });
    }
  }
  const results = await HtmlStructure.computeCssValues(anyElementOnPage, declarations);
  return new Map(declarations.map((d, i) => [cssKey(d.property, d.value), results[i]]));
}

/** Lower-case words without punctuation, e.g. "Your INFORMATION!" -> ["your", "information"]. */
function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * How alike two block texts are: shared words / max(word count of either text).
 * A repeated word only counts as shared as many times as it appears in BOTH texts,
 * so "no no no no" vs "no yes maybe other" = 1 / 4.
 */
function similarity(a: string, b: string): number {
  const wordsA = wordsOf(a);
  const wordsB = wordsOf(b);
  const longest = Math.max(wordsA.length, wordsB.length);
  if (longest === 0) return 0;
  const unusedB = new Map<string, number>();
  for (const word of wordsB) unusedB.set(word, (unusedB.get(word) ?? 0) + 1);
  let shared = 0;
  for (const word of wordsA) {
    const left = unusedB.get(word) ?? 0;
    if (left > 0) {
      shared++;
      unusedB.set(word, left - 1);
    }
  }
  return shared / longest;
}

/** Blocks at least this similar are treated as the same block with a text difference. */
const SIMILARITY_THRESHOLD = 0.5;

/**
 * Best in-order pairing of near-miss blocks inside ONE gap (between two exact matches).
 * `expectedTexts` and `pageTexts` are the unmatched blocks of that gap, in document order.
 * Returns pairs of positions in those two lists.
 *
 * Small table, filled from the end (same idea as the exact-match LCS):
 *   best[x][y] = best result possible using expectedTexts[x..] and pageTexts[y..]
 * A result is better when it has MORE pairs; with the same number of pairs, a higher
 * total similarity wins. Only pairs with similarity >= SIMILARITY_THRESHOLD are allowed,
 * and pairs never cross, so document order is kept. On a full tie the earliest pair wins.
 */
function bestNearMissPairs(expectedTexts: string[], pageTexts: string[]): [number, number][] {
  type Result = { pairs: number; total: number };
  const isBetter = (a: Result, b: Result) => a.pairs > b.pairs || (a.pairs === b.pairs && a.total > b.total + 1e-9);
  const isSame = (a: Result, b: Result) => !isBetter(a, b) && !isBetter(b, a);
  const sim = expectedTexts.map((e) => pageTexts.map((p) => similarity(e, p)));

  const best: Result[][] = Array.from({ length: expectedTexts.length + 1 }, () =>
    Array.from({ length: pageTexts.length + 1 }, () => ({ pairs: 0, total: 0 })),
  );
  /** Result of pairing expectedTexts[x] with pageTexts[y], or null if they are not similar enough. */
  const pairResult = (x: number, y: number): Result | null =>
    sim[x][y] >= SIMILARITY_THRESHOLD ? { pairs: best[x + 1][y + 1].pairs + 1, total: best[x + 1][y + 1].total + sim[x][y] } : null;

  for (let x = expectedTexts.length - 1; x >= 0; x--) {
    for (let y = pageTexts.length - 1; y >= 0; y--) {
      let choice = isBetter(best[x][y + 1], best[x + 1][y]) ? best[x][y + 1] : best[x + 1][y]; // skip one block
      const pair = pairResult(x, y);
      if (pair && !isBetter(choice, pair)) choice = pair; // pairing wins a tie
      best[x][y] = choice;
    }
  }

  // Walk the table again to read off the chosen pairs.
  const pairs: [number, number][] = [];
  for (let x = 0, y = 0; x < expectedTexts.length && y < pageTexts.length; ) {
    const pair = pairResult(x, y);
    if (pair && isSame(pair, best[x][y])) {
      pairs.push([x, y]);
      x++;
      y++;
    } else if (isSame(best[x + 1][y], best[x][y])) {
      x++; // leave this expected block unpaired
    } else {
      y++; // leave this page block unpaired
    }
  }
  return pairs;
}

/**
 * Lines up expected blocks with page blocks, then compares each matched pair.
 *
 *   1. Exact matches in order: the longest common subsequence (LCS) of block texts.
 *      Each page block is used once, in document order, so duplicates such as
 *      Yes / No / Yes / No line up correctly. When several LCS results are equally
 *      long, the one whose blocks moved least (smallest total |expected - page position|)
 *      wins, so a block that stayed in place is never the one reported as moved.
 *   2. Moved blocks: an expected block not matched in step 1 whose exact text is
 *      still unused elsewhere on the page -> "content order differs".
 *   3. Near misses: between two step-1 matches, remaining blocks are paired in order
 *      when similarity() >= 0.5 -> reported as text differences by compareBlock().
 *      bestNearMissPairs() picks the in-order pairing with the most pairs, and among
 *      those the highest total similarity (not simply the first block that is close enough).
 *   4. Everything left is a missing expected block or an extra page block.
 *
 * Every matched pair (steps 1-3) goes through compareBlock(), so text, line breaks,
 * tag and CSS are checked for it. Bold/italic/underline are checked only when the
 * pair's text matches (near-miss pairs from step 3 never get formatting checks).
 * Issues are listed in page order.
 *
 * @param expectedBlocks content list from SpecText.json
 * @param actualBlocks   blocks extracted from the page
 * @param errors         list that collects every difference (changed in place)
 * @param css            expected CSS values in browser notation
 */
function compareBlocks(expectedBlocks: ExpectedBlock[], actualBlocks: ActualBlock[], errors: string[], css: CssLookup): void {
  const expected = expectedBlocks.map(prepare);
  const n = expected.length;
  const m = actualBlocks.length;

  if (n !== m) {
    errors.push(`Expected ${n} content block(s) but found ${m}`);
  }

  const pageIndexOf = new Array<number>(n).fill(-1); // expected index -> page index (-1 = not matched)
  const pageUsed = new Array<boolean>(m).fill(false);
  const moved = new Array<boolean>(n).fill(false);

  // Step 1: LCS. For expected[i..] and page[j..]:
  //   count[i][j] = most exact matches possible, keeping order
  //   moves[i][j] = smallest total |i - j| over the matches, among results with that count
  const count = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const moves = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  /** The three choices at (i, j): match both, skip the expected block, skip the page block. */
  const options = (i: number, j: number): { step: 'match' | 'skipExpected' | 'skipPage'; count: number; moves: number }[] => {
    const list: { step: 'match' | 'skipExpected' | 'skipPage'; count: number; moves: number }[] = [];
    if (expected[i].text === actualBlocks[j].text) {
      list.push({ step: 'match', count: count[i + 1][j + 1] + 1, moves: moves[i + 1][j + 1] + Math.abs(i - j) });
    }
    list.push({ step: 'skipExpected', count: count[i + 1][j], moves: moves[i + 1][j] });
    list.push({ step: 'skipPage', count: count[i][j + 1], moves: moves[i][j + 1] });
    return list;
  };
  /** More matches first; then fewer moves; on a full tie, the earlier option in the list. */
  const best = (i: number, j: number) =>
    options(i, j).reduce((a, b) => (b.count > a.count || (b.count === a.count && b.moves < a.moves) ? b : a));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const choice = best(i, j);
      count[i][j] = choice.count;
      moves[i][j] = choice.moves;
    }
  }
  const anchors: [number, number][] = [[-1, -1]]; // step-1 matches, plus start and end markers
  for (let i = 0, j = 0; i < n && j < m; ) {
    const { step } = best(i, j);
    if (step === 'match') {
      pageIndexOf[i] = j;
      pageUsed[j] = true;
      anchors.push([i, j]);
      i++;
      j++;
    } else if (step === 'skipExpected') {
      i++; // this expected block is not part of the best in-order match
    } else {
      j++; // this page block is not part of the best in-order match
    }
  }
  anchors.push([n, m]);

  // Step 2: moved blocks (same exact text, but out of order).
  for (let i = 0; i < n; i++) {
    if (pageIndexOf[i] !== -1) continue;
    const j = actualBlocks.findIndex((block, k) => !pageUsed[k] && block.text === expected[i].text);
    if (j !== -1) {
      pageIndexOf[i] = j;
      pageUsed[j] = true;
      moved[i] = true;
    }
  }

  // Step 3: near misses, only inside the gap between two consecutive step-1 matches.
  for (let a = 0; a < anchors.length - 1; a++) {
    const [fromI, fromJ] = anchors[a];
    const [toI, toJ] = anchors[a + 1];
    const expectedCandidates: number[] = [];
    for (let i = fromI + 1; i < toI; i++) if (pageIndexOf[i] === -1) expectedCandidates.push(i);
    const pageCandidates: number[] = [];
    for (let j = fromJ + 1; j < toJ; j++) if (!pageUsed[j]) pageCandidates.push(j);
    const pairs = bestNearMissPairs(
      expectedCandidates.map((i) => expected[i].text),
      pageCandidates.map((j) => actualBlocks[j].text),
    );
    for (const [x, y] of pairs) {
      pageIndexOf[expectedCandidates[x]] = pageCandidates[y];
      pageUsed[pageCandidates[y]] = true;
    }
  }

  // Step 4: report in page order. A missing block is placed just after the page block
  // matched IN PLACE to an earlier expected block (moved blocks are ignored here, so they
  // cannot shift the hint); consecutive missing blocks share the same hint.
  const report: { at: number; run: () => void }[] = [];
  let previousPageIndex = -1;
  expected.forEach((exp, i) => {
    const j = pageIndexOf[i];
    if (j === -1) {
      const where = previousPageIndex === -1 ? 'expected at the start of the page' : `expected after page position ${previousPageIndex + 1}`;
      report.push({ at: previousPageIndex + 0.5, run: () => errors.push(`${exp.label}: missing on the page (${where}). Expected "${exp.text}"`) });
      return;
    }
    const act = actualBlocks[j];
    if (moved[i]) {
      report.push({
        at: j,
        run: () => {
          errors.push(`${exp.label}: found at page position ${j + 1} instead of ${i + 1} (content order differs)`);
          compareBlock(exp, act, errors, css); // formatting of a moved block is still checked
        },
      });
    } else {
      previousPageIndex = j;
      report.push({ at: j, run: () => compareBlock(exp, act, errors, css) });
    }
  });
  actualBlocks.forEach((act, j) => {
    if (!pageUsed[j]) {
      report.push({ at: j, run: () => errors.push(`Extra block at page position ${j + 1} (not in SpecText.json): "${act.text}"`) });
    }
  });
  report.sort((x, y) => x.at - y.at).forEach((entry) => entry.run());
}

/**
 * Throws the final validation error: a header, every difference, then the actual
 * page content (bold shown as **bold**) so the tester can fix the JSON or log a defect.
 * The return type `never` means this function always throws.
 */
function fail(context: string, errors: string[], actualBlocks: ActualBlock[]): never {
  throw new Error(
    `${context}: content does not match SpecText.json (${errors.length} difference(s))\n` +
      errors.map((e) => `  - ${e}`).join('\n') +
      `\n\nActual content found on the page (**bold**):\n${HtmlStructure.toReadable(actualBlocks)}`,
  );
}

/** Public API used by the Page Objects. */
export const ContentValidator = {
  /**
   * Validate a screen's landing-page content inside `contentRoot`.
   *
   * Used by: ConfirmPage.validateLandingContent()
   *
   * @param contentRoot locator of the content container (only the content in SpecText.json)
   * @param expected    the screens.<SCREEN>.<LANG> section from JsonReader.getScreen()
   * @param context     label at the start of the error, e.g. "CONFIRM landing page (EN)"
   * @throws Error listing the differences when the content does not match
   */
  async validateScreen(contentRoot: Locator, expected: ExpectedScreen, context: string): Promise<void> {
    const actualBlocks = await HtmlStructure.extract(contentRoot);
    const css = await lookUpCss(contentRoot, expected.content);
    const errors: string[] = [];
    compareBlocks(expected.content, actualBlocks, errors, css);
    if (errors.length > 0) fail(context, errors, actualBlocks);
  },

  /**
   * Validate a Help modal: title, body content, and Close button text.
   *
   * Used by: ConfirmPage.validateHelpText(), VerifyPage.validateHelpText()
   *
   * @param modal    locators of the modal title, the body (paragraphs only) and the Close button
   * @param expected the helpModals.<SCREEN>.<LANG> section from JsonReader.getHelp()
   * @param context  label at the start of the error, e.g. "VERIFY Help modal (EN)"
   * @throws Error listing the differences when anything does not match
   */
  async validateHelp(
    modal: { title: Locator; body: Locator; closeButton: Locator },
    expected: ExpectedHelp,
    context: string,
  ): Promise<void> {
    const errors: string[] = [];

    // Compared exactly, like content lines. HtmlStructure.text() keeps edge spaces only
    // when they are visible (white-space: pre / pre-wrap), so write them only in that case.
    const expectedTitle = normalizeExpected(expected.title);
    const actualTitle = await HtmlStructure.text(modal.title);
    if (actualTitle !== expectedTitle) {
      errors.push(`Title: expected ${showSpaces(expectedTitle)} but found ${showSpaces(actualTitle)}`);
    }

    const actualBlocks = await HtmlStructure.extract(modal.body);
    const css = await lookUpCss(modal.body, expected.content);
    compareBlocks(expected.content, actualBlocks, errors, css);

    const expectedClose = normalizeExpected(expected.closeButton);
    const actualClose = await HtmlStructure.text(modal.closeButton);
    if (actualClose !== expectedClose) {
      errors.push(`Close button: expected ${showSpaces(expectedClose)} but found ${showSpaces(actualClose)}`);
    }

    if (errors.length > 0) fail(context, errors, actualBlocks);
  },
};
