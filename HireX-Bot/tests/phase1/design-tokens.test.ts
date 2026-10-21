import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config';

const globalsPath = fileURLToPath(new URL('../../src/app/globals.css', import.meta.url));
const css = readFileSync(globalsPath, 'utf8');

const theme = tailwindConfig.theme?.extend ?? {};
const colors = (theme.colors ?? {}) as Record<string, unknown>;
const radii = (theme.borderRadius ?? {}) as Record<string, string>;
const fonts = (theme.fontFamily ?? {}) as Record<string, string[]>;
const shadows = (theme.boxShadow ?? {}) as Record<string, string>;

const ALLOWED_HEXES = new Set([
  'FAFAFA',
  'FFFFFF',
  'F4F4F5',
  '0A0A0B',
  'E4E4E7',
  '18181B',
  '52525B',
  '71717A',
]);

describe('Design.md token contract (tailwind.config.ts)', () => {
  it('locks the five surface colours', () => {
    expect(colors.canvas).toBe('#FAFAFA');
    expect(colors.surface).toBe('#FFFFFF');
    expect(colors.subtle).toBe('#F4F4F5');
    expect(colors.obsidian).toBe('#0A0A0B');
    expect(colors.hairline).toBe('#E4E4E7');
  });

  it('locks the focus border token named in Design.md 2.1', () => {
    expect(colors.focus).toBe('#18181B');
  });

  it('locks the three ink tones', () => {
    expect(colors.ink).toEqual({
      primary: '#0A0A0B',
      secondary: '#52525B',
      muted: '#71717A',
    });
  });

  it('declares no invented top-level colour families', () => {
    expect(Object.keys(colors).sort()).toEqual([
      'canvas',
      'focus',
      'hairline',
      'ink',
      'obsidian',
      'subtle',
      'surface',
    ]);
  });

  it('locks the four radii and nothing else', () => {
    expect(radii.pill).toBe('9999px');
    expect(radii.stage).toBe('28px');
    expect(radii.bento).toBe('20px');
    expect(radii.compact).toBe('14px');
    expect(Object.keys(radii).sort()).toEqual(['bento', 'compact', 'pill', 'stage']);
  });

  it('locks the three font stacks byte-for-byte', () => {
    expect(fonts.display).toEqual(["'Google Sans Flex'", 'Arial', 'Helvetica', 'sans-serif']);
    expect(fonts.sans).toEqual(["'Raleway'", '-apple-system', 'BlinkMacSystemFont', 'sans-serif']);
    expect(fonts.mono).toEqual(["'JetBrains Mono'", 'monospace']);
  });

  it('keeps Raleway as the body face and Google Sans Flex as display', () => {
    expect(fonts.sans?.[0]).not.toContain('Google Sans');
    expect(fonts.display?.[0]).toContain('Google Sans');
  });

  it('locks the two sanctioned elevations and nothing heavier', () => {
    expect(shadows.navbar).toBe(
      '0 10px 30px -5px rgba(10, 10, 11, 0.05), 0 1px 3px rgba(10, 10, 11, 0.03)',
    );
    expect(shadows.card).toBe('0 2px 10px rgba(10, 10, 11, 0.02)');
    expect(Object.keys(shadows).sort()).toEqual(['card', 'navbar']);
  });

  it('locks the light theme and scans the src tree', () => {
    expect(tailwindConfig.darkMode).toEqual(['class']);
    expect(tailwindConfig.content).toContain('./src/**/*.{ts,tsx}');
  });
});

