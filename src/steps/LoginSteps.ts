/**
 * FILE: src/steps/LoginSteps.ts
 *
 * RESPONSIBILITY
 *   Step definitions for logging in. Each Given/When/Then below is matched to a Gherkin
 *   line in the feature files by its EXACT text.
 *
 *   Step definitions are kept thin: they only call Page Object methods. All browser
 *   work happens in the Page Objects (LoginPage, ConfirmPage).
 *
 * HOW `this` WORKS HERE
 *   Cucumber runs each step with `this` = the CustomWorld of the current scenario, so
 *   `this.loginPage` is that scenario's LoginPage. A normal `function` (not an arrow
 *   function) is required for Cucumber to set `this`.
 */

import { Given, Then, When } from '@cucumber/cucumber';
import { ConfigReader } from '../config/ConfigReader';
import { CustomWorld } from '../utils/CustomWorld';

// Steps shared by login.feature, confirm.feature and verify.feature.

// Opens BASE_URL and waits for the Census ID box. -> LoginPage.open()
Given('the responder is on the Census home page', async function (this: CustomWorld) {
  await this.loginPage.open();
});

// Types VALID_CENSUS_ID from .env.uat. The ID is never written in the feature file.
When('the responder enters a valid 12-digit Census ID', async function (this: CustomWorld) {
  await this.loginPage.enterCensusId(ConfigReader.validCensusId);
});

// -> LoginPage.clickLogin()
When('the responder clicks the Login button', async function (this: CustomWorld) {
  await this.loginPage.clickLogin();
});

// Waits for the CONFIRM heading, then records CONFIRM as the current screen so the
// shared Help steps (ConfirmSteps.ts) know which Help modal to use.
Then('the responder is navigated to the Confirm page', async function (this: CustomWorld) {
  await this.confirmPage.verifyIsDisplayed();
  this.currentScreen = 'CONFIRM';
});
