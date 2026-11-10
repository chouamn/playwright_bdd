/**
 * FILE: src/utils/BaseAction.ts
 *
 * RESPONSIBILITY
 *   One place for every Playwright UI action the Page Objects need (click, fill, select,
 *   wait, navigate...). Each method wraps the Playwright call and, on failure, throws an
 *   error that says WHAT failed, on WHICH element, in WHICH Page Object.
 *
 * WHO USES IT
 *   BasePage creates one BaseAction per Page Object as `this.actions`.
 *   Page Objects call it; step definitions never call it directly.
 *
 * PLACEHOLDER LOCATORS
 *   There is no special check for 'UPDATE_LOCATOR'. A placeholder locator matches no
 *   element, so Playwright waits for DEFAULT_TIMEOUT and then reports a timeout error.
 *
 * Methods marked "(not used by the current scenarios)" are ready for future screens.
 */

import { Locator, Page } from 'playwright';

/**
 * Reusable Playwright UI operations for all Page Objects.
 *
 * How to use (inside a Page Object):
 *   await this.actions.click(this.nextButtonLocator, 'Next button');
 *
 * Rules every method follows:
 *   - It takes a Playwright Locator (never a hardcoded selector).
 *   - It takes a readable `name`, so a failure says WHICH element had the problem.
 *   - It relies on Playwright auto-waiting (no fixed sleeps). The wait limit is
 *     DEFAULT_TIMEOUT from .env.uat, set on the browser context in Hooks.ts.
 *
 * Example failure message:
 *   Could not click "Next button" on ConfirmPage: Timeout 30000ms exceeded. ...
 */
export class BaseAction {
  /**
   * @param page  the Playwright page of the current scenario
   * @param owner name of the Page Object using these actions (shown in error messages)
   */
  constructor(
    private readonly page: Page,
    private readonly owner: string,
  ) {}

  // ---------- Element interactions ----------
  // Playwright waits automatically until the element is visible, enabled and stable
  // before acting, so no manual waits are needed before these calls.

