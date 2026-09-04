// APLIKACE.png (Sky Hub na notebooku a telefonu, bílé pozadí, bez alfy)
// -> images/sky-hub-app.{png,webp,avif} s průhledným pozadím a měkkým
// stínem telefonu, plus výřez telefonu images/sky-hub-phone.*.
// Bílé pozadí hledáme záplavou od rohů (obrazovky jsou uzavřené tmavým
// rámem, takže se do nich záplava nedostane). Šedý stín telefonu je
// spojitý s pozadím, ale sahá až k rámu — proto ho bereme jen napravo
// a pod telefonem a převádíme na poloprůhlednou černou.
import sharp from '/Users/jansvach/Desktop/sky-guard-web/node_modules/sharp/lib/index.js';
const SRC = process.argv[2] || '/Users/jansvach/Desktop/SKYGUARD-WEB/APLIKACE.png';
const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const N = W * H;
const mn = new Uint8Array(N), mx = new Uint8Array(N);
for (let i = 0; i < N; i++) { const r = data[i*C], g = data[i*C+1], b = data[i*C+2]; mn[i] = Math.min(r,g,b); mx[i] = Math.max(r,g,b); }
const mask = new Uint8Array(N); // 0 = objekt, 1 = pozadí, 2 = stín
function flood(seeds, ok, tag) {
  const stack = seeds.filter(i => ok(i) && mask[i] === 0);
  while (stack.length) {
    const i = stack.pop(); if (mask[i]) continue; mask[i] = tag;
    const x = i % W, y = (i / W) | 0;
    if (x > 0 && !mask[i-1] && ok(i-1)) stack.push(i-1);
    if (x < W-1 && !mask[i+1] && ok(i+1)) stack.push(i+1);
    if (y > 0 && !mask[i-W] && ok(i-W)) stack.push(i-W);
    if (y < H-1 && !mask[i+W] && ok(i+W)) stack.push(i+W);
  }
}
const corners = [0, W-1, (H-1)*W, N-1, ((H/2)|0)*W, ((H/2)|0)*W + W-1, (W/2)|0, (H-1)*W + ((W/2)|0)];
flood(corners, i => mn[i] >= 248, 1);
// stín: neutrální šedá spojitá s pozadím, jen v zóně vpravo/pod telefonem
const shadowZone = i => { const x = i % W, y = (i / W) | 0; return x >= 1758 || (y >= 1048 && x >= 1400); };
const bgSeeds = []; for (let i = 0; i < N; i++) if (mask[i] === 1 && shadowZone(i)) bgSeeds.push(i);
const seedSet = bgSeeds; // hranice pozadí -> stín
mask.forEach((v, i) => { if (v === 1) mask[i] = 1; });
// dočasně odemkneme pozadí v zóně, aby záplava mohla projít přes něj do stínu
const stack = [];
for (const i of seedSet) stack.push(i);
const okShadow = i => shadowZone(i) && (mx[i] - mn[i]) <= 8 && mn[i] >= 128 && mn[i] < 248;
while (stack.length) {
  const i = stack.pop();
  const x = i % W, y = (i / W) | 0;
  for (const j of [x>0?i-1:-1, x<W-1?i+1:-1, y>0?i-W:-1, y<H-1?i+W:-1]) {
    if (j < 0 || mask[j]) continue;
    if (okShadow(j)) { mask[j] = 2; stack.push(j); }
  }
}
const out = Buffer.alloc(N * 4);
let cnt = [0,0,0];
for (let i = 0; i < N; i++) {
  const r = data[i*C], g = data[i*C+1], b = data[i*C+2];
  let a = 255, rr = r, gg = g, bb = b;
  if (mask[i] === 1) { a = 0; cnt[1]++; }
  else if (mask[i] === 2) { a = Math.round(((255 - mn[i]) / (255 - 128)) * 0.85 * 255); rr = gg = bb = 0; cnt[2]++; }
  else if (shadowZone(i) && mn[i] >= 120) { a = 0; cnt[1]++; } // osamělé světlé pixely v zóně stínu
  else {
    cnt[0]++;
    // hrana k pozadí: světlý antialiasing bílé -> částečná průhlednost
    const x = i % W, y = (i / W) | 0;
    let nearBg = false;
    for (const j of [x>0?i-1:-1, x<W-1?i+1:-1, y>0?i-W:-1, y<H-1?i+W:-1]) if (j >= 0 && mask[j] === 1) { nearBg = true; break; }
    if (nearBg && mn[i] > 170) a = Math.max(0, Math.min(255, Math.round(((255 - mn[i]) / 85) * 255)));
  }
  out[i*4] = rr; out[i*4+1] = gg; out[i*4+2] = bb; out[i*4+3] = a;
}
console.log('objekt/pozadí/stín px:', cnt.join('/'));
const rgba = sharp(out, { raw: { width: W, height: H, channels: 4 } });
const trimmed = await rgba.png().toBuffer();
const t = sharp(trimmed).trim({ threshold: 2 });
const { data: tb, info: ti } = await t.toBuffer({ resolveWithObject: true });
console.log('ořez ->', ti.width, 'x', ti.height);
const pad = 24;
const full = await sharp(tb).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r:0,g:0,b:0,alpha:0 } }).toBuffer();
await sharp(full).png({ compressionLevel: 9 }).toFile('images/sky-hub-app.png');
await sharp(full).webp({ quality: 84, alphaQuality: 90 }).toFile('images/sky-hub-app.webp');
await sharp(full).avif({ quality: 58 }).toFile('images/sky-hub-app.avif');
// výřez telefonu z původního rámu: x 1420..1800, y 370..1110
const phone = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).extract({ left: 1420, top: 370, width: 380, height: 740 }).png().toBuffer();
const ph = await sharp(phone).trim({ threshold: 2 }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r:0,g:0,b:0,alpha:0 } }).toBuffer();
await sharp(ph).png({ compressionLevel: 9 }).toFile('images/sky-hub-phone.png');
await sharp(ph).webp({ quality: 84, alphaQuality: 90 }).toFile('images/sky-hub-phone.webp');
await sharp(ph).avif({ quality: 58 }).toFile('images/sky-hub-phone.avif');
for (const f of ['sky-hub-app.png','sky-hub-app.webp','sky-hub-app.avif','sky-hub-phone.png','sky-hub-phone.webp','sky-hub-phone.avif']) {
  const m = await sharp('images/'+f).metadata(); const sz = (await import('node:fs')).statSync('images/'+f).size;
  console.log(f, m.width+'x'+m.height, Math.round(sz/1024)+' kB');
}
// náhled na tmavém pozadí
const m = await sharp(full).metadata();
await sharp({ create: { width: m.width, height: m.height, channels: 4, background: '#08070E' } }).composite([{ input: full }]).resize({ width: 1200 }).png().toFile(process.env.S + '/hub-app-dark.png');
