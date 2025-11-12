#!/usr/bin/env node

/**
 * Parse Jest coverage report and output metrics for GitHub Actions
 * Usage: node scripts/parse-coverage.js
 *
 * Outputs environment variables:
 * - COVERAGE_STATEMENTS: Statement coverage percentage
 * - COVERAGE_FUNCTIONS: Function coverage percentage
 * - COVERAGE_BRANCHES: Branch coverage percentage
 */

const fs = require('fs');
const path = require('path');

const coverageFile = path.join(__dirname, '../coverage/coverage-final.json');

if (!fs.existsSync(coverageFile)) {
  console.error(`Coverage file not found: ${coverageFile}`);
  process.exit(1);
}

const json = require(coverageFile);

let stats = {
  statements: { total: 0, covered: 0 },
  functions: { total: 0, covered: 0 },
  branches: { total: 0, covered: 0 },
};

Object.values(json).forEach((file) => {
  // Statements
  if (file.s) {
    Object.values(file.s).forEach((count) => {
      stats.statements.total++;
      if (count > 0) stats.statements.covered++;
    });
  }

  // Functions
  if (file.f) {
    Object.values(file.f).forEach((count) => {
      stats.functions.total++;
      if (count > 0) stats.functions.covered++;
    });
  }

  // Branches
  if (file.b) {
    Object.values(file.b).forEach((branches) => {
      if (Array.isArray(branches)) {
        branches.forEach((count) => {
          stats.branches.total++;
          if (count > 0) stats.branches.covered++;
        });
      }
    });
  }
});

// Calculate percentages
const calcPercent = (s) =>
  s.total > 0 ? Math.round((s.covered / s.total) * 100) : 0;

const statements = calcPercent(stats.statements);
const functions = calcPercent(stats.functions);
const branches = calcPercent(stats.branches);

// Output for GitHub Actions
console.log(`COVERAGE_STATEMENTS=${statements}`);
console.log(`COVERAGE_FUNCTIONS=${functions}`);
console.log(`COVERAGE_BRANCHES=${branches}`);

// Also output to console for debugging
console.error(`Coverage Report:`);
console.error(
  `  Statements: ${statements}% (${stats.statements.covered}/${stats.statements.total})`,
);
console.error(
  `  Functions: ${functions}% (${stats.functions.covered}/${stats.functions.total})`,
);
console.error(
  `  Branches: ${branches}% (${stats.branches.covered}/${stats.branches.total})`,
);
