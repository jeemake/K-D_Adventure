// ============================================================
// ARCHITECTE EN DÉVELOPPEMENT
// Côte d'Ivoire • Bénin • Le Monde Entier
// Game Engine
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---- GLOBALS ----
let W, H;
const G_SCALE = 1.35; // Global scaling to make everything bigger
let selectedChar = null;
let gameRunning = false;
let score = 0;
let lives = 3;
let level = 1;
let cameraX = 0;
let keys = {};
let particles = [];
let frameCount = 0;

// ---- RESIZE ----
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.scale(G_SCALE, G_SCALE);
  W = canvas.width / G_SCALE;
  H = canvas.height / G_SCALE;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

// ---- LOAD IMAGES ----
const imgs = {};
function loadImg(name, src) {
  const img = new Image();
  img.src = src;
  imgs[name] = img;
}
loadImg('koffi', 'koffi_sprite.png');
loadImg('diabate', 'diabate_sprite.png');
loadImg('bg1', 'Background2.png');
loadImg('bg2', 'bg_level2_2.png'); // Nighttime background
loadImg('bg3', 'bg_level3.png');
loadImg('koffi_sheet', 'koffi_sheet.png');
loadImg('diabate_sheet', 'diabate_sheet.png');
loadImg('koffi_inv', 'invisible_Koffi.png');
loadImg('diabate_inv', 'invisible_diabate.png');
loadImg('landing_bg', 'landing_bg.png');

// Sprite sheet config: 4 cols x 2 rows = 8 frames
// Frames 0-1 = idle, 2-4 = run, 5-6 = jump, 7 = land
const ANIM = {
  idle: { start: 0, end: 1, speed: 25 },
  run: { start: 2, end: 4, speed: 8 },
  jump: { start: 5, end: 6, speed: 15 },
  land: { start: 7, end: 7, speed: 15 }
};

// ---- AUDIO ----
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let menuMusic = null;
let gameMusic1 = null;
let gameMusic2 = null;
let gameMusic3 = null;
let invincibleMusic = null;
let jumpSound = null;
let currentMusic = null;

function createAudio(src, loop) {
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = 0.4;
  return audio;
}

function initAudio() {
  if (!menuMusic) {
    menuMusic = createAudio('music_menu.mp3', true);
    gameMusic1 = createAudio('music_gameplay.mp3', true);
    gameMusic2 = createAudio('music_level2.mp3', true);
    gameMusic3 = createAudio('music_level3.mp3', true);
    invincibleMusic = createAudio('music_invincible.mp3', true);
    jumpSound = createAudio('sfx_jump.mp3', false);
    jumpSound.volume = 1.0; // Increased volume
  }
}

function playSynthesizedSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === 'coin') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'stomp') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'death') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.6);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.7);
  }
}

function playMusic(music) {
  if (currentMusic === music) return;
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
  }
  currentMusic = music;
  if (music) {
    music.play().catch(() => { });
  }
}

function playJumpSfx() {
  if (jumpSound) {
    jumpSound.currentTime = 0;
    jumpSound.play().catch(() => { });
  }
}

// ---- LANDING PAGE BACKGROUND ----
function setLandingBg() {
  const titleScreen = document.getElementById('title-screen');
  titleScreen.style.backgroundImage = "url('landing_bg.png')";
}
setLandingBg();

// ---- TITLE SCREEN STARS ----
(function createStars() {
  const cont = document.getElementById('stars');
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = Math.random() * 3 + 's';
    s.style.opacity = Math.random() * 0.7 + 0.3;
    cont.appendChild(s);
  }
})();

// ---- UI FUNCTIONS ----
function showSelect() {
  initAudio();
  playMusic(menuMusic);
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('select-screen').style.display = 'flex';
}

function selectChar(name) {
  initAudio();
  selectedChar = name;
  document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('card-' + name).classList.add('selected');
  document.getElementById('play-btn').style.display = 'inline-block';
}

