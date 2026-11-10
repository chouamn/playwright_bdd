# Purpose: checks that a responder can log in with a valid Census ID and reach CONFIRM.
# This feature does NOT compare any screen text with SpecText.json.
# Run only this feature: npm run test:login
# Step definitions: src/steps/LoginSteps.ts
@login @regression
Feature: ISR Login Screen Content Validation

  Scenario: ISR Login with a valid Census ID
    # Opens BASE_URL from resources/environment/.env.uat
    Given the responder is on the Census home page
    # Types VALID_CENSUS_ID from .env.uat (the ID is never written in this file)
    When the responder enters a valid 12-digit Census ID
    And the responder clicks the Login button
    # Passes when the CONFIRM page heading is visible
    Then the responder is navigated to the Confirm page
