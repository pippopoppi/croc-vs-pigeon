/* Coccodrillo vs Piccione — a 30-second one-button arcade game. Pippo Poppi Games. MIT licence. */
(() => {
'use strict';

// Everything is simulated and drawn on a 200x360 pixel canvas, then scaled up with
// smoothing off, which is what gives the chunky pixel-art look.
const W = 200, H = 360, SCALE = 2;
const GROUND = 302;            // where the crocodile stands
const CROC_X = 100;
const ROUND = 30;              // seconds per game
const SAVE_KEY = 'crocvspigeon.v1';
const SITE_URL = (location.origin + location.pathname).replace(/index\.html$/, '');
const TAU = 6.2832;
const G_ACC = 900;

const PIGEONS = {
  normal:  { score: 100,  r: 7,  speed: 1.0, hp: 1, color: '#9aa4ad', dark: '#6b7680' },
  maranza: { score: 150,  r: 7,  speed: 1.2, hp: 1, color: '#8d96a0', dark: '#5f6973', erratic: true, dodges: true },
  bomber:  { score: 100,  r: 8,  speed: 0.8, hp: 1, color: '#a8b0b8', dark: '#707a84', bombs: true },
  golden:  { score: 1000, r: 7,  speed: 2.3, hp: 1, color: '#f6c445', dark: '#b8860b', golden: true },
  boss:    { score: 500,  r: 20, speed: 0.4, hp: 3, color: '#7d8791', dark: '#4d565f', boss: true, bombs: true },
};

// ---------- save ----------
function loadSave() {
  const d = { best: 0, bestEaten: 0, games: 0, sound: true };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(d, s); } catch (e) { /* no storage */ }
  return d;
}
const save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// ---------- helpers ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- audio ----------
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* none */ } } return AC; }
function tone(freq, dur, type, vol, slide, when) {
  if (!save.sound || !ac()) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + (when || 0);
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol || 0.05, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) { /* ignore */ }
}
function noise(dur, vol) {
  if (!save.sound || !ac()) return;
  try {
    const n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = buf; g.gain.value = vol || 0.08;
    s.connect(g); g.connect(AC.destination); s.start();
  } catch (e) { /* ignore */ }
}
function sfxChomp() { noise(0.12, 0.12); tone(180, 0.12, 'square', 0.06, 60); }
function sfxSplat() { noise(0.2, 0.08); tone(120, 0.25, 'sawtooth', 0.07, 40); }
function sfxCoo() { tone(520, 0.08, 'triangle', 0.025, 420); tone(480, 0.08, 'triangle', 0.02, 380, 0.09); }
function sfxGold() { [880, 1108, 1318, 1760].forEach((f, i) => tone(f, 0.12, 'triangle', 0.05, null, i * 0.07)); }
function sfxItalian() {
  // A deliberately wobbly tarantella fragment, detuned for maximum brainrot.
  const notes = [659, 659, 659, 587, 523, 587, 659, 784, 659, 523, 587, 659, 587, 523, 494, 523];
  notes.forEach((f, i) => { tone(f * (1 + (Math.random() - 0.5) * 0.06), 0.11, 'square', 0.045, null, i * 0.095); tone(f / 2, 0.1, 'triangle', 0.03, null, i * 0.095); });
}
function sfxTick() { tone(1200, 0.04, 'square', 0.03); }
function sfxBoss() { tone(90, 0.5, 'sawtooth', 0.08, 50); tone(70, 0.5, 'sawtooth', 0.06, 40, 0.3); }

// ---------- state ----------
const G = {
  state: 'title', t: 0, left: ROUND, score: 0, eaten: 0, combo: 0, best: 0, hearts: 3,
  croc: { y: GROUND, vy: 0, air: false, charge: 0, charging: false, mouth: 0, bite: 0, hurt: 0, ate: 0 },
  birds: [], poops: [], parts: [], floats: [], spawnT: 1.2, bossT: 14, bossDone: 0, shake: 0, flash: 0, lastTick: 31, inferno: false, msg: null, msgT: 0,
  clouds: Array.from({ length: 5 }, (_, i) => ({ x: i * 50 + rnd(0, 30), y: 20 + rnd(0, 50), w: 18 + rnd(0, 18) })),
};

