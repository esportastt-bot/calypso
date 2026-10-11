/* =====================================================================
 *  CALYPSO — Cinématique d'introduction (10 s)
 *  Rendu Canvas 2D 1920x1080 + bande-son synthétisée (WebAudio).
 *
 *  Storyboard
 *   0.0 – 3.6  Espace profond. Saturne apparaît, lever de soleil derrière
 *              son limbe, le satellite Calypso dérive près des anneaux.
 *   3.6 – 4.9  La caméra plonge vers Calypso, qui se charge d'énergie.
 *   4.9 – 5.6  Calypso se désintègre en milliers de particules qui
 *              orbitent comme un anneau et convergent pour former le logo.
 *   5.6        IMPACT : flash, onde de choc, flare anamorphique, étincelles.
 *   5.6 – 7.1  Le logo se révèle, poussière d'anneau en orbite, reflet.
 *   7.1 – 10   Le logo s'élève, le nom CALYPSO apparaît lettre par lettre.
 * ===================================================================== */
(() => {
'use strict';

/* ---------------- Réglages ---------------- */
const CFG = {
  title: 'CALYPSO',
  tagline: '', // L'acronyme est généré dynamiquement dans drawTitle
  duration: 10,
};
const TL = { burst: 4.9, impact: 5.6, rise0: 7.1, rise1: 8.1, text0: 7.7 };
const TILT = -0.3;            // inclinaison des anneaux (alignée sur le logo)
const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const BAR = 138;              // bandes cinéma 2.39:1

/* ---------------- Utilitaires ---------------- */
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eio3 = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eio4 = t => t < .5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2;
const eout3 = t => 1 - Math.pow(1 - t, 3);
const ein3 = t => t * t * t;
const eoutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const R = rng(20261011);
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

const cv = document.getElementById('stage');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');

/* =====================================================================
 *  PRÉ-RENDUS
 * ===================================================================== */
let BG, SAT, MOON, MOONW, VIGN, GRAIN = [], STARS = [], DUST = [], SPARKS = [], PARTS = [];
let LOGO, LW, LH, LOGO_W, LOGO_GLOW, SWEEP_C, SWEEP_G;

function buildBackground() {
  const w = 2300, h = 1400;
  const [c, g] = mk(w, h);
  const base = g.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, 1400);
  base.addColorStop(0, '#081530'); base.addColorStop(.6, '#030814'); base.addColorStop(1, '#010205');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  const blobs = [
    [650, 450, 620, '30,70,170', .30], [1550, 950, 700, '15,90,160', .22], [1800, 320, 480, '80,40,140', .18],
    [380, 1050, 520, '10,50,120', .25], [1150, 700, 900, '20,40,90', .18], [1300, 200, 300, '40,110,200', .10],
  ];
  for (const [x, y, r, col, a] of blobs) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${col},${a})`); rg.addColorStop(.5, `rgba(${col},${a * .35})`); rg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 3200; i++) {
    const x = R() * w, y = R() * h, b = Math.pow(R(), 3.2), s = .5 + b * 1.6;
    g.fillStyle = `rgba(${200 + 55 * R() | 0},${215 + 40 * R() | 0},255,${.12 + b * .88})`;
    g.fillRect(x, y, s, s);
  }
  for (let i = 0; i < 45; i++) {
    const x = R() * w, y = R() * h, r = 4 + R() * 12;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(230,240,255,.9)'); rg.addColorStop(.25, 'rgba(150,190,255,.25)'); rg.addColorStop(1, 'rgba(100,150,255,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  BG = c;
}

const SR = 300; // rayon de Saturne dans le pré-rendu
function buildSaturn() {
  const Wc = 1500, Hc = 760, cx = 750, cy = 380, k = .27;
  const rin = SR * 1.22, rout = SR * 2.3;
  const [c, g] = mk(Wc, Hc);

  const dens = r => {
    const u = (r - rin) / (rout - rin);
    let d = .55 + .22 * Math.sin(u * 90) + .14 * Math.sin(u * 231 + 1) + .09 * Math.sin(u * 517 + 2);
    if (u < .2) d *= .2 + u * 2.5;                 // anneau C, pâle
    if (u > .6 && u < .655) d *= .06;              // division de Cassini
    if (u > .88 && u < .893) d *= .15;             // division d'Encke
    if (u > .95) d *= (1 - u) / .05;
    return clamp(d);
  };
  const drawRings = (a0, a1) => {
    for (let r = rin; r <= rout; r += .6) {
      const u = (r - rin) / (rout - rin);
      const l = lerp(140, 228, Math.sin(u * PI) * .75 + .25);
      g.strokeStyle = `rgba(${l | 0},${l * .91 | 0},${l * .8 | 0},${dens(r) * .5})`;
      g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(cx, cy, r, r * k, 0, a0, a1); g.stroke();
    }
  };

  drawRings(PI, TAU); // moitié arrière

  // -- Planète
  const [b, bg] = mk(SR * 2, SR * 2);
  let y = 0;
  while (y < SR * 2) {
    const h = 3 + R() * 16, lat = (y - SR) / SR;
    const l = lerp(208, 165, Math.abs(lat)) + (R() - .5) * 42;
    bg.fillStyle = `rgb(${l | 0},${l * .88 | 0},${l * .7 | 0})`;
    bg.fillRect(0, y, SR * 2, h + 1); y += h;
  }
  const [p, pg] = mk(SR * 2, SR * 2);
  pg.save(); pg.beginPath(); pg.arc(SR, SR, SR, 0, TAU); pg.clip();
  pg.filter = 'blur(2.5px)'; pg.drawImage(b, 0, 0); pg.filter = 'none';
  const cap = pg.createLinearGradient(0, 0, 0, SR * 2);
  cap.addColorStop(0, 'rgba(70,110,160,.45)'); cap.addColorStop(.22, 'rgba(70,110,160,0)');
  cap.addColorStop(.8, 'rgba(70,110,160,0)'); cap.addColorStop(1, 'rgba(70,110,160,.3)');
  pg.fillStyle = cap; pg.fillRect(0, 0, SR * 2, SR * 2);
  const Lx = -.62, Ly = -.55;
  const sh = pg.createRadialGradient(SR + Lx * SR * .55, SR + Ly * SR * .55, SR * .1, SR, SR, SR * 1.05);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.5, 'rgba(2,5,14,.25)');
  sh.addColorStop(.82, 'rgba(2,5,14,.88)'); sh.addColorStop(1, 'rgba(2,4,10,.98)');
  pg.fillStyle = sh; pg.fillRect(0, 0, SR * 2, SR * 2);
  pg.restore();
  g.drawImage(p, cx - SR, cy - SR);

  // ombre des anneaux sur la planète
  g.save(); g.beginPath(); g.arc(cx, cy, SR, 0, TAU); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = SR * .13;
  g.beginPath(); g.ellipse(cx, cy + SR * .12, SR * 1.55, SR * 1.55 * k, 0, 0, PI); g.stroke();
  g.restore();

  drawRings(0, PI); // moitié avant
  SAT = { c, cx, cy };
}

function buildMoon() {
  const S = 256, cx = S / 2, cy = S / 2, r = S * .36;
  const path = gg => {
    gg.beginPath();
    for (let i = 0; i <= 140; i++) {
      const a = i / 140 * TAU;
      const rr = r * (1 + .07 * Math.sin(3 * a + 1) + .05 * Math.sin(5 * a + 2) + .03 * Math.sin(9 * a));
      const x = cx + Math.cos(a) * rr * 1.3, y = cy + Math.sin(a) * rr * .95;
      i ? gg.lineTo(x, y) : gg.moveTo(x, y);
    }
    gg.closePath();
  };
  const [c, g] = mk(S * 2, S * 2); g.scale(2, 2); // 2x : reste net pendant la plongée
  path(g); g.save(); g.clip();
  const base = g.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, r * 1.4);
  base.addColorStop(0, '#dfe6ef'); base.addColorStop(1, '#7d899b');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  // texture de surface (glace poussiéreuse)
  for (let i = 0; i < 900; i++) {
    const x = R() * S, y = R() * S, rr = 1 + Math.pow(R(), 2) * 14, light = R() < .5;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, light ? 'rgba(255,255,255,.10)' : 'rgba(40,50,70,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
  }
  // cratères : fond ombré, rebord éclairé côté opposé à la lumière
  for (let i = 0; i < 34; i++) {
    const x = cx + (R() - .5) * r * 2.4, y = cy + (R() - .5) * r * 1.7, cr = 2 + Math.pow(R(), 1.8) * 15;
    const inner = g.createRadialGradient(x - cr * .3, y - cr * .3, 0, x, y, cr);
    inner.addColorStop(0, 'rgba(30,38,55,.45)'); inner.addColorStop(.7, 'rgba(30,38,55,.2)'); inner.addColorStop(1, 'rgba(30,38,55,0)');
    g.fillStyle = inner; g.beginPath(); g.arc(x, y, cr, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = Math.max(.8, cr * .12);
    g.beginPath(); g.arc(x, y, cr * .92, PI * -.05, PI * .7); g.stroke();
  }
  // terminateur
  const sh = g.createLinearGradient(cx - r * 1.1, cy - r, cx + r * 1.1, cy + r * .9);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.4, 'rgba(2,5,12,.1)'); sh.addColorStop(.68, 'rgba(2,5,12,.7)'); sh.addColorStop(1, 'rgba(2,4,10,.97)');
  g.fillStyle = sh; g.fillRect(0, 0, S, S);
  g.restore();
  MOON = c;
  const [w, wg] = mk(S * 2, S * 2); wg.drawImage(c, 0, 0); wg.globalCompositeOperation = 'source-in';
  wg.fillStyle = '#e8f3ff'; wg.fillRect(0, 0, S * 2, S * 2);
  MOONW = w;
}

function buildLogo() {
  LW = LOGO.width; LH = LOGO.height;
  let g;
  [LOGO_W, g] = mk(LW, LH);
  g.drawImage(LOGO, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, LW, LH);

  const pad = 180;
  [LOGO_GLOW, g] = mk(LW + pad * 2, LH + pad * 2);
  g.filter = 'blur(40px)'; g.drawImage(LOGO, pad, pad); g.filter = 'none';
  g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(60,140,255)'; g.fillRect(0, 0, LW + pad * 2, LH + pad * 2);

  [SWEEP_C, SWEEP_G] = mk(LW, LH);

  // Points d'échantillonnage du logo → cibles des particules
  const sw = 210, sh = Math.round(LH * sw / LW);
  const [s, sg] = mk(sw, sh); sg.drawImage(LOGO, 0, 0, sw, sh);
  const d = sg.getImageData(0, 0, sw, sh).data;
  const pts = [];
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = (y * sw + x) * 4;
    if (d[i + 3] > 150) pts.push({ x: (x + R()) / sw * LW - LW / 2, y: (y + R()) / sh * LH - LH / 2, r: d[i], g: d[i + 1], b: d[i + 2] });
  }
  for (let i = pts.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
  const S0 = 1.25; // échelle du logo au moment de l'impact
  PARTS = pts.slice(0, 4200).map(p => {
    const a = R() * TAU, rr = Math.sqrt(R());
    const mix = v => Math.min(255, v * .55 + 255 * .45) | 0;
    return {
      sx: CX + Math.cos(a) * rr * 210 * 1.3, sy: CY + Math.sin(a) * rr * 210 * .95,
      ex: Math.cos(a), ey: Math.sin(a),
      tx: CX + p.x * S0, ty: CY + p.y * S0,
      th: R() * TAU, spin: (1.2 + R() * .8) * PI, amp: 120 + R() * 260,
      delay: R() * .22, size: 1 + R() * 1.8,
      col: `rgb(${mix(p.r)},${mix(p.g)},${mix(p.b)})`,
    };
  });
}

function buildMisc() {
  // étoiles 3D (warp)
  for (let i = 0; i < 950; i++) STARS.push({ x: (R() * 2 - 1) * 1.8, y: (R() * 2 - 1) * 1.1, z: R(), b: .4 + R() * .6 });
  // poussière d'anneau autour du logo
  for (let i = 0; i < 1100; i++) {
    const r = 360 + Math.pow(R(), .7) * 330;
    const l = 170 + R() * 85 | 0;
    DUST.push({ a: R() * TAU, r, w: (.18 + R() * .25) * (420 / r), sz: .8 + R() * 2.2, al: .25 + R() * .75, col: `rgb(${l * .75 | 0},${l * .88 | 0},${l})` });
  }
  // étincelles d'impact
  for (let i = 0; i < 320; i++) SPARKS.push({ a: R() * TAU, v: 500 + R() * 1700, k: 2.5 + R() * 2.5, w: .8 + R() * 2, life: .8 + R() * 1.1, flat: R() < .7 });
  // vignette
  let g;
  [VIGN, g] = mk(W, H);
  const v = g.createRadialGradient(CX, CY, H * .35, CX, CY, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.75)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  // grain
  for (let n = 0; n < 4; n++) {
    const [c, gg] = mk(256, 256);
    const id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const val = 128 + (R() - .5) * 255 | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = val; id.data[i + 3] = 255; }
    gg.putImageData(id, 0, 0); GRAIN.push(c);
  }
}

/* =====================================================================
 *  PRIMITIVES LUMINEUSES
 * ===================================================================== */
function glow(x, y, r, col, a) {
  if (r <= 0 || a <= 0) return;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(.4, `rgba(${col},${a * .3})`); gr.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function streak(x, y, len, th, col, a, rot = 0) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(len / 100, th / 100);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
  gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.15, `rgba(${col},${a * .6})`); gr.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = gr; ctx.fillRect(-100, -100, 200, 200); ctx.restore();
}
function sunFlare(x, y, I) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(x, y, 650 * I, '255,160,100', .16 * I);
  glow(x, y, 190, '255,225,190', .75 * I);
  glow(x, y, 45, '255,255,255', I);
  streak(x, y, 1500 * I + 300, 16, '90,160,255', .85 * I);
  streak(x, y, 800, 4, '210,230,255', .9 * I);
  const dx = CX - x, dy = CY - y;
  const ghosts = [[.25, 30, '120,200,255', .12], [.45, 14, '255,210,140', .2], [.62, 70, '90,140,255', .07],
                  [.8, 24, '160,255,210', .1], [1.0, 150, '110,150,255', .05], [1.15, 40, '255,180,120', .08]];
  for (const [k, r, c, a] of ghosts) {
    const gx = x + dx * 2 * k, gy = y + dy * 2 * k;
    glow(gx, gy, r, c, a * I);
    ctx.strokeStyle = `rgba(${c},${a * .6 * I})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(gx, gy, r * .8, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
function star4(x, y, size, a, rot) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  streak(x, y, size, size * .035, '150,200,255', a, rot);
  streak(x, y, size, size * .035, '150,200,255', a, rot + PI / 2);
  streak(x, y, size * .5, size * .02, '200,220,255', a * .6, rot + PI / 4);
  streak(x, y, size * .5, size * .02, '200,220,255', a * .6, rot - PI / 4);
  glow(x, y, size * .25, '200,230,255', a);
  ctx.restore();
}

/* =====================================================================
 *  SCÈNES
 * ===================================================================== */
const travel = t => .012 * t + 2.7 * eio4(seg(t, 3.7, 6.5));

function drawBackground(t) {
  const fin = eout3(seg(t, 0, 1.8));
  const z = 1 + .12 * eio4(seg(t, 3.7, 6.5)) + .01 * t;
  ctx.save(); ctx.globalAlpha = fin * (t > TL.impact ? .85 : 1);
  ctx.translate(CX, CY); ctx.scale(z, z);
  ctx.drawImage(BG, -BG.width / 2 - 60 + t * -9, -BG.height / 2 - 20 + t * -3);
  ctx.restore();
}

function drawStars(t) {
  const fin = eout3(seg(t, 0, 1.5));
  const tr = travel(t), dtr = tr - travel(t - .04);
  const warp = clamp(dtr * 40);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const s of STARS) {
    const z = (((s.z - tr) % 1) + 1) % 1 * .97 + .03;
    const z2 = Math.min(z + dtr, 1);
    const x1 = CX + s.x / z * 520, y1 = CY + s.y / z * 520;
    if (x1 < -50 || x1 > W + 50 || y1 < -50 || y1 > H + 50) continue;
    const x2 = CX + s.x / z2 * 520, y2 = CY + s.y / z2 * 520;
    const b = clamp((1 - z) * 1.4) * s.b * fin;
    ctx.strokeStyle = `rgba(${lerp(220, 150, warp) | 0},${lerp(230, 200, warp) | 0},255,${b})`;
    ctx.lineWidth = .7 + (1 - z) * 2.4;
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1 + .1, y1); ctx.stroke();
  }
  ctx.restore();
}

