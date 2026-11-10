/**
 * FILE: src/pages/VerifyPage.ts
 *
 * RESPONSIBILITY
 *   Page Object for the VERIFY ADDRESS screen: page check and the VERIFY Help modal.
 *
 *   Note: VERIFY landing-page content (screens.VERIFY in SpecText.json) is NOT validated
 *   by the current scenarios; this class has no validateLandingContent() method.
 *
 * WHO USES IT
 *   VerifySteps.ts through CustomWorld (this.verifyPage), and the shared Help steps in
 *   ConfirmSteps.ts through CustomWorld.currentHelpScreen (when currentScreen is 'VERIFY').
 *
 * LOCATORS TO UPDATE
 *   All six locators below are still 'UPDATE_LOCATOR'.
 */

import { Locator, Page } from 'playwright';
import { JsonReader, Language } from '../data/JsonReader';
import { ContentValidator } from '../utils/ContentValidator';
import { BasePage, HelpScreen } from './BasePage';

/** VERIFY ADDRESS screen: page check plus the VERIFY Help link and Help modal. */
export class VerifyPage extends BasePage implements HelpScreen {
  // Private + readonly: only this class uses them, and they are set once.
  /** Page heading ("VERIFY ADDRESS"); used to confirm the screen is shown. */
  private readonly pageHeadingLocator: Locator;
  /** "Help" link next to the question. */
  private readonly helpLinkLocator: Locator;
  /** The whole Help modal (used to wait until it is shown / hidden). */
  private readonly helpModalLocator: Locator;
  /** Title of the Help modal ("Help"). */
  private readonly helpModalTitleLocator: Locator;
  /** Help paragraphs only (no title, no Close button). */
  private readonly helpModalBodyLocator: Locator;
  /** "Close" button of the Help modal. */
  private readonly helpModalCloseButtonLocator: Locator;

  /**
   * Creates the Page Object and its locators. Called once per scenario by CustomWorld.
   *
   * @param page the Playwright page of the current scenario
   */
  constructor(page: Page) {
    super(page); // BasePage stores the page and creates this.actions

    // TODO: UPDATE LOCATOR FROM DOM
    this.pageHeadingLocator = page.locator('UPDATE_LOCATOR');

    // TODO: UPDATE LOCATOR FROM DOM
    this.helpLinkLocator = page.locator('UPDATE_LOCATOR');

    // TODO: UPDATE LOCATOR FROM DOM
    this.helpModalLocator = page.locator('UPDATE_LOCATOR');

    // TODO: UPDATE LOCATOR FROM DOM
    this.helpModalTitleLocator = page.locator('UPDATE_LOCATOR');

    // Element that holds only the Help paragraphs (not the title or Close button)
    // TODO: UPDATE LOCATOR FROM DOM
    this.helpModalBodyLocator = page.locator('UPDATE_LOCATOR');

    // TODO: UPDATE LOCATOR FROM DOM
    this.helpModalCloseButtonLocator = page.locator('UPDATE_LOCATOR');
  }

  /**
   * Confirms the VERIFY ADDRESS screen is shown by waiting for its heading.
   *
   * Used by steps: "Then the responder is navigated to the Verify page"
   *                "And the responder is navigated back to the Verify page"
   */
  async verifyIsDisplayed(): Promise<void> {
    await this.actions.waitForVisible(this.pageHeadingLocator, 'VERIFY ADDRESS page heading');
  }

  // ---------- Help modal ----------
  // HelpScreen contract, called by the shared Help steps when currentScreen is 'VERIFY'.

  /** Clicks the VERIFY "Help" link. Step: "When the responder clicks the Help tooltip". */
  async openHelp(): Promise<void> {
    await this.actions.click(this.helpLinkLocator, 'VERIFY Help tooltip');
  }

  /** Waits until the Help modal is visible. Step: "Then the Help modal popup is displayed". */
  async verifyHelpIsDisplayed(): Promise<void> {
    await this.actions.waitForVisible(this.helpModalLocator, 'VERIFY Help modal');
  }

  /**
   * Compares the Help modal title, body and Close button with helpModals.VERIFY.<language>.
   * The expected text contains {CENSUS_DAY}, which is replaced with CENSUS_DAY from .env.uat.
   *
   * Used by step: "And the responder validates the Help text against the expected content"
   *
   * @param language 'EN' or 'ES'
   * @throws Error listing the differences when the content does not match
   */
  async validateHelpText(language: Language): Promise<void> {
    await ContentValidator.validateHelp(
      {
        title: this.helpModalTitleLocator,
        body: this.helpModalBodyLocator,
        closeButton: this.helpModalCloseButtonLocator,
      },
      JsonReader.getHelp('VERIFY', language),
      `VERIFY Help modal (${language})`,
    );
  }

  /** Clicks the Help modal Close button. Step: "When the responder clicks the Close button on the Help modal popup". */
  async closeHelp(): Promise<void> {
    await this.actions.click(this.helpModalCloseButtonLocator, 'VERIFY Help modal Close button');
  }

  /** Waits until the Help modal is hidden. Step: "Then the Help modal popup is closed". */
  async verifyHelpIsClosed(): Promise<void> {
    await this.actions.waitForHidden(this.helpModalLocator, 'VERIFY Help modal');
  }
}
