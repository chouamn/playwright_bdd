/**
 * FILE: src/pages/BasePage.ts
 *
 * RESPONSIBILITY
 *   - BasePage: the parent class of every Page Object (LoginPage, ConfirmPage, VerifyPage).
 *     It stores the Playwright page and gives every child `this.actions` (BaseAction).
 *   - HelpScreen: the list of methods a screen with a Help tooltip must provide.
 *   - hasHelp(): checks at run time whether a Page Object provides those methods.
 *
 * WHO USES IT
 *   - Every Page Object extends BasePage.
 *   - CustomWorld.currentHelpScreen uses hasHelp() so the shared Help steps in
 *     ConfirmSteps.ts work on both CONFIRM and VERIFY.
 */

// `Page` = one browser tab controlled by Playwright.
import { Page } from 'playwright';
import { Language } from '../data/JsonReader';
// BaseAction holds the reusable click / fill / wait methods.
import { BaseAction } from '../utils/BaseAction';

/**
 * Methods every screen with a Help tooltip provides.
 * The shared Help steps use this, so they work on CONFIRM, VERIFY and any future screen
 * that implements it.
 *
 * Implemented by: ConfirmPage, VerifyPage
 */
export interface HelpScreen {
  /** Wait until this screen is shown. */
  verifyIsDisplayed(): Promise<void>;
  /** Click the "Help" link/tooltip. */
  openHelp(): Promise<void>;
  /** Wait until the Help modal is visible. */
  verifyHelpIsDisplayed(): Promise<void>;
  /** Compare the Help modal title, body and Close button with SpecText.json. */
  validateHelpText(language: Language): Promise<void>;
  /** Click the Close button of the Help modal. */
  closeHelp(): Promise<void>;
  /** Wait until the Help modal is hidden. */
  verifyHelpIsClosed(): Promise<void>;
}

/** The methods a page object must have to count as a HelpScreen. */
const HELP_SCREEN_METHODS: (keyof HelpScreen)[] = [
  'verifyIsDisplayed',
  'openHelp',
  'verifyHelpIsDisplayed',
  'validateHelpText',
  'closeHelp',
  'verifyHelpIsClosed',
];

/**
 * True when a page object has ALL the Help methods above.
 *
 * TypeScript interfaces do not exist at run time, so the check looks for each method
 * by name. The `screen is BasePage & HelpScreen` return type tells TypeScript that,
 * after a `true` result, the Help methods can be called safely.
 *
 * Used by: CustomWorld.currentHelpScreen
 *
 * @param screen any Page Object
 * @returns true for ConfirmPage and VerifyPage, false for LoginPage
 */
export function hasHelp(screen: BasePage): screen is BasePage & HelpScreen {
  const candidate = screen as Partial<HelpScreen>;
  return HELP_SCREEN_METHODS.every((method) => typeof candidate[method] === 'function');
}

/**
 * Parent of every Page Object.
 *
 *   this.page    - the Playwright page of the current scenario
 *   this.actions - reusable UI operations (click, fill, waitForVisible, ...) from BaseAction
 *
 * Example Page Object:
 *   export class ExamplePage extends BasePage {
 *     private readonly nextButtonLocator: Locator;
 *
 *     constructor(page: Page) {
 *       super(page); // stores the page and creates this.actions
 *
 *       // TODO: UPDATE LOCATOR FROM DOM
 *       this.nextButtonLocator = page.locator('UPDATE_LOCATOR');
 *     }
 *
 *     async clickNext(): Promise<void> {
 *       await this.actions.click(this.nextButtonLocator, 'Next button');
 *     }
 *   }
 *
 * To finish a locator: inspect the element in the Census app DOM, find a stable
 * selector, and replace the placeholder locator expression with a real Playwright
 * locator, e.g. page.locator('#nextBtn') or page.getByRole('button', { name: 'Next' }).
 * (Illustrative selectors only - not real Census selectors.)
 *
 * `abstract` means BasePage itself cannot be created with `new`; only its children can.
 */
export abstract class BasePage {
  /**
   * Reusable Playwright actions for this Page Object.
   * `protected` = usable inside BasePage and its children, not from step definitions.
   * `readonly`  = set once in the constructor and never replaced.
   */
  protected readonly actions: BaseAction;

  /**
   * @param page the Playwright page of the current scenario (created in Hooks.ts, Before hook).
   *             Writing `protected readonly page` here also stores it as `this.page`.
   */
  constructor(protected readonly page: Page) {
    // this.constructor.name is the child class name (e.g. "ConfirmPage"); BaseAction
    // puts it in error messages so a failure says which Page Object had the problem.
    this.actions = new BaseAction(page, this.constructor.name);
  }

  /**
   * Every screen must be able to confirm that it is the screen currently shown.
   * Each Page Object implements it, usually by waiting for its page heading.
   */
  abstract verifyIsDisplayed(): Promise<void>;
}
