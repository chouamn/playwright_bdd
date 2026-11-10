/**
 * FILE: src/utils/HtmlStructure.ts
 *
 * RESPONSIBILITY
 *   Reads what the responder actually SEES inside a part of the page: text, line breaks,
 *   bold / italic / underline per character, HTML tag and a few CSS values.
 *   It does not compare anything; ContentValidator does the comparison.
 *
 * WHO USES IT
 *   ContentValidator.validateScreen() / validateHelp():
 *     - HtmlStructure.extract()          -> content blocks of a container or Help body
 *     - HtmlStructure.text()             -> Help title and Close button text
 *     - HtmlStructure.computeCssValues() -> converts expected CSS ("#fff") to browser notation
 *     - HtmlStructure.toReadable()       -> "actual content" dump in failure messages
 *
 * TWO WORLDS
 *   Functions marked "Runs INSIDE the browser" (extractInBrowser, readTextInfo) are sent
 *   to the browser by Playwright's locator.evaluate(). They can use DOM APIs such as
 *   getComputedStyle(), but cannot use anything defined outside their own body.
 *   Everything else runs in Node.js.
 */

import { Locator } from 'playwright';

/**
 * Extracts the visible text of a DOM region as an ordered list of blocks.
 *
 *   block  = one block-level element (p, h1, li, div, label row...) in top-to-bottom order
 *   lines  = the block's text split on <br>
 *   format = for every character: is it bold / italic / underlined?
 *   style  = a few computed CSS values of the block element
 *
 * Hidden content is skipped, because the check is about what the responder SEES:
 *   - display:none, opacity 0 and 1px screen-reader-only elements: the whole element
 *     and everything inside it (children cannot undo these);
 *   - visibility:hidden: only the text that is itself hidden. A child with
 *     visibility:visible inside a hidden parent IS shown, so it is extracted.
 */

/** Computed CSS properties captured for each block (usable in SpecText.json "style"). */
export const CAPTURED_STYLES = [
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontFamily',
  'color',
  'backgroundColor',
  'textAlign',
  'textDecorationLine',
  'lineHeight',
] as const;

/**
 * One block as found on the page (after white-space normalization).
 * ContentValidator compares each ActualBlock with an expected block from SpecText.json.
 */
export interface ActualBlock {
  /** Lower-case HTML tag of the block element, e.g. "p", "h1", "div". */
  tag: string;
  /**
   * Text of each line as the browser shows it: spaces are collapsed only where CSS
   * `white-space` collapses them; &nbsp; and preserved spaces are kept (as ' ').
   * "" = a visible blank line.
   */
  lines: string[];
  /** lines joined with "\n" - the index space used by `format`. */
  text: string;
  /** One true/false per character of `text`, e.g. format.bold[0] = is the first character bold? */
  format: { bold: boolean[]; italic: boolean[]; underline: boolean[] };
  /** Computed CSS of the block element, keyed by the CAPTURED_STYLES names. */
  style: Record<string, string>;
}

/**
 * How the browser treats spaces and newlines in a run (from CSS `white-space`):
 *   collapse        - normal, nowrap: spaces/tabs/newlines collapse to one space
 *   preserve        - pre, pre-wrap, break-spaces: every space and newline is kept
 *   preserve-breaks - pre-line: spaces collapse, newlines are kept as line breaks
 */
type SpaceMode = 'collapse' | 'preserve' | 'preserve-breaks';

/**
 * A "run" = a piece of text that has ONE format (e.g. the bold part of a sentence).
 * Built in the browser by extractInBrowser(); not yet white-space normalized.
 */
interface RawRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  space: SpaceMode;
}

/** A block as returned by the browser: lines (split on <br>) of runs, before normalization. */
interface RawBlock {
  tag: string;
  lines: RawRun[][];
  style: Record<string, string>;
}

