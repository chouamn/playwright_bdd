# Purpose: moves from CONFIRM to VERIFY ADDRESS and validates the VERIFY Help pop-up
# against resources/testdata/SpecText.json (helpModals.VERIFY.EN).
# The VERIFY landing-page text (screens.VERIFY) is NOT compared by this scenario.
# Needs CENSUS_DAY in .env.uat: the expected Help text contains {CENSUS_DAY}.
# Run only this feature: npm run test:verify
# Step definitions: src/steps/LoginSteps.ts, VerifySteps.ts and ConfirmSteps.ts (shared Help steps)
@verify @regression
Feature: ISR Verify Screen Content Validation

  Scenario: ISR Verify Screen Help Text Validation
    # Log in (same steps as login.feature)
    Given the responder is on the Census home page
    When the responder enters a valid 12-digit Census ID
    And the responder clicks the Login button
    Then the responder is navigated to the Confirm page

    # Yes and Next are on the CONFIRM screen
    When the responder selects Yes
    And the responder clicks the Next button
    # Checks the VERIFY heading is visible and records VERIFY as the current screen
    Then the responder is navigated to the Verify page

    # Same Help steps as confirm.feature, now acting on the VERIFY Help modal
    When the responder clicks the Help tooltip
    Then the Help modal popup is displayed
    # Compares title, body and Close button with helpModals.VERIFY.EN
    And the responder validates the Help text against the expected content

    When the responder clicks the Close button on the Help modal popup
    Then the Help modal popup is closed
    And the responder is navigated back to the Verify page
