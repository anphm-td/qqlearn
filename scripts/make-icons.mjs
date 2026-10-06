// Sinh logo "100" + toàn bộ icon app (PWA + Android assets) từ một công thức duy nhất.
// Chạy: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = (await import('sharp')).default;

const INK = '#45403A';
const TEAL = '#4EB09B';
const BG = '#FBF6EE';
const CORAL = '#F28076';
const MUTED = '#9A9188';
const RULE = '#F0E6D6';

// Số "100" nét tròn (Quicksand-like), giữa oval 512×512: thân 1 tại x=134, hai oval 0
function digitsSVG(stroke, w = 34) {
  return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M112 232 L134 196 L134 340"/>
    <ellipse cx="244" cy="268" rx="45" ry="72"/>
    <ellipse cx="358" cy="268" rx="45" ry="72"/>
  </g>`;
}

function sparkleSVG(x, y, r, color) {
  return `<path d="M${x} ${y - r} C${x + r * 0.12} ${y - r * 0.3} ${x + r * 0.3} ${y - r * 0.12} ${x + r} ${y} C${x + r * 0.3} ${y + r * 0.12} ${x + r * 0.12} ${y + r * 0.3} ${x} ${y + r} C${x - r * 0.12} ${y + r * 0.3} ${x - r * 0.3} ${y + r * 0.12} ${x - r} ${y} C${x - r * 0.3} ${y - r * 0.12} ${x - r * 0.12} ${y - r * 0.3} ${x} ${y - r} Z" fill="${color}"/>`;
}

// variant: 'hatch' (A — giữ chất v5), 'solid' (B), 'outline' (C)
// scale: thu nhỏ nội dung về TÂM (256,256) — cho maskable/adaptive/splash
function logoSVG({ variant = 'hatch', bg = BG, sparkle = true, scale = 1, rounded = false, size = 512, idSuffix = '' }) {
  let oval;
  if (variant === 'solid') {
    oval = `<ellipse cx="256" cy="268" rx="196" ry="140" fill="${TEAL}"/>`;
  } else if (variant === 'outline') {
    oval = `<ellipse cx="256" cy="268" rx="196" ry="140" fill="none" stroke="${MUTED}" stroke-width="10" stroke-dasharray="24 20"/>`;
  } else {
    oval = `
    <ellipse cx="256" cy="268" rx="196" ry="140" fill="none" stroke="${MUTED}" stroke-width="10" stroke-dasharray="24 20"/>
    <ellipse cx="256" cy="268" rx="196" ry="140" fill="url(#hatch${idSuffix})"/>`;
  }
  const digitStroke = variant === 'solid' ? BG : variant === 'outline' ? TEAL : INK;
  const content = `${oval}
  ${digitsSVG(digitStroke, 34)}
  ${sparkle ? sparkleSVG(418, 142, 26, CORAL) : ''}`;
  const inner = scale === 1 ? content
    : `<g transform="translate(${(256 * (1 - scale)).toFixed(1)} ${(256 * (1 - scale)).toFixed(1)}) scale(${scale})">${content}</g>`;
  const bgRect = rounded
    ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${bg}"/>`
    : (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <pattern id="hatch${idSuffix}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="14" stroke="${TEAL}" stroke-width="4" opacity="0.5"/>
    </pattern>
  </defs>
  ${bgRect}
  ${inner}
</svg>`;
}

// ==== 1) SVG master cho PWA + design ====
// Phương án chính thức: 'solid' — oval teal đặc + số 100 màu kem (đọc rõ nhất ở cỡ 48px)
const MAIN = 'solid';
mkdirSync(path.join(ROOT, 'design', 'logo'), { recursive: true });
writeFileSync(path.join(ROOT, 'design', 'logo', 'qqlearn-logo.svg'), logoSVG({ variant: MAIN, rounded: true, idSuffix: '-m' }));
writeFileSync(path.join(ROOT, 'design', 'logo', 'phuong-an-a-hatch.svg'), logoSVG({ variant: 'hatch', rounded: true, idSuffix: '-a' }));
writeFileSync(path.join(ROOT, 'design', 'logo', 'phuong-an-c-outline.svg'), logoSVG({ variant: 'outline', rounded: true, idSuffix: '-c' }));
writeFileSync(path.join(ROOT, 'public', 'icon.svg'), logoSVG({ variant: MAIN, rounded: true, idSuffix: '-p' }));
writeFileSync(path.join(ROOT, 'public', 'icon-maskable.svg'), logoSVG({ variant: MAIN, scale: 0.82, idSuffix: '-k' }));

// ==== 2) PNG assets cho Android (@capacitor/assets) ====
mkdirSync(path.join(ROOT, 'assets'), { recursive: true });
const png = (svg, w) => sharp(Buffer.from(svg)).resize(w, w).png();
await png(logoSVG({ variant: MAIN, idSuffix: '-io' }), 1024).toFile(path.join(ROOT, 'assets', 'icon-only.png'));
await png(logoSVG({ variant: MAIN, bg: '', scale: 0.8, idSuffix: '-fg' }), 1024).toFile(path.join(ROOT, 'assets', 'icon-foreground.png'));
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png().toFile(path.join(ROOT, 'assets', 'icon-background.png'));
await png(logoSVG({ variant: MAIN, scale: 0.55, idSuffix: '-sp' }), 2732).toFile(path.join(ROOT, 'assets', 'splash.png'));
await png(logoSVG({ variant: MAIN, scale: 0.55, idSuffix: '-spd' }), 2732).toFile(path.join(ROOT, 'assets', 'splash-dark.png'));

// ==== 3) Ảnh preview 3 phương án (A | B | C) ====
const sheetW = 1560, cell = 500, pad = 30;
const comps = [];
for (const [i, v] of [['hatch', 'A'], ['solid', 'B'], ['outline', 'C']].entries()) {
  const buf = await sharp(Buffer.from(logoSVG({ variant: v[0], rounded: true, idSuffix: `-s${i}` }))).resize(cell, cell).png().toBuffer();
  comps.push({ input: buf, left: pad + i * (cell + pad), top: pad });
}
await sharp({ create: { width: sheetW, height: cell + pad * 2, channels: 4, background: '#FFFFFF' } })
  .composite(comps).png().toFile(path.join(ROOT, 'design', 'logo', 'preview-3-phuong-an.png'));

console.log('OK — icon.svg, icon-maskable.svg, assets/*.png, design/logo/* đã ghi');
