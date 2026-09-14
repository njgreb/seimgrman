// Publishes dist/ to the gh-pages branch (run by .github/workflows/deploy.yml after `npm run build`).
//
// Site layout:
//   /                  latest build
//   /builds/<sha>/     every build ever deployed, kept forever
//   /builds/           list of builds, newest first (from builds/builds.json)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BRANCH = 'gh-pages';
const REPO = process.cwd();
const DIST = path.join(REPO, 'dist');

interface Build {
  sha: string;
  subject: string;
  date: string;
}

function git(args: string[], cwd = REPO): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function indexHtml(builds: Build[]): string {
  const rows = builds
    .map(
      (b) =>
        `<li><a href="./${b.sha}/">${b.sha}</a><time>${b.date.slice(0, 16).replace('T', ' ')}</time><span>${escapeHtml(b.subject)}</span></li>`,
    )
    .join('\n');
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MEGA MANAGER builds</title>
<style>
  body { margin: 0; padding: 32px 16px; background: #101820; color: #e8e8e8; font: 14px/1.5 ui-monospace, Menlo, monospace; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 20px; letter-spacing: 2px; margin: 0 0 4px; }
  a { color: #7ec8ff; }
  ul { list-style: none; padding: 0; margin: 24px 0 0; }
  li { display: grid; grid-template-columns: 7ch 16ch 1fr; gap: 16px; padding: 8px 0; border-top: 1px solid #243040; }
  time { color: #8898a8; }
  @media (max-width: 560px) { li { grid-template-columns: 7ch 1fr; } li span { grid-column: 1 / -1; } }
</style>
<main>
  <h1>MEGA MANAGER</h1>
  <a href="../">Play latest</a>
  <ul>
${rows}
  </ul>
</main>
`;
}

function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ is missing; run npm run build first');

  const build: Build = {
    sha: git(['rev-parse', '--short=7', 'HEAD']),
    subject: git(['log', '-1', '--format=%s']),
    date: git(['log', '-1', '--format=%cI']),
  };

  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  const exists = git(['ls-remote', '--heads', 'origin', BRANCH]);
  try {
    if (exists) {
      git(['fetch', '--depth=1', 'origin', BRANCH]);
      git(['worktree', 'add', '--detach', site, 'FETCH_HEAD']);
    } else {
      git(['worktree', 'add', '--detach', site]);
      git(['checkout', '-q', '--orphan', `${BRANCH}-deploy`], site);
      git(['rm', '-rfq', '.'], site);
    }
    publish(site, build);
  } finally {
    git(['worktree', 'remove', '--force', site]);
    if (!exists) git(['branch', '-D', `${BRANCH}-deploy`]);
  }
}

function publish(site: string, build: Build) {
  // Latest build at the root: replace everything except the builds archive.
  for (const entry of fs.readdirSync(site)) {
    if (entry !== '.git' && entry !== 'builds') fs.rmSync(path.join(site, entry), { recursive: true, force: true });
  }
  fs.cpSync(DIST, site, { recursive: true });
  fs.writeFileSync(path.join(site, '.nojekyll'), '');

  const buildDir = path.join(site, 'builds', build.sha);
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.cpSync(DIST, buildDir, { recursive: true });

  const manifestPath = path.join(site, 'builds', 'builds.json');
  const builds: Build[] = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  const updated = [build, ...builds.filter((b) => b.sha !== build.sha)];
  fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + '\n');
  fs.writeFileSync(path.join(site, 'builds', 'index.html'), indexHtml(updated));

  git(['add', '-A'], site);
  if (!git(['status', '--porcelain'], site)) {
    console.log(`${build.sha} is already deployed`);
    return;
  }
  git(['commit', '-qm', `Deploy ${build.sha}: ${build.subject}`], site);
  git(['push', '-q', 'origin', `HEAD:refs/heads/${BRANCH}`], site);
  console.log(`Deployed ${build.sha} (${updated.length} builds)`);
}

main();