  /**
   * Clicks an element. Used by LoginPage.clickLogin(), ConfirmPage.clickNext(),
   * openHelp() and closeHelp().
   *
   * @param locator the element to click
   * @param name    readable name for error messages, e.g. 'Next button'
   */
  async click(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'click', () => locator.click());
  }

  /** Double-clicks an element. (not used by the current scenarios) */
  async doubleClick(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'double-click', () => locator.dblclick());
  }

  /** Right-clicks an element. (not used by the current scenarios) */
  async rightClick(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'right-click', () => locator.click({ button: 'right' }));
  }

  /**
   * Replace the field's value in one go (the normal way to enter text).
   * Used by LoginPage.enterCensusId().
   *
   * @param locator the input or textarea
   * @param value   the text to put in the field
   * @param name    readable name for error messages
   * @example await this.actions.fill(this.censusIdInputBoxLocator, '123456789012', 'Census ID input');
   */
  async fill(locator: Locator, value: string, name: string): Promise<void> {
    await this.executeAction(locator, name, 'fill', () => locator.fill(value));
  }

  /** Empties an input field. (not used by the current scenarios) */
  async clear(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'clear', () => locator.clear());
  }

  /**
   * Type key by key. Use only when a field reacts to each key press
   * (e.g. an input mask such as ____-____-____); otherwise use fill().
   * (not used by the current scenarios)
   */
  async type(locator: Locator, value: string, name: string): Promise<void> {
    await this.executeAction(locator, name, 'type into', () => locator.pressSequentially(value));
  }

  /** Press a key on an element, e.g. 'Enter', 'Tab', 'Escape'. (not used by the current scenarios) */
  async press(locator: Locator, key: string, name: string): Promise<void> {
    await this.executeAction(locator, name, `press "${key}" on`, () => locator.press(key));
  }

  /** Ticks a checkbox (does nothing if already ticked). (not used by the current scenarios) */
  async check(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'check', () => locator.check());
  }

  /** Unticks a checkbox. (not used by the current scenarios) */
  async uncheck(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'uncheck', () => locator.uncheck());
  }

  /**
   * Select a radio button (e.g. Yes / No).
   * Used by ConfirmPage.selectYes() / selectNo().
   */
  async selectRadio(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'select radio button', () => locator.check());
  }

  /** Moves the mouse over an element (e.g. to show a tooltip). (not used by the current scenarios) */
  async hover(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'hover over', () => locator.hover());
  }

  /** Gives keyboard focus to an element. (not used by the current scenarios) */
  async focus(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'focus', () => locator.focus());
  }

  // ---------- Dropdowns (<select>) ----------
  // Not used by the current scenarios; ready for screens with dropdowns.

  /** Selects the option whose visible text is `label`, e.g. selectByLabel(stateLocator, 'Maryland', 'State'). */
  async selectByLabel(locator: Locator, label: string, name: string): Promise<void> {
    await this.executeAction(locator, name, `select option "${label}" in`, () => locator.selectOption({ label }));
  }

  /** Selects the option whose `value` attribute is `value`. */
  async selectByValue(locator: Locator, value: string, name: string): Promise<void> {
    await this.executeAction(locator, name, `select value "${value}" in`, () => locator.selectOption({ value }));
  }

  /**
   * index starts at 0 (the first option). Must be a whole number: 0, 1, 2, ...
   *
   * @throws Error before touching the browser when index is negative or not a whole number
   */
  async selectByIndex(locator: Locator, index: number, name: string): Promise<void> {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(
        `Invalid dropdown index ${String(index)} for "${name}" on ${this.owner}: ` +
          `use a whole number 0 or greater (0 = first option).`,
      );
    }
    await this.executeAction(locator, name, `select option #${index} in`, () => locator.selectOption({ index }));
  }

  /**
   * Visible text of every option in the dropdown, in order.
   *
   * @returns e.g. ['Select one', 'Yes', 'No']
   */
  async getDropdownOptions(locator: Locator, name: string): Promise<string[]> {
    return this.executeAction(locator, name, 'read options of', async () =>
      (await locator.locator('option').allInnerTexts()).map((text) => text.trim()),
    );
  }

  // ---------- Element state and values ----------
  // Not used by the current scenarios (content checks go through ContentValidator).

  /** true/false right now - does NOT wait. Use waitForVisible() to wait. */
  async isVisible(locator: Locator, name: string): Promise<boolean> {
    return this.executeAction(locator, name, 'check visibility of', () => locator.isVisible());
  }

  /** true when the element is enabled (not disabled). */
  async isEnabled(locator: Locator, name: string): Promise<boolean> {
    return this.executeAction(locator, name, 'check if enabled', () => locator.isEnabled());
  }

  /** true when a checkbox or radio button is selected. */
  async isChecked(locator: Locator, name: string): Promise<boolean> {
    return this.executeAction(locator, name, 'check if checked', () => locator.isChecked());
  }

  /**
   * Visible text of the element, with surrounding spaces removed.
   * For exact text + formatting comparison use ContentValidator instead.
   */
  async getText(locator: Locator, name: string): Promise<string> {
    return this.executeAction(locator, name, 'read text of', async () => (await locator.innerText()).trim());
  }

  /** Current value of an input, textarea or select. */
  async getInputValue(locator: Locator, name: string): Promise<string> {
    return this.executeAction(locator, name, 'read value of', () => locator.inputValue());
  }

  /** Attribute value, or null when the element does not have that attribute. */
  async getAttribute(locator: Locator, attribute: string, name: string): Promise<string | null> {
    return this.executeAction(locator, name, `read attribute "${attribute}" of`, () => locator.getAttribute(attribute));
  }

  /** Number of elements the locator matches right now (does not wait). */
  async getCount(locator: Locator, name: string): Promise<number> {
    return this.executeAction(locator, name, 'count', () => locator.count());
  }

  /**
   * Waits until the element is visible (up to DEFAULT_TIMEOUT).
   * Used by every verifyIsDisplayed() and verifyHelpIsDisplayed() method, and by
   * ConfirmPage.validateLandingContent() before reading the content.
   */
  async waitForVisible(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'wait until visible', () => locator.waitFor({ state: 'visible' }));
  }

  /**
   * Waits until the element is hidden or removed (up to DEFAULT_TIMEOUT).
   * Used by verifyHelpIsClosed() in ConfirmPage and VerifyPage.
   */
  async waitForHidden(locator: Locator, name: string): Promise<void> {
    await this.executeAction(locator, name, 'wait until hidden', () => locator.waitFor({ state: 'hidden' }));
  }

  // ---------- Navigation ----------

  /**
   * Opens a URL and waits for the HTML to load ('domcontentloaded').
   * Used by LoginPage.open() with BASE_URL.
   */
  async navigateTo(url: string): Promise<void> {
    await this.executePageAction(`open ${url}`, () => this.page.goto(url, { waitUntil: 'domcontentloaded' }));
  }

  /** Browser Back. The Census app asks responders to use its own buttons instead. */
  async goBack(): Promise<void> {
    await this.executePageAction('go back', () => this.page.goBack({ waitUntil: 'domcontentloaded' }));
  }

  /** Browser Forward. The Census app asks responders to use its own buttons instead. */
  async goForward(): Promise<void> {
    await this.executePageAction('go forward', () => this.page.goForward({ waitUntil: 'domcontentloaded' }));
  }

  /** Reloads the current page. (not used by the current scenarios) */
  async reload(): Promise<void> {
    await this.executePageAction('reload the page', () => this.page.reload({ waitUntil: 'domcontentloaded' }));
  }

  /** Wait until the URL matches, e.g. waitForUrl(/\/verify/) or waitForUrl('**\/confirm'). */
  async waitForUrl(url: string | RegExp): Promise<void> {
    await this.executePageAction(`wait for URL ${url}`, () => this.page.waitForURL(url));
  }

  /**
   * Wait for the page to finish loading after a click that navigates.
   * Prefer the default 'domcontentloaded' (or 'load'). Avoid 'networkidle': it waits
   * for 500 ms with no network traffic, which may never happen (or happen late) on
   * pages with continuous activity such as session keep-alive or analytics calls.
   */
  async waitForPageLoad(state: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded'): Promise<void> {
    await this.executePageAction(`wait for page ${state}`, () => this.page.waitForLoadState(state));
  }

  // ---------- Internal helpers ----------

  /**
   * Run an element operation; on failure, say what, where and why.
   *
   * @typeParam T  what the operation returns (void, string, boolean...)
   * @param locator   the element (kept for symmetry with the public methods)
   * @param name      readable element name, e.g. 'Next button'
   * @param action    verb for the message, e.g. 'click'
   * @param operation the Playwright call to run
   * @returns whatever the operation returns
   * @throws Error "Could not <action> "<name>" on <PageObject>: <Playwright message>"
   */
  private async executeAction<T>(locator: Locator, name: string, action: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // `cause` keeps the original Playwright error (type, stack, call log) attached.
      throw new Error(`Could not ${action} "${name}" on ${this.owner}: ${describeError(error)}`, { cause: error });
    }
  }

  /** Run a page-level operation (navigation); on failure, say what and why. */
  private async executePageAction<T>(action: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new Error(`Could not ${action} on ${this.owner}: ${describeError(error)}`, { cause: error });
    }
  }
}

/** Readable message for anything that was thrown (an Error, a string, or another value). */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}