function startGame() {
  G.state = 'play'; G.t = 0; G.left = ROUND; G.score = 0; G.eaten = 0; G.combo = 0; G.hearts = 3;
  G.croc = { y: GROUND, vy: 0, air: false, charge: 0, charging: false, mouth: 0, bite: 0, hurt: 0, ate: 0 };
  G.birds = []; G.poops = []; G.parts = []; G.floats = []; G.spawnT = 0.6; G.bossT = 14; G.bossDone = 0; G.shake = 0; G.flash = 0; G.lastTick = 31; G.inferno = false; G.msg = null;
  save.games++; persist();
  showScreen(null);
}

function spawnBird(type) {
  const P = PIGEONS[type];
  const fromLeft = Math.random() < 0.5;
  const diff = G.t / ROUND;
  const base = 38 + diff * 34 + (G.inferno ? 18 : 0);
  const b = { type, x: fromLeft ? -20 : W + 20, dir: fromLeft ? 1 : -1, y: P.boss ? 120 : rnd(90, 240), baseY: 0, r: P.r, hp: P.hp, maxHp: P.hp,
    speed: base * P.speed * rnd(0.85, 1.15), ph: Math.random() * TAU, bombT: rnd(0.4, 1.2), dodgeT: 0, dead: false, hit: 0 };
  b.baseY = b.y;
  G.birds.push(b);
  if (P.boss) { G.msg = 'IL BOSS!'; G.msgT = 1.5; sfxBoss(); G.shake = 0.6; }
  else if (P.golden) { G.msg = 'PICCIONE D’ORO!'; G.msgT = 1.2; sfxGold(); }
}
function pickType() {
  const r = Math.random(), late = G.t > ROUND * 0.4;
  if (r < 0.03) return 'golden';
  if (r < (late ? 0.28 : 0.14)) return 'maranza';
  if (r < (late ? 0.5 : 0.3)) return 'bomber';
  return 'normal';
}

function release() {
  const c = G.croc;
  if (!c.charging) return;
  c.charging = false;
  const v = 230 + c.charge * 430;
  c.vy = -v; c.air = true; c.mouth = 1; c.bite = 0; c.ate = 0;
  tone(300 + c.charge * 400, 0.1, 'square', 0.04, 150);
}

function eat(b) {
  const P = PIGEONS[b.type];
  b.hp -= 1; b.hit = 0.15;
  const c = G.croc;
  if (b.hp > 0) { tone(240, 0.1, 'square', 0.05, 120); G.shake = 0.3; c.vy = Math.min(c.vy, -120); return; }
  b.dead = true; G.eaten++; c.ate++;
  G.combo++;
  const mult = Math.min(5, 1 + Math.floor(G.combo / 5));
  const pts = P.golden ? P.score : P.score * mult;
  G.score += pts;
  G.floats.push({ x: b.x, y: b.y - 10, text: '+' + pts, life: 0.9, color: P.golden ? '#ffd84a' : '#fff' });
  for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, v = 30 + Math.random() * 70; G.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.4 + Math.random() * 0.4, color: i % 3 === 0 ? '#fff' : P.color }); }
  sfxChomp();
  if (P.boss) { G.hearts = Math.min(3, G.hearts + 1); G.msg = 'BOSS MANGIATO! +♥'; G.msgT = 1.5; G.shake = 0.8; G.bossDone++; }
  if (G.combo === 5) { G.msg = 'ITALIAN COMBO!'; G.msgT = 1.6; sfxItalian(); G.flash = 0.4; }
  else if (G.combo > 5 && G.combo % 5 === 0) { G.msg = '×' + mult + ' COMBO!'; G.msgT = 1; tone(660, 0.12, 'triangle', 0.05, 990); }
  c.vy = Math.min(c.vy, -60); // a little bounce to chain bites
}