describe('Design.md token contract (globals.css)', () => {
  it('declares every colour as a custom property', () => {
    const expected: Array<[string, string]> = [
      ['--bg-canvas', '#FAFAFA'],
      ['--bg-surface', '#FFFFFF'],
      ['--bg-subtle', '#F4F4F5'],
      ['--bg-obsidian', '#0A0A0B'],
      ['--border-hairline', '#E4E4E7'],
      ['--border-focus', '#18181B'],
      ['--text-primary', '#0A0A0B'],
      ['--text-secondary', '#52525B'],
      ['--text-muted', '#71717A'],
    ];
    for (const [name, value] of expected) {
      expect(css).toContain(`${name}: ${value}`);
    }
  });

  it('declares exactly nine colour-valued custom properties', () => {
    const matches = css.match(/--(?:bg|border|text)-[a-z-]+:\s*#[0-9A-Fa-f]{6}/g) ?? [];
    expect(matches).toHaveLength(9);
  });

  it('does not reduce the verified signal to a bare colour', () => {
    expect(css).toContain('--signal-verified: filled-dot');
    expect(css).not.toMatch(/--signal-verified:\s*#/);
  });

  it('uses no gradient fills', () => {
    expect(css).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/);
  });

  it('uses no hue-based colour syntax', () => {
    expect(css).not.toMatch(/\bhsl\(|\boklch\(|\blab\(/);
    expect(css).not.toMatch(/\brgb\(/);
  });

  it('never opts into a dark scheme', () => {
    expect(css).not.toContain('prefers-color-scheme: dark');
    expect(css).not.toContain('neon');
  });

  it('uses only the approved monochrome hexes', () => {
    const hexes = css.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    expect(hexes.length).toBeGreaterThan(0);
    for (const hex of hexes) {
      expect(ALLOWED_HEXES.has(hex.slice(1).toUpperCase())).toBe(true);
    }
  });

  it('paints the body from the canvas token, never a dark surface', () => {
    expect(css).toMatch(/background-color:\s*var\(--bg-canvas\)/);
    expect(css).not.toMatch(/background-color:\s*#000/i);
  });
});

describe('design system accessibility facts', () => {
  const luminance = (hex: string): number => {
    const channel = (offset: number): number => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const ratio = (a: string, b: string): number => {
    const la = luminance(a);
    const lb = luminance(b);
    const light = Math.max(la, lb);
    const dark = Math.min(la, lb);
    return (light + 0.05) / (dark + 0.05);
  };

  it('meets AA for body text pairs', () => {
    expect(ratio('#0A0A0B', '#FAFAFA')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#0A0A0B', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#52525B', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#52525B', '#FAFAFA')).toBeGreaterThanOrEqual(4.5);
  });

  it('records the muted-on-subtle pair as AA-failing rather than silently claiming AAA', () => {
    // Documented limitation: #71717A on #F4F4F5 is 4.397:1. Phase 3 must not use
    // this pair for body copy, and the UI may not claim WCAG AAA for muted text.
    expect(ratio('#71717A', '#F4F4F5')).toBeLessThan(4.5);
  });

  it('uses white, not secondary ink, on the obsidian surface', () => {
    expect(ratio('#FFFFFF', '#0A0A0B')).toBeGreaterThanOrEqual(7);
    expect(ratio('#52525B', '#0A0A0B')).toBeLessThan(4.5);
  });
});

describe('Typography is actually shipped, not merely declared', () => {
  const faceFiles = [
    { weight: '400', file: 'raleway-400.woff2', family: 'Raleway' },
    { weight: '500', file: 'raleway-500.woff2', family: 'Raleway' },
    { weight: '600', file: 'raleway-600.woff2', family: 'Raleway' },
    { weight: '400', file: 'jetbrains-mono-400.woff2', family: 'JetBrains Mono' },
  ];

  it('declares one @font-face per shipped weight', () => {
    const faces = css.match(/@font-face\s*\{[^}]+\}/g) ?? [];
    expect(faces).toHaveLength(faceFiles.length);
    for (const face of faceFiles) {
      expect(css).toContain(`url('/fonts/${face.file}') format('woff2')`);
    }
  });

  it('ships a real woff2 file for every declared face', () => {
    for (const face of faceFiles) {
      const path = fileURLToPath(new URL(`../../public/fonts/${face.file}`, import.meta.url));
      const bytes = readFileSync(path);
      expect(bytes.byteLength).toBeGreaterThan(1_000);
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2');
    }
  });

  it('declares the OFL licence for each self-hosted family', () => {
    for (const name of ['OFL-Raleway.txt', 'OFL-JetBrainsMono.txt']) {
      const path = fileURLToPath(new URL(`../../public/fonts/${name}`, import.meta.url));
      expect(readFileSync(path, 'utf8')).toContain('SIL OPEN FONT LICENSE');
    }
  });

  it('preloads the body face in the document head', () => {
    const layout = readFileSync(
      fileURLToPath(new URL('../../src/app/layout.tsx', import.meta.url)),
      'utf8',
    );
    expect(layout).toContain('rel="preload"');
    expect(layout).toContain('/fonts/raleway-400.woff2');
    expect(layout).toContain('as="font"');
  });
});
