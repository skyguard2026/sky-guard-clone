// Průhledný render sloupu (alfa) -> tři velikosti v AVIF/WebP/PNG.
// Nahrazuje předchozí verzi z fotky s tmavým pozadím; rámování v CSS
// tím přestává být potřeba.
import sharp from '/Users/jansvach/Desktop/sky-guard-web/node_modules/sharp/lib/index.js';
import fs from 'fs';
const SRC = process.argv[2];
const OUT = '/Users/jansvach/Desktop/sky-guard-clone/images/';
const t = await sharp(SRC).trim({ threshold: 4 }).toBuffer({ resolveWithObject: true });
console.log(`po ořezu průhledna: ${t.info.width}x${t.info.height}`);
for (const [name, h] of [['sky-camera-tower', 1500], ['sky-camera-hero', 1200], ['sky-camera-card', 800]]) {
  const img = sharp(t.data).resize({ height: h, withoutEnlargement: true });
  await img.clone().png({ compressionLevel: 9, palette: false }).toFile(OUT + name + '.png');
  await img.clone().webp({ quality: 86, alphaQuality: 92 }).toFile(OUT + name + '.webp');
  await img.clone().avif({ quality: 60 }).toFile(OUT + name + '.avif');
  const kb = e => (fs.statSync(OUT + name + '.' + e).size / 1024).toFixed(0);
  const m = await sharp(OUT + name + '.avif').metadata();
  console.log(`  ${name}: ${m.width}x${m.height} alfa=${m.hasAlpha}  png ${kb('png')} / webp ${kb('webp')} / avif ${kb('avif')} kB`);
}