function drawSaturnShot(t) {
  const fin = eout3(seg(t, .2, 2.2));
  const pre = eio3(seg(t, 0, 3.8));
  const dp = ein3(seg(t, 3.6, 5.3));
  const s = lerp(.6, .7, pre) * (1 + 1.9 * dp);
  const px = lerp(880, 830, pre) - 650 * dp, py = lerp(615, 600, pre) + 400 * dp;
  const alpha = fin * (1 - seg(t, 4.5, 5.3));

  if (alpha > 0) {
    const copies = dp > .03 ? 4 : 1;
    for (let k = copies - 1; k >= 0; k--) {
      const sk = s * (1 + .04 * k * dp);
      ctx.save(); ctx.globalAlpha = alpha * (k === 0 ? 1 : .2);
      ctx.translate(px, py); ctx.rotate(TILT); ctx.scale(sk, sk);
      ctx.drawImage(SAT.c, -SAT.cx, -SAT.cy);
      ctx.restore();
    }
    // lever de soleil derrière le limbe + liseré lumineux
    const sunI = eio3(seg(t, 1.1, 3.0)) * alpha;
    if (sunI > 0) {
      const ang = -2.35, rf = lerp(.95, 1.03, eio3(seg(t, 1.1, 3.4)));
      ctx.save(); ctx.translate(px, py); ctx.rotate(TILT); ctx.scale(s, s);
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = 'rgba(255,190,130,1)'; ctx.shadowBlur = 30;
      for (const [span, a, lw] of [[1.4, .18, 7], [.85, .35, 4], [.4, .7, 2.5]]) {
        ctx.strokeStyle = `rgba(255,228,190,${a * sunI})`; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.arc(0, 0, SR - 1, ang - span, ang + span); ctx.stroke();
      }
      ctx.restore();
      const lx = Math.cos(ang) * SR * rf, ly = Math.sin(ang) * SR * rf;
      const c = Math.cos(TILT), sn = Math.sin(TILT);
      sunFlare(px + (lx * c - ly * sn) * s, py + (lx * sn + ly * c) * s, sunI);
    }
  }

  // ---- Calypso, le satellite
  const pm = seg(t, 0, 3.6), mp = eio3(seg(t, 3.6, 4.8));
  let mx = lerp(1585, 1395, pm), my = lerp(350, 300, pm), mr = lerp(22, 32, pm);
  mx = lerp(mx, CX, mp); my = lerp(my, CY, mp); mr = mr * Math.pow(210 / mr, mp);
  const ma = eout3(seg(t, .6, 2.2)) * (1 - seg(t, 4.88, 4.96));
  if (ma > 0) {
    const rot = .15 + t * .05;
    ctx.save(); ctx.globalAlpha = ma;
    ctx.translate(mx, my); ctx.rotate(rot); ctx.scale(mr / 184, mr / 184);
    ctx.drawImage(MOON, -256, -256);
    const en = seg(t, 4.3, 4.9);
    if (en > 0) { ctx.globalAlpha = ma * Math.pow(en, 1.6); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(MOONW, -256, -256); }
    ctx.restore();
    // halo d'énergie
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(mx, my, mr * 2.2, '110,170,255', .12 * ma);
    if (en > 0) { glow(mx, my, mr * (1.6 + 2.4 * en), '120,190,255', .9 * en * en * ma); streak(mx, my, 900 * en, 10, '100,170,255', en * en * ma); }
    ctx.restore();
  }
}

