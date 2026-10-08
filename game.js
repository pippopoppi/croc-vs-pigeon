/* Coccodrillo vs Piccione — a one-button survival arcade game. Pippo Poppi Games. MIT licence. */
(() => {
'use strict';

// Everything is simulated and drawn on a 200x360 pixel canvas, then scaled up with
// smoothing off, which is what gives the chunky pixel-art look.
const W = 200, H = 360, SCALE = 2;
const GROUND = 302;            // where the crocodile stands
const CROC_X = 100;            // starting x
const CROC_S = 0.65;           // crocodile size
const CROC_MIN = 24, CROC_MAX = W - 24;
const RAMP = 60;               // seconds over which the difficulty climbs to full
const INFERNO_AT = 45;         // seconds after which the inferno never stops
const SAVE_KEY = 'crocvspigeon.v1';
// Shared ranking. Leave empty for a per-device ranking only; set it to the URL of the
// deployed Cloudflare Worker in server/ to enable the world ranking (see README).
const LEADERBOARD_URL = '';
const BOARD_SIZE = 10;         // rows shown
const BOARD_KEEP = 100;        // rows kept locally
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
  const d = { best: 0, bestEaten: 0, bestTime: 0, games: 0, sound: true, name: '', board: [] };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(d, s); } catch (e) { /* no storage */ }
  return d;
}
const save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// ---------- ranking ----------
// One row per nickname (case-insensitive). A new score for a known name only replaces the
// row when it is better, so you can reuse your name and keep your record.
function cleanName(v) { return String(v || '').replace(/[^\p{L}\p{N}\p{Emoji_Presentation} _.\-!?*]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12).toUpperCase(); }
function cmpRows(a, b) { return b.score - a.score || b.time - a.time || (a.at || 0) - (b.at || 0); }
function upsert(board, row) {
  const key = row.name.toLowerCase();
  const i = board.findIndex(e => e.name.toLowerCase() === key);
  let improved = false;
  if (i < 0) { board.push(row); improved = true; }
  else if (cmpRows(row, board[i]) < 0) { board[i] = row; improved = true; }
  board.sort(cmpRows); if (board.length > BOARD_KEEP) board.length = BOARD_KEEP;
  return { rank: board.findIndex(e => e.name.toLowerCase() === key) + 1, improved };
}
let worldBoard = null;          // last list fetched from the server, or null when offline / local-only
function renderBoard() {
  const list = document.getElementById('board'); if (!list) return;
  const rows = (worldBoard || save.board).slice(0, BOARD_SIZE);
  const me = cleanName(save.name).toLowerCase();
  list.innerHTML = rows.length ? '' : '<li class="empty">Nessun punteggio. Sii il primo!</li>';
  rows.forEach((r, i) => {
    const li = document.createElement('li'); if (r.name.toLowerCase() === me) li.className = 'me';
    const mk = (cls, txt) => { const d = document.createElement('span'); d.className = cls; d.textContent = txt; li.appendChild(d); };
    mk('pos', i + 1); mk('name', r.name); mk('pts', Number(r.score).toLocaleString()); mk('sub', fmtTime(r.time));
    list.appendChild(li);
  });
  const title = document.getElementById('board-title'), note = document.getElementById('board-note');
  if (title) title.textContent = worldBoard ? 'CLASSIFICA MONDIALE' : 'CLASSIFICA';
  if (note) note.textContent = worldBoard ? 'Top ' + BOARD_SIZE + ' di tutti i giocatori' : LEADERBOARD_URL ? 'Classifica mondiale non raggiungibile: mostro quella di questo dispositivo' : 'Su questo dispositivo';
}
async function fetchBoard() {
  if (!LEADERBOARD_URL || typeof fetch !== 'function') return;
  try { const r = await fetch(LEADERBOARD_URL + '?top=' + BOARD_SIZE, { cache: 'no-store' }); if (r.ok) { worldBoard = (await r.json()).top || []; renderBoard(); } } catch (e) { /* offline: keep local */ }
}
async function submitScore(row) {
  if (!LEADERBOARD_URL || typeof fetch !== 'function') return null;
  try {
    const r = await fetch(LEADERBOARD_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) });
    if (!r.ok) return null;
    const j = await r.json(); worldBoard = j.top || worldBoard; renderBoard(); return j;
  } catch (e) { return null; }
}

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
  state: 'title', t: 0, score: 0, eaten: 0, combo: 0, best: 0, hearts: 3,
  croc: { x: CROC_X, y: GROUND, vy: 0, air: false, charge: 0, charging: false, mouth: 0, bite: 0, hurt: 0, ate: 0 },
  birds: [], poops: [], parts: [], floats: [], spawnT: 1.2, bossT: 14, bossDone: 0, shake: 0, flash: 0, lastTick: 31, inferno: false, msg: null, msgT: 0,
  clouds: Array.from({ length: 5 }, (_, i) => ({ x: i * 50 + rnd(0, 30), y: 20 + rnd(0, 50), w: 18 + rnd(0, 18) })),
};

