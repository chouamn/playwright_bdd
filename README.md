# Census ISR JSON Automation Framework (POC)

A lightweight UI test framework for the Census ISR questionnaire.
It checks that the text on the screens and in the Help pop-ups matches the expected text stored in a **JSON** file. The older framework uses Excel for this.

**Built with:** Playwright · TypeScript · Cucumber (BDD) · Page Object Model · JSON test data · dotenv

---

## 1. What it tests

| Feature file | Tags | What it covers |
|---|---|---|
| `login.feature` | `@login @regression` | Log in with a valid Census ID → CONFIRM page opens |
| `confirm.feature` | `@confirm @regression` | CONFIRM page content, then the CONFIRM Help pop-up text, then closing it |
| `verify.feature` | `@verify @regression` | Select Yes → Next → VERIFY page, then the VERIFY Help pop-up text, then closing it |

**What content is validated today:**

| Content in `SpecText.json` | Validated by a scenario? |
|---|---|
| CONFIRM page content (`screens.CONFIRM`) | Yes — `confirm.feature` |
| CONFIRM Help pop-up (`helpModals.CONFIRM`) | Yes — `confirm.feature` |
| VERIFY Help pop-up (`helpModals.VERIFY`) | Yes — `verify.feature` |
| LOGIN page content (`screens.LOGIN`) | No — stored for reference only |
| VERIFY page content (`screens.VERIFY`) | No — stored for reference only |

`login.feature` only checks that login works and the CONFIRM page opens. `verify.feature` checks that the VERIFY page opens, but it does not compare the VERIFY page text. Only English (`EN`) content is used by the current scenarios.

For each screen or pop-up that is validated, the framework checks:

- the exact text
- the order of paragraphs, headings, options and buttons
- line breaks (`<br>`) and text that sits on the same line
- which text is **bold** and which is not
- optionally: underline, italic, HTML tag, and CSS values such as font size or color

---

## 2. Folder structure

```
census-isr-json-automation/
├── resources/
│   ├── environment/.env.uat      ← URL, Census IDs, browser settings, Census Day
│   ├── features/                 ← the 3 Cucumber feature files
│   └── testdata/SpecText.json    ← expected screen + Help text (EN / ES)
├── src/
│   ├── config/ConfigReader.ts    ← loads .env.uat
│   ├── data/JsonReader.ts        ← reads SpecText.json
│   ├── pages/                    ← Page Objects (BasePage, LoginPage, ConfirmPage, VerifyPage)
│   ├── steps/                    ← Cucumber step definitions (thin; they call page objects)
│   └── utils/
│       ├── BaseAction.ts         ← reusable Playwright action methods
│       ├── CustomWorld.ts        ← per-scenario context (browser, page, page objects)
│       ├── Hooks.ts              ← browser start/stop, failure screenshots + traces
│       ├── HtmlStructure.ts      ← reads text + formatting from the page
│       └── ContentValidator.ts   ← compares page content with SpecText.json
├── reports/                      ← generated: HTML/JSON reports, screenshots, traces
├── cucumber.js                   ← Cucumber settings (features, reports, dry run)
├── package.json                  ← npm scripts
└── tsconfig.json
```

How a step runs: **feature file → step definition → page object → BasePage / ContentValidator → browser**

---

## 3. Installation

You need **Node.js 18 or newer** (check with `node -v`).

```bash
cd census-isr-json-automation
npm install
npm run install:browsers     # downloads the Chromium browser for Playwright
```

---

## 4. Environment configuration

All environment settings are in `resources/environment/.env.uat`:

| Variable | Meaning |
|---|---|
| `BASE_URL` | UAT login page URL |
| `BROWSER` | `chromium`, `firefox` or `webkit` |
| `HEADLESS` | `false` shows the browser window; `true` runs it hidden |
| `DEFAULT_TIMEOUT` | How long Playwright waits for an element, in milliseconds |
| `VALID_CENSUS_ID` | A 12-digit test Census ID that can log in |
| `INVALID_CENSUS_ID` | An invalid ID. No current scenario uses it. |
| `CENSUS_DAY` | Census Day exactly as the application displays it, for example `April 1, 2027`. Replaces `{CENSUS_DAY}` in `SpecText.json`. It is currently required because the placeholder exists in the JSON file. |

Values that start with `your-` are placeholders. If `BASE_URL`, `VALID_CENSUS_ID` or `CENSUS_DAY` is still a placeholder, the test run **stops right away with a clear message**. This check runs before every test run (any feature), not only the VERIFY scenario. `CENSUS_DAY` is checked because `SpecText.json` currently contains `{CENSUS_DAY}`; if that placeholder were removed from the JSON, `CENSUS_DAY` would no longer be required.

You can also set a value for one run without editing the file. Values set in the terminal take priority over the file:

```bash
# Git Bash
BASE_URL=https://example-uat npm run test:login
# PowerShell
$env:BASE_URL="https://example-uat"; npm run test:login
```