/** Public API used by ContentValidator. */
export const HtmlStructure = {
  /**
   * Extract the visible content blocks inside `root`.
   *
   * Steps:
   *   1. root.evaluate() runs extractInBrowser() inside the browser on the root element
   *      and returns the raw blocks (Playwright waits for the element first).
   *   2. normalizeBlock() applies the CSS white-space rules in Node.js.
   *   3. Blocks with no text left are dropped.
   *
   * Used by: ContentValidator.validateScreen() (content container) and validateHelp() (Help body)
   *
   * @param root locator of the container, e.g. ConfirmPage.contentContainerLocator
   * @returns the blocks in top-to-bottom document order
   */
  async extract(root: Locator): Promise<ActualBlock[]> {
    const rawBlocks = await root.evaluate(extractInBrowser, [...CAPTURED_STYLES]);
    return rawBlocks.map(normalizeBlock).filter((block) => block.text.length > 0);
  },

  /**
   * Visible text of one element (titles, buttons). innerText() already applies the
   * browser's CSS white-space rules, so inner spacing is kept as displayed.
   * Leading/trailing spaces depend on the element's own `white-space`:
   *   - pre, pre-wrap, break-spaces: they take up visible space, so they are kept
   *     (only a final newline is dropped - it does not show an extra line);
   *   - normal, nowrap, pre-line: they are not displayed, so they are removed.
   * &nbsp; is written as ' '.
   *
   * Used by: ContentValidator.validateHelp() for the Help title and the Close button.
   *
   * @param locator the title or button element
   * @returns the text exactly as displayed, e.g. "Help" or "Close"
   */
  async text(locator: Locator): Promise<string> {
    // <input type="button|submit|reset"> shows its `value`, which innerText() does not return.
    const { inputButtonValue, preservesSpaces } = await locator.evaluate(readTextInfo);
    let text = (inputButtonValue ?? (await locator.innerText())).replace(/\r\n?/g, '\n');
    if (preservesSpaces) {
      text = text.replace(/\n$/, '');
    } else {
      // innerText() has already collapsed inner spaces, but an input value has not.
      if (inputButtonValue !== null) text = text.replace(/[ \t\n\f]+/g, ' ');
      // Trim only collapsible whitespace: &nbsp; at the edges is displayed, so it stays.
      text = text.replace(/^[ \t\n\f]+|[ \t\n\f]+$/g, '');
    }
    return text.replace(/ /g, ' ');
  },

  /**
   * Ask the browser how it would write each expected CSS value, e.g.
   * color "#fff" -> "rgb(255, 255, 255)", fontWeight "bold" -> "700".
   * Returns null for a value the browser does not accept for that property.
   * Uses a temporary hidden element, removed again afterwards.
   *
   * Why: the browser always reports computed CSS in its own notation, so the expected
   * value from SpecText.json must be converted the same way before comparing.
   *
   * Used by: ContentValidator (lookUpCss), once per validation, for all style values.
   *
   * @param anyElementOnPage any element on the page (only used to run code in the browser)
   * @param declarations     e.g. [{ property: 'color', value: '#1f4e79' }]
   * @returns one result per declaration, same order: the browser value, or null if invalid
   */
  async computeCssValues(anyElementOnPage: Locator, declarations: { property: string; value: string }[]): Promise<(string | null)[]> {
    if (declarations.length === 0) return [];
    return anyElementOnPage.evaluate((_el, decls) => {
      const probe = document.createElement('span');
      probe.style.display = 'none';
      document.body.appendChild(probe);
      try {
        return decls.map(({ property, value }) => {
          const cssName = property.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()); // fontWeight -> font-weight
          if (!CSS.supports(cssName, value)) return null;
          probe.style.setProperty(cssName, value);
          const computed = getComputedStyle(probe).getPropertyValue(cssName);
          probe.style.removeProperty(cssName);
          return computed;
        });
      } finally {
        probe.remove(); // always remove the temporary element, even if something above fails
      }
    }, declarations);
  },

  /**
   * Human-readable dump used in failure messages. Bold text is shown as **bold**.
   *
   * Used by: ContentValidator fail() - printed under "Actual content found on the page".
   *
   * @param blocks the extracted blocks
   * @returns one line per block, e.g.  [2] <p> **Are you completing ...?** Help
   *          (line breaks inside a block are shown as <br>)
   */
  toReadable(blocks: ActualBlock[]): string {
    return blocks
      .map((block, index) => {
        let out = '';
        let inBold = false; // are we currently inside a ** ... ** section?
        // Walk the text one character at a time and add ** each time bold turns on or off.
        for (let i = 0; i < block.text.length; i++) {
          const ch = block.text[i];
          const bold = block.format.bold[i];
          if (ch !== ' ' && ch !== '\n' && bold !== inBold) {
            // Close the marker before any trailing spaces: "**bold** text", not "**bold **text".
            out = inBold ? out.replace(/(\s*)$/, '**$1') : out + '**';
            inBold = bold;
          }
          out += ch;
        }
        if (inBold) out += '**';
        return `  [${index + 1}] <${block.tag}> ${out.replace(/\n/g, ' <br> ')}`;
      })
      .join('\n');
  },
};