function startGame() {
  G.state = 'play'; G.t = 0; G.score = 0; G.eaten = 0; G.combo = 0; G.hearts = 3;
  G.croc = { x: CROC_X, y: GROUND, vy: 0, dir: 1, air: false, charge: 0, charging: false, mouth: 0, bite: 0, hurt: 0, ate: 0 };
  G.birds = []; G.poops = []; G.parts = []; G.floats = []; G.spawnT = 0.6; G.bossT = 14; G.bossDone = 0; G.shake = 0; G.flash = 0; G.lastTick = 31; G.inferno = false; G.msg = null;
  save.games++; persist();
  showScreen(null);
}

function spawnBird(type) {
  const P = PIGEONS[type];
  const fromLeft = Math.random() < 0.5;
  const diff = Math.min(1, G.t / RAMP);
  const base = 38 + diff * 34 + (G.inferno ? 18 : 0) + Math.min(30, Math.max(0, G.t - RAMP) * 0.25);
  const b = { type, x: fromLeft ? -20 : W + 20, dir: fromLeft ? 1 : -1, y: P.boss ? 120 : rnd(90, 240), baseY: 0, r: P.r, hp: P.hp, maxHp: P.hp,
    speed: base * P.speed * rnd(0.85, 1.15), ph: Math.random() * TAU, bombT: rnd(0.4, 1.2), dodgeT: 0, dead: false, hit: 0 };
  b.baseY = b.y;
  G.birds.push(b);
  if (P.boss) { G.msg = 'IL BOSS!'; G.msgT = 1.5; sfxBoss(); G.shake = 0.6; }
  else if (P.golden) { G.msg = 'PICCIONE D’ORO!'; G.msgT = 1.2; sfxGold(); }
}
function pickType() {
  const r = Math.random(), late = G.t > 20;
  if (r < 0.03) return 'golden';
  if (r < (late ? 0.28 : 0.14)) return 'maranza';
  if (r < (late ? 0.5 : 0.3)) return 'bomber';
  return 'normal';
}

function release() {
  const c = G.croc;
  if (!c.charging) return;
  c.charging = false;
  if (c.air) return;            // a finger lifted in mid-air: nothing to launch
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
  for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, v = 30 + Math.random() * 70; G.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.5 + Math.random() * 0.5, color: i % 3 === 0 ? '#fff' : P.color, feather: true, rot: Math.random() * TAU }); }
  sfxChomp();
  if (P.boss) { G.hearts++; G.msg = 'BOSS MANGIATO! +♥ (' + G.hearts + ')'; G.msgT = 1.5; G.shake = 0.8; G.bossDone++; }
  if (G.combo === 5) { G.msg = 'ITALIAN COMBO!'; G.msgT = 1.6; sfxItalian(); G.flash = 0.4; }
  else if (G.combo > 5 && G.combo % 5 === 0) { G.msg = '×' + mult + ' COMBO!'; G.msgT = 1; tone(660, 0.12, 'triangle', 0.05, 990); }
  c.vy = Math.min(c.vy, -60); // a little bounce to chain bites
}

function hurt() {
  const c = G.croc;
  if (c.hurt > 0) return;
  c.hurt = 1; G.hearts--; G.combo = 0; G.shake = 0.8; G.flash = 0.5;
  sfxSplat();
  G.floats.push({ x: c.x, y: c.y - 20, text: 'CACCA!', life: 0.9, color: '#ffb0b0' });
}

// ---------- simulation ----------
function update(dt) {
  G.t += dt;
  G.shake = Math.max(0, G.shake - dt * 3); G.flash = Math.max(0, G.flash - dt * 2);
  if (G.msgT > 0) { G.msgT -= dt; if (G.msgT <= 0) G.msg = null; }
  for (const cl of G.clouds) { cl.x += 3 * dt; if (cl.x > W + 30) cl.x = -40; }
  if (!G.inferno && G.t >= INFERNO_AT) { G.inferno = true; G.msg = 'INFERNO!'; G.msgT = 1.6; tone(200, 0.4, 'sawtooth', 0.07, 400); }
  if (G.t >= INFERNO_AT - 5 && G.t < INFERNO_AT && Math.floor(G.t) > G.lastTick) { G.lastTick = Math.floor(G.t); sfxTick(); }

  // croc
  const c = G.croc;
  if (c.hurt > 0) c.hurt -= dt;
  if (keys.left) moveCroc(c.x - 120 * dt);
  if (keys.right) moveCroc(c.x + 120 * dt);
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
    const diff = Math.min(1, G.t / RAMP);
    G.spawnT = (G.inferno ? Math.max(0.3, 0.5 - (G.t - INFERNO_AT) * 0.003) : 1.25 - diff * 0.6) * rnd(0.7, 1.3);
  }
  G.bossT -= dt;
  if (G.bossT <= 0 && !G.birds.some(b => b.type === 'boss')) { spawnBird('boss'); G.bossT = 12; }

  // birds
  const mouth = { x: c.x + 8 * c.dir, y: c.y - 10, r: 11 };
  for (const b of G.birds) {
    if (b.dead) continue;
    const P = PIGEONS[b.type];
    if (b.hit > 0) b.hit -= dt;
    b.ph += dt * (P.golden ? 20 : 10);
    b.x += b.dir * b.speed * dt;
    if (P.erratic) b.y = b.baseY + Math.sin(b.ph * 0.6) * 22 + Math.sin(b.ph * 1.7) * 8;
    else if (!P.boss) b.y = b.baseY + Math.sin(b.ph * 0.5) * 3;
    else b.y = b.baseY + Math.sin(b.ph * 0.25) * 10;
    if (P.dodges && c.air && c.vy < 0 && Math.abs(b.x - c.x) < 40 && b.y > c.y - 90 && b.dodgeT <= 0) { b.baseY -= 28; b.dodgeT = 1.5; sfxCoo(); }
    if (b.dodgeT > 0) b.dodgeT -= dt;
    if (P.bombs) {
      b.bombT -= dt;
      if (b.bombT <= 0) { b.bombT = P.boss ? rnd(0.35, 0.6) : rnd(0.9, 1.6); if (Math.abs(b.x - c.x) < (P.boss ? 70 : 30) || P.boss) { G.poops.push({ x: b.x + rnd(-4, 4), y: b.y + b.r, vy: 40, dead: false }); if (Math.random() < 0.5) sfxCoo(); } }
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
    const bx = c.x, by = c.y + 4;
    if (Math.abs(p.x - bx) < 14 && p.y > by - 14 && p.y < by + 16) { p.dead = true; hurt(); }
  }
  G.birds = G.birds.filter(b => !b.dead); G.poops = G.poops.filter(p => !p.dead);
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life -= dt; if (p.life <= 0) { G.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.feather ? 60 : 200) * dt; if (p.feather) p.vx *= 0.97; }
  for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.life -= dt; f.y -= 25 * dt; if (f.life <= 0) G.floats.splice(i, 1); }

  if (G.hearts <= 0) endGame();
}