## 5. Updating the Census IDs and UAT URL

1. Open `resources/environment/.env.uat`.
2. Replace `BASE_URL`, `VALID_CENSUS_ID` and `CENSUS_DAY` with real UAT values.
3. Save. You don't need to change any code.

> Treat real Census IDs as test data. Do not paste them into feature files or page objects.

---

## 6. Updating the DOM locator placeholders

Each Page Object declares its locators at the top of the class and sets them in the constructor. They all start as placeholders, because the real DOM has not been checked yet:

```ts
export class LoginPage extends BasePage {
  private readonly censusIdInputBoxLocator: Locator;
  private readonly loginButtonLocator: Locator;

  constructor(page: Page) {
    super(page);

    // TODO: UPDATE LOCATOR FROM DOM
    this.censusIdInputBoxLocator = page.locator('UPDATE_LOCATOR');

    // TODO: UPDATE LOCATOR FROM DOM
    this.loginButtonLocator = page.locator('UPDATE_LOCATOR');
  }
}
```

To update one, you only change the locator line inside the constructor:

1. Open the app in Chrome, right-click the element and choose **Inspect**.
2. Pick a stable selector. Use `id`, `data-*`, `name` or an accessible role/label. Avoid long auto-generated CSS paths.
3. Replace the placeholder locator expression with the appropriate Playwright locator. You can use CSS selectors, roles, labels, or other supported Playwright locator methods. Keep the existing property declarations and Page Object methods unchanged. Examples (**illustrative only — these are not real Census selectors**):
   ```ts
   // Before
   this.censusIdInputBoxLocator = page.locator('UPDATE_LOCATOR');

   // After (example: CSS selector)
   this.censusIdInputBoxLocator = page.locator('#censusId');

   // After (example: role-based locator - the whole expression is replaced)
   this.loginButtonLocator = page.getByRole('button', { name: 'Log In' });
   ```
4. Delete the `TODO` comment once the locator works.

You don't need to change the declarations at the top of the class or any methods.

To list every placeholder still left, run:

```bash
grep -rn "UPDATE_LOCATOR" src/pages
```

If a locator still contains `UPDATE_LOCATOR`, Playwright will wait until the configured timeout (`DEFAULT_TIMEOUT`) and then report a locator timeout. Replace all placeholders with the correct DOM selectors before running UAT tests.

| Page object | Locators to update |
|---|---|
| `LoginPage.ts` | `censusIdInputBoxLocator`, `loginButtonLocator` |
| `ConfirmPage.ts` | `pageHeadingLocator`, `contentContainerLocator`, `yesRadioButtonLocator`, `noRadioButtonLocator`, `nextButtonLocator`, `helpLinkLocator`, `helpModalLocator`, `helpModalTitleLocator`, `helpModalBodyLocator`, `helpModalCloseButtonLocator` |
| `VerifyPage.ts` | `pageHeadingLocator`, `helpLinkLocator`, `helpModalLocator`, `helpModalTitleLocator`, `helpModalBodyLocator`, `helpModalCloseButtonLocator` |

Tips:

- `contentContainerLocator` must contain **only** the CONFIRM content listed in `SpecText.json` (heading → question → options → Next). It must not include the site header or footer.
- `helpModalBodyLocator` must contain **only** the Help paragraphs, without the "Help" title and the Close button. Those two are checked separately through `helpModalTitleLocator` and `helpModalCloseButtonLocator`.
- `yesRadioButtonLocator` / `noRadioButtonLocator` should point to the radio `<input>` (or its `<label>`).
- `helpLinkLocator` is the "Help" link next to the question.

---

## 7. Updating expected content in `SpecText.json`

The file is organized as **screen → language → content**:

```json
"screens":    { "CONFIRM": { "EN": { "content": [ ...blocks... ] }, "ES": { ... } } },
"helpModals": { "VERIFY":  { "EN": { "title": "Help", "closeButton": "Close", "content": [ ... ] } } }
```

`content` is the list of text blocks **in top-to-bottom order**. A block is one paragraph, heading, option or button.

| Field | Use |
|---|---|
| `type` | A label shown in error messages, for example `"paragraph"` or `"button"` |
| `text` | The block's text, when it is a single line |
| `lines` | Use instead of `text` when the block has line breaks (`<br>`). Add one entry per line. Use `""` for an intentional blank line (for example `<br><br>`). |
| `bold: true` | The whole block is bold |
| `boldText` | Only these parts are bold. Any text not listed **must not** be bold. |
| `underlineText` / `italicText` | Optional. Same idea as `boldText`, and only checked when present. |
| `tag` | Optional HTML tag check, for example `"h1"` |
| `style` | Optional CSS check, for example `{ "fontSize": "24px", "color": "#1f4e79", "fontWeight": "bold" }`. Supported keys: fontSize, fontWeight, fontStyle, fontFamily, color, backgroundColor, textAlign, textDecorationLine, lineHeight. `color`, `backgroundColor` and `fontWeight` accept any normal CSS notation (`#fff`, `white`, `rgb(255, 255, 255)`, `bold` = `700`). Write the other properties as the browser reports them (for example `24px`, not `1.5rem`). |