function hurt() {
  const c = G.croc;
  if (c.hurt > 0) return;
  c.hurt = 1; G.hearts--; G.combo = 0; G.shake = 0.8; G.flash = 0.5;
  sfxSplat();
  G.floats.push({ x: CROC_X, y: c.y - 20, text: 'CACCA!', life: 0.9, color: '#ffb0b0' });
}

// ---------- simulation ----------
function update(dt) {
  G.t += dt; G.left -= dt;
  G.shake = Math.max(0, G.shake - dt * 3); G.flash = Math.max(0, G.flash - dt * 2);
  if (G.msgT > 0) { G.msgT -= dt; if (G.msgT <= 0) G.msg = null; }
  for (const cl of G.clouds) { cl.x += 3 * dt; if (cl.x > W + 30) cl.x = -40; }
  if (!G.inferno && G.left <= 10) { G.inferno = true; G.msg = 'ULTIMI 10 SECONDI: INFERNO!'; G.msgT = 1.6; tone(200, 0.4, 'sawtooth', 0.07, 400); }
  if (G.left <= 10 && Math.ceil(G.left) < G.lastTick) { G.lastTick = Math.ceil(G.left); sfxTick(); }

  // croc
  const c = G.croc;
  if (c.hurt > 0) c.hurt -= dt;
  if (c.charging && !c.air) c.charge = Math.min(1, c.charge + dt / 0.8);
  if (c.air) {
    c.vy += G_ACC * dt; c.y += c.vy * dt;
    if (c.vy > 0) c.mouth = Math.max(0, c.mouth - dt * 2.2);
    if (c.y >= GROUND) { c.y = GROUND; c.air = false; c.vy = 0; c.mouth = 0; c.charge = 0; if (c.ate === 0) G.combo = 0; noise(0.05, 0.03); if (c.charging) { /* held through the jump: start the next charge fresh */ c.charge = 0; } }
  }

  // spawns
  G.spawnT -= dt;
  if (G.spawnT <= 0) {
    spawnBird(pickType());
    const diff = G.t / ROUND;
    G.spawnT = (G.inferno ? 0.45 : 1.25 - diff * 0.6) * rnd(0.7, 1.3);
  }
  G.bossT -= dt;
  if (G.bossT <= 0 && !G.birds.some(b => b.type === 'boss')) { spawnBird('boss'); G.bossT = 12; }

  // birds
  const mouth = { x: CROC_X, y: c.y - 16, r: 15 };
  for (const b of G.birds) {
    if (b.dead) continue;
    const P = PIGEONS[b.type];
    if (b.hit > 0) b.hit -= dt;
    b.ph += dt * (P.golden ? 20 : 10);
    b.x += b.dir * b.speed * dt;
    if (P.erratic) b.y = b.baseY + Math.sin(b.ph * 0.6) * 22 + Math.sin(b.ph * 1.7) * 8;
    else if (!P.boss) b.y = b.baseY + Math.sin(b.ph * 0.5) * 3;
    else b.y = b.baseY + Math.sin(b.ph * 0.25) * 10;
    if (P.dodges && c.air && c.vy < 0 && Math.abs(b.x - CROC_X) < 40 && b.y > c.y - 90 && b.dodgeT <= 0) { b.baseY -= 28; b.dodgeT = 1.5; sfxCoo(); }
    if (b.dodgeT > 0) b.dodgeT -= dt;
    if (P.bombs) {
      b.bombT -= dt;
      if (b.bombT <= 0) { b.bombT = P.boss ? rnd(0.35, 0.6) : rnd(0.9, 1.6); if (Math.abs(b.x - CROC_X) < (P.boss ? 70 : 34) || P.boss) { G.poops.push({ x: b.x + rnd(-4, 4), y: b.y + b.r, vy: 40, dead: false }); if (Math.random() < 0.5) sfxCoo(); } }
    }
    if ((b.dir > 0 && b.x > W + 24) || (b.dir < 0 && b.x < -24)) { b.dead = true; continue; }
    // bite check: mouth open, croc airborne
    if (c.air && c.mouth > 0.2) {
      const dx = b.x - mouth.x, dy = b.y - mouth.y;
      if (dx * dx + dy * dy < (b.r + mouth.r) ** 2) eat(b);
    }
  }
  // poops
  for (const p of G.poops) {
    if (p.dead) continue;
    p.vy += 220 * dt; p.y += p.vy * dt;
    if (p.y > GROUND + 30) { p.dead = true; for (let i = 0; i < 4; i++) G.parts.push({ x: p.x, y: GROUND + 30, vx: rnd(-30, 30), vy: rnd(-40, -10), life: 0.3, color: '#f3f0e6' }); continue; }
    const bx = CROC_X, by = c.y + 6;
    if (Math.abs(p.x - bx) < 20 && p.y > by - 22 && p.y < by + 24) { p.dead = true; hurt(); }
  }
  G.birds = G.birds.filter(b => !b.dead); G.poops = G.poops.filter(p => !p.dead);
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life -= dt; if (p.life <= 0) { G.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; }
  for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.life -= dt; f.y -= 25 * dt; if (f.life <= 0) G.floats.splice(i, 1); }

  if (G.hearts <= 0 || G.left <= 0) endGame();
}

