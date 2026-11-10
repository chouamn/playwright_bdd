/**
 * FILE: src/pages/LoginPage.ts
 *
 * RESPONSIBILITY
 *   Page Object for the LOGIN (Census home) screen: open the page, type the Census ID,
 *   click Log In.
 *
 * WHO USES IT
 *   LoginSteps.ts, through CustomWorld (this.loginPage).
 *
 * LOCATORS TO UPDATE
 *   censusIdInputBoxLocator, loginButtonLocator (both still 'UPDATE_LOCATOR').
 */

// `Locator` = a way to find an element; `Page` = the browser tab.
import { Locator, Page } from 'playwright';
import { ConfigReader } from '../config/ConfigReader';
import { BasePage } from './BasePage';

/** LOGIN screen: Census ID entry and the Log In button. */
export class LoginPage extends BasePage {
  // Locators are `private` (only this class uses them; steps call methods instead)
  // and `readonly` (set once in the constructor, never changed during the scenario).
  /** The 12-digit Census ID text box. */
  private readonly censusIdInputBoxLocator: Locator;
  /** The "Log In" button. */
  private readonly loginButtonLocator: Locator;

  /**
   * Creates the Page Object and its locators. Called once per scenario by CustomWorld.
   * Creating a locator does NOT search the page yet; Playwright looks for the element
   * only when an action (click, fill, wait...) uses it.
   *
   * @param page the Playwright page of the current scenario
   */
  constructor(page: Page) {
    super(page); // BasePage stores the page and creates this.actions

    // TODO: UPDATE LOCATOR FROM DOM
    this.censusIdInputBoxLocator = page.locator('UPDATE_LOCATOR');

    // TODO: UPDATE LOCATOR FROM DOM
    this.loginButtonLocator = page.locator('UPDATE_LOCATOR');
  }

  /**
   * Open the Census home (login) page from BASE_URL in .env.uat,
   * then wait until the Census ID box is visible.
   *
   * Used by step: "Given the responder is on the Census home page"
   */
  async open(): Promise<void> {
    await this.actions.navigateTo(ConfigReader.baseUrl);
    await this.verifyIsDisplayed();
  }

  /**
   * Confirms the LOGIN screen is shown by waiting for the Census ID box.
   * Fails after DEFAULT_TIMEOUT if it never appears.
   */
  async verifyIsDisplayed(): Promise<void> {
    await this.actions.waitForVisible(this.censusIdInputBoxLocator, 'Census ID input');
  }

  /**
   * Types the Census ID into the input box (replaces any existing value).
   *
   * Used by step: "When the responder enters a valid 12-digit Census ID"
   *
   * @param censusId the ID to type, normally ConfigReader.validCensusId
   * @example await loginPage.enterCensusId('123456789012'); // illustrative ID only
   */
  async enterCensusId(censusId: string): Promise<void> {
    await this.actions.fill(this.censusIdInputBoxLocator, censusId, 'Census ID input');
  }

  /**
   * Clicks the Log In button.
   *
   * Used by step: "And the responder clicks the Login button"
   */
  async clickLogin(): Promise<void> {
    await this.actions.click(this.loginButtonLocator, 'Log In button');
  }
}