Example: a bold question with a normal "Help" link on the same line:

```json
{
  "type": "question",
  "text": "Are you completing the 2027 Census Test questionnaire for the address below? Help",
  "boldText": ["Are you completing the 2027 Census Test questionnaire for the address below?"]
}
```

Rules:

- Text is compared **exactly as the responder sees it**, including punctuation, quote style (`"` vs `“ ”`) and spaces.
  - Repeated spaces and line wraps in the HTML source are ignored **only where the browser also hides them** (normal CSS `white-space`).
  - Visible extra spaces count, for example two `&nbsp;` or `white-space: pre`/`pre-wrap`. Write them in the JSON as the same number of spaces. A non-breaking space is written as a normal space.
  - The framework includes handling for line breaks under `pre`, `pre-wrap`, and `pre-line`. Browser behavior for these cases should be confirmed during UAT.
  - Include leading and trailing spaces when they are visibly rendered by the browser (for example with `white-space: pre`, `pre-wrap` or `break-spaces`). For normal whitespace handling, spaces that the browser collapses or hides should not be added to the expected JSON.
- `{CENSUS_DAY}` is replaced with `CENSUS_DAY` from `.env.uat`.
- Keys that start with `_` (`_todo`, `_source`, `_readme`) are notes for people. The framework ignores them.
- A section with an empty `content` list (for example the Spanish entries) stops the test with a "No expected content" message.
- Not every section in the file is tested yet. `screens.LOGIN` and `screens.VERIFY` are stored for reference only (see Section 1).

### JSON validation rules

Before comparing, the framework checks that the JSON section it is about to use is well formed. If something is wrong, the test stops with a clear validation error that lists **every** problem in that section (with the block number), so you can fix them all at once.

- Every content block must contain either `text` or `lines`, but not both.
- `text` must be a non-empty string.
- `lines` must be a list of strings with at least one non-empty line. Empty strings (`""`) are allowed for intentional blank lines.
- `type` and `tag` must be strings when present.
- `bold` must be `true` or `false` (without quotes) when present.
- `boldText`, `underlineText` and `italicText` must be lists of strings when present.
- `style` must be an object with string values when present, for example `{ "fontWeight": "700" }` (with quotes).
- Help `title` and `closeButton` must be strings.
- English Help titles and Close labels must contain text.
- Spanish Help titles and Close labels may currently be empty, because the Spanish content is not finished yet.
- Fields beginning with `_`, such as `_readme`, `_source` and `_todo`, are documentation notes and are ignored by the framework.

Only the section used by the running scenario is checked (for example, `helpModals.VERIFY.EN` when the VERIFY Help step runs). Other unknown fields are currently ignored, not rejected, so check the spelling of field names carefully.

`JsonReader` validates the requested screen or Help section when it is loaded. `ConfigReader` separately checks the JSON file for required environment placeholders, such as `{CENSUS_DAY}`.

**When content does not match**, the error reports the differences detected by the validator. If a block's text or line count does not match, bold, italic, and underline comparisons for that block may be skipped. Tag and CSS checks still run. The report also prints the content actually found on the page, with bold text shown as `**bold**`. You can use that output to fix the JSON or report a defect.

---

## 8. Running the tests

| Command | What it does |
|---|---|
| `npm run test:login` | Runs `login.feature` only (`@login`) |
| `npm run test:confirm` | Runs `confirm.feature` only (`@confirm`) |
| `npm run test:verify` | Runs `verify.feature` only (`@verify`) |
| `npm run test:regression` | Runs all three features (`@regression`) |
| `npm run test:dry-run` | Checks that every feature step has a step definition. It does not open a browser, so it works before the locators and URL are set. |
| `npm run typecheck` | TypeScript compile check |
| `npm run clean:reports` | Deletes old reports, screenshots and traces |

## 9. Running the regression suite

```bash
npm run test:regression
```

---

## 10. Reports, screenshots and traces

**Every** `test:*` run (except the dry run) writes the reports automatically. There is no separate report step.

| Output | Location |
|---|---|
| HTML report (open in a browser) | `reports/cucumber-report.html` |
| JSON report | `reports/cucumber-report.json` |
| Failure screenshots | `reports/screenshots/<scenario-name>_<time>.png` |
| Failure traces | `reports/traces/<scenario-name>_<time>.zip` |

When a scenario fails:

- a full-page screenshot is saved and also embedded in the HTML report
- the Playwright trace is saved. To replay the run step by step (DOM snapshots, network, console), open it with:
  ```bash
  npx playwright show-trace "reports/traces/<file>.zip"
  ```
- traces of passing scenarios are not kept, so the folder only holds failures

The reports are overwritten on each run. Screenshots and traces have timestamps, so they pile up until you run `npm run clean:reports`.
