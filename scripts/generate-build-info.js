'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// Resolve owner/repo from gh CLI, with fallback to git remote URL
const nameWithOwner = safe(() => {
  const val = sh('gh repo view --json nameWithOwner -q .nameWithOwner');
  if (!val || !val.includes('/')) throw new Error('unexpected format');
  return val;
});

const ownerRepo = nameWithOwner
  ? nameWithOwner
  : safe(() => {
      const url = sh('git config --get remote.origin.url');
      const m =
        url.match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/) ||
        url.match(/github\.com\/(.+?\/.+?)(?:\.git)?$/);
      if (!m) throw new Error('cannot parse remote url');
      return m[1];
    });

// Find most recently merged PR on main
// Note: per_page=20 covers normal repo cadence; if all 20 are closed-not-merged, prNumber = null
let prNumber = null;
let prBody = '';
let prTitle = '';
let prHeadRef = '';

if (ownerRepo) {
  const prs = safe(() => {
    const json = sh(
      `gh api 'repos/${ownerRepo}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=20'`,
    );
    return JSON.parse(json);
  }, []);

  const lastMerged = Array.isArray(prs) ? prs.find((pr) => pr.merged_at) : null;
  if (lastMerged) {
    prNumber = lastMerged.number;
    prBody = lastMerged.body || '';
    prTitle = lastMerged.title || '';
    prHeadRef = (lastMerged.head && lastMerged.head.ref) || '';
  }
}

// Resolve linked issue number (closing keywords > branch name > title mention)
let issueNumber = null;

// a. Closing keywords in PR body (case-insensitive, handles "Closes:", "fix #", "resolved #", etc.)
const bodyMatch = prBody.match(/(?:close[sd]?|fixe[sd]?|resolve[sd]?)\s*:?\s*#(\d+)/i);
if (bodyMatch) {
  issueNumber = parseInt(bodyMatch[1], 10);
}

// b. Branch name: anchored to ^issue- to avoid matching e.g. feature/issue-43-x
if (issueNumber === null) {
  const branchMatch = prHeadRef.match(/^issue-(\d+)(?:-|$)/i);
  if (branchMatch) {
    issueNumber = parseInt(branchMatch[1], 10);
  }
}

// c. First #N mention in PR title
if (issueNumber === null) {
  const titleMatch = prTitle.match(/#(\d+)/);
  if (titleMatch) {
    issueNumber = parseInt(titleMatch[1], 10);
  }
}

// Fetch issue title independently — failure leaves issueNumber intact
let issueTitle = null;
if (issueNumber !== null && ownerRepo) {
  issueTitle = safe(() => {
    const json = sh(`gh api 'repos/${ownerRepo}/issues/${issueNumber}'`);
    return JSON.parse(json).title || null;
  });
}

// Commit SHA
const commitShaFull = safe(() => sh('git rev-parse HEAD'));
const commitShaShort = commitShaFull ? commitShaFull.slice(0, 7) : null;

// Assemble output — key order is preserved by V8 for non-integer string keys (Node >= 20)
const output = {
  issueNumber,
  issueTitle,
  prNumber,
  commitShaShort,
  commitShaFull,
  builtAt: new Date().toISOString(),
};

// Write file — only failure that exits non-zero
const outPath = path.join(__dirname, '..', 'data', 'build-info.json');
try {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
} catch (err) {
  process.stderr.write(`build-info: failed to write ${outPath}: ${err.message}\n`);
  process.exit(1);
}

console.log(
  `build-info: issue=#${issueNumber} pr=#${prNumber} sha=${commitShaShort} built=${output.builtAt}`,
);
