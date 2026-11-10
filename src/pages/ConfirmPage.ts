/**
 * FILE: src/pages/ConfirmPage.ts
 *
 * RESPONSIBILITY
 *   Page Object for the CONFIRM screen: page check, landing-content validation,
 *   Yes / No options, Next button, and the CONFIRM Help modal.
 *
 * WHO USES IT
 *   LoginSteps.ts, ConfirmSteps.ts and VerifySteps.ts, through CustomWorld (this.confirmPage),
 *   and the shared Help steps through CustomWorld.currentHelpScreen.
 *
 * LOCATORS TO UPDATE
 *   All ten locators below are still 'UPDATE_LOCATOR'.
 */

import { Locator, Page } from 'playwright';
// JsonReader gives the expected content; ContentValidator compares it with the page.
import { JsonReader, Language } from '../data/JsonReader';
import { ContentValidator } from '../utils/ContentValidator';
import { BasePage, HelpScreen } from './BasePage';

/**
 * CONFIRM screen: "Are you completing the ... questionnaire for the address below?"
 * Holds the Yes / No options and the Next button (they are on this screen),
 * plus the CONFIRM Help link and Help modal.
 *
 * `implements HelpScreen` = TypeScript checks that this class has all Help methods.
 */
export class ConfirmPage extends BasePage implements HelpScreen {
  // All locators are private + readonly: step definitions never touch them directly.
  /** Page heading ("CONFIRM"); used to confirm the screen is shown. */
  private readonly pageHeadingLocator: Locator;
  /** Container of the landing content compared with screens.CONFIRM (no header/footer). */
  private readonly contentContainerLocator: Locator;
  /** "Yes" radio button (the <input> or its <label>). */
  private readonly yesRadioButtonLocator: Locator;
  /** "No" radio button (the <input> or its <label>). */
  private readonly noRadioButtonLocator: Locator;
  /** "Next" button. */
  private readonly nextButtonLocator: Locator;
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

    // Container that holds the landing-page content listed in SpecText.json (screens.CONFIRM)
    // TODO: UPDATE LOCATOR FROM DOM
    this.contentContainerLocator = page.locator('UPDATE_LOCATOR');

    // TODO: UPDATE LOCATOR FROM DOM
    this.yesRadioButtonLocator = page.locator('UPDATE_LOCATOR');

    // TODO: UPDATE LOCATOR FROM DOM
    this.noRadioButtonLocator = page.locator('UPDATE_LOCATOR');

    // TODO: UPDATE LOCATOR FROM DOM
    this.nextButtonLocator = page.locator('UPDATE_LOCATOR');

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
   * Confirms the CONFIRM screen is shown by waiting for its heading.
   *
   * Used by steps: "Then the responder is navigated to the Confirm page"
   *                "And the responder is navigated back to the Confirm page"
   */
  async verifyIsDisplayed(): Promise<void> {
    await this.actions.waitForVisible(this.pageHeadingLocator, 'CONFIRM page heading');
  }

  /**
   * Compares the CONFIRM landing content with screens.CONFIRM.<language> in SpecText.json.
   * Steps: wait for the container -> read expected JSON -> extract + compare.
   *
   * Used by step: "And the landing page content is displayed correctly"
   *
   * @param language 'EN' or 'ES' (the scenarios pass CustomWorld.language, which is 'EN')
   * @throws Error listing the differences when the content does not match
   */
  async validateLandingContent(language: Language): Promise<void> {
    await this.actions.waitForVisible(this.contentContainerLocator, 'CONFIRM content container');
    await ContentValidator.validateScreen(
      this.contentContainerLocator,
      JsonReader.getScreen('CONFIRM', language),
      `CONFIRM landing page (${language})`, // label shown at the start of the error message
    );
  }

  /**
   * Selects the "Yes" option.
   *
   * Used by step: "When the responder selects Yes" (verify.feature)
   */
  async selectYes(): Promise<void> {
    await this.actions.selectRadio(this.yesRadioButtonLocator, 'Yes option');
  }

  /** Not used by the current feature files; kept so the No option is ready to use. */
  async selectNo(): Promise<void> {
    await this.actions.selectRadio(this.noRadioButtonLocator, 'No option');
  }

  /**
   * Clicks the Next button (moves to the VERIFY screen after "Yes").
   *
   * Used by step: "And the responder clicks the Next button"
   */
  async clickNext(): Promise<void> {
    await this.actions.click(this.nextButtonLocator, 'Next button');
  }

  // ---------- Help modal ----------
  // These six methods are the HelpScreen contract. The shared Help steps call them
  // through CustomWorld.currentHelpScreen when currentScreen is 'CONFIRM'.

  /** Clicks the CONFIRM "Help" link. Step: "When the responder clicks the Help tooltip". */
  async openHelp(): Promise<void> {
    await this.actions.click(this.helpLinkLocator, 'CONFIRM Help tooltip');
  }

  /** Waits until the Help modal is visible. Step: "Then the Help modal popup is displayed". */
  async verifyHelpIsDisplayed(): Promise<void> {
    await this.actions.waitForVisible(this.helpModalLocator, 'CONFIRM Help modal');
  }

  /**
   * Compares the Help modal title, body and Close button with helpModals.CONFIRM.<language>.
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
      JsonReader.getHelp('CONFIRM', language),
      `CONFIRM Help modal (${language})`,
    );
  }

  /** Clicks the Help modal Close button. Step: "When the responder clicks the Close button on the Help modal popup". */
  async closeHelp(): Promise<void> {
    await this.actions.click(this.helpModalCloseButtonLocator, 'CONFIRM Help modal Close button');
  }

  /** Waits until the Help modal is hidden. Step: "Then the Help modal popup is closed". */
  async verifyHelpIsClosed(): Promise<void> {
    await this.actions.waitForHidden(this.helpModalLocator, 'CONFIRM Help modal');
  }
}