function endGame() {
  G.state = 'over';
  const newBest = G.score > save.best;
  save.best = Math.max(save.best, G.score); save.bestEaten = Math.max(save.bestEaten, G.eaten); save.bestTime = Math.max(save.bestTime, G.t);
  const row = { name: cleanName(save.name) || 'ANONIMO', score: G.score, time: Math.floor(G.t), eaten: G.eaten, at: Date.now() };
  G.rank = upsert(save.board, row); G.worldRank = null; persist();
  tone(newBest ? 660 : 160, 0.5, newBest ? 'triangle' : 'sawtooth', 0.07, newBest ? 990 : 60);
  showEnd(newBest);
  submitScore(row).then(j => { if (j && G.state === 'over') { G.worldRank = j; showRank(); } });
}

// ---------- rendering (high-resolution vector art) ----------
// The simulation runs in a 200x360 logical space; everything is drawn with curves and
// gradients straight onto the device-resolution canvas, so nothing is ever upscaled.
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const p = ctx;
const wrap = document.getElementById('wrap');
let scale = 1, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  scale = Math.min(window.innerWidth / (W * SCALE), window.innerHeight / (H * SCALE));
  const cw = Math.round(W * SCALE * scale), ch = Math.round(H * SCALE * scale);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
}
window.addEventListener('resize', resize); resize();

const R = (x, y, w, h, col) => { p.fillStyle = col; p.fillRect(x, y, w, h); };
function rr(x, y, w, h, r, col) { p.fillStyle = col; p.beginPath(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); p.fill(); }
function ell(x, y, rx, ry, col) { p.fillStyle = col; p.beginPath(); p.ellipse(x, y, rx, ry, 0, 0, TAU); p.fill(); }
function text(str, x, y, col, size, align, outline) {
  p.font = '900 ' + (size || 8) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  p.textAlign = align || 'left'; p.textBaseline = 'top';
  if (outline) { p.lineJoin = 'round'; p.lineWidth = Math.max(1.2, size * 0.22); p.strokeStyle = outline; p.strokeText(str, x, y); }
  p.fillStyle = col; p.fillText(str, x, y);
}
function heart(x, y, s, col) {
  p.fillStyle = col; p.beginPath();
  p.moveTo(x, y + s * 0.9); p.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.7, y - s * 1.0, x, y - s * 0.3);
  p.bezierCurveTo(x + s * 0.7, y - s * 1.0, x + s * 1.3, y - s * 0.1, x, y + s * 0.9); p.fill();
}
function star(x, y, r, col) {
  p.fillStyle = col; p.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rad = i % 2 ? r * 0.4 : r; p.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  p.closePath(); p.fill();
}