function endGame() {
  G.state = 'over'; G.left = Math.max(0, G.left);
  const newBest = G.score > save.best;
  save.best = Math.max(save.best, G.score); save.bestEaten = Math.max(save.bestEaten, G.eaten); persist();
  tone(newBest ? 660 : 160, 0.5, newBest ? 'triangle' : 'sawtooth', 0.07, newBest ? 990 : 60);
  showEnd(newBest);
}

// ---------- rendering (pixel canvas) ----------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const px = document.createElement('canvas'); px.width = W; px.height = H;
const p = px.getContext('2d');
const wrap = document.getElementById('wrap');
let scale = 1;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  scale = Math.min(window.innerWidth / (W * SCALE), window.innerHeight / (H * SCALE));
  const cw = Math.round(W * SCALE * scale), ch = Math.round(H * SCALE * scale);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
}
window.addEventListener('resize', resize); resize();

const R = (x, y, w, h, col) => { p.fillStyle = col; p.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function drawRome(t) {
  // sky
  const sky = p.createLinearGradient(0, 0, 0, GROUND); sky.addColorStop(0, '#79c8f3'); sky.addColorStop(1, '#d9ecf7');
  p.fillStyle = sky; p.fillRect(0, 0, W, H);
  if (G.inferno) { p.fillStyle = 'rgba(255,90,40,' + (0.12 + Math.sin(t * 8) * 0.06) + ')'; p.fillRect(0, 0, W, H); }
  // sun
  R(158, 28, 14, 14, '#ffe28a'); R(160, 26, 10, 18, '#ffe28a'); R(156, 30, 18, 10, '#ffe28a');
  for (const cl of G.clouds) { R(cl.x, cl.y, cl.w, 6, '#fff'); R(cl.x + 4, cl.y - 4, cl.w - 8, 4, '#fff'); }
  // far skyline
  p.fillStyle = '#9fb3c9';
  for (let i = 0; i < 9; i++) { const bw = 14 + (i * 7) % 12, bh = 24 + (i * 13) % 30; p.fillRect(i * 23, 252 - bh, bw, bh); }
  // dome (St Peter's-like)
  R(22, 228, 36, 24, '#8a9db3'); p.fillStyle = '#8a9db3'; p.beginPath(); p.arc(40, 230, 18, Math.PI, 0); p.fill(); R(38, 204, 4, 10, '#8a9db3'); R(36, 203, 8, 3, '#8a9db3');
  // Colosseum
  R(112, 214, 80, 38, '#c9b58e'); R(112, 214, 80, 3, '#a89570');
  p.fillStyle = '#8f7a56';
  for (let row = 0; row < 3; row++) for (let i = 0; i < 8; i++) { p.fillRect(115 + i * 10, 218 + row * 12, 6, 8); }
  R(112, 232, 80, 2, '#a89570'); R(112, 244, 80, 2, '#a89570'); R(176, 206, 16, 10, '#c9b58e');
  // umbrella pines
  for (const x of [6, 96, 196]) { R(x - 1, 236, 3, 18, '#5a3d24'); R(x - 10, 230, 20, 7, '#3f7a3c'); R(x - 7, 226, 14, 5, '#4f8f48'); }
  // ground: cobbles
  R(0, 252, W, H - 252, '#5d708d');
  R(0, 252, W, 3, '#4a5b75');
  p.fillStyle = '#6a7d9a';
  for (let y = 258; y < H; y += 8) for (let x = ((y / 8) % 2) * 4; x < W; x += 8) p.fillRect(x, y, 6, 5);
  // sampietrini walkway line
  R(0, GROUND + 30, W, 2, '#4a5b75');
}

function drawCroc(t) {
  const c = G.croc, y = c.y, x = CROC_X;
  if (c.hurt > 0 && Math.floor(t * 20) % 2 === 0) return;
  const squat = !c.air && c.charging ? Math.round(c.charge * 5) : 0;
  const body = '#398c40', dark = '#225a30', belly = '#a0d779';
  // tail
  R(x - 46, y + 10 + squat, 18, 6, dark); R(x - 54, y + 13 + squat, 10, 4, dark);
  // body
  R(x - 32, y + 4 + squat, 46, 18, body); R(x - 30, y + 16 + squat, 42, 6, belly);
  for (let i = 0; i < 5; i++) R(x - 28 + i * 9, y + squat, 4, 5, dark); // back scales
  // legs
  R(x - 24, y + 22, 7, 8 - squat, dark); R(x + 2, y + 22, 7, 8 - squat, dark);
  // head + jaws
  const open = Math.round(c.mouth * 14);
  R(x + 8, y - 2 + squat, 30, 12, body);                    // upper head
  R(x + 14, y - 6 + squat, 12, 6, body);                   // brow
  R(x + 18, y - 5 + squat, 4, 4, '#fff'); R(x + 20, y - 4 + squat, 2, 2, '#111'); // eye
  R(x + 8, y + 10 + squat + open, 32, 6, dark);             // lower jaw
  if (open > 2) {
    R(x + 10, y + 10 + squat, 28, open, '#c03a4a');         // mouth inside
    for (let i = 0; i < 5; i++) { R(x + 12 + i * 6, y + 10 + squat, 2, 3, '#fff'); R(x + 14 + i * 6, y + 7 + squat + open, 2, 3, '#fff'); }
  }
  R(x + 34, y + 2 + squat, 4, 3, '#1a3a1f');                // nostril
  // charge bar
  if (c.charging && !c.air) { R(x - 20, y - 14, 40, 5, '#1b2a36'); R(x - 19, y - 13, Math.round(38 * c.charge), 3, c.charge > 0.85 ? '#ff5e5e' : '#ffd84a'); }
}

function drawBird(b, t) {
  const P = PIGEONS[b.type], s = P.boss ? 2.6 : 1, x = b.x, y = b.y;
  const flap = Math.sin(b.ph) > 0;
  const col = b.hit > 0 ? '#fff' : P.color, dark = b.hit > 0 ? '#ddd' : P.dark;
  p.save(); p.translate(Math.round(x), Math.round(y)); p.scale(b.dir * s, s);
  // wings
  if (flap) { R(-6, -10, 10, 4, dark); R(-4, -13, 6, 3, dark); } else { R(-6, 2, 10, 4, dark); R(-4, 5, 6, 3, dark); }
  // body
  R(-8, -4, 14, 8, col); R(-10, -2, 4, 4, dark);              // tail
  R(4, -8, 7, 7, col);                                         // head
  R(8, -6, 2, 2, '#111');                                      // eye
  R(11, -5, 4, 2, '#e7ae58');                                  // beak
  R(-3, 4, 2, 3, '#e7ae58'); R(1, 4, 2, 3, '#e7ae58');         // feet
  if (P.erratic) { R(5, -7, 7, 3, '#111'); R(2, -4, 10, 1, '#f6c445'); }   // sunglasses + chain
  if (P.golden && Math.floor(t * 10) % 2 === 0) { R(-12, -12, 2, 2, '#fff'); R(10, 6, 2, 2, '#fff'); }
  if (P.boss) { R(4, -10, 3, 2, '#111'); R(7, -11, 3, 2, '#111'); }      // angry brow
  p.restore();
  if (P.boss) { R(x - 16, y - 36, 32, 3, '#1b2a36'); R(x - 15, y - 35, Math.round(30 * b.hp / b.maxHp), 1, '#ff5e5e'); }
}

function drawPoop(q) { R(q.x - 2, q.y - 3, 4, 5, '#f3f0e6'); R(q.x - 1, q.y - 4, 2, 2, '#f3f0e6'); R(q.x, q.y - 1, 2, 2, '#9c8b6e'); }

function text(str, x, y, col, size, align) {
  p.fillStyle = col; p.font = 'bold ' + (size || 8) + 'px monospace'; p.textAlign = align || 'left'; p.textBaseline = 'top'; p.fillText(str, Math.round(x), Math.round(y));
}

function draw() {
  const t = G.t;
  p.save();
  if (G.shake > 0) p.translate(Math.round((Math.random() - 0.5) * G.shake * 6), Math.round((Math.random() - 0.5) * G.shake * 6));
  drawRome(t);
  for (const q of G.poops) drawPoop(q);
  for (const b of G.birds) drawBird(b, t);
  drawCroc(t);
  for (const q of G.parts) { R(q.x, q.y, 2, 2, q.color); }
  for (const f of G.floats) { text(f.text, f.x, f.y, f.color, 8, 'center'); }
  p.restore();
  if (G.flash > 0) { p.fillStyle = 'rgba(255,255,255,' + G.flash * 0.4 + ')'; p.fillRect(0, 0, W, H); }
  // HUD
  R(0, 0, W, 14, 'rgba(0,0,0,0.55)');
  text('SCORE ' + String(G.score).padStart(5, '0'), 4, 3, '#fff', 8);
  for (let i = 0; i < 3; i++) text(i < G.hearts ? '♥' : '♡', 88 + i * 9, 2, i < G.hearts ? '#ff5e5e' : '#888', 9);
  const sec = Math.max(0, Math.ceil(G.left));
  text('00:' + String(sec).padStart(2, '0'), W - 4, 3, G.left <= 10 && Math.floor(t * 4) % 2 === 0 ? '#ff5e5e' : '#fff', 8, 'right');
  if (G.state === 'play') {
    const mult = Math.min(5, 1 + Math.floor(G.combo / 5));
    R(0, H - 14, W, 14, 'rgba(0,0,0,0.55)');
    text(G.croc.air ? 'CHOMP!' : G.croc.charging ? 'RELEASE TO BITE' : 'HOLD TO CHARGE', 4, H - 11, '#fff', 7);
    if (G.combo >= 2) text('×' + mult + ' COMBO (' + G.combo + ')', W - 4, H - 11, '#ffd84a', 7, 'right');
    if (G.msg) { R(0, 150, W, 16, 'rgba(0,0,0,0.6)'); text(G.msg, W / 2, 153, G.msg.includes('INFERNO') ? '#ff5e5e' : '#ffd84a', 9, 'center'); }
  }
  if (G.state === 'title') {
    R(0, 100, W, 60, 'rgba(0,0,0,0.6)');
    text('COCCODRILLO', W / 2, 106, '#a0d779', 14, 'center'); text('VS PICCIONE', W / 2, 122, '#fff', 14, 'center');
    text('TAP TO START', W / 2, 146, Math.floor(t * 2) % 2 === 0 ? '#ffd84a' : '#fff', 8, 'center');
  }
  // present: scale up with crisp pixels
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(px, 0, 0, W, H, 0, 0, canvas.width, canvas.height);
}

// ---------- input: one button ----------
function pressStart() {
  ac();
  if (G.state === 'title') { startGame(); return; }
  if (G.state !== 'play') return;
  const c = G.croc;
  if (!c.air) { c.charging = true; c.charge = 0; }
}
function pressEnd() { if (G.state === 'play') release(); }
canvas.addEventListener('pointerdown', e => { e.preventDefault(); pressStart(); try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
canvas.addEventListener('pointerup', pressEnd);
canvas.addEventListener('pointercancel', pressEnd);
window.addEventListener('keydown', e => { if ((e.code === 'Space' || e.key === ' ') && !e.repeat) { e.preventDefault(); pressStart(); } });
window.addEventListener('keyup', e => { if (e.code === 'Space' || e.key === ' ') pressEnd(); });

// ---------- screens ----------
const $ = id => document.getElementById(id);
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id)); }
function challengeText() {
  return 'Ho mangiato ' + G.eaten + ' piccioni e fatto ' + G.score.toLocaleString() + ' punti in Coccodrillo vs Piccione 🐊🐦 Battimi: ' + SITE_URL + ' #CoccodrilloVsPiccione #PippoPoppiGames';
}
function showEnd(newBest) {
  $('end-title').textContent = G.hearts > 0 ? (G.eaten >= 25 ? 'APEX PREDATOR. 🐊' : 'TIME’S UP. 🐦') : 'YOU GOT PIGEONED. 🐦';
  $('end-score').textContent = G.score.toLocaleString();
  $('end-eaten').textContent = G.eaten;
  $('end-best').textContent = (newBest ? 'NEW RECORD! ' : 'Record: ' + save.best.toLocaleString() + ' · ') + 'Partite: ' + save.games;
  $('end-tag').textContent = G.hearts > 0 ? (G.eaten >= 25 ? 'Roma è tua. I piccioni lo sanno.' : 'Non male. I piccioni ridono comunque.') : 'You are not the apex predator. You are the lunch.';
  $('btn-share').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(challengeText().replace(SITE_URL, '')) + '&url=' + encodeURIComponent(SITE_URL);
  $('btn-copy').textContent = 'COPY X CHALLENGE';
  showScreen('end');
}
$('btn-copy').addEventListener('click', async () => {
  const txt = challengeText();
  try { await navigator.clipboard.writeText(txt); $('btn-copy').textContent = 'COPIED! ✓'; }
  catch (e) { prompt('Copy this:', txt); }
});
$('btn-again').addEventListener('click', () => { ac(); startGame(); });
$('btn-sound').addEventListener('click', () => { save.sound = !save.sound; persist(); $('btn-sound').textContent = save.sound ? '🔊 Sound on' : '🔇 Sound off'; });
$('btn-sound').textContent = save.sound ? '🔊 Sound on' : '🔇 Sound off';

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  if (G.state === 'play') update(dt);
  else { G.t += dt; for (const cl of G.clouds) { cl.x += 3 * dt; if (cl.x > W + 30) cl.x = -40; } }
  draw();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { last = performance.now(); });
showScreen(null);
requestAnimationFrame(frame);

window.CrocVsPigeon = { G, save, startGame, update, draw, pressStart, pressEnd, PIGEONS, W, H, GROUND, CROC_X };
})();
