/**
 * FILE: src/steps/ConfirmSteps.ts
 *
 * RESPONSIBILITY
 *   - Step definitions for the CONFIRM screen (landing content, navigated back).
 *   - The SHARED Help modal steps used by both confirm.feature and verify.feature.
 *
 *   Steps only call Page Object methods; no locators or Playwright calls here.
 *   `this` is the CustomWorld of the current scenario.
 */

import { Then, When } from '@cucumber/cucumber';
import { CustomWorld } from '../utils/CustomWorld';

// ---------- CONFIRM screen ----------

// Compares the CONFIRM landing content with screens.CONFIRM.EN in SpecText.json.
// this.language is 'EN' (set in CustomWorld).
Then('the landing page content is displayed correctly', async function (this: CustomWorld) {
  await this.confirmPage.validateLandingContent(this.language);
});

// After the Help modal is closed, checks the CONFIRM heading is visible again.
Then('the responder is navigated back to the Confirm page', async function (this: CustomWorld) {
  await this.confirmPage.verifyIsDisplayed();
});

// ---------- Help modal (shared by confirm.feature and verify.feature) ----------
// Cucumber allows each step text to be defined only once, so these steps act on
// whichever screen the responder is on (this.currentScreen: CONFIRM or VERIFY).
// this.currentHelpScreen returns ConfirmPage or VerifyPage (see CustomWorld.ts).

// -> openHelp(): click the Help link of the current screen.
When('the responder clicks the Help tooltip', async function (this: CustomWorld) {
  await this.currentHelpScreen.openHelp();
});

// -> verifyHelpIsDisplayed(): wait until the Help modal is visible.
Then('the Help modal popup is displayed', async function (this: CustomWorld) {
  await this.currentHelpScreen.verifyHelpIsDisplayed();
});

// -> validateHelpText(): compare title, body and Close button with helpModals.<SCREEN>.EN.
Then('the responder validates the Help text against the expected content', async function (this: CustomWorld) {
  await this.currentHelpScreen.validateHelpText(this.language);
});

// -> closeHelp(): click the Close button of the Help modal.
When('the responder clicks the Close button on the Help modal popup', async function (this: CustomWorld) {
  await this.currentHelpScreen.closeHelp();
});

// -> verifyHelpIsClosed(): wait until the Help modal is hidden.
Then('the Help modal popup is closed', async function (this: CustomWorld) {
  await this.currentHelpScreen.verifyHelpIsClosed();
});