const SKY_FAR = '#9bb4cf', SKY_MID = '#7f9ab8';
function drawRome(t) {
  const sky = p.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0, '#3f97d9'); sky.addColorStop(0.55, '#8fcbee'); sky.addColorStop(1, '#f6e3b8');
  p.fillStyle = sky; p.fillRect(0, 0, W, 262);
  if (G.inferno) { p.fillStyle = 'rgba(255,80,30,' + (0.14 + Math.sin(t * 8) * 0.06) + ')'; p.fillRect(0, 0, W, H); }
  // sun with glow
  const glow = p.createRadialGradient(164, 34, 4, 164, 34, 40); glow.addColorStop(0, 'rgba(255,240,170,0.9)'); glow.addColorStop(1, 'rgba(255,240,170,0)');
  p.fillStyle = glow; p.fillRect(114, -10, 100, 100); ell(164, 34, 11, 11, '#fff2b0');
  // clouds
  for (const cl of G.clouds) { const w = cl.w; p.fillStyle = 'rgba(255,255,255,0.95)'; p.beginPath(); p.ellipse(cl.x, cl.y, w * 0.55, 5, 0, 0, TAU); p.ellipse(cl.x - w * 0.25, cl.y - 2, w * 0.3, 5.5, 0, 0, TAU); p.ellipse(cl.x + w * 0.2, cl.y - 3, w * 0.34, 6.5, 0, 0, TAU); p.fill(); }
  // far skyline
  p.fillStyle = SKY_FAR;
  for (let i = 0; i < 11; i++) { const bw = 14 + (i * 7) % 12, bh = 18 + (i * 13) % 30; rr(i * 19 - 4, 250 - bh, bw, bh + 4, 1.5, SKY_FAR); }
  p.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 11; i++) { const bw = 14 + (i * 7) % 12, bh = 18 + (i * 13) % 30; for (let wy = 254 - bh; wy < 246; wy += 7) for (let wx = i * 19 - 1; wx < i * 19 - 4 + bw - 3; wx += 5) p.fillRect(wx, wy, 2, 3); }
  // St Peter's: drum, dome, lantern
  rr(20, 226, 42, 26, 2, SKY_MID); ell(41, 228, 21, 19, SKY_MID); p.fillStyle = SKY_MID;
  rr(37, 203, 8, 10, 1, SKY_MID); rr(35, 200, 12, 4, 1, SKY_MID); R(40.3, 194, 1.4, 7, SKY_MID); R(38, 196.5, 6, 1.4, SKY_MID);
  p.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 6; i++) p.fillRect(24 + i * 6.5, 232, 2, 9);
  for (let i = -3; i <= 3; i++) { p.strokeStyle = 'rgba(0,0,0,0.08)'; p.lineWidth = 0.8; p.beginPath(); p.moveTo(41, 209); p.quadraticCurveTo(41 + i * 9, 222, 41 + i * 6.5, 243); p.stroke(); }
  // obelisk
  p.fillStyle = SKY_MID; p.beginPath(); p.moveTo(82, 252); p.lineTo(84, 214); p.lineTo(86, 214); p.lineTo(88, 252); p.fill();
  // Colosseum
  const col = p.createLinearGradient(0, 212, 0, 252); col.addColorStop(0, '#e2cfa6'); col.addColorStop(1, '#bda57a');
  p.fillStyle = col; p.beginPath(); p.moveTo(110, 252); p.lineTo(110, 222); p.quadraticCurveTo(150, 206, 196, 214); p.lineTo(196, 252); p.closePath(); p.fill();
  p.fillStyle = 'rgba(90,70,40,0.55)';
  for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) { const ax = 114 + i * 9.4, ay = 218 + row * 11 + (i < 5 ? (5 - i) * 0.9 : 0) * 0.6; p.beginPath(); p.moveTo(ax, ay + 8); p.lineTo(ax, ay + 3); p.arc(ax + 2.8, ay + 3, 2.8, Math.PI, 0); p.lineTo(ax + 5.6, ay + 8); p.closePath(); p.fill(); }
  p.strokeStyle = 'rgba(90,70,40,0.35)'; p.lineWidth = 0.8; for (let row = 1; row < 3; row++) { p.beginPath(); p.moveTo(110, 217 + row * 11 + 4); p.lineTo(196, 214 + row * 11 + 2); p.stroke(); }
  // umbrella pines
  for (const [x, h] of [[8, 30], [98, 26], [192, 32]]) {
    p.strokeStyle = '#5a3d24'; p.lineWidth = 2.4; p.beginPath(); p.moveTo(x, 254); p.quadraticCurveTo(x + 1.5, 244, x, 254 - h); p.stroke();
    ell(x, 254 - h - 2, 13, 6.5, '#2f6b35'); ell(x - 4, 254 - h - 5, 9, 5.5, '#3f8a44'); ell(x + 5, 254 - h - 5, 8, 5, '#3f8a44'); ell(x, 254 - h - 8, 6, 4, '#55a35a');
  }
  // ground: sampietrini
  const gr = p.createLinearGradient(0, 252, 0, H); gr.addColorStop(0, '#7d90ad'); gr.addColorStop(1, '#55667f');
  p.fillStyle = gr; p.fillRect(0, 252, W, H - 252);
  R(0, 252, W, 2.5, '#3a475c');
  for (let y = 257; y < H; y += 7) for (let x = ((y / 7) % 2) * 3.5; x < W; x += 7) { const v = ((x * 13 + y * 7) % 11) / 11; p.fillStyle = 'rgba(255,255,255,' + (0.07 + v * 0.09) + ')'; p.beginPath(); p.moveTo(x + 0.8, y); p.lineTo(x + 6.2, y); p.quadraticCurveTo(x + 7, y, x + 7, y + 0.8); p.lineTo(x + 7, y + 5.2); p.quadraticCurveTo(x + 7, y + 6, x + 6.2, y + 6); p.lineTo(x + 0.8, y + 6); p.quadraticCurveTo(x, y + 6, x, y + 5.2); p.lineTo(x, y + 0.8); p.quadraticCurveTo(x, y, x + 0.8, y); p.fill(); }
  R(0, GROUND + 30, W, 1.5, 'rgba(0,0,0,0.25)');
}