function partPos(p, t) {
  const e = eio3(seg(t, TL.burst + p.delay, TL.impact));
  const ex = 70 * eout3(seg(t, TL.burst, TL.burst + .25)) * (1 - e);
  const bx = lerp(p.sx + p.ex * ex, p.tx, e), by = lerp(p.sy + p.ey * ex, p.ty, e);
  const amp = p.amp * Math.sin(PI * e), a = p.th + p.spin * e;
  const ox = Math.cos(a) * amp, oy = Math.sin(a) * amp * .3;
  const c = Math.cos(TILT), s = Math.sin(TILT);
  return [bx + ox * c - oy * s, by + ox * s + oy * c];
}

function drawParticles(t) {
  const a = seg(t, TL.burst - .02, TL.burst + .06) * (1 - seg(t, TL.impact, TL.impact + .2));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  // éclair de désintégration + cœur qui se charge
  glow(CX, CY, 520, '120,180,255', .7 * (1 - seg(t, TL.burst, TL.burst + .45)));
  glow(CX, CY, 380, '140,200,255', .35 * seg(t, 5.1, TL.impact));
  if (a > 0) {
    ctx.globalAlpha = a * .8;
    for (const p of PARTS) {
      const [x1, y1] = partPos(p, t), [x2, y2] = partPos(p, t - .014);
      ctx.strokeStyle = p.col; ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1 + .1, y1); ctx.stroke();
    }
  }
  ctx.restore();
}

