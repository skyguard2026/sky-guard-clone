// Nahradí koncepční kamerové SVG reálnou fotkou sloupu.
// Použití:  node scripts/swap-camera-asset.mjs <cesta-k-fotce>
//
// Vygeneruje tři varianty (hero / karta / deep dive) v AVIF, WebP i PNG
// a přepíše odkazy v nova/index.html. Koncepční SVG zůstávají v design/camera/
// jako fallback, kdyby bylo potřeba se vrátit.
import sharp from '/Users/jansvach/Desktop/sky-guard-web/node_modules/sharp/lib/index.js';
import fs from 'fs';
import path from 'path';

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error('Chybí zdrojová fotka. Použití: node scripts/swap-camera-asset.mjs <cesta>');
  process.exit(1);
}
const ROOT = '/Users/jansvach/Desktop/sky-guard-clone';
const OUT = path.join(ROOT, 'images');

const meta = await sharp(SRC).metadata();
console.log(`zdroj: ${meta.width}x${meta.height} ${meta.format}, alfa: ${!!meta.hasAlpha}`);

// Ořez okolního pozadí — fotka je na tmavém podkladu, necháme jen produkt
// s malou rezervou, ať se dá v layoutu ukotvit ke spodní hraně.
const trimmed = await sharp(SRC).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
console.log(`po ořezu: ${trimmed.info.width}x${trimmed.info.height}`);

const VARIANTS = [
  { name: 'sky-camera-tower', h: 1800 },   // deep dive, plná výška
  { name: 'sky-camera-hero',  h: 1500 },   // hero
  { name: 'sky-camera-card',  h: 900  },   // karty konfigurace
];

for (const v of VARIANTS) {
  const base = path.join(OUT, v.name);
  const img = sharp(trimmed.data).resize({ height: v.h, withoutEnlargement: true });
  await img.clone().png({ compressionLevel: 9 }).toFile(base + '.png');
  await img.clone().webp({ quality: 86 }).toFile(base + '.webp');
  await img.clone().avif({ quality: 58 }).toFile(base + '.avif');
  const kb = (e) => (fs.statSync(base + '.' + e).size / 1024).toFixed(0);
  console.log(`  ${v.name}: png ${kb('png')} kB, webp ${kb('webp')} kB, avif ${kb('avif')} kB`);
}

// Přepis odkazů v HTML: SVG -> <picture> s reálnou fotkou.
const HTML = path.join(ROOT, 'nova/index.html');
let h = fs.readFileSync(HTML, 'utf8');

const pic = (name, alt, cls, extra) =>
  `<picture>` +
  `<source type="image/avif" srcset="/images/${name}.avif">` +
  `<source type="image/webp" srcset="/images/${name}.webp">` +
  `<img${cls ? ` class="${cls}"` : ''} src="/images/${name}.png" alt="${alt}"${extra || ''} decoding="async">` +
  `</picture>`;

const REPLACEMENTS = [
  [/<img class="sg-hero-camera sg-float" src="\/design\/camera\/sky-camera-tower-hero-v2\.svg"[^>]*>/,
   pic('sky-camera-hero', 'Kamerový sloup Sky Guard se třemi kamerami, satelitní anténou a rozvaděčem', 'sg-hero-camera sg-float')],
  [/<img src="\/design\/camera\/sky-camera-tower-card-v2\.svg" alt="Kamerový sloup Sky Guard"[^>]*>/,
   pic('sky-camera-card', 'Kamerový sloup Sky Guard', null, ' loading="lazy"')],
  [/<img src="\/design\/camera\/sky-camera-tower-card-v2\.svg" alt="" aria-hidden="true"[^>]*>/,
   pic('sky-camera-card', '', null, ' aria-hidden="true" loading="lazy"')],
  [/<img src="\/design\/camera\/sky-camera-tower-product-v2\.svg" alt="Kamerový sloup Sky Guard v plné výšce"[^>]*>/,
   pic('sky-camera-tower', 'Kamerový sloup Sky Guard v plné výšce', null, ' loading="lazy"')],
];

let n = 0;
for (const [re, rep] of REPLACEMENTS) {
  if (re.test(h)) { h = h.replace(re, rep); n++; }
  else console.warn('  ⚠️  vzor nenalezen:', String(re).slice(0, 70));
}
fs.writeFileSync(HTML, h);
console.log(`\npřepsáno odkazů: ${n}/${REPLACEMENTS.length}`);
console.log('zbývá SVG odkazů na kameru:', (h.match(/design\/camera\/sky-camera-tower-(hero|card|product)/g) || []).length);