function drawCroc(t) {
  const c = G.croc;
  if (c.hurt > 0 && Math.floor(t * 20) % 2 === 0) return;
  // shadow on the ground, shrinking with height
  const hgt = GROUND - c.y, sh = clamp(1 - hgt / 220, 0.35, 1);
  ell(c.x + 2 * c.dir, GROUND + 29, 34 * CROC_S * sh, 5 * sh, 'rgba(0,0,0,' + (0.28 * sh) + ')');
  p.save(); p.translate(c.x, c.y); p.scale(CROC_S * c.dir, CROC_S);   // dir flips the whole crocodile to face the way it moves
  const squash = !c.air && c.charging ? c.charge * 0.18 : 0;
  const stretch = c.air ? clamp(-c.vy / 900, -0.08, 0.1) : 0;
  p.translate(0, 30); p.scale(1 + squash * 0.6 - stretch * 0.4, 1 - squash + stretch); p.translate(0, -30);
  const body = p.createLinearGradient(0, -8, 0, 24); body.addColorStop(0, '#4c9f4a'); body.addColorStop(0.6, '#3b8a3f'); body.addColorStop(1, '#2d6b33');
  // tail
  p.fillStyle = '#2d6b33'; p.beginPath(); p.moveTo(-28, 8); p.quadraticCurveTo(-48, 6, -62, 18); p.quadraticCurveTo(-50, 16, -40, 20); p.quadraticCurveTo(-34, 22, -26, 22); p.closePath(); p.fill();
  // legs
  for (const lx of [-22, 4]) { rr(lx, 18, 9, 12, 3, '#2d6b33'); rr(lx - 2, 26, 13, 5, 2.5, '#245a2c'); }
  // body
  p.fillStyle = body; p.beginPath(); p.moveTo(-32, 20); p.quadraticCurveTo(-36, 2, -20, 0); p.lineTo(12, -1); p.quadraticCurveTo(20, 0, 18, 10); p.lineTo(16, 22); p.quadraticCurveTo(-10, 26, -32, 20); p.closePath(); p.fill();
  // belly
  p.fillStyle = '#b9e18c'; p.beginPath(); p.moveTo(-28, 20); p.quadraticCurveTo(-8, 25, 15, 21); p.quadraticCurveTo(10, 16, -6, 15); p.quadraticCurveTo(-20, 15, -28, 20); p.fill();
  p.strokeStyle = 'rgba(0,0,0,0.12)'; p.lineWidth = 1; for (let i = 0; i < 5; i++) { p.beginPath(); p.moveTo(-24 + i * 8, 16); p.lineTo(-23 + i * 8, 22); p.stroke(); }
  // back ridges
  p.fillStyle = '#245a2c'; for (let i = 0; i < 5; i++) { const rx = -26 + i * 9; p.beginPath(); p.moveTo(rx, 0.5); p.quadraticCurveTo(rx + 2.5, -6, rx + 5, 0.5); p.closePath(); p.fill(); }
  // head: upper jaw rotates up, lower jaw rotates down around a hinge at (14, 10)
  const open = c.mouth; const hx = 14, hy = 10;
  p.save(); p.translate(hx, hy); p.rotate(-open * 0.45);
  const head = p.createLinearGradient(0, -12, 0, 4); head.addColorStop(0, '#4c9f4a'); head.addColorStop(1, '#3b8a3f');
  p.fillStyle = head; p.beginPath(); p.moveTo(-6, -12); p.quadraticCurveTo(6, -14, 14, -10); p.lineTo(30, -6); p.quadraticCurveTo(34, -5, 33, 0); p.lineTo(-4, 1); p.closePath(); p.fill();
  rr(6, -13, 10, 6, 3, '#3b8a3f');                                      // brow
  ell(11, -9, 3.6, 3.6, '#fff'); ell(12, -8.6, 2, 2.4, '#1b2a36'); ell(12.9, -9.6, 0.8, 0.8, '#fff');   // eye
  ell(30, -4, 1.3, 1, '#1f3f24');                                       // nostril
  p.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { p.beginPath(); p.moveTo(2 + i * 5, 0); p.lineTo(4 + i * 5, 3.2); p.lineTo(6 + i * 5, 0); p.fill(); }
  p.restore();
  p.save(); p.translate(hx, hy); p.rotate(open * 0.7);
  p.fillStyle = '#c23a4a'; p.beginPath(); p.moveTo(-4, 0); p.lineTo(32, 0); p.quadraticCurveTo(33, 4, 30, 6); p.lineTo(-2, 7); p.closePath(); p.fill();  // mouth inside
  p.fillStyle = '#2d6b33'; p.beginPath(); p.moveTo(-4, 4); p.lineTo(31, 3); p.quadraticCurveTo(34, 6, 31, 10); p.lineTo(-2, 11); p.closePath(); p.fill(); // lower jaw
  p.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { p.beginPath(); p.moveTo(5 + i * 5, 4); p.lineTo(7 + i * 5, 1); p.lineTo(9 + i * 5, 4); p.fill(); }
  p.restore();
  p.restore();
  if (c.charging && !c.air) {
    rr(c.x - 15, c.y - 14, 30, 5, 2.5, 'rgba(0,0,0,0.45)');
    rr(c.x - 14, c.y - 13, 28 * c.charge, 3, 1.5, c.charge > 0.85 ? '#ff5e5e' : '#ffd84a');
  }
}