function logoXf(t) {
  let s = 1 + .04 * seg(t, TL.impact, TL.rise0);
  s *= 1 + .25 * (1 - eoutExpo(seg(t, TL.impact, 6.7)));
  const r = eio3(seg(t, TL.rise0, TL.rise1));
  s *= lerp(1, .84, r) * (1 + .025 * seg(t, TL.rise1, 10.5));
  return { x: CX, y: lerp(CY, 425, r), s };
}

function sweepLogo(p) {
  const g = SWEEP_G;
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, LW, LH); g.drawImage(LOGO, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.save(); g.translate(lerp(-.35 * LW, 1.35 * LW, eio3(p)), LH / 2); g.rotate(.45);
  const gr = g.createLinearGradient(-90, 0, 90, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(235,245,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(-90, -LH * 1.5, 180, LH * 3);
  g.restore();
  return SWEEP_C;
}

function drawDust(t, L, front) {
  const vis = seg(t, TL.impact + .02, 6.5);
  if (vis <= 0) return;
  const ex = lerp(.2, 1, eoutExpo(seg(t, TL.impact, 7.3)));
  const c = Math.cos(TILT), s = Math.sin(TILT);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const d of DUST) {
    const a = d.a + d.w * (t - TL.impact), sn = Math.sin(a);
    if ((sn > 0) !== front) continue;
    const r = d.r * ex * L.s, lx = Math.cos(a) * r, ly = sn * r * .28;
    ctx.globalAlpha = d.al * vis * (front ? 1 : .4);
    ctx.fillStyle = d.col;
    ctx.fillRect(L.x + lx * c - ly * s, L.y + lx * s + ly * c, d.sz, d.sz);
  }
  ctx.restore();
}

function drawLogoShot(t, t_unclamped) {
  const L = logoXf(t), dw = LW * L.s, dh = LH * L.s, x0 = L.x - dw / 2, y0 = L.y - dh / 2;

  // silhouette qui se forme juste avant l'impact
  if (t < TL.impact) {
    const a = Math.pow(seg(t, 5.3, TL.impact), 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .8;
    ctx.drawImage(LOGO_W, CX - LW * .625, CY - LH * .625, LW * 1.25, LH * 1.25); ctx.restore();
    return;
  }
  const ti = t - TL.impact;

  // halo bleu
  const gs = L.s, pad = 180 * gs;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(.3 + .7 * (1 - seg(t, TL.impact, 7)) + .06 * Math.sin(t_unclamped * 2.2));
  ctx.drawImage(LOGO_GLOW, x0 - pad, y0 - pad, dw + pad * 2, dh + pad * 2);
  ctx.restore();

  drawDust(t_unclamped, L, false);

  // logo + reflets
  let img = LOGO;
  const s1 = seg(t, 6.3, 7.2), s2 = seg(t, 9.0, 9.8);
  if (s1 > 0 && s1 < 1) img = sweepLogo(s1); else if (s2 > 0 && s2 < 1) img = sweepLogo(s2);
  ctx.drawImage(img, x0, y0, dw, dh);
  const wA = 1 - eout3(seg(t, TL.impact, 6.5));
  if (wA > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = wA;
    ctx.drawImage(LOGO_W, x0, y0, dw, dh); ctx.restore();
  }

  drawDust(t_unclamped, L, true);

  // ondes de choc (dans le plan des anneaux)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [d, w0, col] of [[0, 22, '170,215,255'], [.12, 10, '120,180,255'], [.3, 5, '220,235,255']]) {
    const p = seg(ti, d, d + 1.3);
    if (p <= 0 || p >= 1) continue;
    const rad = lerp(60, 1700, eout3(p));
    ctx.shadowColor = `rgba(${col},1)`; ctx.shadowBlur = 40;
    ctx.strokeStyle = `rgba(${col},${(1 - p) * .85})`; ctx.lineWidth = w0 * (1 - p) + 1.5;
    ctx.beginPath(); ctx.ellipse(CX, CY, rad, rad * .3, TILT, 0, TAU); ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // étincelles
  const c = Math.cos(TILT), sn = Math.sin(TILT);
  ctx.lineCap = 'round';
  for (const sp of SPARKS) {
    if (ti > sp.life) continue;
    const dist = dt => sp.v * (1 - Math.exp(-sp.k * dt)) / sp.k;
    const d1 = dist(ti), d2 = dist(Math.max(0, ti - .035));
    const fy = sp.flat ? .3 : 1;
    const ux = Math.cos(sp.a), uy = Math.sin(sp.a) * fy;
    const rx = ux * c - uy * sn, ry = ux * sn + uy * c;
    ctx.strokeStyle = `rgba(200,225,255,${1 - ti / sp.life})`; ctx.lineWidth = sp.w;
    ctx.beginPath(); ctx.moveTo(CX + rx * d2, CY + ry * d2); ctx.lineTo(CX + rx * d1 + .1, CY + ry * d1); ctx.stroke();
  }

  // flare anamorphique
  const fI = Math.pow(1 - seg(ti, 0, 1.6), 1.5);
  streak(CX, CY, 2200, 22, '80,150,255', fI);
  streak(CX, CY, 1200, 5, '200,230,255', fI);
  glow(CX, CY, 700 * fI, '90,150,255', .35 * fI);
  ctx.restore();

  // scintillement final sur la petite sphère du logo (Calypso !)
  const gA = Math.sin(PI * seg(t, 9.15, 10.1));
  if (gA > 0) star4(L.x + (.3 - .5) * dw, L.y + (.215 - .5) * dh, 230 * gA, gA * .95, t * .6);
}

function drawTitle(t) {
  if (t < TL.text0) return;
  const size = 126, cy = 785;
  ctx.save();
  ctx.font = `700 ${size}px Orbitron, 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const L = [...CFG.title], ws = L.map(l => ctx.measureText(l).width);
  const track = lerp(80, 30, eout3(seg(t, TL.text0, TL.text0 + 2)));
  const total = ws.reduce((a, b) => a + b, 0) + track * (L.length - 1);
  const mid = (L.length - 1) / 2;
  const sp = seg(t, 9.0, 9.8);
  const bandX = lerp(CX - total / 2 - 250, CX + total / 2 + 250, eio3(sp));
  let x = CX - total / 2;
  for (let i = 0; i < L.length; i++) {
    const st = TL.text0 + Math.abs(i - mid) * .09, p = seg(t, st, st + .75);
    const lx = x + ws[i] / 2; x += ws[i] + track;
    if (p <= 0) continue;
    const e = eoutExpo(p), sc = lerp(1.6, 1, e);
    ctx.save(); ctx.translate(lx, cy); ctx.scale(sc, sc);
    ctx.globalAlpha = eout3(p);
    if (p < 1) ctx.filter = `blur(${(1 - e) * 14}px)`;
    const gr = ctx.createLinearGradient(0, -size * .4, 0, size * .4);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.38, '#dbe5f3'); gr.addColorStop(.52, '#7b8ca6');
    gr.addColorStop(.68, '#c4d0e0'); gr.addColorStop(1, '#f2f6fb');
    ctx.fillStyle = gr; ctx.shadowColor = 'rgba(60,140,255,.6)'; ctx.shadowBlur = 30;
    ctx.fillText(L[i], 0, 0);
    ctx.filter = 'none'; ctx.shadowBlur = 0;
    if (sp > 0 && sp < 1) {
      const bl = (bandX - lx) / sc;
      const sg = ctx.createLinearGradient(bl - 110, 0, bl + 110, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(220,240,255,.95)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sg; ctx.fillText(L[i], 0, 0);
    }
    ctx.restore();
  }

  // ligne lumineuse
  const lp = eout3(seg(t, 8.4, 9.3));
  if (lp > 0) {
    const hw = total * .55 * lp, ly = 858;
    const gr = ctx.createLinearGradient(CX - hw, 0, CX + hw, 0);
    gr.addColorStop(0, 'rgba(90,160,255,0)'); gr.addColorStop(.5, 'rgba(170,210,255,.9)'); gr.addColorStop(1, 'rgba(90,160,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(CX - hw, ly, hw * 2, 1.5);
    ctx.globalCompositeOperation = 'lighter'; glow(CX, ly, 60 * lp, '120,180,255', .35 * (1 - seg(t, 9.3, 10)));
    ctx.globalCompositeOperation = 'source-over';
  }
  // slogan (Acronyme CALYPSO)
  const ta = eout3(seg(t, 8.7, 9.6));
  if (ta > 0) {
    ctx.save();
    ctx.font = `600 21px Rajdhani, 'Segoe UI', sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${lerp(12, 6, ta)}px`;
    ctx.textAlign = 'left';

    const parts = [
      { f: 'C', r: 'USTOMIZABLE ' },
      { f: 'A', r: 'CCESS & ' },
      { f: 'L', r: 'INKED ' },
      { f: 'Y', r: 'IELD ' },
      { f: 'P', r: 'LATFORM FOR ' },
      { f: 'S', r: 'ECURE ' },
      { f: 'O', r: 'PERATIONS' }
    ];

    let totalW = 0;
    for (const p of parts) totalW += ctx.measureText(p.f + p.r).width;

    let currentX = CX - totalW / 2;

    for (const p of parts) {
      // Première lettre brillante
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(230,245,255,${ta})`;
      ctx.shadowColor = `rgba(150,200,255,${ta * 0.8})`;
      ctx.shadowBlur = 10;
      ctx.fillText(p.f, currentX, 895);
      currentX += ctx.measureText(p.f).width;

      // Reste du mot
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(145,172,208,${ta})`;
      ctx.shadowBlur = 0;
      ctx.fillText(p.r, currentX, 895);
      currentX += ctx.measureText(p.r).width;
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawFlash(t) {
  let a = 0;
  if (t > 5.42 && t < 6.5) a = t < TL.impact ? Math.pow(seg(t, 5.42, TL.impact), 2.5) : 1 - eout3(seg(t, TL.impact, 6.5));
  if (t > TL.burst - .02 && t < 5.3) a = Math.max(a, .5 * (1 - eout3(seg(t, TL.burst, 5.3))));
  if (a > 0) { ctx.fillStyle = `rgba(236,244,255,${a})`; ctx.fillRect(0, 0, W, H); }
}

function drawGrade(t, t_unclamped) {
  ctx.drawImage(VIGN, 0, 0);
  // grain argentique
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .06;
  const gi = GRAIN[(t_unclamped * 24 | 0) % GRAIN.length], ox = (t_unclamped * 977 % 256) | 0, oy = (t_unclamped * 613 % 256) | 0;
  for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) ctx.drawImage(gi, x, y);
  ctx.restore();
  // fondu d'ouverture
  const fb = 1 - eout3(seg(t, 0, 1.0));
  if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
  // bandes cinéma
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, BAR); ctx.fillRect(0, H - BAR, W, BAR);
}

function drawFooterLogos(t) {
  const p = seg(t, 9.4, 10.4);
  if (p <= 0 || !SAFRAN) return;

  const op = eout3(p);
  const yOffset = lerp(15, 0, eoutExpo(p));
  
  const sw = 150;
  const sh = sw * (SAFRAN.height / SAFRAN.width);
  const spacing = 50; 
  // Centré verticalement dans la bande noire du bas
  const yBase = H - (BAR / 2) - (sh / 2);

  ctx.save();
  ctx.globalAlpha = op;
  if (p < 1) ctx.filter = `blur(${(1 - op) * 6}px)`;

  // Safran (gauche)
  ctx.drawImage(SAFRAN, CX - spacing - sw, yBase + yOffset, sw, sh);
  // MCO (droite - en attente, on utilise Safran)
  ctx.drawImage(SAFRAN, CX + spacing, yBase + yOffset, sw, sh);

  // Séparateur
  ctx.fillStyle = `rgba(150,180,220,${op * 0.35})`;
  ctx.fillRect(CX - 0.5, yBase + yOffset - 5, 1, sh + 10);
  ctx.restore();

  // Éclat stylisé (balayage optique)
  const sweep = seg(t, 9.7, 10.7);
  if (sweep > 0 && sweep < 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.sin(sweep * PI) * 0.6;
    const scanX = lerp(CX - spacing - sw - 40, CX + spacing + sw + 40, eio3(sweep));
    const gr = ctx.createLinearGradient(scanX - 50, 0, scanX + 50, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(180,220,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(scanX - 50, yBase - 15, 100, sh + 30);
    ctx.restore();
  }
}

function render(t_unclamped) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (t_unclamped < 0) { ctx.fillRect(0, 0, W, H); return; }

  const t = Math.min(t_unclamped, 11);

  // caméra : roulis lent + secousses
  let sh_cam = 0;
  if (t > TL.impact) sh_cam = 18 * Math.pow(1 - seg(t, TL.impact, TL.impact + .8), 2);
  else if (t > TL.burst) sh_cam = 6 * Math.pow(1 - seg(t, TL.burst, TL.burst + .3), 2);
  const sx = (Math.sin(t * 91.7) + .5 * Math.sin(t * 53.1)) * sh_cam, sy = (Math.cos(t * 77.3) + .5 * Math.sin(t * 41.9)) * sh_cam;
  const roll = lerp(.035, 0, eio3(seg(t, 0, 5.3)));
  ctx.translate(CX + sx, CY + sy); ctx.rotate(roll); ctx.translate(-CX, -CY);

  drawBackground(t);
  drawStars(t_unclamped);
  if (t < 5.4) drawSaturnShot(t);
  if (t >= TL.burst - .05 && t < TL.impact + .3) drawParticles(t);
  if (t >= 5.3) drawLogoShot(t, t_unclamped);
  drawTitle(t);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawFlash(t);
  drawGrade(t, t_unclamped);
  drawFooterLogos(t);
}

/* =====================================================================
 *  BANDE-SON (synthèse WebAudio)
 * ===================================================================== */
function makeAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ac = new AC();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = .003; comp.release.value = .25;
  const master = ac.createGain();
  master.connect(comp); comp.connect(ac.destination);
  const recDest = ac.createMediaStreamDestination(); comp.connect(recDest);

  const mkBuf = (dur, fn) => {
    const len = ac.sampleRate * dur | 0, b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = fn(i, len); }
    return b;
  };
  const verb = ac.createConvolver();
  verb.buffer = mkBuf(4, (i, n) => (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6));
  const vret = ac.createGain(); vret.gain.value = .55; verb.connect(vret); vret.connect(master);
  const noise = mkBuf(3, () => Math.random() * 2 - 1);

  function schedule(T) {
    master.gain.cancelScheduledValues(0);
    master.gain.setValueAtTime(.85, T); master.gain.setValueAtTime(.85, T + 10.2); master.gain.linearRampToValueAtTime(0, T + 11.8);

    const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, T); return o; };
    const gain = (v = 0) => { const g = ac.createGain(); g.gain.setValueAtTime(v, T); return g; };
    const filt = (type, f, q = 1) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(f, T); b.Q.value = q; return b; };
    const send = (node, dry = 1, wet = .4) => {
      if (dry) { const g = ac.createGain(); g.gain.value = dry; node.connect(g); g.connect(master); }
      if (wet) { const g = ac.createGain(); g.gain.value = wet; node.connect(g); g.connect(verb); }
    };
    const ns = (t0, dur) => { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(T + t0); s.stop(T + t0 + dur); return s; };

    // BRAAMs (cuivres graves)
    const braam = (t0, root, dur, vol) => {
      const f = filt('lowpass', 120, 3);
      f.frequency.setValueAtTime(120, T + t0); f.frequency.exponentialRampToValueAtTime(1100, T + t0 + .35); f.frequency.exponentialRampToValueAtTime(150, T + t0 + dur);
      const g = gain(0); g.gain.setValueAtTime(0, T + t0); g.gain.linearRampToValueAtTime(vol, T + t0 + .08); g.gain.exponentialRampToValueAtTime(.001, T + t0 + dur);
      f.connect(g); send(g, 1, .5);
      [[1, 'sawtooth', .35], [1.006, 'sawtooth', .35], [2, 'sawtooth', .25], [2.997, 'sawtooth', .18], [.5, 'sine', .9]].forEach(([m, ty, v]) => {
        const o = osc(ty, root * m), og = ac.createGain(); og.gain.value = v; o.connect(og); og.connect(f); o.start(T + t0); o.stop(T + t0 + dur + .1);
      });
    };
    braam(.25, 43.65, 3.2, .4);
    braam(2.7, 49, 2.4, .32);

    // nappe grave montante
    {
      const f = filt('lowpass', 150, 1.5); f.frequency.exponentialRampToValueAtTime(900, T + 5.45);
      const g = gain(0); g.gain.linearRampToValueAtTime(.16, T + 1.5); g.gain.linearRampToValueAtTime(.26, T + 5.3); g.gain.linearRampToValueAtTime(0, T + 5.5);
      f.connect(g); send(g, 1, .2);
      [[55, 'sawtooth', .3], [55.4, 'sawtooth', .3], [82.4, 'sawtooth', .15], [27.5, 'sine', .8]].forEach(([fr, ty, v]) => {
        const o = osc(ty, fr), og = ac.createGain(); og.gain.value = v; o.connect(og); og.connect(f); o.start(T); o.stop(T + 5.6);
      });
    }
    // riser (souffle + ton montant) avec coupure avant l'impact
    {
      const s = ns(3.2, 2.35), bp = filt('bandpass', 300, 1.8);
      bp.frequency.setValueAtTime(300, T + 3.2); bp.frequency.exponentialRampToValueAtTime(8000, T + 5.5);
      const g = gain(0); g.gain.setValueAtTime(0, T + 3.2); g.gain.linearRampToValueAtTime(.5, T + 5.5); g.gain.linearRampToValueAtTime(0, T + 5.54);
      s.connect(bp); bp.connect(g); send(g, 1, .3);
      const o = osc('sawtooth', 90); o.frequency.setValueAtTime(90, T + 3.2); o.frequency.exponentialRampToValueAtTime(720, T + 5.5);
      const lp = filt('lowpass', 1800), og = gain(0);
      og.gain.setValueAtTime(0, T + 3.2); og.gain.linearRampToValueAtTime(.07, T + 5.5); og.gain.linearRampToValueAtTime(0, T + 5.54);
      o.connect(lp); lp.connect(og); send(og, 1, .3); o.start(T + 3.2); o.stop(T + 5.6);
    }
    // désintégration de Calypso
    {
      const s = ns(TL.burst, .9), bp = filt('bandpass', 2500, 1.2);
      bp.frequency.setValueAtTime(3000, T + TL.burst); bp.frequency.exponentialRampToValueAtTime(500, T + TL.burst + .7);
      const g = gain(0); g.gain.setValueAtTime(.3, T + TL.burst); g.gain.exponentialRampToValueAtTime(.001, T + TL.burst + .8);
      s.connect(bp); bp.connect(g); send(g, 1, .6);
    }
    // IMPACT
    const I = TL.impact;
    {
      const o = osc('sine', 120); o.frequency.setValueAtTime(120, T + I); o.frequency.exponentialRampToValueAtTime(28, T + I + 1.6);
      const g = gain(0); g.gain.setValueAtTime(1.1, T + I); g.gain.exponentialRampToValueAtTime(.001, T + I + 3);
      o.connect(g); send(g, 1, .25); o.start(T + I); o.stop(T + I + 3.2);

      const s = ns(I, 2), lp = filt('lowpass', 6000, .7);
      lp.frequency.setValueAtTime(6000, T + I); lp.frequency.exponentialRampToValueAtTime(200, T + I + 1.5);
      const ng = gain(0); ng.gain.setValueAtTime(.9, T + I); ng.gain.exponentialRampToValueAtTime(.001, T + I + 1.8);
      s.connect(lp); lp.connect(ng); send(ng, 1, .8);

      [146.8, 220, 293.7, 440.5, 587.3, 881, 1174.7].forEach(fr => {
        const m = osc('triangle', fr), mg = gain(0);
        mg.gain.setValueAtTime(.05, T + I); mg.gain.exponentialRampToValueAtTime(.0005, T + I + 4.5);
        m.connect(mg); send(mg, .4, 1); m.start(T + I); m.stop(T + I + 4.6);
      });
    }
    // nappe héroïque (Ré mineur add9)
    {
      const lp = filt('lowpass', 700, .7), g = gain(0);
      g.gain.setValueAtTime(0, T + 5.75); g.gain.linearRampToValueAtTime(.035, T + 7.2); g.gain.setValueAtTime(.035, T + 10); g.gain.linearRampToValueAtTime(0, T + 11.8);
      lp.frequency.setValueAtTime(500, T + 5.75); lp.frequency.linearRampToValueAtTime(1400, T + 9.5);
      lp.connect(g); send(g, 1, .6);
      [73.42, 110, 146.83, 174.61, 220, 329.63, 440].forEach(fr => [-1, 1].forEach(dt => {
        const o = osc('sawtooth', fr * Math.pow(2, dt * 4 / 1200)); o.connect(lp); o.start(T + 5.7); o.stop(T + 12);
      }));
    }
    // whoosh montée du logo
    {
      const s = ns(7, 1.3), bp = filt('bandpass', 250, 1.5);
      bp.frequency.setValueAtTime(250, T + 7); bp.frequency.exponentialRampToValueAtTime(2200, T + 7.9);
      const g = gain(0); g.gain.setValueAtTime(0, T + 7); g.gain.linearRampToValueAtTime(.22, T + 7.7); g.gain.linearRampToValueAtTime(0, T + 8.25);
      s.connect(bp); bp.connect(g); send(g, 1, .4);
      const o = osc('sine', 70); o.frequency.setValueAtTime(70, T + 7.7); o.frequency.exponentialRampToValueAtTime(38, T + 9);
      const og = gain(0); og.gain.setValueAtTime(.5, T + 7.7); og.gain.exponentialRampToValueAtTime(.001, T + 9.2);
      o.connect(og); send(og, 1, .3); o.start(T + 7.7); o.stop(T + 9.3);
    }
    // carillons des lettres
    const notes = [1760, 1568, 1318.5, 1174.7, 1318.5, 1568, 1760];
    notes.forEach((fr, i) => {
      const st = T + TL.text0 + Math.abs(i - 3) * .09;
      [[fr, .045], [fr * 2, .012]].forEach(([f, v]) => {
        const o = osc('sine', f), g = gain(0);
        g.gain.setValueAtTime(v, st); g.gain.exponentialRampToValueAtTime(.0005, st + 2);
        o.connect(g); send(g, .5, 1); o.start(st); o.stop(st + 2.1);
      });
    });
    // scintillement final
    [[2637, .035], [3951, .02]].forEach(([f, v]) => {
      const st = T + 9.45, o = osc('sine', f), g = gain(0);
      g.gain.setValueAtTime(v, st); g.gain.exponentialRampToValueAtTime(.0005, st + 1.8);
      o.connect(g); send(g, .4, 1); o.start(st); o.stop(st + 1.9);
    });
  }
  return { ac, recDest, schedule };
}

/* =====================================================================
 *  LECTURE / EXPORT
 * ===================================================================== */
const $ = id => document.getElementById(id);
let t0 = null, audio = null, playing = false;

function loop(now) {
  const t = t0 === null ? -1 : (now - t0) / 1000;
  render(t);
  $('replay').classList.toggle('show', t > CFG.duration + .8 && !recording);
  requestAnimationFrame(loop);
}

let recording = false;
function startRecording(lead) {
  const vs = cv.captureStream(60);
  const tracks = [...vs.getVideoTracks()];
  if (audio) tracks.push(...audio.recDest.stream.getAudioTracks());
  const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  const type = types.find(x => window.MediaRecorder && MediaRecorder.isTypeSupported(x));
  if (!type) { alert("L'export vidéo n'est pas supporté par ce navigateur (utilisez Chrome ou Edge)."); return; }
  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: type, videoBitsPerSecond: 20e6, audioBitsPerSecond: 192e3 });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    recording = false; $('recdot').classList.remove('show');
    const blob = new Blob(chunks, { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `calypso_intro.${type.includes('mp4') ? 'mp4' : 'webm'}`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  recording = true; $('recdot').classList.add('show');
  rec.start();
  setTimeout(() => rec.stop(), (lead + CFG.duration + 1.2) * 1000);
}

async function start(record = false) {
  if (recording) return;
  $('overlay').classList.add('hidden');
  document.body.classList.add('playing');
  if (!record && !document.fullscreenElement) { try { await document.documentElement.requestFullscreen(); } catch (e) { /* ignoré */ } }
  if (!audio) audio = makeAudio();
  const lead = .25;
  if (audio) { await audio.ac.resume(); audio.schedule(audio.ac.currentTime + lead); }
  t0 = performance.now() + lead * 1000;
  playing = true;
  if (record) startRecording(lead);
}

$('play').onclick = () => start(false);
$('rec').onclick = () => start(true);
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter' || k === 'r') { e.preventDefault(); start(false); }
  if (k === 'f') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
});
cv.addEventListener('click', () => { if (playing && (performance.now() - t0) / 1000 > CFG.duration) start(false); });

let SAFRAN;
/* ---------------- Initialisation ---------------- */
(async () => {
  LOGO = new Image();
  LOGO.src = window.CALYPSO_LOGO;
  SAFRAN = new Image();
  SAFRAN.src = window.SAFRAN_LOGO;
  try { await Promise.all([LOGO.decode(), SAFRAN.decode()]); } catch (e) { /* ignore */ }
  try { await Promise.all([document.fonts.load("700 126px Orbitron"), document.fonts.load("500 27px Rajdhani")]); } catch (e) { /* polices de secours */ }
  buildBackground(); buildSaturn(); buildMoon(); buildLogo(); buildMisc();
  $('play').disabled = false; $('rec').disabled = false;
  // aperçu possible via ?t=6.2 (fige l'image à un instant donné)
  const q = new URLSearchParams(location.search).get('t');
  if (q !== null) { $('overlay').classList.add('hidden'); t0 = performance.now() - parseFloat(q) * 1000; render(parseFloat(q)); window.__freeze = parseFloat(q); }
  window.__render = render;
  requestAnimationFrame(window.__freeze !== undefined ? () => {} : loop);
})();
})();
