/**
 * FILE: src/utils/CustomWorld.ts
 *
 * RESPONSIBILITY
 *   The Cucumber "World": an object that holds everything ONE scenario needs
 *   (browser, browser context, page, Page Objects, language, current screen).
 *
 * HOW IT IS USED
 *   - Cucumber creates a new CustomWorld at the start of every scenario
 *     (registered by setWorldConstructor() at the bottom of this file).
 *   - Hooks.ts (Before) opens a page and calls initPages() to fill it in.
 *   - Step definitions receive it as `this`, e.g. this.confirmPage.selectYes().
 *   - Hooks.ts (After) uses this.page / this.context for screenshots, traces and cleanup.
 */

import { IWorldOptions, World, setWorldConstructor } from '@cucumber/cucumber';
// Browser = the running browser; BrowserContext = an isolated session (own cookies);
// Page = one tab inside that context.
import { Browser, BrowserContext, Page } from 'playwright';
import { Language } from '../data/JsonReader';
import { HelpScreen, hasHelp } from '../pages/BasePage';
import { ConfirmPage } from '../pages/ConfirmPage';
import { LoginPage } from '../pages/LoginPage';
import { VerifyPage } from '../pages/VerifyPage';

/**
 * Screen registry: screen name -> Page Object class.
 *
 * TO ADD A NEW SCREEN:
 *   1. Create src/pages/<Name>Page.ts that extends BasePage
 *      (implement HelpScreen too if the screen has a Help tooltip).
 *   2. Add one line to ScreenRegistry below and one line in createScreens().
 *   3. In steps, use this.getScreen('<NAME>') and set this.currentScreen = '<NAME>'
 *      in the "navigated to the ... page" step.
 */
type ScreenRegistry = {
  LOGIN: LoginPage;
  CONFIRM: ConfirmPage;
  VERIFY: VerifyPage;
};

/** Names of all registered screens, e.g. 'LOGIN' | 'CONFIRM' | 'VERIFY'. */
export type ScreenKey = keyof ScreenRegistry;

/**
 * Creates one instance of every Page Object, all sharing the same Playwright page.
 * Called by initPages() once per scenario.
 */
function createScreens(page: Page): ScreenRegistry {
  return {
    LOGIN: new LoginPage(page),
    CONFIRM: new ConfirmPage(page),
    VERIFY: new VerifyPage(page),
  };
}

/**
 * Scenario-level context. Cucumber creates a NEW CustomWorld for every scenario,
 * so nothing leaks between scenarios. Inside step definitions it is `this`.
 */
export class CustomWorld extends World {
  // The `!` tells TypeScript "this is set later" (by initPages() in the Before hook),
  // not in the constructor.
  /** The shared browser launched once in BeforeAll. */
  browser!: Browser;
  /** This scenario's own browser context (fresh cookies/session; closed in After). */
  context!: BrowserContext;
  /** This scenario's browser tab. */
  page!: Page;

  /** All Page Objects for this scenario, created once per scenario. */
  private screens!: ScreenRegistry;

  /** Language of the expected content in SpecText.json. */
  language: Language = 'EN';

  /** Screen the responder is currently on; set by the "navigated to ..." steps. */
  currentScreen?: ScreenKey;

  /** Cucumber passes `options` (attach, log, parameters); the parent World stores them. */
  constructor(options: IWorldOptions) {
    super(options);
  }

  /**
   * Called by the Before hook once the page is open.
   * Stores the browser objects and creates the Page Objects for this scenario.
   *
   * @param browser the shared browser
   * @param context this scenario's browser context
   * @param page    this scenario's page
   */
  initPages(browser: Browser, context: BrowserContext, page: Page): void {
    this.browser = browser;
    this.context = context;
    this.page = page;
    this.screens = createScreens(page);
  }

  /**
   * Page Object for any registered screen, e.g. this.getScreen('CONFIRM').
   * The generic type <K> makes the return type match the name: getScreen('CONFIRM')
   * returns a ConfirmPage, so its methods are auto-completed in VS Code.
   */
  getScreen<K extends ScreenKey>(name: K): ScreenRegistry[K] {
    return this.screens[name];
  }

  // Shortcuts used by the existing step definitions.
  /** this.loginPage = this.getScreen('LOGIN') */
  get loginPage(): LoginPage {
    return this.getScreen('LOGIN');
  }

  /** this.confirmPage = this.getScreen('CONFIRM') */
  get confirmPage(): ConfirmPage {
    return this.getScreen('CONFIRM');
  }

  /** this.verifyPage = this.getScreen('VERIFY') */
  get verifyPage(): VerifyPage {
    return this.getScreen('VERIFY');
  }

  /**
   * Page Object for the screen whose Help tooltip the shared Help steps act on.
   * Example: after "navigated to the Verify page", this returns the VerifyPage.
   *
   * @throws Error when no "navigated to ..." step has run yet, or the current screen has no Help
   */
  get currentHelpScreen(): HelpScreen {
    if (!this.currentScreen) {
      throw new Error('Current screen is unknown. A "navigated to the ... page" step must run before the Help steps.');
    }
    const screen = this.getScreen(this.currentScreen);
    if (!hasHelp(screen)) {
      throw new Error(`The ${this.currentScreen} screen has no Help tooltip (its Page Object does not implement HelpScreen).`);
    }
    return screen;
  }
}

// Tell Cucumber to use CustomWorld (instead of its default World) for every scenario.
setWorldConstructor(CustomWorld);