// Start menu music on first interaction
document.getElementById('title-screen').addEventListener('click', () => {
  initAudio();
  playMusic(menuMusic);
}, { once: true });

// ---- LEVEL DATA ----
function generateLevel(lvl) {
  const platforms = [];
  const coins = [];
  const enemies = [];
  const levelWidth = 5000 + lvl * 1000;

  // Ground
  for (let x = 0; x < levelWidth; x += 80) {
    if (lvl > 1 && x > 600 && Math.random() < 0.06) { x += 160; continue; }
    platforms.push({ x, y: H - 60, w: 80, h: 60, type: 'ground' });
  }

  // Floating platforms
  const numPlats = 15 + lvl * 5;
  for (let i = 0; i < numPlats; i++) {
    const px = 300 + Math.random() * (levelWidth - 500);
    const py = H - 140 - Math.random() * 260;
    const pw = 80 + Math.random() * 100;
    platforms.push({ x: px, y: py, w: pw, h: 20, type: 'float' });
    if (Math.random() < 0.7) {
      coins.push({ x: px + pw / 2 - 12, y: py - 35, w: 24, h: 24, collected: false });
    }
  }

  // Floating coins
  for (let i = 0; i < 20 + lvl * 5; i++) {
    coins.push({
      x: 200 + Math.random() * (levelWidth - 400),
      y: H - 120 - Math.random() * 300,
      w: 24, h: 24, collected: false
    });
  }

  // Enemies
  const numEnemies = 8 + lvl * 4;
  for (let i = 0; i < numEnemies; i++) {
    const ex = 400 + Math.random() * (levelWidth - 600);
    enemies.push({
      x: ex, y: H - 100, w: 36, h: 36,
      vx: (0.8 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1),
      alive: true, startX: ex, range: 120 + Math.random() * 80
    });
  }

  // Goal flag
  const flag = { x: levelWidth - 200, y: H - 260, w: 40, h: 200 };

  const signs = [];
  const texts = ['ESQUISSE', 'APS', 'APD', 'DCE', 'DAO', 'Chantier'];
  for (let i = 0; i < texts.length; i++) {
    const sx = 800 + i * ((levelWidth - 1800) / texts.length);
    signs.push({ x: sx, y: H - 60, w: 80, h: 50, text: texts[i], index: i, collected: false });
  }
  signs.push({ x: levelWidth - 320, y: H - 60, w: 80, h: 50, text: 'Livraison', index: texts.length, collected: false });

  // Special Coin (1 per level)
  let specialCoinX;
  if (lvl === 3) {
    specialCoinX = flag.x - 300; // Near the end for level 3
  } else {
    specialCoinX = levelWidth / 2 + Math.random() * 500; // Somewhere in the middle
  }
  const specialCoin = { x: specialCoinX, y: H - 180, w: 32, h: 32, collected: false };

  return { platforms, coins, enemies, flag, signs, specialCoin, width: levelWidth };
}

// ---- PLAYER ----
let player = null;
let levelData = null;

function createPlayer(x = 100, y = H - 200, char = 'koffi') {
  return {
    x, y,
    w: 36, h: 48,
    vx: 0, vy: 0,
    speed: 4, jumpPower: -9.5,
    onGround: false,
    facing: 1, // 1 right, -1 left
    animFrame: 0,
    animTimer: 0,
    jumpCount: 0,
    invincible: 0,
    superTimer: 0, // Tracker for the 10.5sec invincibility (630 frames at 60fps)
    prevState: 'idle',
    currentSignIndex: 0
  };
}

