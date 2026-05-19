module.exports = {
  skipFiles: [],
  istanbulReporter: ["text", "text-summary", "html", "json-summary"],
  mocha: {
    grep: "@unit",
    timeout: 60000,
  },
  configureYulOptimizer: true,
};
