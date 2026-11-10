/**
 * FILE: src/steps/VerifySteps.ts
 *
 * RESPONSIBILITY
 *   Step definitions that move from CONFIRM to VERIFY and check the VERIFY screen is shown.
 *   The VERIFY Help steps are the shared Help steps in ConfirmSteps.ts.
 *
 *   Note: these steps check that the VERIFY page is displayed; they do NOT compare the
 *   VERIFY landing-page text with SpecText.json.
 *   `this` is the CustomWorld of the current scenario.
 */

import { Then, When } from '@cucumber/cucumber';
import { CustomWorld } from '../utils/CustomWorld';

// The Yes option and Next button are on the CONFIRM screen,
// so these steps use the ConfirmPage object.

// -> ConfirmPage.selectYes()
When('the responder selects Yes', async function (this: CustomWorld) {
  await this.confirmPage.selectYes();
});

// -> ConfirmPage.clickNext()
When('the responder clicks the Next button', async function (this: CustomWorld) {
  await this.confirmPage.clickNext();
});

// ---------- VERIFY screen ----------

// Waits for the VERIFY heading, then records VERIFY as the current screen so the
// shared Help steps act on the VERIFY Help modal from now on.
Then('the responder is navigated to the Verify page', async function (this: CustomWorld) {
  await this.verifyPage.verifyIsDisplayed();
  this.currentScreen = 'VERIFY';
});

// After the Help modal is closed, checks the VERIFY heading is visible again.
Then('the responder is navigated back to the Verify page', async function (this: CustomWorld) {
  await this.verifyPage.verifyIsDisplayed();
});