// ---- GAME START ----
function startGame() {
  document.getElementById('select-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('overlay').style.display = 'none';
  if ('ontouchstart' in window) {
    document.getElementById('mobile-controls').style.display = 'flex';
  }
  score = 0;
  lives = 3;
  level = 1;
  updateHUD();
  player = createPlayer();
  levelData = generateLevel(level);
  cameraX = 0;
  gameRunning = true;
  particles = [];
  playMusic(gameMusic1);
  requestAnimationFrame(gameLoop);
}

function restartGame() {
  document.getElementById('overlay').style.display = 'none';
  startGame();
}

function nextLevel() {
  level++;
  player = createPlayer();
  levelData = generateLevel(level);
  cameraX = 0;
  particles = [];
  updateHUD();
}

// ---- HUD ----
function updateHUD() {
  document.getElementById('score-val').textContent = score;
  document.getElementById('level-val').textContent = level;
  const hc = document.getElementById('hearts');
  hc.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const h = document.createElement('span');
    h.className = 'heart';
    h.textContent = i < lives ? '❤️' : '🖤';
    hc.appendChild(h);
  }
}

// ---- PARTICLES ----
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 5 - 2,
      life: 30 + Math.random() * 20,
      color, size: 3 + Math.random() * 4
    });
  }
}

// ---- INPUT ----
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Mobile controls
['btn-left', 'btn-right', 'btn-jump'].forEach(id => {
  const el = document.getElementById(id);
  const code = id === 'btn-left' ? 'ArrowLeft' : id === 'btn-right' ? 'ArrowRight' : 'Space';
  el.addEventListener('touchstart', e => { e.preventDefault(); keys[code] = true; });
  el.addEventListener('touchend', e => { e.preventDefault(); keys[code] = false; });
});

// ---- PHYSICS CONSTANTS ----
const GRAVITY = 0.55;
const JUMP_FORCE = -11;
const MOVE_SPEED = 4.5;
const FRICTION = 0.85;
const MAX_JUMPS = 2;