function drawBird(b, t) {
  const P = PIGEONS[b.type], s = P.boss ? 2.6 : 1, x = b.x, y = b.y;
  const flap = Math.sin(b.ph);
  const col = b.hit > 0 ? '#fff' : P.color, dark = b.hit > 0 ? '#ddd' : P.dark;
  p.save(); p.translate(x, y); p.scale(b.dir * s, s);
  // back wing
  p.save(); p.translate(-2, -2); p.rotate(-flap * 0.9 - 0.3); p.fillStyle = dark; p.beginPath(); p.moveTo(0, 0); p.quadraticCurveTo(-10, -9, -16, -3); p.quadraticCurveTo(-9, -2, 0, 0); p.fill(); p.restore();
  // tail
  p.fillStyle = dark; p.beginPath(); p.moveTo(-6, -1); p.lineTo(-13, -4); p.lineTo(-14, 2); p.lineTo(-6, 3); p.fill();
  // body
  const bg = p.createLinearGradient(0, -6, 0, 6); bg.addColorStop(0, col); bg.addColorStop(1, dark);
  p.fillStyle = bg; p.beginPath(); p.ellipse(0, 0, 9, 5.5, 0, 0, TAU); p.fill();
  // head + iridescent neck
  ell(7, -4, 4.2, 4, col); ell(4.5, -2.5, 2.6, 2.2, P.golden ? '#e0a020' : '#5c9c6a');
  if (!P.golden) { p.fillStyle = 'rgba(140,90,200,0.6)'; p.beginPath(); p.ellipse(4.2, -1.8, 1.8, 1.4, 0.4, 0, TAU); p.fill(); }
  ell(8.6, -4.6, 1.4, 1.4, '#fff'); ell(8.9, -4.6, 0.8, 0.8, '#111'); ell(9.2, -4.9, 0.3, 0.3, '#fff');
  p.fillStyle = '#e7a23d'; p.beginPath(); p.moveTo(10.5, -4.5); p.lineTo(14.5, -3.4); p.lineTo(10.5, -2.4); p.fill();
  // front wing
  p.save(); p.translate(1, -1); p.rotate(-flap * 1.1); p.fillStyle = col; p.beginPath(); p.moveTo(0, 0); p.quadraticCurveTo(-8, -11, -17, -5); p.quadraticCurveTo(-14, 1, -4, 3); p.quadraticCurveTo(-2, 2, 0, 0); p.fill();
  p.strokeStyle = 'rgba(0,0,0,0.18)'; p.lineWidth = 0.7; p.beginPath(); p.moveTo(-3, 1); p.lineTo(-12, -4); p.moveTo(-5, 2); p.lineTo(-14, -1); p.stroke(); p.restore();
  // feet
  p.strokeStyle = '#e7a23d'; p.lineWidth = 1.2; p.lineCap = 'round'; p.beginPath(); p.moveTo(-1, 5); p.lineTo(-2, 8); p.moveTo(2, 5); p.lineTo(2, 8); p.stroke();
  if (P.erratic) { rr(5, -7.2, 7.5, 3.2, 1.2, '#111'); R(8.6, -6.2, 0.8, 1.2, '#333'); p.strokeStyle = '#f6c445'; p.lineWidth = 0.9; p.beginPath(); p.arc(4, -1, 4, 0.2, 2.6); p.stroke(); ell(4, 3.2, 1, 1, '#f6c445'); }
  if (P.boss) { p.strokeStyle = '#111'; p.lineWidth = 1.2; p.beginPath(); p.moveTo(6, -8); p.lineTo(10, -6.6); p.stroke(); }
  p.restore();
  if (P.golden) { const k = (t * 6 + b.ph) % 1; star(x - 10 * b.dir, y - 9, 2.2 + k, '#fff8c0'); star(x + 11 * b.dir, y + 7, 1.4 + (1 - k), '#fff8c0'); }
  if (P.boss) { rr(x - 16, y - 38, 32, 4, 2, 'rgba(0,0,0,0.5)'); rr(x - 15, y - 37, 30 * b.hp / b.maxHp, 2, 1, '#ff5e5e'); }
}

function drawPoop(q) {
  p.strokeStyle = 'rgba(255,255,255,0.35)'; p.lineWidth = 1.5; p.beginPath(); p.moveTo(q.x, q.y - 9); p.lineTo(q.x, q.y - 3); p.stroke();
  p.fillStyle = '#f5f1e6'; p.beginPath(); p.moveTo(q.x, q.y - 5); p.quadraticCurveTo(q.x + 4, q.y - 1, q.x + 2.5, q.y + 2.5); p.quadraticCurveTo(q.x, q.y + 4, q.x - 2.5, q.y + 2.5); p.quadraticCurveTo(q.x - 4, q.y - 1, q.x, q.y - 5); p.fill();
  ell(q.x + 0.8, q.y + 0.8, 1.3, 1.3, '#9c8b6e');
}

