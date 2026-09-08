// ホーム画面／タブ用のアイコンを作る。アプリを開いたとき最初に出る三日月を、
// そのまま「光の点」で描いたもの。ブラウザのお仕着せアイコンだと何のアプリだか
// 分からないので、中身と同じ絵にする。
// 使い方:  node makeicon.js
//   icon.svg / apple-touch-icon.png / icon-192.png / icon-512.png を作り直す。
const fs = require('fs');
const zlib = require('zlib');

// ---------------------------------------------------------------- PNG ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf){
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function writePng(path, w, h, rgb){ // rgb: Uint8Array w*h*3
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++){
    raw[y * (1 + w * 3)] = 0; // filter: none
    for (let x = 0; x < w * 3; x++) raw[y * (1 + w * 3) + 1 + x] = rgb[y * w * 3 + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type 2 = truecolor RGB（背景は塗りつぶすので透明は要らない）
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

// ------------------------------------------------------------- 絵づくり ----
const BG = [0x03, 0x05, 0x0b];      // アプリの背景と同じ
const HALO = [0x7f, 0xe0, 0xff];    // 暈の既定色（アプリを開いたときの色）
const CORE = [0xff, 0xff, 0xff];    // 芯は純白（RONDOと同じ組み立て）

function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 三日月の形。index.html の drawDemo と同じ組み立て（大きい円から、
// 少しずらした円を抜く）だが、正方形のアイコンに収まるよう寸法を詰めてある。
const S = 1024;
const CX = S * 0.455, CY = S * 0.5, R = S * 0.375;
const IX = CX + R * 0.52, IY = CY - R * 0.13, IR = R * 0.86;
function inCrescent(x, y){
  const d1 = Math.hypot(x - CX, y - CY);
  const d2 = Math.hypot(x - IX, y - IY);
  return d1 <= R && d2 >= IR;
}

// 点を撒く。近すぎる点を弾く（アプリのディザと同じ考え方）。
function scatter(count, minDist, seed){
  const rnd = mulberry32(seed);
  const pts = [];
  let tries = 0;
  while (pts.length < count && tries < count * 900){
    tries++;
    const x = rnd() * S, y = rnd() * S;
    if (!inCrescent(x, y)) continue;
    let ok = true;
    for (const p of pts){ if (Math.hypot(p.x - x, p.y - y) < minDist){ ok = false; break; } }
    if (ok) pts.push({ x, y, s: 0.75 + rnd() * 0.5 });
  }
  return pts;
}

// 撒いたあとで、絵全体を正方形の真ん中に収め直す。三日月は右側を欠いた形なので
// 数式どおりに置くと左に寄り、左端の余白が2%しか残らなかった。ホーム画面では
// 角が丸く切られるので、上下左右に同じだけ余白を取っておきたい。
function fitToSquare(pts, coreR, spread, margin){
  const reach = p => coreR * p.s * spread * 1.2; // 暈が届く範囲
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  for (const p of pts){
    const h = reach(p);
    l = Math.min(l, p.x - h); r = Math.max(r, p.x + h);
    t = Math.min(t, p.y - h); b = Math.max(b, p.y + h);
  }
  const avail = S * (1 - 2 * margin);
  const k = Math.min(avail / (r - l), avail / (b - t));
  const ox = S / 2 - k * (l + r) / 2, oy = S / 2 - k * (t + b) / 2;
  return {
    pts: pts.map(p => ({ x: p.x * k + ox, y: p.y * k + oy, s: p.s })),
    coreR: coreR * k
  };
}

// 暈と芯を足し合わせる（加算合成）。RONDO の光と同じで、芯が白く小さいのが肝。
function render(pts, coreR, spread){
  const acc = new Float32Array(S * S * 3);
  for (const p of pts){
    const cr = coreR * p.s;
    const hr = cr * spread;
    const cs = cr * 0.62, hs = hr * 0.42;
    const reach = Math.ceil(hr * 1.6);
    const x0 = Math.max(0, (p.x - reach) | 0), x1 = Math.min(S - 1, (p.x + reach) | 0);
    const y0 = Math.max(0, (p.y - reach) | 0), y1 = Math.min(S - 1, (p.y + reach) | 0);
    for (let y = y0; y <= y1; y++){
      for (let x = x0; x <= x1; x++){
        const d2 = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2;
        const ha = 0.55 * Math.exp(-d2 / (2 * hs * hs));
        const ca = 1.00 * Math.exp(-d2 / (2 * cs * cs));
        const i = (y * S + x) * 3;
        acc[i]     += HALO[0] * ha + CORE[0] * ca;
        acc[i + 1] += HALO[1] * ha + CORE[1] * ca;
        acc[i + 2] += HALO[2] * ha + CORE[2] * ca;
      }
    }
  }
  const out = new Uint8Array(S * S * 3);
  for (let i = 0; i < S * S; i++){
    for (let c = 0; c < 3; c++){
      out[i * 3 + c] = Math.min(255, Math.round(BG[c] + acc[i * 3 + c]));
    }
  }
  return out;
}

function downsample(src, from, to){
  const out = new Uint8Array(to * to * 3);
  const k = from / to;
  for (let y = 0; y < to; y++){
    const sy0 = Math.floor(y * k), sy1 = Math.min(from, Math.floor((y + 1) * k));
    for (let x = 0; x < to; x++){
      const sx0 = Math.floor(x * k), sx1 = Math.min(from, Math.floor((x + 1) * k));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++){
        for (let sx = sx0; sx < sx1; sx++){
          const i = (sy * from + sx) * 3;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
        }
      }
      const o = (y * to + x) * 3;
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n);
    }
  }
  return out;
}