/**
 * Runs INSIDE the browser.
 *   inputButtonValue - for an input button, its value with CSS text-transform applied
 *                      (as the responder sees it); for any other element, null.
 *   preservesSpaces  - true when the element's own white-space keeps spaces
 *                      (pre, pre-wrap, break-spaces), so edge spaces are visible.
 *
 * Used by: HtmlStructure.text()
 */
function readTextInfo(el: Element): { inputButtonValue: string | null; preservesSpaces: boolean } {
  const style = getComputedStyle(el);
  const collapse = (style as unknown as Record<string, string | undefined>).whiteSpaceCollapse;
  const preservesSpaces = collapse
    ? collapse === 'preserve' || collapse === 'break-spaces'
    : ['pre', 'pre-wrap', 'break-spaces'].includes(style.whiteSpace);

  if (!(el instanceof HTMLInputElement) || !['button', 'submit', 'reset'].includes(el.type)) {
    return { inputButtonValue: null, preservesSpaces };
  }
  const transform = style.textTransform;
  let value = el.value;
  if (transform.includes('uppercase')) value = value.toUpperCase();
  else if (transform.includes('lowercase')) value = value.toLowerCase();
  else if (transform.includes('capitalize')) {
    // Same word rule as extractInBrowser: start of word = previous char is not a letter/digit/mark/_/apostrophe.
    let out = '';
    let previous = '';
    for (const ch of value) {
      const upper = ch.toUpperCase();
      out += !/[\p{L}\p{N}\p{M}_'’]/u.test(previous) && upper.length === 1 ? upper : ch;
      previous = ch;
    }
    value = out;
  }
  return { inputButtonValue: value, preservesSpaces };
}

/**
 * Turn raw runs into lines + per-character format flags, applying the same
 * white-space rules the browser uses when it displays the text (CSS Text 3):
 *   - collapsible spaces (space, tab, and newline in "collapse" mode) shrink to one
 *     space, and disappear at the start and end of a line;
 *   - &nbsp; is never collapsible: it is kept, written as a normal ' ';
 *   - in "preserve" mode every space/tab is kept; in "preserve"/"preserve-breaks"
 *     mode a newline starts a new line, like <br>.
 * Each character keeps the format of the run it came from, so text and the
 * bold/italic/underline arrays always have the same length.
 *
 * Example (normal white-space):  "  Hello   <b>world</b>  "  ->  "Hello world"
 *                                 (with "world" marked bold)
 *
 * Used by: HtmlStructure.extract()
 *
 * @param raw a block returned by extractInBrowser()
 * @returns the block as the responder sees it
 */
function normalizeBlock(raw: RawBlock): ActualBlock {
  type Char = { ch: string; bold: boolean; italic: boolean; underline: boolean; collapsible: boolean };
  const COLLAPSIBLE = /[ \t\n\f]/; // only these collapse in CSS; other Unicode spaces stay as typed

  // The result is built character by character. `collapsible` marks a space that may
  // still disappear (e.g. at the end of a line).
  const normalizedLines: Char[][] = [[]];
  const currentLine = () => normalizedLines[normalizedLines.length - 1];
  const trimTrailingCollapsible = (line: Char[]) => {
    while (line.length > 0 && line[line.length - 1].collapsible) line.pop();
  };
  const startNewLine = () => {
    trimTrailingCollapsible(currentLine());
    normalizedLines.push([]);
  };

  raw.lines.forEach((runs, index) => {
    if (index > 0) startNewLine(); // <br>
    for (const run of runs) {
      const format = { bold: run.bold, italic: run.italic, underline: run.underline };
      for (const ch of run.text.replace(/\r\n?/g, '\n')) {
        if (ch === '\n' && run.space !== 'collapse') {
          startNewLine(); // preserved newline (pre, pre-wrap, pre-line)
        } else if (ch === ' ') {
          currentLine().push({ ch: ' ', ...format, collapsible: false }); // &nbsp; is always shown
        } else if (COLLAPSIBLE.test(ch) && run.space === 'preserve') {
          currentLine().push({ ch: ch === '\t' ? '\t' : ' ', ...format, collapsible: false });
        } else if (COLLAPSIBLE.test(ch)) {
          const line = currentLine();
          const previous = line[line.length - 1];
          // Dropped at the start of a line and right after another collapsible space.
          if (previous && !previous.collapsible) line.push({ ch: ' ', ...format, collapsible: true });
        } else {
          currentLine().push({ ch, ...format, collapsible: false });
        }
      }
    }
  });
  trimTrailingCollapsible(currentLine());

  // A final <br> (or a final preserved newline) does not show an extra line, so drop
  // ONE trailing empty line. Other empty lines are visible blank lines and are kept.
  if (normalizedLines.length > 1 && normalizedLines[normalizedLines.length - 1].length === 0) normalizedLines.pop();

  // Join the lines with "\n" so `text` and the format arrays share one index space.
  const all: Char[] = [];
  normalizedLines.forEach((line, index) => {
    if (index > 0) all.push({ ch: '\n', bold: false, italic: false, underline: false, collapsible: false });
    all.push(...line);
  });

  return {
    tag: raw.tag,
    lines: normalizedLines.map((line) => line.map((c) => c.ch).join('')),
    text: all.map((c) => c.ch).join(''),
    format: {
      bold: all.map((c) => c.bold),
      italic: all.map((c) => c.italic),
      underline: all.map((c) => c.underline),
    },
    style: raw.style,
  };
}

/**
 * Runs INSIDE the browser (Playwright serializes this function),
 * so it must not reference anything outside its own body.
 *
 * Walks the DOM under `root` and returns its visible content as raw blocks:
 *   - a block-level element (p, h1, li, div...) starts a new block;
 *   - inline elements (b, span, a...) stay inside the current block as runs;
 *   - <br> starts a new line inside the block;
 *   - hidden elements, scripts, styles and SVG are skipped;
 *   - <input type="button|submit|reset"> contributes its visible value.
 *
 * Used by: HtmlStructure.extract() via root.evaluate()
 *
 * @param root       the container element (resolved from the Locator by Playwright)
 * @param styleNames CAPTURED_STYLES, passed in because outside variables are not available here
 * @returns raw blocks in document order
 */
function extractInBrowser(root: Element, styleNames: string[]): RawBlock[] {
  // Elements that never contain visible text content.
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'svg', 'SVG']);
  const blocks: RawBlock[] = [];

  // visibility is NOT checked here: a child can override visibility:hidden, so
  // visibility is checked on each piece of text (and input button) instead.
  const isHidden = (el: Element): boolean => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.opacity === '0') return true;
    if (s.display === 'contents') return false;
    const r = el.getBoundingClientRect();
    return r.width <= 1 && r.height <= 1; // screen-reader-only text
  };

  /** True for block-level elements (display: block, flex, list-item...), false for inline ones. */
  const isBlock = (el: Element): boolean => {
    const d = getComputedStyle(el).display;
    return !d.startsWith('inline') && d !== 'contents' && d !== 'none';
  };

  /** True when an (inline) element has a visible block-level element somewhere inside it. */
  const containsBlock = (el: Element): boolean => {
    for (const child of Array.from(el.children)) {
      if (SKIP_TAGS.has(child.tagName) || isHidden(child)) continue;
      if (isBlock(child) || containsBlock(child)) return true;
    }
    return false;
  };

  /**
   * Bold / italic / underline of the text inside `el`.
   * Bold = computed font-weight 600 or more (so <b>, <strong> and CSS font-weight all count).
   */
  const formatOf = (el: Element, stopAt: Element) => {
    const s = getComputedStyle(el);
    let underline = false;
    // text-decoration is not inherited in computed style, so walk up to the block.
    for (let cur: Element | null = el; cur; cur = cur.parentElement) {
      if (getComputedStyle(cur).textDecorationLine.includes('underline')) {
        underline = true;
        break;
      }
      if (cur === stopAt) break;
    }
    return {
      bold: (parseInt(s.fontWeight, 10) || 400) >= 600,
      italic: s.fontStyle === 'italic' || s.fontStyle.startsWith('oblique'),
      underline,
    };
  };

  /** Last character already collected on this line ('' at the start of a line). */
  const lastCharOf = (line: RawRun[]): string => {
    for (let i = line.length - 1; i >= 0; i--) {
      if (line[i].text.length > 0) return line[i].text[line[i].text.length - 1];
    }
    return '';
  };

  /**
   * Apply CSS text-transform so the text matches what the responder SEES.
   * `previousChar` is the character before this text on the same line, because
   * "capitalize" words can span elements (e.g. <b>hel</b>lo -> "Hello").
   * Each run keeps one format, so a length change (e.g. "ß" -> "SS") keeps
   * the bold/italic/underline flags aligned with the text.
   */
  const applyTextTransform = (text: string, transform: string, previousChar: string): string => {
    if (transform.includes('uppercase')) return text.toUpperCase();
    if (transform.includes('lowercase')) return text.toLowerCase();
    if (transform.includes('capitalize')) {
      // Matches Chromium: a word starts after any char that is not a letter, digit,
      // combining mark, underscore or apostrophe. Letters with no single-char capital stay as is.
      let out = '';
      let previous = previousChar;
      for (const ch of text) {
        const upper = ch.toUpperCase();
        out += !/[\p{L}\p{N}\p{M}_'’]/u.test(previous) && upper.length === 1 ? upper : ch;
        previous = ch;
      }
      return out;
    }
    return text; // "none" (or any other value): unchanged
  };

  /** How this element's CSS white-space treats spaces and newlines (see SpaceMode). */
  const spaceModeOf = (style: CSSStyleDeclaration): SpaceMode => {
    // Newer browsers expose white-space-collapse; older ones only the white-space shorthand.
    const collapse = (style as unknown as Record<string, string | undefined>).whiteSpaceCollapse;
    if (collapse) {
      if (collapse === 'preserve' || collapse === 'break-spaces') return 'preserve';
      return collapse === 'preserve-breaks' ? 'preserve-breaks' : 'collapse';
    }
    const ws = style.whiteSpace;
    if (ws === 'pre' || ws === 'pre-wrap' || ws === 'break-spaces') return 'preserve';
    return ws === 'pre-line' ? 'preserve-breaks' : 'collapse';
  };

  /**
   * Adds the text of `node` (and of everything inside it) to `lines` as runs.
   * Recursive: an element calls collectRuns() again for each child node.
   */
  const collectRuns = (node: Node, lines: RawRun[][], blockEl: Element): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent) return;
      const parentStyle = getComputedStyle(parent);
      if (parentStyle.visibility !== 'visible') return;
      const rawText = node.textContent ?? '';
      if (rawText.length > 0) {
        const line = lines[lines.length - 1];
        const text = applyTextTransform(rawText, parentStyle.textTransform, lastCharOf(line));
        line.push({ text, ...formatOf(parent, blockEl), space: spaceModeOf(parentStyle) });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.tagName === 'BR') {
      lines.push([]);
      return;
    }
    if (isHidden(el)) return;
    if (el.tagName === 'INPUT') {
      const input = el as HTMLInputElement;
      const inputStyle = getComputedStyle(el);
      if (['submit', 'button', 'reset'].includes(input.type) && input.value && inputStyle.visibility === 'visible') {
        const line = lines[lines.length - 1];
        const text = applyTextTransform(input.value, inputStyle.textTransform, lastCharOf(line));
        line.push({ text, ...formatOf(el, blockEl), space: spaceModeOf(inputStyle) });
      }
      return;
    }
    for (const child of Array.from(el.childNodes)) collectRuns(child, lines, blockEl);
  };

  /** Computed values of the CAPTURED_STYLES properties for one block element. */
  const styleOf = (el: Element): Record<string, string> => {
    const s = getComputedStyle(el) as unknown as Record<string, string>;
    const out: Record<string, string> = {};
    for (const name of styleNames) out[name] = String(s[name] ?? '');
    return out;
  };

  /** Turns a group of inline nodes into one RawBlock, owned by the block element `blockEl`. */
  const emit = (nodes: Node[], blockEl: Element): void => {
    const lines: RawRun[][] = [[]];
    for (const n of nodes) collectRuns(n, lines, blockEl);
    // A block with only whitespace (e.g. a <p>&nbsp;</p> spacer) is treated as layout
    // spacing, not content: it is not extracted and not validated against SpecText.json.
    const hasText = lines.some((line) => line.some((run) => run.text.trim().length > 0));
    if (hasText) blocks.push({ tag: blockEl.tagName.toLowerCase(), lines, style: styleOf(blockEl) });
  };

  // Walk the tree: inline content is grouped into the nearest block element;
  // block children become their own blocks (in document order).
  const walk = (container: Element): void => {
    // Inline nodes collected so far; they become one block when a block element
    // (or the end of the container) is reached.
    let pending: Node[] = [];
    const flush = () => {
      if (pending.length > 0) emit(pending, container);
      pending = [];
    };
    for (const node of Array.from(container.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        pending.push(node);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      if (el.tagName === 'BR') {
        pending.push(el); // <br> has no size, so check it before the hidden-element filter
        continue;
      }
      if (SKIP_TAGS.has(el.tagName) || isHidden(el)) continue;
      if (isBlock(el) || containsBlock(el)) {
        flush();
        walk(el);
      } else {
        pending.push(el);
      }
    }
    flush();
  };

  walk(root);
  return blocks;
}