function draw() {
  const t = G.t;
  ctx.setTransform(dpr * scale * SCALE, 0, 0, dpr * scale * SCALE, 0, 0);
  p.save();
  if (G.shake > 0) p.translate((Math.random() - 0.5) * G.shake * 6, (Math.random() - 0.5) * G.shake * 6);
  drawRome(t);
  for (const q of G.poops) drawPoop(q);
  for (const b of G.birds) drawBird(b, t);
  drawCroc(t);
  for (const q of G.parts) { p.globalAlpha = clamp(q.life * 2.5, 0, 1); if (q.feather) { p.save(); p.translate(q.x, q.y); p.rotate(q.rot + q.life * 4); ell(0, 0, 3, 1.3, q.color); p.restore(); } else ell(q.x, q.y, 1.6, 1.6, q.color); }
  p.globalAlpha = 1;
  for (const f of G.floats) { p.globalAlpha = clamp(f.life * 1.5, 0, 1); text(f.text, f.x, f.y, f.color, 9, 'center', 'rgba(0,0,0,0.6)'); }
  p.globalAlpha = 1;
  p.restore();
  if (G.flash > 0) { p.fillStyle = 'rgba(255,255,255,' + G.flash * 0.4 + ')'; p.fillRect(0, 0, W, H); }
  // HUD
  const hud = p.createLinearGradient(0, 0, 0, 18); hud.addColorStop(0, 'rgba(10,20,30,0.75)'); hud.addColorStop(1, 'rgba(10,20,30,0.35)');
  p.fillStyle = hud; p.fillRect(0, 0, W, 18);
  text('SCORE', 5, 4, '#9fb3c9', 6); text(String(G.score).padStart(5, '0'), 31, 3, '#fff', 8.5);
  // lives: three slots to start, growing with every boss eaten; past six it becomes a counter
  if (G.hearts <= 6) { const slots = Math.max(3, G.hearts); for (let i = 0; i < slots; i++) heart(92 + i * 10, 8.5, 4, i < G.hearts ? '#ff4d5e' : 'rgba(255,255,255,0.25)'); }
  else { heart(92, 8.5, 4, '#ff4d5e'); text('×' + G.hearts, 99, 3, '#ff8a94', 8.5); }
  const el = Math.floor(G.t), mm = Math.floor(el / 60), ss = el % 60;
  text(String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'), W - 5, 3, G.inferno && Math.floor(t * 4) % 2 === 0 ? '#ff5e5e' : '#fff', 8.5, 'right');
  if (G.state === 'play') {
    const mult = Math.min(5, 1 + Math.floor(G.combo / 5));
    p.fillStyle = 'rgba(10,20,30,0.55)'; p.fillRect(0, H - 14, W, 14);
    text(G.croc.air ? 'TAP TO BITE AGAIN · DRAG TO STEER' : G.croc.charging ? 'RELEASE TO BITE' : 'HOLD TO CHARGE · DRAG TO MOVE', 5, H - 10.5, '#fff', 6.5);
    if (G.combo >= 2) { rr(W - 58, H - 13, 54, 11, 4, mult >= 3 ? '#ffd84a' : 'rgba(255,255,255,0.15)'); text('×' + mult + ' COMBO ' + G.combo, W - 31, H - 10.5, mult >= 3 ? '#1b2a36' : '#ffd84a', 6.5, 'center'); }
    if (G.msg) { const k = clamp(G.msgT * 3, 0, 1); p.save(); p.translate(W / 2, 158); p.scale(0.8 + k * 0.2, 0.8 + k * 0.2); rr(-70, -9, 140, 18, 6, 'rgba(10,20,30,0.7)'); text(G.msg, 0, -6.5, G.msg.includes('INFERNO') ? '#ff5e5e' : '#ffd84a', 10, 'center', 'rgba(0,0,0,0.5)'); p.restore(); }
  }
  if (G.state === 'title') {
    // The name + ranking card sits over the middle of the screen, so the title lives up top.
    rr(10, 24, W - 20, 62, 10, 'rgba(10,20,30,0.72)');
    text('COCCODRILLO', W / 2, 31, '#b9e18c', 17, 'center', '#1b2a36'); text('VS PICCIONE', W / 2, 51, '#fff', 17, 'center', '#1b2a36');
    text('SURVIVE. EAT. DODGE.', W / 2, 74, Math.floor(t * 2) % 2 === 0 ? '#ffd84a' : '#9fb3c9', 6.5, 'center');
  }
}

// The crocodile turns to face the direction it moves in (dir: 1 = right, -1 = left).
function moveCroc(nx) {
  const c = G.croc; nx = clamp(nx, CROC_MIN, CROC_MAX);
  if (nx > c.x + 0.3) c.dir = 1; else if (nx < c.x - 0.3) c.dir = -1;
  c.x = nx;
}

// ---------- input: one button ----------
function pressStart() {
  ac();
  if (G.state === 'title') { openStart(); return; }
  if (G.state !== 'play') return;
  const c = G.croc;
  if (!c.air) { c.charging = true; c.charge = 0; return; }
  // in the air: every tap snaps the jaws open again for another bite, and holding the
  // finger through the landing starts the next charge right away
  c.mouth = 1; c.bites = (c.bites || 0) + 1; c.charging = true; c.charge = 0;
  tone(520, 0.06, 'square', 0.035, 260);
}
function pressEnd() { drag = null; if (G.state === 'play') release(); }
const keys = { left: false, right: false };
let drag = null;
function pointerX(e) { const r = canvas.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; }
canvas.addEventListener('pointerdown', e => { e.preventDefault(); pressStart(); drag = { px: pointerX(e), cx: G.croc.x }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
canvas.addEventListener('pointermove', e => { if (!drag || G.state !== 'play') return; moveCroc(drag.cx + (pointerX(e) - drag.px) * 1.5); });
canvas.addEventListener('pointerup', pressEnd);
canvas.addEventListener('pointercancel', pressEnd);
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if ((e.code === 'Space' || e.key === ' ') && !e.repeat) { e.preventDefault(); pressStart(); }
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.key === ' ') pressEnd();
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});

