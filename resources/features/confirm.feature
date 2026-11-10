# Purpose: validates the CONFIRM landing-page content and the CONFIRM Help pop-up
# against resources/testdata/SpecText.json (screens.CONFIRM.EN and helpModals.CONFIRM.EN).
# Run only this feature: npm run test:confirm
# Step definitions: src/steps/LoginSteps.ts and src/steps/ConfirmSteps.ts
@confirm @regression
Feature: ISR Confirm Screen Content Validation

  Scenario: ISR Confirm Screen Help Text Validation
    # Log in (same steps as login.feature)
    Given the responder is on the Census home page
    When the responder enters a valid 12-digit Census ID
    And the responder clicks the Login button
    # Also records CONFIRM as the current screen for the Help steps below
    Then the responder is navigated to the Confirm page
    # Compares the CONFIRM content container with screens.CONFIRM.EN
    And the landing page content is displayed correctly

    # Help steps are shared with verify.feature; here they act on the CONFIRM Help modal
    When the responder clicks the Help tooltip
    Then the Help modal popup is displayed
    # Compares title, body and Close button with helpModals.CONFIRM.EN
    And the responder validates the Help text against the expected content

    When the responder clicks the Close button on the Help modal popup
    Then the Help modal popup is closed
    And the responder is navigated back to the Confirm page
