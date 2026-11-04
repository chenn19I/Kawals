import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const TARGETS = [
  'apps/web/src',
  'apps/web/index.html',
  'apps/api/src',
  'packages/rules/src',
  'fixtures/src',
  'README.md',
  'penjelasan deskripsi proyek.md',
  'spikes',
];

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.md', '.json', '.svg']);

function collect(path: string, found: string[] = []): string[] {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    return found;
  }

  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      collect(join(path, entry), found);
    }
    return found;
  }

  if (TEXT_EXTENSIONS.has(extname(path))) found.push(path);
  return found;
}

const files = TARGETS.flatMap((target) => collect(join(ROOT, target)));

describe('authored copy', () => {
  it('scans the UI, API, fixtures, and docs', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('uses no em dash or em dash entity', () => {
    const offenders = files.filter((file) => {
      const text = readFileSync(file, 'utf8');
      return (
        text.includes('\u2014') ||
        text.includes('&mdash;') ||
        text.includes('&#8212;') ||
        text.includes('&#x2014;')
      );
    });

    expect(offenders.map((file) => relative(ROOT, file))).toEqual([]);
  });
});