// ---- COLLISION ----
function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---- UPDATE ----
function update() {
  if (!player || !levelData) return;
  const p = player;
  const spd = selectedChar === 'koffi' ? MOVE_SPEED * 1.15 : MOVE_SPEED;

  // Input
  if (keys['ArrowLeft'] || keys['KeyA']) { p.vx -= 0.8; p.facing = -1; }
  if (keys['ArrowRight'] || keys['KeyD']) { p.vx += 0.8; p.facing = 1; }
  if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && p.jumpCount < MAX_JUMPS) {
    p.vy = p.superTimer > 0 ? JUMP_FORCE * 1.3 : JUMP_FORCE; // Higher jump when invincible
    p.jumpCount++;
    keys['Space'] = false; keys['ArrowUp'] = false; keys['KeyW'] = false;
    spawnParticles(p.x + p.w / 2, p.y + p.h, p.superTimer > 0 ? '#fff' : '#f4a523', 5);
    playJumpSfx();
  }

  // Clamp speed
  p.vx = Math.max(-spd, Math.min(spd, p.vx));
  p.vx *= FRICTION;
  p.vy += GRAVITY;
  if (p.vy > 14) p.vy = 14;

  // Move X
  p.x += p.vx;
  for (const pl of levelData.platforms) {
    if (rectOverlap(p, pl)) {
      if (p.vx > 0) p.x = pl.x - p.w;
      else p.x = pl.x + pl.w;
      p.vx = 0;
    }
  }

  // Move Y
  p.onGround = false;
  p.y += p.vy;
  for (const pl of levelData.platforms) {
    if (rectOverlap(p, pl)) {
      if (p.vy > 0) {
        p.y = pl.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumpCount = 0;
      } else {
        p.y = pl.y + pl.h;
        p.vy = 0;
      }
    }
  }

  // Fall off screen
  if (p.y > H + 100) { loseLife(); return; }

  // Keep in bounds
  if (p.x < 0) p.x = 0;

  // Coins
  for (const c of levelData.coins) {
    if (!c.collected && rectOverlap(p, c)) {
      c.collected = true;
      score += 10;
      updateHUD();
      spawnParticles(c.x + 12, c.y + 12, '#f4a523', 10);
      playSynthesizedSound('coin');
    }
  }

  // Special Coin
  if (levelData.specialCoin && !levelData.specialCoin.collected) {
    if (rectOverlap(p, levelData.specialCoin)) {
      levelData.specialCoin.collected = true;
      score += 500;
      updateHUD();

      let dur = invincibleMusic.duration;
      if (!dur || isNaN(dur) || dur === Infinity) dur = 10.5; // Fallback
      p.superTimer = Math.floor(dur * 60);

      spawnParticles(levelData.specialCoin.x + 16, levelData.specialCoin.y + 16, '#00e5ff', 40);
      playSynthesizedSound('coin');
      playMusic(invincibleMusic);
    }
  }

  // Enemies
  for (const e of levelData.enemies) {
    if (!e.alive) continue;
    e.x += e.vx;
    if (Math.abs(e.x - e.startX) > e.range) e.vx *= -1;
    for (const pl of levelData.platforms) {
      if (e.x + e.w > pl.x && e.x < pl.x + pl.w && Math.abs((e.y + e.h) - pl.y) < 5) {
        e.y = pl.y - e.h;
      }
    }
    if (rectOverlap(p, e)) {
      if (p.superTimer > 0) {
        // Invincible kill
        e.alive = false;
        score += 50;
        updateHUD();
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#fff', 15);
        playSynthesizedSound('stomp');
      } else if (p.invincible <= 0) {
        if (p.vy > 0 && p.y + p.h - e.y < 20) {
          // Normal stomp
          e.alive = false;
          p.vy = -8;
          score += 25;
          updateHUD();
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#e74c3c', 12);
          playSynthesizedSound('stomp');
        } else {
          loseLife(); return;
        }
      }
    }
  }

  // Signs (sequence collection)
  for (const s of levelData.signs) {
    if (!s.collected && rectOverlap(p, { x: s.x, y: s.y - 50, w: s.w, h: s.h })) {
      if (s.index === p.currentSignIndex) {
        s.collected = true;
        p.currentSignIndex++;
        score += 100; // Big score!
        updateHUD();
        spawnParticles(s.x + 40, s.y - 25, '#f4a523', 25);
        playSynthesizedSound('coin');
      }
    }
  }

  // Flag / Goal
  if (rectOverlap(p, levelData.flag)) {
    if (level < 3) {
      level++;
      player.x = 100;
      player.y = H - 200;
      player.vx = 0;
      player.vy = 0;
      player.currentSignIndex = 0;
      levelData = generateLevel(level);
      updateHUD();

      if (level === 2) playMusic(gameMusic2);
      if (level === 3) playMusic(gameMusic3);
    } else {
      showOverlay('🏆 VICTOIRE !', 'Score final : ' + score);
    }
    return;
  }

  // Invincibility/Super timers
  if (p.invincible > 0) p.invincible--;
  if (p.superTimer > 0) {
    p.superTimer--;
    if (Math.random() < 0.2) {
      // Spawn white aura particles
      spawnParticles(p.x + Math.random() * p.w, p.y + Math.random() * p.h, '#fff', 1);
    }
    if (p.superTimer <= 0) {
      // Revert music
      if (level === 1) playMusic(gameMusic1);
      else if (level === 2) playMusic(gameMusic2);
      else if (level === 3) playMusic(gameMusic3);
    }
  }

  // Camera
  const targetCam = p.x - W / 3;
  cameraX += (targetCam - cameraX) * 0.08;
  if (cameraX < 0) cameraX = 0;
  if (cameraX > levelData.width - W) cameraX = levelData.width - W;

  // Smooth animation state machine
  let animState = 'idle';
  if (!p.onGround) {
    animState = p.vy < 0 ? 'jump' : 'land';
  } else if (Math.abs(p.vx) > 0.5) {
    animState = 'run';
  }

  // Only reset frame when changing animation state
  if (animState !== p.prevState) {
    const anim = ANIM[animState];
    p.animFrame = anim.start;
    p.animTimer = 0;
    p.prevState = animState;
  }

  const anim = ANIM[animState];
  p.animTimer++;
  if (p.animTimer >= anim.speed) {
    p.animTimer = 0;
    p.animFrame++;
    if (p.animFrame > anim.end) {
      p.animFrame = anim.start;
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.15;
    pt.life--;
    if (pt.life <= 0) particles.splice(i, 1);
  }

  frameCount++;
}

