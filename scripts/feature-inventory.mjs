/**
 * Reproduces the feature table in docs/code-quality-brief.md.
 *
 * The percentages in that document are only worth anything if someone else
 * can arrive at them. The file-to-feature mapping below is a human judgement
 * — it has to be, since the codebase has no module boundaries to read — so it
 * is written down here rather than described in prose, and anyone who
 * disagrees with a placement can move a line and re-run.
 *
 *   node scripts/feature-inventory.mjs
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Feature → the folders that hold it.
 *
 * This used to be a list of individual files, which meant every new file
 * landed in the catch-all until someone remembered to add it — eleven did
 * exactly that in one afternoon. Now that src/components and src/lib are
 * grouped by feature, the map points at folders and new files are counted
 * where they are put.
 */
const FEATURES = {
  'Promo card editor': { layer: 'front', paths: ['src/components/promo', 'src/lib/promo'] },
  'Announcement bar': { layer: 'front', paths: ['src/components/announcement', 'src/lib/announcement'] },
  'Countdown timer editor': { layer: 'front', paths: ['src/components/timer-lexical', 'src/lib/editor/timerUtils.ts'] },
  'Rich text engine': { layer: 'front', paths: ['src/lib/editor/richTextUtils.ts', 'src/lib/editor/undoStack.ts', 'src/lib/editor/historyManager.ts', 'src/hooks/useRichTextEditor.ts', 'src/hooks/useEditorHistory.ts'] },
  'Dashboard': { layer: 'front', paths: ['src/components/dashboard'] },
  'Shared components & utilities': { layer: 'front', paths: ['src/components/shared', 'src/lib/utils.ts', 'src/lib/calendarDates.ts', 'src/lib/gradientAngle.ts', 'src/lib/configSignature.ts', 'src/lib/whatsapp.ts', 'src/hooks/useSignalEffect.ts'] },
  'Auth & session': { layer: 'front + back', paths: ['src/app/login', 'src/app/api/auth', 'src/lib/auth/session.ts', 'src/lib/auth/currentUser.ts', 'src/lib/auth/password.ts', 'src/lib/auth/sessionWarning.ts', 'src/middleware.ts', 'src/repositories/userRepository.ts'] },
  'Persistence & publishing': { layer: 'front + back', paths: ['src/app/api/config', 'src/app/api/draft', 'src/app/api/variants', 'src/lib/db', 'src/repositories/campaignRepository.ts', 'src/services'] },
  'Cross-device presence': { layer: 'front + back', paths: ['src/app/api/presence', 'src/lib/auth/presenceClient.ts', 'src/lib/auth/device.ts'] },
  'Installable app (PWA)': { layer: 'front', paths: ['src/hooks/useInstallPrompt.ts', 'src/components/shell/ServiceWorkerGuard.tsx'] },
  'App shell & state': { layer: 'front', paths: ['src/app/page.tsx', 'src/app/layout.tsx', 'src/components/shell/Header.tsx', 'src/components/tour', 'src/app/error.tsx', 'src/app/global-error.tsx', 'src/types'] },
};

/** Server code, counted separately — a feature row is not a layer count. */
const BACKEND = ['src/app/api', 'src/services', 'src/repositories', 'src/lib/db/db.ts', 'src/lib/db/schema.ts', 'src/lib/auth/session.ts', 'src/lib/auth/password.ts', 'src/lib/auth/currentUser.ts', 'src/middleware.ts'];

const walk = (dir) => readdirSync(dir).flatMap((e) => {
  const p = join(dir, e);
  return statSync(p).isDirectory() ? walk(p) : (/\.tsx?$/.test(p) ? [p] : []);
});
const lines = (p) => readFileSync(p, 'utf8').split('\n').length - 1;
const under = (file, prefix) => file === prefix || file.startsWith(prefix.replace(/\/$/, '') + '/');

const files = walk('src');
const total = files.reduce((n, f) => n + lines(f), 0);
const claimed = new Set();

const rows = Object.entries(FEATURES).map(([name, { layer, paths }]) => {
  const own = files.filter((f) => paths.some((p) => under(f, p)));
  own.forEach((f) => claimed.add(f));
  return { name, layer, files: own.length, lines: own.reduce((n, f) => n + lines(f), 0) };
}).sort((a, b) => b.lines - a.lines);

const rest = files.filter((f) => !claimed.has(f));
if (rest.length) rows.push({ name: 'Repositories, services, hooks, utilities', layer: 'mixed', files: rest.length, lines: rest.reduce((n, f) => n + lines(f), 0) });

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);
console.log(`${pad('FEATURE', 42)}${pad('LAYER', 14)}${num('FILES', 6)}${num('LINES', 8)}${num('SHARE', 7)}`);
for (const r of rows) console.log(`${pad(r.name, 42)}${pad(r.layer, 14)}${num(r.files, 6)}${num(r.lines, 8)}${num(Math.round(r.lines / total * 100) + '%', 7)}`);
console.log(`${pad('TOTAL', 56)}${num(files.length, 6)}${num(total, 8)}`);

const backend = files.filter((f) => BACKEND.some((p) => under(f, p)));
const backendLines = backend.reduce((n, f) => n + lines(f), 0);
console.log(`\nBackend only (server code, not feature totals): ${backendLines} lines across ${backend.length} files — ${(backendLines / total * 100).toFixed(1)}% of the codebase`);
