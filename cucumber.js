// Cucumber configuration.
// Every test run writes BOTH reports automatically:
//   reports/cucumber-report.html  (open in a browser)
//   reports/cucumber-report.json  (machine readable)

// Settings shared by both profiles below.
const common = {
  // Where the Gherkin feature files are.
  paths: ['resources/features/**/*.feature'],
  // ts-node lets Cucumber load the TypeScript files directly (no separate build step).
  requireModule: ['ts-node/register'],
  // Loads every step definition, hook, Page Object and the CustomWorld.
  require: ['src/**/*.ts'],
};

// "default" is used by test:login / test:confirm / test:verify / test:regression
// (the npm scripts add --tags to choose which scenarios run).

module.exports = {
  default: {
    ...common,
    format: [
      'progress',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber-report.json',
    ],
    formatOptions: { snippetInterface: 'async-await' },
  },

  // Dry run: checks that every step in the feature files has a matching
  // step definition, WITHOUT opening a browser or touching the UAT site.
  // Does not overwrite the HTML/JSON reports.
  dryRun: {
    ...common,
    dryRun: true,
    strict: true,
    format: ['progress', 'usage'],
  },
};