// ---------- screens ----------
const $ = id => document.getElementById(id);
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id)); }
function challengeText() {
  const rank = G.worldRank && G.worldRank.rank ? ' Sono #' + G.worldRank.rank + ' in classifica mondiale.' : '';
  return 'Sono sopravvissuto ' + fmtTime(G.t) + ', ho mangiato ' + G.eaten + ' piccioni e fatto ' + G.score.toLocaleString() + ' punti in Coccodrillo vs Piccione 🐊🐦' + rank + ' Battimi: ' + SITE_URL + ' #CoccodrilloVsPiccione #PippoPoppiGames';
}
function showRank() {
  const name = cleanName(save.name) || 'ANONIMO';
  if (G.worldRank) {
    const w = G.worldRank;
    $('end-rank').textContent = name + ': #' + w.rank + ' nel mondo' + (w.improved ? (w.rank === 1 ? ' 👑 PRIMO!' : ' 🏆') : ' · il tuo record resta ' + Number(w.best).toLocaleString());
  } else if (G.rank) {
    $('end-rank').textContent = name + ': #' + G.rank.rank + ' su questo dispositivo' + (G.rank.improved ? (G.rank.rank === 1 ? ' 👑' : ' 🏆') : '');
  } else $('end-rank').textContent = '';
  $('btn-share').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(challengeText().replace(SITE_URL, '')) + '&url=' + encodeURIComponent(SITE_URL);
}
function openStart() {
  G.state = 'title';
  const inp = $('nick'); if (inp) { inp.value = save.name || ''; inp.classList.remove('shake'); }
  renderBoard(); fetchBoard();
  showScreen('start');
}
function playFromStart() {
  const inp = $('nick');
  const name = cleanName(inp ? inp.value : '');
  if (!name) { if (inp) { inp.value = ''; inp.placeholder = 'SERVE UN NOME!'; inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); inp.focus(); } return; }
  save.name = name; persist();
  if (inp) inp.blur();
  ac(); startGame();
}
function fmtTime(t) { const el = Math.floor(t); return (el >= 60 ? Math.floor(el / 60) + 'm ' : '') + (el % 60) + 's'; }
function showEnd(newBest) {
  $('end-title').textContent = G.t >= 90 ? 'APEX PREDATOR. 🐊' : 'YOU GOT PIGEONED. 🐦';
  $('end-time').textContent = fmtTime(G.t);
  $('end-score').textContent = G.score.toLocaleString();
  $('end-eaten').textContent = G.eaten;
  $('end-best').textContent = (newBest ? 'NEW RECORD! ' : 'Record: ' + save.best.toLocaleString() + ' · ') + 'Miglior tempo: ' + fmtTime(save.bestTime) + ' · Partite: ' + save.games;
  $('end-tag').textContent = G.t >= 90 ? 'Roma è tua. I piccioni lo sanno.' : G.t >= 45 ? 'Hai visto l’inferno. L’inferno ha visto te.' : 'You are not the apex predator. You are the lunch.';
  showRank();
  $('btn-copy').textContent = 'COPY X CHALLENGE';
  showScreen('end');
}
$('btn-copy').addEventListener('click', async () => {
  const txt = challengeText();
  try { await navigator.clipboard.writeText(txt); $('btn-copy').textContent = 'COPIED! ✓'; }
  catch (e) { prompt('Copy this:', txt); }
});
$('btn-again').addEventListener('click', () => { ac(); startGame(); });
$('btn-board').addEventListener('click', () => { ac(); openStart(); });
$('btn-play').addEventListener('click', playFromStart);
$('nick').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); playFromStart(); } });
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
openStart();
requestAnimationFrame(frame);

window.CrocVsPigeon = { G, save, startGame, update, draw, pressStart, pressEnd, moveCroc, openStart, playFromStart, upsert, cleanName, PIGEONS, W, H, GROUND, CROC_X };
})();