function loseLife() {
  lives--;
  updateHUD();
  playSynthesizedSound('death');
  if (lives <= 0) {
    showOverlay('💀 FIN DE PARTIE', 'Score : ' + score);
  } else {
    player.x = 100;
    player.y = H - 160;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 90;
  }
}

function showOverlay(title, msg) {
  gameRunning = false;
  playMusic(menuMusic);
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent = msg;
  document.getElementById('overlay').style.display = 'flex';
}

// ---- DRAWING ----
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#1a0a2e');
  skyGrad.addColorStop(0.3, '#2d1b69');
  skyGrad.addColorStop(0.6, '#e8740c');
  skyGrad.addColorStop(1, '#f4a523');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Background image (parallax)
  let bgImg = imgs.bg1;
  if (level === 2) bgImg = imgs.bg2;
  if (level === 3) bgImg = imgs.bg3;

  if (bgImg && bgImg.complete) {
    const bgW = bgImg.width;
    const bgH = bgImg.height;
    const scale = Math.max(W / bgW, H / bgH);
    const drawW = bgW * scale;
    const drawH = bgH * scale;
    const bgX = -(cameraX * 0.3) % drawW;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(bgImg, bgX, (H - drawH) / 2, drawW, drawH);
    if (bgX + drawW < W) {
      ctx.drawImage(bgImg, bgX + drawW, (H - drawH) / 2, drawW, drawH);
    }
    ctx.globalAlpha = 1.0;
  }

  // Distant buildings silhouette (parallax layer 2)
  drawSilhouette(cameraX * 0.15, '#1a0a2e', 0.3);

  ctx.save();
  ctx.translate(-cameraX, 0);

  // Platforms
  for (const pl of levelData.platforms) {
    if (pl.x + pl.w < cameraX - 100 || pl.x > cameraX + W + 100) continue;
    if (pl.type === 'ground') {
      const grd = ctx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + pl.h);
      grd.addColorStop(0, '#8B4513');
      grd.addColorStop(0.3, '#A0522D');
      grd.addColorStop(1, '#654321');
      ctx.fillStyle = grd;
      ctx.fillRect(pl.x, pl.y, pl.w, pl.h);

      if (level === 2) {
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(pl.x, pl.y, pl.w, 8);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(pl.x, pl.y, pl.w, 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
    } else {
      const fpGrd = ctx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + pl.h);
      fpGrd.addColorStop(0, '#d4a574');
      fpGrd.addColorStop(1, '#b8860b');
      ctx.fillStyle = fpGrd;
      roundRect(ctx, pl.x, pl.y, pl.w, pl.h, 4);
      ctx.fill();
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = 2;
      roundRect(ctx, pl.x, pl.y, pl.w, pl.h, 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(pl.x + 4, pl.y + 2, pl.w - 8, 3);
    }
  }

  // Coins
  for (const c of levelData.coins) {
    if (c.collected) continue;
    if (c.x + c.w < cameraX - 50 || c.x > cameraX + W + 50) continue;
    const cy = c.y + Math.sin(frameCount * 0.08 + c.x) * 4;
    const coinGrd = ctx.createRadialGradient(c.x + 12, cy + 12, 2, c.x + 12, cy + 12, 14);
    coinGrd.addColorStop(0, '#fff5cc');
    coinGrd.addColorStop(0.5, '#f4a523');
    coinGrd.addColorStop(1, '#e8740c');

    if (level === 2) {
      ctx.shadowColor = '#f4a523';
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = coinGrd;
    ctx.beginPath();
    ctx.arc(c.x + 12, cy + 12, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('★', c.x + 12, cy + 16);
  }

  // Special Coin
  if (levelData.specialCoin && !levelData.specialCoin.collected) {
    const sc = levelData.specialCoin;
    if (sc.x + sc.w >= cameraX - 50 && sc.x <= cameraX + W + 50) {
      const cy = sc.y + Math.sin(frameCount * 0.1 + sc.x) * 6;
      const coinGrd = ctx.createRadialGradient(sc.x + 16, cy + 16, 2, sc.x + 16, cy + 16, 18);
      coinGrd.addColorStop(0, '#e0f7fa');
      coinGrd.addColorStop(0.5, '#00e5ff');
      coinGrd.addColorStop(1, '#00b8d4');

      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 25;

      ctx.fillStyle = coinGrd;
      ctx.beginPath();
      ctx.arc(sc.x + 16, cy + 16, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('P', sc.x + 16, cy + 22);
    }
  }

  // Enemies
  for (const e of levelData.enemies) {
    if (!e.alive) continue;
    if (e.x + e.w < cameraX - 50 || e.x > cameraX + W + 50) continue;
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(e.x + e.w / 2, e.y);
    ctx.lineTo(e.x + e.w, e.y + e.h);
    ctx.lineTo(e.x, e.y + e.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x + 8, e.y + e.h * 0.5);
    ctx.lineTo(e.x + e.w - 8, e.y + e.h * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.x + 4, e.y + e.h * 0.75);
    ctx.lineTo(e.x + e.w - 4, e.y + e.h * 0.75);
    ctx.stroke();
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h * 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex - 5, ey, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 5, ey, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(ex - 4, ey + 1, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 6, ey + 1, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Flag / Goal — level-specific
  if (levelData.flag) {
    const f = levelData.flag;
    // Pole
    ctx.fillStyle = '#888';
    ctx.fillRect(f.x + 16, f.y, 8, f.h);

    if (level === 1) {
      // 🇨🇮 Côte d'Ivoire flag (orange | white | green)
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(f.x + 24, f.y + 10, 15, 40);
      ctx.fillStyle = '#fff';
      ctx.fillRect(f.x + 39, f.y + 10, 15, 40);
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(f.x + 54, f.y + 10, 16, 40);
      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🇨🇮', f.x + 44, f.y + 70);
    } else if (level === 2) {
      // 🇧🇯 Bénin flag (green left | yellow top-right | red bottom-right)
      ctx.fillStyle = '#008751';
      ctx.fillRect(f.x + 24, f.y + 10, 18, 40);
      ctx.fillStyle = '#FCD116';
      ctx.fillRect(f.x + 42, f.y + 10, 28, 20);
      ctx.fillStyle = '#E8112D';
      ctx.fillRect(f.x + 42, f.y + 30, 28, 20);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🇧🇯', f.x + 44, f.y + 70);
    } else {
      // 🌍 World / Globe
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(f.x + 44, f.y + 30, 20, 0, Math.PI * 2);
      ctx.fill();
      // Green continents (simplified)
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.ellipse(f.x + 38, f.y + 25, 8, 12, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(f.x + 52, f.y + 28, 6, 8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2980b9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x + 44, f.y + 30, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌍', f.x + 44, f.y + 70);
    }

    // Building icon on top
    ctx.fillStyle = '#f4a523';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏗️', f.x + 20, f.y + 5);
  }

  // Collectible Signs
  for (const s of levelData.signs) {
    if (s.collected) continue;
    if (s.x < cameraX - 100 || s.x > cameraX + W + 100) continue;

    // Highlight next collectible sign, grey out others
    const isActive = player && s.index === player.currentSignIndex;
    ctx.globalAlpha = isActive ? 1.0 : 0.4;

    // Post
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(s.x + 36, s.y - 30, 8, 30);

    // Board
    if (isActive) {
      ctx.shadowColor = '#fcd116';
      ctx.shadowBlur = 15;
    }
    ctx.fillStyle = '#f4a523'; // Golden board for collectibles
    ctx.fillRect(s.x, s.y - 50, 80, 24);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x, s.y - 50, 80, 24);

    // Text
    ctx.fillStyle = '#1a0a2e';
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.text, s.x + 40, s.y - 34);

    ctx.globalAlpha = 1.0;
  }

  // Player
  if (player) {
    const p = player;
    if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0) {
      // Blinking
    } else {
      drawPlayer(p);
    }
  }

  // Particles
  for (const pt of particles) {
    ctx.globalAlpha = pt.life / 50;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawPlayer(p) {
  let sheetKey;
  if (p.superTimer > 0) {
    if (p.superTimer <= 180 && Math.floor(frameCount / 5) % 2 === 0) {
      sheetKey = selectedChar + '_sheet'; // Flicker warning
    } else {
      sheetKey = selectedChar + '_inv'; // e.g. koffi_inv or diabate_inv
    }
  } else {
    sheetKey = selectedChar + '_sheet';
  }

  const sheet = imgs[sheetKey];
  if (sheet && sheet.complete && sheet.naturalWidth > 0) {
    ctx.save();
    if (p.facing === -1) {
      ctx.translate(p.x + p.w / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(p.x + p.w / 2), 0);
    }

    // 4 columns × 2 rows grid
    const cols = 4;
    const rows = 2;
    const frameW = sheet.naturalWidth / cols;
    const frameH = sheet.naturalHeight / rows;
    const frame = Math.max(0, Math.min(p.animFrame, cols * rows - 1));
    const col = frame % cols;
    const row = Math.floor(frame / cols);
    const sx = col * frameW;
    const sy = row * frameH;

    // Fix sprite cropping and character Y offset:
    // Some sprite sheets have bounding boxes that crop hands/feet if drawn exactly at bounds.
    // Drawing the slice slightly larger guarantees the whole frame is visible without getting cut.
    const drawW = 72; // Increased size to prevent horizontal cropping
    const drawH = (frameH / frameW) * drawW;

    // Y-Offset adjustment: Visually sink the character down slightly to overlap 
    // the green grass line, neutralizing the floating appearance entirely.
    const drawY = p.y + p.h - drawH + 3;

    ctx.drawImage(sheet, sx, sy, frameW, frameH,
      p.x - 14, drawY, drawW, drawH);

    ctx.restore();
  } else {
    // Fallback: use static sprite
    const img = imgs[selectedChar];
    if (img && img.complete) {
      ctx.save();
      if (p.facing === -1) {
        ctx.translate(p.x + p.w / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(p.x + p.w / 2), 0);
      }
      const drawW = 72;
      const drawH = 80;
      const drawY = p.y + p.h - drawH + 3;
      ctx.drawImage(img, p.x - 14, drawY, drawW, drawH);
      ctx.restore();
    } else {
      ctx.fillStyle = selectedChar === 'koffi' ? '#f39c12' : '#3498db';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }
}

function drawSilhouette(offsetX, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const buildings = [
    { x: 100, w: 60, h: 120 }, { x: 200, w: 40, h: 180 }, { x: 280, w: 80, h: 100 },
    { x: 400, w: 50, h: 200 }, { x: 500, w: 70, h: 140 }, { x: 620, w: 45, h: 170 },
    { x: 700, w: 90, h: 90 }, { x: 850, w: 55, h: 160 }, { x: 950, w: 65, h: 130 },
    { x: 1050, w: 80, h: 190 }, { x: 1180, w: 40, h: 110 }, { x: 1260, w: 70, h: 150 }
  ];
  for (const b of buildings) {
    const bx = ((b.x - offsetX) % 1400 + 1400) % 1400;
    ctx.fillRect(bx, H - 60 - b.h, b.w, b.h + 60);
    if (b.h > 150) {
      ctx.beginPath();
      ctx.arc(bx + b.w / 2, H - 60 - b.h, b.w / 2.5, Math.PI, 0);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ---- GAME LOOP ----
function gameLoop() {
  if (!gameRunning) return;
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ---- WINDOW FOCUS HANDLING ----
window.addEventListener('blur', () => { keys = {}; });