const SEED = 20260908;
const SPREAD = 3.1; // 暈と芯の半径比。RONDO に合わせた値（1 ÷ 0.32）
const fitted = fitToSquare(scatter(64, S * 0.052, SEED), S * 0.0175, SPREAD, 0.09);
const pts = fitted.pts;
const big = render(pts, fitted.coreR, SPREAD);

const ROOT = __dirname + '/';
writePng(ROOT + 'apple-touch-icon.png', 180, 180, downsample(big, S, 180));
writePng(ROOT + 'icon-192.png', 192, 192, downsample(big, S, 192));
writePng(ROOT + 'icon-512.png', 512, 512, downsample(big, S, 512));

// タブ用のSVG。PNGと同じ点・同じ寸法で描く（別々に作ると、タブとホーム画面で
// 微妙に違う絵になってしまう）。桁は詰める。
const svgFit = fitted;
const svgPts = svgFit.pts;
const n = v => (v / S * 64).toFixed(1).replace(/\.0$/, '');
let circles = '';
for (const p of svgPts) circles += `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(svgFit.coreR * p.s * SPREAD)}"/>`;
let cores = '';
for (const p of svgPts) cores += `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(svgFit.coreR * p.s)}"/>`;
// 暈はぼかす。べたっとした円のままだと隣どうしがくっついて塊に見え、
// 「光の点」に見えない（PNG側はガウスで落としているので同じ見え方に寄せる）。
const blur = n(svgFit.coreR * 0.62); // PNG側のガウス（cs = 芯半径×0.62）に合わせる
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
  + `<rect width="64" height="64" fill="#03050b"/>`
  + `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%">`
  + `<feGaussianBlur stdDeviation="${blur}"/></filter></defs>`
  + `<g fill="#7fe0ff" opacity=".55" filter="url(#b)">${circles}</g>`
  + `<g fill="#fff">${cores}</g></svg>`;
fs.writeFileSync(ROOT + 'icon.svg', svg);

console.log('dots:', pts.length, 'svg dots:', svgPts.length, 'svg bytes:', svg.length);
console.log('uri bytes:', encodeURIComponent(svg).length);
