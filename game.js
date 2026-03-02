// ============================================================
// ARCHITECTE EN DÉVELOPPEMENT
// Côte d'Ivoire • Bénin • Le Monde Entier
// Game Engine
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---- FIREBASE INIT ----
const firebaseConfig = {
  apiKey: "AIzaSyCJXfYPozFDr-MfLeowraXnTDmGbQbkgmE",
  authDomain: "kd-aventure.firebaseapp.com",
  projectId: "kd-aventure",
  storageBucket: "kd-aventure.firebasestorage.app",
  messagingSenderId: "146622414027",
  appId: "1:146622414027:web:eb66bb0869b78b702cef4e"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ---- GLOBALS ----
let W, H;
const G_SCALE = 1.35;
let selectedChar = null;
let gameRunning = false;
let gamePaused = false;
let soundMuted = localStorage.getItem('kd_muted') === 'true';
let score = 0;
let lives = 3;
let level = 1;
let cameraX = 0;
let keys = {};
let particles = [];
let frameCount = 0;
let bgElements = [];
let lastCheckpointX = 100;
let screenShake = 0;
let cashTransition = 0;  // countdown before level transition after HONORAIRES
let tutorialActive = false;
let tutorialShown = localStorage.getItem('kd_tutorial_shown') === 'true';

const MUSIC_VOLUME = 0.4;
const SFX_VOLUME = 1.0;
const SIGN_NAMES = ['ESQ', 'APS', 'APD', 'DCE', 'DAO', 'CHT', 'LIV'];
const SIGN_FULL = ['ESQUISSE', 'APS', 'APD', 'DCE', 'DAO', 'Chantier', 'Livraison'];

// ---- BOSS DEFINITIONS ----
const BOSS_DEFS = [
  { drawW: 110, drawH: 110, w: 88,  h: 82,  hp: 3, name: 'Client Gaou'   },
  { drawW: 130, drawH: 130, w: 104, h: 97,  hp: 3, name: 'Administration' },
  { drawW: 150, drawH: 150, w: 120, h: 112, hp: 3, name: 'Budget'         },
];

// ---- RESIZE ----
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.setTransform(G_SCALE, 0, 0, G_SCALE, 0, 0);
  W = canvas.width / G_SCALE;
  H = canvas.height / G_SCALE;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

// ---- LOAD IMAGES ----
const imgs = {};
let imgsLoaded = 0;
let imgsTotal = 0;

function loadImg(name, src) {
  imgsTotal++;
  const img = new Image();
  img.onload = function () {
    imgsLoaded++;
    const pct = Math.floor((imgsLoaded / imgsTotal) * 100);
    const bar = document.getElementById('loading-bar-fill');
    if (bar) bar.style.width = pct + '%';
    if (imgsLoaded >= imgsTotal) onAllImagesLoaded();
  };
  img.onerror = function () {
    imgsLoaded++;
    if (imgsLoaded >= imgsTotal) onAllImagesLoaded();
  };
  img.src = src;
  imgs[name] = img;
}

function onAllImagesLoaded() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('title-screen').style.display = 'flex';
  setLandingBg();
}

loadImg('koffi', 'koffi_sprite.png');
loadImg('diabate', 'diabate_sprite.png');
loadImg('bg1', 'Background2.png');
loadImg('bg2', 'bg_level2_2.png');
loadImg('bg3', 'bg_level3.png');
loadImg('koffi_sheet', 'koffi_sheet.png');
loadImg('diabate_sheet', 'diabate_sheet.png');
loadImg('koffi_inv', 'invisible_Koffi.png');
loadImg('diabate_inv', 'invisible_diabate.png');
loadImg('landing_bg', 'landing_bg.png');
loadImg('archie1', 'Archimonster/ArchiMonster.png');
loadImg('archie2', 'Archimonster/ArchiMonster 2.png');
loadImg('cash', 'pileofcash.png');

// Sprite sheet config: 4 cols x 2 rows = 8 frames
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
  audio.volume = soundMuted ? 0 : MUSIC_VOLUME;
  return audio;
}

function initAudio() {
  if (!menuMusic) {
    menuMusic = createAudio('music_menu.mp3', true);
    gameMusic1 = createAudio('music_gameplay.mp3', true);
    gameMusic2 = createAudio('music_level2.mp3?v=2', true);
    gameMusic3 = createAudio('SONGS/Gameplay music groove level 3-2.mp3', true);
    invincibleMusic = createAudio('music_invincible.mp3?v=2', true);
    jumpSound = createAudio('SONGS/jump_sound_in_game.mp3', false);
    jumpSound.volume = soundMuted ? 0 : SFX_VOLUME;
  }
  // Update sound toggle button
  document.getElementById('sound-toggle').textContent = soundMuted ? '🔇' : '🔊';
}

function toggleSound() {
  soundMuted = !soundMuted;
  localStorage.setItem('kd_muted', soundMuted);
  document.getElementById('sound-toggle').textContent = soundMuted ? '🔇' : '🔊';
  const vol = soundMuted ? 0 : MUSIC_VOLUME;
  if (menuMusic) menuMusic.volume = vol;
  if (gameMusic1) gameMusic1.volume = vol;
  if (gameMusic2) gameMusic2.volume = vol;
  if (gameMusic3) gameMusic3.volume = vol;
  if (invincibleMusic) invincibleMusic.volume = vol;
  if (jumpSound) jumpSound.volume = soundMuted ? 0 : SFX_VOLUME;
  if (currentMusic) currentMusic.volume = vol;
}

function playSynthesizedSound(type) {
  if (soundMuted) return;
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
  } else if (type === 'break') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.1);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'death') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.6);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.7);
  } else if (type === 'doublejump') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.15);
    // Second tone
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(2000, now + 0.14);
    gain2.gain.setValueAtTime(0.2, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.2);
  } else if (type === 'checkpoint') {
    // Pleasant ascending arpeggio
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, now + i * 0.1);
      g.gain.setValueAtTime(0.25, now + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
      o.start(now + i * 0.1);
      o.stop(now + i * 0.1 + 0.25);
    });
  } else if (type === 'groundpound') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'swoosh') {
    // Airy high-to-low sweep for Koffi dash
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.18);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.25);
    // Second layer — breathy whistle
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(900, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.15);
    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc2.start(now);
    osc2.stop(now + 0.22);
  } else if (type === 'bossHit') {
    // Heavy thud when boss takes damage
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.35);
  } else if (type === 'fireball') {
    // Crackly fire whoosh
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.28);
  }
}

// ---- VICTORY FANFARE — played when player touches the HONORAIRES cash pile ----
function playVictoryFanfare() {
  if (!audioCtx) return;
  if (soundMuted) return;
  const vol = 0.28;
  const now = audioCtx.currentTime;

  function note(freq, startTime, duration, type = 'square') {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, now + startTime);
    g.gain.setValueAtTime(vol, now + startTime);
    g.gain.exponentialRampToValueAtTime(0.001, now + startTime + duration);
    o.start(now + startTime);
    o.stop(now + startTime + duration + 0.05);
  }

  // Ascending arpeggio → final major chord  (~2.0 s total)
  note(392.00, 0.00, 0.13);  // G4
  note(523.25, 0.14, 0.13);  // C5
  note(659.25, 0.28, 0.13);  // E5
  note(783.99, 0.42, 0.13);  // G5
  note(1046.5, 0.56, 0.22);  // C6
  // Final triumphant chord (C major)
  note(523.25, 0.90, 0.85);  // C5
  note(659.25, 0.90, 0.85);  // E5
  note(783.99, 0.90, 0.85);  // G5
  note(1046.5, 0.90, 0.85);  // C6
}

function playMusic(music) {
  if (currentMusic === music) return;
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
  }
  currentMusic = music;
  if (music) {
    music.volume = soundMuted ? 0 : MUSIC_VOLUME;
    music.play().catch(() => { });
  }
}

function playJumpSfx() {
  if (soundMuted) return;
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

// Init sound toggle button on load
document.getElementById('sound-toggle').textContent = soundMuted ? '🔇' : '🔊';

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

// ---- BACKGROUND ELEMENTS ----
function initBgElements(lvl) {
  bgElements = [];
  if (lvl === 1) {
    // Clouds
    for (let i = 0; i < 5; i++) {
      bgElements.push({
        type: 'cloud', x: Math.random() * W, y: 30 + Math.random() * 80,
        speed: 0.1 + Math.random() * 0.2, width: 60 + Math.random() * 50
      });
    }
    // Birds
    for (let i = 0; i < 3; i++) {
      bgElements.push({
        type: 'bird', x: Math.random() * W, y: 50 + Math.random() * 100,
        speed: 0.4 + Math.random() * 0.3, wingPhase: Math.random() * Math.PI * 2
      });
    }
  } else if (lvl === 2) {
    // Floating neon lights
    for (let i = 0; i < 10; i++) {
      bgElements.push({
        type: 'light', x: Math.random() * W, y: Math.random() * H * 0.7,
        speed: 0.05 + Math.random() * 0.1, phase: Math.random() * Math.PI * 2,
        size: 2 + Math.random() * 3
      });
    }
    // Twinkling stars
    for (let i = 0; i < 20; i++) {
      bgElements.push({
        type: 'bgstar', x: Math.random() * W, y: Math.random() * H * 0.5,
        phase: Math.random() * Math.PI * 2, size: 1 + Math.random()
      });
    }
  } else if (lvl === 3) {
    // Satellites
    for (let i = 0; i < 2; i++) {
      bgElements.push({
        type: 'satellite', x: Math.random() * W, y: 20 + Math.random() * 40,
        speed: 0.15 + Math.random() * 0.1
      });
    }
  }
}

function updateBgElements() {
  for (const el of bgElements) {
    if (el.type === 'cloud' || el.type === 'bird' || el.type === 'satellite') {
      el.x += el.speed;
      if (el.x > W + 100) el.x = -100;
    } else if (el.type === 'light') {
      el.y -= el.speed;
      el.x += Math.sin(frameCount * 0.02 + el.phase) * 0.3;
      if (el.y < -10) { el.y = H * 0.7; el.x = Math.random() * W; }
    }
  }
  // Shooting stars for level 3
  if (level === 3 && frameCount % 300 === 0) {
    bgElements.push({
      type: 'shootingStar', x: Math.random() * W * 0.8, y: Math.random() * 60,
      life: 25, speed: 4
    });
  }
  // Clean up expired shooting stars
  for (let i = bgElements.length - 1; i >= 0; i--) {
    if (bgElements[i].type === 'shootingStar') {
      bgElements[i].life--;
      bgElements[i].x += bgElements[i].speed;
      bgElements[i].y += bgElements[i].speed * 0.6;
      if (bgElements[i].life <= 0) bgElements.splice(i, 1);
    }
  }
}

function drawBgElements() {
  for (const el of bgElements) {
    if (el.type === 'cloud') {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#fff';
      const cx = el.x, cy = el.y, w = el.width;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.2, 0, Math.PI * 2);
      ctx.arc(cx + w * 0.25, cy - w * 0.08, w * 0.25, 0, Math.PI * 2);
      ctx.arc(cx + w * 0.55, cy, w * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (el.type === 'bird') {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#1a0a2e';
      ctx.lineWidth = 1.5;
      const wing = Math.sin(frameCount * 0.12 + el.wingPhase) * 6;
      ctx.beginPath();
      ctx.moveTo(el.x - 6, el.y + wing);
      ctx.lineTo(el.x, el.y);
      ctx.lineTo(el.x + 6, el.y + wing);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (el.type === 'light') {
      const alpha = 0.3 + Math.sin(frameCount * 0.05 + el.phase) * 0.3;
      ctx.globalAlpha = alpha;
      const color = Math.sin(frameCount * 0.02 + el.phase) > 0 ? '#00e5ff' : '#f4a523';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(el.x, el.y, el.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    } else if (el.type === 'bgstar') {
      const alpha = 0.3 + Math.sin(frameCount * 0.04 + el.phase) * 0.4;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(el.x, el.y, el.size, el.size);
      ctx.globalAlpha = 1;
    } else if (el.type === 'satellite') {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#95a5a6';
      ctx.fillRect(el.x - 2, el.y - 2, 4, 4);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(el.x - 8, el.y - 1, 6, 2);
      ctx.fillRect(el.x + 2, el.y - 1, 6, 2);
      ctx.globalAlpha = 1;
    } else if (el.type === 'shootingStar') {
      ctx.globalAlpha = el.life / 25;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(el.x - 20, el.y - 12);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

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

  // Enemies with types
  const numEnemies = 8 + lvl * 4;
  const floatPlats = platforms.filter(p => p.type === 'float');
  let platformEnemyCount = 0;

  for (let i = 0; i < numEnemies; i++) {
    let etype = 'patrol';
    if (lvl >= 2) {
      const roll = Math.random();
      if (roll < 0.25 && platformEnemyCount < floatPlats.length) etype = 'platform';
      else if (roll < 0.5) etype = 'fast';
      if (lvl === 3 && roll >= 0.5 && roll < 0.75) etype = 'chaser';
    }

    if (etype === 'platform' && floatPlats.length > 0) {
      const plat = floatPlats[platformEnemyCount % floatPlats.length];
      platformEnemyCount++;
      const ex = plat.x + plat.w / 2 - 18;
      enemies.push({
        x: ex, y: plat.y - 36, w: 36, h: 36,
        vx: (0.6 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1),
        alive: true, startX: ex, range: Math.max(20, plat.w / 2 - 20),
        type: etype, stunTimer: 0, platformRef: plat
      });
    } else {
      const spd = etype === 'fast' ? (1.8 + Math.random() * 1.2) : (0.8 + Math.random() * 1.2);
      const ex = 400 + Math.random() * (levelWidth - 600);
      enemies.push({
        x: ex, y: H - 100, w: 36, h: 36,
        vx: spd * (Math.random() < 0.5 ? 1 : -1),
        alive: true, startX: ex, range: etype === 'fast' ? 80 : (120 + Math.random() * 80),
        type: etype, stunTimer: 0
      });
    }
  }

  // Goal flag
  const flag = { x: levelWidth - 200, y: H - 260, w: 40, h: 200 };

  // Signs
  const signs = [];
  const texts = ['ESQUISSE', 'APS', 'APD', 'DCE', 'DAO', 'Chantier'];
  for (let i = 0; i < texts.length; i++) {
    const sx = 800 + i * ((levelWidth - 1800) / texts.length);
    signs.push({ x: sx, y: H - 60, w: 80, h: 50, text: texts[i], index: i, collected: false });
  }
  signs.push({ x: levelWidth - 320, y: H - 60, w: 80, h: 50, text: 'Livraison', index: texts.length, collected: false });

  // Special Coin
  let specialCoinX;
  if (lvl === 3) specialCoinX = flag.x - 300;
  else specialCoinX = levelWidth / 2 + Math.random() * 500;
  const specialCoin = { x: specialCoinX, y: H - 180, w: 32, h: 32, collected: false };

  // Checkpoints
  const checkpoints = [];
  const cpPositions = [Math.floor(levelWidth / 3), Math.floor(levelWidth * 2 / 3)];
  if (lvl === 3) cpPositions.push(Math.floor(levelWidth * 0.8));
  for (const cx of cpPositions) {
    checkpoints.push({ x: cx, y: H - 140, w: 16, h: 80, activated: false });
  }

  // Init background elements
  initBgElements(lvl);

  // ---- BOSS ----
  const def = BOSS_DEFS[lvl - 1];
  const bossX = levelWidth - 600;
  const boss = {
    x: bossX,
    y: H - 60 - def.h,
    w: def.w, h: def.h,
    drawW: def.drawW, drawH: def.drawH,
    hp: def.hp, maxHp: def.hp,
    name: def.name,
    alive: true,
    vx: 0.6,
    startX: bossX,
    range: 80,       // small patrol range
    facing: -1,      // -1 = left (natural sprite orientation)
    animFrame: 0,
    animTimer: 0,
    hitTimer: 0,     // flash when hit
    fireTimer: lvl === 3 ? 210 : 0,
  };

  // ---- CASH PILE (HONORAIRES) — sits at the base of the flag pole ----
  const cashW = 180, cashH = 140;
  const cashPile = {
    x: flag.x + 20 - cashW / 2,   // centred on pole (pole centre = flag.x + 20)
    y: H - 60 - cashH,             // resting on the ground
    w: cashW,
    h: cashH,
    triggered: false,
  };

  return { platforms, coins, enemies, flag, signs, specialCoin, checkpoints, boss, bossFireballs: [], cashPile, width: levelWidth };
}

// ---- PLAYER ----
let player = null;
let levelData = null;

function createPlayer(x = 100, y = H - 200) {
  return {
    x, y,
    w: 36, h: 48,
    vx: 0, vy: 0,
    speed: 4, jumpPower: -9.5,
    onGround: false,
    facing: 1,
    animFrame: 0,
    animTimer: 0,
    jumpCount: 0,
    invincible: 0,
    superTimer: 0,
    prevState: 'idle',
    currentSignIndex: 0,
    // Ground pound (Diabate)
    groundPoundActive: false,
    groundPoundCooldown: 0,
    groundPoundLanding: 0,
    // Dash (Koffi)
    dashActive: false,
    dashTimer: 0,
    dashCooldown: 0,
    // Double jump ring effect
    doubleJumpRing: 0
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
  lastCheckpointX = 100;
  gamePaused = false;
  updateHUD();
  player = createPlayer();
  levelData = generateLevel(level);
  cameraX = 0;
  gameRunning = true;
  particles = [];

  // Tutorial
  if (!tutorialShown) {
    tutorialActive = true;
  }

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
  lastCheckpointX = 100;
  particles = [];
  updateHUD();
}

// ---- PAUSE ----
function togglePause() {
  if (!gameRunning) return;
  gamePaused = !gamePaused;
  if (gamePaused) {
    if (currentMusic) currentMusic.pause();
  } else {
    if (currentMusic) currentMusic.play().catch(() => { });
    requestAnimationFrame(gameLoop);
  }
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
  // Sign tracker
  const st = document.getElementById('sign-tracker');
  st.innerHTML = '';
  const idx = player ? player.currentSignIndex : 0;
  for (let i = 0; i < SIGN_NAMES.length; i++) {
    const s = document.createElement('span');
    s.className = 'sign-step';
    if (i < idx) s.classList.add('collected');
    else if (i === idx) s.classList.add('active');
    s.textContent = SIGN_NAMES[i];
    st.appendChild(s);
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

function spawnRingParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * 3,
      vy: Math.sin(angle) * 3 - 1,
      life: 20 + Math.random() * 10,
      color, size: 2 + Math.random() * 2
    });
  }
}

// ---- INPUT ----
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if ((e.code === 'Escape' || e.code === 'KeyP') && gameRunning) {
    togglePause();
  }
  // Tutorial dismiss
  if (tutorialActive && gameRunning) {
    tutorialActive = false;
    tutorialShown = true;
    localStorage.setItem('kd_tutorial_shown', 'true');
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Dismiss tutorial on any tap (mobile doesn't fire keydown from touch buttons)
document.addEventListener('touchstart', () => {
  if (tutorialActive && gameRunning) {
    tutorialActive = false;
    tutorialShown = true;
    localStorage.setItem('kd_tutorial_shown', 'true');
  }
}, { passive: true });

// Mobile controls
['btn-left', 'btn-right', 'btn-jump', 'btn-down'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  const code = id === 'btn-left' ? 'ArrowLeft' : id === 'btn-right' ? 'ArrowRight' : id === 'btn-down' ? 'ArrowDown' : 'Space';

  el.addEventListener('touchstart', e => {
    e.preventDefault();
    keys[code] = true;
    // Short haptic pulse (Android Chrome + iOS Safari 13+)
    if (navigator.vibrate) navigator.vibrate(8);
  }, { passive: false });

  el.addEventListener('touchend', e => {
    e.preventDefault();
    keys[code] = false;
  }, { passive: false });

  // Fires when a phone call, notification, or system gesture steals the touch —
  // without this the key stays "stuck" until the next touchstart
  el.addEventListener('touchcancel', e => {
    e.preventDefault();
    keys[code] = false;
  }, { passive: false });

  // Releases the key cleanly when the player slides a finger off the button
  el.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = el.getBoundingClientRect();
    const inside = touch.clientX >= rect.left && touch.clientX <= rect.right &&
                   touch.clientY >= rect.top  && touch.clientY <= rect.bottom;
    keys[code] = inside;
  }, { passive: false });
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

  // Update background elements
  updateBgElements();

  // Input
  if (keys['ArrowLeft'] || keys['KeyA']) { p.vx -= 0.8; p.facing = -1; }
  if (keys['ArrowRight'] || keys['KeyD']) { p.vx += 0.8; p.facing = 1; }

  // Jump
  if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && p.jumpCount < MAX_JUMPS) {
    const isDoubleJump = p.jumpCount === 1;
    p.vy = p.superTimer > 0 ? JUMP_FORCE * 1.3 : JUMP_FORCE;
    p.jumpCount++;
    keys['Space'] = false; keys['ArrowUp'] = false; keys['KeyW'] = false;

    if (isDoubleJump) {
      spawnRingParticles(p.x + p.w / 2, p.y + p.h, '#00e5ff', 8);
      spawnParticles(p.x + p.w / 2, p.y + p.h, '#00e5ff', 10);
      playSynthesizedSound('doublejump');
      p.doubleJumpRing = 12;
    } else {
      spawnParticles(p.x + p.w / 2, p.y + p.h, p.superTimer > 0 ? '#fff' : '#f4a523', 5);
      playJumpSfx();
    }
  }

  // Diabate ground pound
  if (selectedChar === 'diabate' && !p.onGround && !p.groundPoundActive && p.groundPoundCooldown <= 0) {
    if (keys['ArrowDown'] || keys['KeyS']) {
      p.groundPoundActive = true;
      p.vy = 16;
      p.vx = 0;
      keys['ArrowDown'] = false;
      keys['KeyS'] = false;
    }
  }

  // Koffi dash
  if (selectedChar === 'koffi' && p.onGround && !p.dashActive && p.dashCooldown <= 0) {
    if (keys['ArrowDown'] || keys['KeyS']) {
      p.dashActive = true;
      p.dashTimer = 18; // ~0.3 seconds at 60fps
      p.vx = p.facing * MOVE_SPEED * 3.5;
      keys['ArrowDown'] = false;
      keys['KeyS'] = false;
      playSynthesizedSound('swoosh');
      spawnParticles(p.x + p.w / 2, p.y + p.h / 2, '#f39c12', 8);
    }
  }

  // Clamp speed (skip during ground pound or dash)
  if (!p.groundPoundActive && !p.dashActive) {
    p.vx = Math.max(-spd, Math.min(spd, p.vx));
    p.vx *= FRICTION;
  }
  p.vy += GRAVITY;
  if (p.vy > 16) p.vy = 16;

  // Timers
  if (p.groundPoundCooldown > 0) p.groundPoundCooldown--;
  if (p.groundPoundLanding > 0) p.groundPoundLanding--;
  if (p.doubleJumpRing > 0) p.doubleJumpRing--;
  if (p.dashCooldown > 0) p.dashCooldown--;

  // Koffi dash active
  if (p.dashActive && p.dashTimer > 0) {
    p.dashTimer--;
    // Speed trail particles behind player
    if (frameCount % 2 === 0) {
      particles.push({
        x: p.x + (p.facing === 1 ? 0 : p.w),
        y: p.y + p.h * 0.3 + Math.random() * p.h * 0.4,
        vx: -p.facing * (1 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 0.8,
        life: 12 + Math.random() * 8,
        color: '#f39c12',
        size: 2 + Math.random() * 3
      });
      particles.push({
        x: p.x + (p.facing === 1 ? 0 : p.w),
        y: p.y + p.h * 0.5 + Math.random() * p.h * 0.3,
        vx: -p.facing * (0.5 + Math.random() * 1.5),
        vy: (Math.random() - 0.5) * 0.5,
        life: 8 + Math.random() * 6,
        color: '#e8740c',
        size: 1.5 + Math.random() * 2
      });
    }
    if (p.dashTimer <= 0) {
      p.dashActive = false;
      p.dashCooldown = 45; // cooldown ~0.75s
    }
  }

  // Move X
  p.x += p.vx;
  for (let i = levelData.platforms.length - 1; i >= 0; i--) {
    const pl = levelData.platforms[i];
    if (rectOverlap(p, pl)) {
      if ((p.superTimer > 0 || p.groundPoundActive) && pl.type === 'float') {
        levelData.platforms.splice(i, 1);
        spawnParticles(pl.x + pl.w / 2, pl.y + pl.h / 2, '#8B4513', 15);
        playSynthesizedSound('break');
        score += 20;
        updateHUD();
        // Kill platform enemies on this platform
        for (const e of levelData.enemies) {
          if (e.alive && e.type === 'platform' && e.platformRef === pl) {
            e.alive = false;
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#e74c3c', 10);
            score += 25;
          }
        }
        continue;
      }
      if (p.vx > 0) p.x = pl.x - p.w;
      else p.x = pl.x + pl.w;
      p.vx = 0;
    }
  }

  // Move Y
  p.onGround = false;
  p.y += p.vy;
  for (let i = levelData.platforms.length - 1; i >= 0; i--) {
    const pl = levelData.platforms[i];
    if (rectOverlap(p, pl)) {
      if ((p.superTimer > 0 || p.groundPoundActive) && pl.type === 'float') {
        levelData.platforms.splice(i, 1);
        spawnParticles(pl.x + pl.w / 2, pl.y + pl.h / 2, '#8B4513', 15);
        playSynthesizedSound('break');
        score += 20;
        updateHUD();
        for (const e of levelData.enemies) {
          if (e.alive && e.type === 'platform' && e.platformRef === pl) {
            e.alive = false;
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#e74c3c', 10);
            score += 25;
          }
        }
        continue;
      }
      if (p.vy > 0) {
        p.y = pl.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumpCount = 0;

        // Ground pound landing
        if (p.groundPoundActive) {
          p.groundPoundActive = false;
          p.groundPoundCooldown = 60;
          p.groundPoundLanding = 15;
          screenShake = 5;
          spawnParticles(p.x + p.w / 2, p.y + p.h, '#8B6914', 20);
          playSynthesizedSound('groundpound');
          // Stun nearby enemies
          for (const e of levelData.enemies) {
            if (e.alive && Math.abs(e.x - p.x) < 120 && Math.abs(e.y - p.y) < 80) {
              e.stunTimer = 90;
            }
          }
        }
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
      if (!dur || isNaN(dur) || dur === Infinity) dur = 10.5;
      p.superTimer = Math.floor(dur * 60);
      spawnParticles(levelData.specialCoin.x + 16, levelData.specialCoin.y + 16, '#00e5ff', 40);
      playSynthesizedSound('coin');
      playMusic(invincibleMusic);
    }
  }

  // Checkpoints
  for (const cp of levelData.checkpoints) {
    if (!cp.activated && rectOverlap(p, cp)) {
      cp.activated = true;
      lastCheckpointX = cp.x;
      spawnParticles(cp.x + 8, cp.y, '#f4a523', 20);
      playSynthesizedSound('checkpoint');
    }
  }

  // ---- BOSS UPDATE ----
  if (levelData.boss && levelData.boss.alive) {
    const b = levelData.boss;

    // Small patrol left-right
    if (Math.abs(b.x - b.startX) > b.range) b.vx *= -1;
    b.x += b.vx;
    b.facing = b.vx < 0 ? -1 : 1;

    // Timers
    if (b.hitTimer > 0) b.hitTimer--;
    b.animTimer++;
    if (b.animTimer >= 22) { b.animFrame = (b.animFrame + 1) % 2; b.animTimer = 0; }

    // Level 3 fire attack
    if (level === 3 && b.fireTimer > 0) {
      b.fireTimer--;
      if (b.fireTimer === 0) {
        const fx = b.facing === -1 ? b.x : b.x + b.w;
        levelData.bossFireballs.push({
          x: fx, y: b.y + b.h * 0.4,
          vx: b.facing * 3.5,
          w: 22, h: 14, alive: true, life: 200
        });
        playSynthesizedSound('fireball');
        b.fireTimer = 210; // ~3.5 s between shots
      }
    }

    // Player ↔ boss collision
    if (rectOverlap(p, b)) {
      const stomping = p.vy > 0 && (p.y + p.h - b.y) < 38;
      const powerHit = p.superTimer > 0 || p.groundPoundActive || p.dashActive;

      if ((stomping || powerHit) && b.hitTimer === 0) {
        b.hp--;
        b.hitTimer = 35;
        p.vy = -9;   // bounce player up
        screenShake = 4;
        spawnParticles(b.x + b.w / 2, b.y, '#e74c3c', 14);
        playSynthesizedSound('bossHit');
        if (b.hp <= 0) {
          b.alive = false;
          score += 200;
          updateHUD();
          spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#f4a523', 30);
          playSynthesizedSound('stomp');
        }
      } else if (!stomping && !powerHit && p.invincible <= 0 && b.hitTimer === 0) {
        loseLife(); return;
      }
    }
  }

  // ---- FIREBALL UPDATE ----
  if (levelData.bossFireballs) {
    for (let i = levelData.bossFireballs.length - 1; i >= 0; i--) {
      const fb = levelData.bossFireballs[i];
      if (!fb.alive) { levelData.bossFireballs.splice(i, 1); continue; }
      fb.x += fb.vx;
      fb.life--;
      if (fb.life <= 0) { levelData.bossFireballs.splice(i, 1); continue; }
      if (rectOverlap(p, fb) && p.invincible <= 0 && p.superTimer <= 0) {
        fb.alive = false;
        loseLife(); return;
      }
    }
  }

  // Enemies
  for (const e of levelData.enemies) {
    if (!e.alive) continue;

    // Stun timer
    if (e.stunTimer > 0) {
      e.stunTimer--;
    } else {
      // Movement by type
      if (e.type === 'chaser' && Math.abs(p.x - e.x) < 200) {
        e.vx += (p.x > e.x ? 0.15 : -0.15);
        e.vx = Math.max(-2.5, Math.min(2.5, e.vx));
      } else {
        // Patrol (default, fast, platform)
        if (Math.abs(e.x - e.startX) > e.range) e.vx *= -1;
      }
      e.x += e.vx;
    }

    // Snap to platforms
    for (const pl of levelData.platforms) {
      if (e.x + e.w > pl.x && e.x < pl.x + pl.w && Math.abs((e.y + e.h) - pl.y) < 5) {
        e.y = pl.y - e.h;
      }
    }

    // Player collision
    if (rectOverlap(p, e)) {
      if (p.superTimer > 0 || p.groundPoundActive || p.dashActive) {
        e.alive = false;
        score += 50;
        updateHUD();
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, p.dashActive ? '#f39c12' : '#fff', 15);
        playSynthesizedSound('stomp');
      } else if (p.invincible <= 0) {
        if (p.vy > 0 && p.y + p.h - e.y < 20) {
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

  // Signs
  for (const s of levelData.signs) {
    if (!s.collected && rectOverlap(p, { x: s.x, y: s.y - 50, w: s.w, h: s.h })) {
      if (s.index === p.currentSignIndex) {
        s.collected = true;
        p.currentSignIndex++;
        score += 100;
        updateHUD();
        spawnParticles(s.x + 40, s.y - 25, '#f4a523', 25);
        playSynthesizedSound('coin');
      }
    }
  }

  // ---- CASH PILE (HONORAIRES) — end-of-level trigger ----
  if (levelData.cashPile && !levelData.cashPile.triggered && rectOverlap(p, levelData.cashPile)) {
    levelData.cashPile.triggered = true;
    cashTransition = 165;          // ~2.75 s at 60 fps (fanfare is ~1.75 s + brief pause)
    if (currentMusic) { currentMusic.pause(); }
    playVictoryFanfare();
    screenShake = 5;
    spawnParticles(levelData.cashPile.x + levelData.cashPile.w / 2, levelData.cashPile.y, '#f4d03f', 22);
    spawnParticles(levelData.cashPile.x + levelData.cashPile.w / 2, levelData.cashPile.y + 30, '#27ae60', 14);
  }

  // Countdown → level transition
  if (cashTransition > 0) {
    cashTransition--;
    if (cashTransition === 0) {
      // Same transition logic as flag
      if (level < 3) {
        level++;
        player.x = 100;
        player.y = H - 200;
        player.vx = 0;
        player.vy = 0;
        player.currentSignIndex = 0;
        player.groundPoundActive = false;
        player.groundPoundCooldown = 0;
        player.dashActive = false;
        player.dashTimer = 0;
        player.dashCooldown = 0;
        lastCheckpointX = 100;
        levelData = generateLevel(level);
        updateHUD();
        if (level === 2) playMusic(gameMusic2);
        if (level === 3) playMusic(gameMusic3);
      } else {
        gameRunning = false;
        playMusic(menuMusic);
        document.getElementById('hud').style.display = 'none';
        if ('ontouchstart' in window) {
          document.getElementById('mobile-controls').style.display = 'none';
        }
        document.getElementById('victory-score-msg').textContent = 'Ton Score Final : ' + score;
        document.getElementById('victory-char-img').src = 'select_' + selectedChar + '.png';
        document.getElementById('victory-screen').style.display = 'flex';
      }
      return;
    }
  }

  // Flag / Goal (fallback — also works if player skips the cash pile)
  if (cashTransition <= 0 && rectOverlap(p, levelData.flag)) {
    if (level < 3) {
      level++;
      player.x = 100;
      player.y = H - 200;
      player.vx = 0;
      player.vy = 0;
      player.currentSignIndex = 0;
      player.groundPoundActive = false;
      player.groundPoundCooldown = 0;
      player.dashActive = false;
      player.dashTimer = 0;
      player.dashCooldown = 0;
      lastCheckpointX = 100;
      levelData = generateLevel(level);
      updateHUD();
      if (level === 2) playMusic(gameMusic2);
      if (level === 3) playMusic(gameMusic3);
    } else {
      gameRunning = false;
      playMusic(menuMusic);
      document.getElementById('hud').style.display = 'none';
      if ('ontouchstart' in window) {
        document.getElementById('mobile-controls').style.display = 'none';
      }
      document.getElementById('victory-score-msg').textContent = 'Ton Score Final : ' + score;
      document.getElementById('victory-char-img').src = 'select_' + selectedChar + '.png';
      document.getElementById('victory-screen').style.display = 'flex';
    }
    return;
  }

  // Invincibility/Super timers
  if (p.invincible > 0) p.invincible--;
  if (p.superTimer > 0) {
    p.superTimer--;
    if (Math.random() < 0.2) {
      spawnParticles(p.x + Math.random() * p.w, p.y + Math.random() * p.h, '#fff', 1);
    }
    if (p.superTimer <= 0) {
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

  // Animation state machine
  let animState = 'idle';
  if (!p.onGround) {
    animState = p.vy < 0 ? 'jump' : 'land';
  } else if (Math.abs(p.vx) > 0.5) {
    animState = 'run';
  }

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

  // Screen shake decay
  if (screenShake > 0) screenShake *= 0.85;
  if (screenShake < 0.5) screenShake = 0;

  frameCount++;
}

function loseLife() {
  lives--;
  updateHUD();
  playSynthesizedSound('death');
  screenShake = 8;
  // Abort any in-progress cash-pile transition and resume music
  if (cashTransition > 0) {
    cashTransition = 0;
    if (levelData && levelData.cashPile) levelData.cashPile.triggered = false;
    const track = level === 1 ? gameMusic1 : level === 2 ? gameMusic2 : gameMusic3;
    playMusic(track);
  }
  if (lives <= 0) {
    showOverlay('💀 FIN DE PARTIE', 'Score : ' + score);
  } else {
    player.x = lastCheckpointX;
    player.y = H - 160;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 90;
    player.groundPoundActive = false;
    player.dashActive = false;
    player.dashTimer = 0;
  }
}

function showOverlay(title, msg) {
  gameRunning = false;
  playMusic(menuMusic);
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent = msg;
  document.getElementById('overlay').style.display = 'flex';
}

async function submitScore() {
  const pName = document.getElementById('player-name-input').value.slice(0, 30) || 'Joueur Anonyme';
  document.getElementById('victory-screen').style.display = 'none';
  await saveAndShowLeaderboard(pName, '#2ecc71');
}

async function submitScoreLoss() {
  const pName = document.getElementById('gameover-name-input').value.slice(0, 30) || 'Joueur Anonyme';
  document.getElementById('overlay').style.display = 'none';
  await saveAndShowLeaderboard(pName, '#e74c3c');
}

async function saveAndShowLeaderboard(pName, color) {
  document.getElementById('leaderboard-name').innerHTML = "<span style='color:#fff;font-size:12px;'>Chargement des scores...</span>";
  document.getElementById('leaderboard-score').textContent = "";
  document.getElementById('leaderboard-screen').style.display = 'flex';

  try {
    await db.collection("scores").add({
      name: pName,
      score: score,
      character: selectedChar,
      max_level: level,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    const snapshot = await db.collection("scores")
      .orderBy("score", "desc")
      .limit(5)
      .get();

    let scoresHtml = `<div style="font-size:14px; margin-bottom:15px; color:${color};">Ton Score: ${score}</div>`;
    scoresHtml += `<div style="font-size:16px; color:#f4a523; margin-bottom:10px; text-decoration:underline;">TOP 5</div>`;

    let rank = 1;
    snapshot.forEach(doc => {
      const data = doc.data();
      const safeName = String(data.name).slice(0, 30).replace(/</g, '&lt;');
      scoresHtml += `<div style="font-size:12px; color:#fff; margin-bottom:6px;">${rank}. ${safeName} - <span style="color:#f4a523">${data.score}</span> pts</div>`;
      rank++;
    });

    document.getElementById('leaderboard-name').innerHTML = scoresHtml;
  } catch (error) {
    console.error("Firebase Error: ", error);
    document.getElementById('leaderboard-name').textContent = "Erreur de connexion au classement.";
    document.getElementById('leaderboard-score').textContent = "Score Final : " + score + " points";
  }
}

function restartFromLeaderboard() {
  document.getElementById('leaderboard-screen').style.display = 'none';
  restartGame();
}

// ---- DRAWING ----

// Level-specific ground tile
function drawGroundTile(pl) {
  if (level === 1) {
    // Red laterite earth
    const grd = ctx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + pl.h);
    grd.addColorStop(0, '#b5451b');
    grd.addColorStop(0.3, '#a03d18');
    grd.addColorStop(1, '#8b3a12');
    ctx.fillStyle = grd;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    // Sparse grass tufts
    ctx.fillStyle = '#c46a3a';
    ctx.fillRect(pl.x, pl.y, pl.w, 6);
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 1.5;
    for (let gx = pl.x + 10; gx < pl.x + pl.w - 5; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx, pl.y); ctx.lineTo(gx - 2, pl.y - 5);
      ctx.moveTo(gx, pl.y); ctx.lineTo(gx + 2, pl.y - 4);
      ctx.moveTo(gx, pl.y); ctx.lineTo(gx + 4, pl.y - 3);
      ctx.stroke();
    }
    // Pebbles
    ctx.fillStyle = '#c4784a';
    for (let px = pl.x + 15; px < pl.x + pl.w - 10; px += 35) {
      ctx.beginPath();
      ctx.arc(px, pl.y + 15, 2, 0, Math.PI * 2);
      ctx.arc(px + 8, pl.y + 20, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (level === 2) {
    // Dark concrete
    const grd = ctx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + pl.h);
    grd.addColorStop(0, '#404040');
    grd.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = grd;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    // Sidewalk edge
    ctx.fillStyle = '#666';
    ctx.fillRect(pl.x, pl.y, pl.w, 3);
    // Neon accent line
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(pl.x, pl.y + 3, pl.w, 1.5);
    ctx.shadowBlur = 0;
    // Cracks
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    for (let cx = pl.x + 30; cx < pl.x + pl.w; cx += 60) {
      ctx.beginPath();
      ctx.moveTo(cx, pl.y + 8);
      ctx.lineTo(cx + 3, pl.y + 25);
      ctx.lineTo(cx - 1, pl.y + 40);
      ctx.stroke();
    }
  } else {
    // Steel blue
    const grd = ctx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + pl.h);
    grd.addColorStop(0, '#2c3e50');
    grd.addColorStop(1, '#1a252f');
    ctx.fillStyle = grd;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    // Metallic strip
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(pl.x, pl.y, pl.w, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(pl.x, pl.y, pl.w, 1);
    // Rivets
    ctx.fillStyle = '#7f8c8d';
    for (let rx = pl.x + 20; rx < pl.x + pl.w; rx += 40) {
      ctx.beginPath();
      ctx.arc(rx, pl.y + 10, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
}

// Level-specific floating platform
function drawFloatPlatform(pl) {
  if (level === 1) {
    // Wooden scaffolding
    const fpGrd = ctx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + pl.h);
    fpGrd.addColorStop(0, '#d4a574');
    fpGrd.addColorStop(1, '#b8860b');
    ctx.fillStyle = fpGrd;
    roundRect(ctx, pl.x, pl.y, pl.w, pl.h, 2);
    ctx.fill();
    // Wood grain lines
    ctx.strokeStyle = '#a06930';
    ctx.lineWidth = 0.5;
    for (let ly = pl.y + 5; ly < pl.y + pl.h - 2; ly += 5) {
      ctx.beginPath();
      ctx.moveTo(pl.x + 2, ly);
      ctx.lineTo(pl.x + pl.w - 2, ly);
      ctx.stroke();
    }
    // Support posts
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(pl.x + 2, pl.y + pl.h, 4, 12);
    ctx.fillRect(pl.x + pl.w - 6, pl.y + pl.h, 4, 12);
  } else if (level === 2) {
    // Concrete ledge
    ctx.fillStyle = '#555';
    roundRect(ctx, pl.x, pl.y, pl.w, pl.h, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(pl.x + 2, pl.y + 1, pl.w - 4, 3);
    // Neon underglow
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(pl.x + 4, pl.y + pl.h - 1, pl.w - 8, 1);
    ctx.shadowBlur = 0;
    // Rebar dots
    ctx.fillStyle = '#e8740c';
    ctx.beginPath();
    ctx.arc(pl.x + 4, pl.y + pl.h / 2, 2, 0, Math.PI * 2);
    ctx.arc(pl.x + pl.w - 4, pl.y + pl.h / 2, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Steel beam
    const fpGrd = ctx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + pl.h);
    fpGrd.addColorStop(0, '#5d6d7e');
    fpGrd.addColorStop(1, '#34495e');
    ctx.fillStyle = fpGrd;
    roundRect(ctx, pl.x, pl.y, pl.w, pl.h, 1);
    ctx.fill();
    // Reflection line
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(pl.x + 4, pl.y + Math.floor(pl.h / 3), pl.w - 8, 2);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1;
    roundRect(ctx, pl.x, pl.y, pl.w, pl.h, 1);
    ctx.stroke();
  }
}

// Level-specific enemy drawing
function drawEnemy(e) {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const shake = e.stunTimer > 0 ? Math.sin(frameCount * 0.5) * 2 : 0;
  const drawX = e.x + shake;

  if (e.stunTimer > 0) ctx.globalAlpha = 0.6;

  if (level === 1) {
    // Orange construction plot / traffic cone enemy
    // Cone body (orange triangle)
    const coneGrd = ctx.createLinearGradient(drawX, e.y, drawX, e.y + e.h);
    coneGrd.addColorStop(0, '#ff6b00');
    coneGrd.addColorStop(0.5, '#f39c12');
    coneGrd.addColorStop(1, '#e8740c');
    ctx.fillStyle = coneGrd;
    ctx.beginPath();
    ctx.moveTo(drawX + e.w * 0.15, e.y + e.h);
    ctx.lineTo(cx + shake, e.y + 2);
    ctx.lineTo(drawX + e.w * 0.85, e.y + e.h);
    ctx.closePath();
    ctx.fill();
    // White reflective stripes
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(drawX + e.w * 0.28, e.y + e.h * 0.35, e.w * 0.44, 4);
    ctx.fillRect(drawX + e.w * 0.22, e.y + e.h * 0.55, e.w * 0.56, 4);
    // Base plate
    ctx.fillStyle = '#333';
    roundRect(ctx, drawX + 2, e.y + e.h - 6, e.w - 4, 6, 2);
    ctx.fill();
    // Cone outline
    ctx.strokeStyle = '#c45500';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(drawX + e.w * 0.15, e.y + e.h);
    ctx.lineTo(cx + shake, e.y + 2);
    ctx.lineTo(drawX + e.w * 0.85, e.y + e.h);
    ctx.closePath();
    ctx.stroke();
    // Angry eyes on the cone
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 5 + shake, e.y + e.h * 0.4, 4, 0, Math.PI * 2);
    ctx.arc(cx + 5 + shake, e.y + e.h * 0.4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0a2e';
    ctx.beginPath();
    ctx.arc(cx - 4 + shake, e.y + e.h * 0.42, 2, 0, Math.PI * 2);
    ctx.arc(cx + 6 + shake, e.y + e.h * 0.42, 2, 0, Math.PI * 2);
    ctx.fill();
    // Angry eyebrows
    ctx.strokeStyle = '#1a0a2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 9 + shake, e.y + e.h * 0.28);
    ctx.lineTo(cx - 2 + shake, e.y + e.h * 0.34);
    ctx.moveTo(cx + 9 + shake, e.y + e.h * 0.28);
    ctx.lineTo(cx + 2 + shake, e.y + e.h * 0.34);
    ctx.stroke();
    // Grumpy mouth
    ctx.strokeStyle = '#1a0a2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + shake, e.y + e.h * 0.58, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (level === 2) {
    // Neon drone - hexagon
    ctx.fillStyle = '#2d1b69';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = cx + shake + Math.cos(a) * 16;
      const py = cy + Math.sin(a) * 16;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Central eye
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(cx + shake, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Propeller
    ctx.save();
    ctx.translate(cx + shake, e.y + 4);
    ctx.rotate(frameCount * 0.15);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.stroke();
    ctx.restore();
    // Speed type indicator
    if (e.type === 'fast') {
      ctx.strokeStyle = 'rgba(0,229,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(drawX - 5, cy);
      ctx.lineTo(drawX - 12, cy);
      ctx.moveTo(drawX - 5, cy - 4);
      ctx.lineTo(drawX - 10, cy - 4);
      ctx.stroke();
    }
  } else {
    // Robot
    ctx.fillStyle = '#7f8c8d';
    roundRect(ctx, drawX + 4, e.y + 4, e.w - 8, e.h - 12, 4);
    ctx.fill();
    // Rounded top
    ctx.beginPath();
    ctx.arc(cx + shake, e.y + 8, (e.w - 8) / 2, Math.PI, 0);
    ctx.fill();
    // LED eyes
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(cx - 8 + shake, e.y + e.h * 0.3, 6, 4);
    ctx.fillRect(cx + 2 + shake, e.y + e.h * 0.3, 6, 4);
    // Legs (walking animation)
    const legOffset = Math.sin(frameCount * 0.15) * 3;
    ctx.fillStyle = '#5d6d7e';
    ctx.fillRect(cx - 6 + shake, e.y + e.h - 8 + legOffset, 4, 8 - legOffset);
    ctx.fillRect(cx + 2 + shake, e.y + e.h - 8 - legOffset, 4, 8 + legOffset);
    // Antenna
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + shake, e.y + 4);
    ctx.lineTo(cx + shake, e.y - 6);
    ctx.stroke();
    if (frameCount % 30 < 15) {
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(cx + shake, e.y - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (e.stunTimer > 0) ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Screen shake
  ctx.save();
  if (screenShake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * screenShake,
      (Math.random() - 0.5) * screenShake
    );
  }

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  if (level === 2) {
    skyGrad.addColorStop(0, '#0a0520');
    skyGrad.addColorStop(0.5, '#1a0a2e');
    skyGrad.addColorStop(1, '#2d1b69');
  } else if (level === 3) {
    skyGrad.addColorStop(0, '#0f1923');
    skyGrad.addColorStop(0.4, '#1a252f');
    skyGrad.addColorStop(0.7, '#2c3e50');
    skyGrad.addColorStop(1, '#5d6d7e');
  } else {
    skyGrad.addColorStop(0, '#1a0a2e');
    skyGrad.addColorStop(0.3, '#2d1b69');
    skyGrad.addColorStop(0.6, '#e8740c');
    skyGrad.addColorStop(1, '#f4a523');
  }
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

  // Background animated elements (screen space)
  drawBgElements();

  // Distant buildings silhouette (parallax layer 2)
  drawSilhouette(cameraX * 0.15, '#1a0a2e', 0.3);

  ctx.save();
  ctx.translate(-cameraX, 0);

  // Platforms
  for (const pl of levelData.platforms) {
    if (pl.x + pl.w < cameraX - 100 || pl.x > cameraX + W + 100) continue;
    if (pl.type === 'ground') {
      drawGroundTile(pl);
    } else {
      drawFloatPlatform(pl);
    }
  }

  // Checkpoints
  for (const cp of levelData.checkpoints) {
    if (cp.x < cameraX - 50 || cp.x > cameraX + W + 50) continue;
    // Pole
    ctx.fillStyle = cp.activated ? '#f4a523' : '#888';
    ctx.fillRect(cp.x + 4, cp.y, 8, cp.h);
    // Flag
    if (cp.activated) {
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.moveTo(cp.x + 12, cp.y + 4);
      ctx.lineTo(cp.x + 32, cp.y + 14);
      ctx.lineTo(cp.x + 12, cp.y + 24);
      ctx.closePath();
      ctx.fill();
      // Checkmark
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cp.x + 17, cp.y + 14);
      ctx.lineTo(cp.x + 21, cp.y + 18);
      ctx.lineTo(cp.x + 28, cp.y + 10);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(cp.x + 12, cp.y + 4);
      ctx.lineTo(cp.x + 28, cp.y + 12);
      ctx.lineTo(cp.x + 12, cp.y + 20);
      ctx.closePath();
      ctx.fill();
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
    drawEnemy(e);
  }

  // ---- DRAW BOSS ----
  if (levelData.boss && levelData.boss.alive) {
    const b = levelData.boss;
    if (!(b.x + b.w < cameraX - 50 || b.x > cameraX + W + 50)) {
      const sprite = imgs[b.animFrame === 0 ? 'archie1' : 'archie2'];
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.save();
        // Flash when hit: alternate between white-overlay and normal
        if (b.hitTimer > 0 && Math.floor(b.hitTimer / 4) % 2 === 0) {
          ctx.filter = 'brightness(8)';
          ctx.globalAlpha = 0.6;
        }
        // Flip sprite when facing right (sprite naturally faces left)
        if (b.facing === 1) {
          ctx.translate(b.x + b.w / 2, 0);
          ctx.scale(-1, 1);
          ctx.translate(-(b.x + b.w / 2), 0);
        }
        const dx = b.x - (b.drawW - b.w) / 2;
        const dy = b.y - (b.drawH - b.h) / 2;
        ctx.drawImage(sprite, dx, dy, b.drawW, b.drawH);
        ctx.restore();
      }

      // HP bar above boss
      const barW = b.w * 0.85;
      const barX = b.x + (b.w - barW) / 2;
      const barY = b.y - 26;
      ctx.fillStyle = '#2c2c2c';
      ctx.fillRect(barX, barY, barW, 8);
      ctx.fillStyle = b.hp === b.maxHp ? '#e74c3c' : b.hp > 1 ? '#e67e22' : '#c0392b';
      ctx.fillRect(barX, barY, barW * (b.hp / b.maxHp), 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, 8);

      // Boss name label — moves with boss
      ctx.save();
      ctx.fillStyle = '#f4a523';
      ctx.font = 'bold 10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fillText(b.name, b.x + b.w / 2, barY - 6);
      ctx.restore();
    }
  }

  // ---- DRAW FIREBALLS ----
  if (levelData.bossFireballs) {
    for (const fb of levelData.bossFireballs) {
      if (!fb.alive) continue;
      if (fb.x + fb.w < cameraX - 50 || fb.x > cameraX + W + 50) continue;
      ctx.save();
      ctx.shadowColor = '#ff6b00';
      ctx.shadowBlur = 14;
      const flicker = 0.8 + Math.sin(frameCount * 0.4) * 0.2;
      ctx.globalAlpha = flicker;
      const fbGrd = ctx.createRadialGradient(fb.x + 11, fb.y + 7, 1, fb.x + 11, fb.y + 7, 12);
      fbGrd.addColorStop(0, '#ffffff');
      fbGrd.addColorStop(0.35, '#f4a523');
      fbGrd.addColorStop(1, '#e74c3c');
      ctx.fillStyle = fbGrd;
      ctx.beginPath();
      ctx.arc(fb.x + 11, fb.y + 7, 11, 0, Math.PI * 2);
      ctx.fill();
      // Trailing ember
      ctx.globalAlpha = flicker * 0.4;
      ctx.fillStyle = '#f4a523';
      ctx.beginPath();
      ctx.arc(fb.x + 11 - fb.vx * 2.5, fb.y + 7, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Flag / Goal
  if (levelData.flag) {
    const f = levelData.flag;
    ctx.fillStyle = '#888';
    ctx.fillRect(f.x + 16, f.y, 8, f.h);

    if (level === 1) {
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(f.x + 24, f.y + 10, 15, 40);
      ctx.fillStyle = '#fff';
      ctx.fillRect(f.x + 39, f.y + 10, 15, 40);
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(f.x + 54, f.y + 10, 16, 40);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🇨🇮', f.x + 44, f.y + 70);
    } else if (level === 2) {
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
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(f.x + 44, f.y + 30, 20, 0, Math.PI * 2);
      ctx.fill();
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

    ctx.fillStyle = '#f4a523';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏗️', f.x + 20, f.y + 5);
  }

  // ---- DRAW CASH PILE (HONORAIRES) ----
  if (levelData.cashPile) {
    const cp = levelData.cashPile;
    if (cp.x + cp.w > cameraX - 60 && cp.x < cameraX + W + 60) {
      ctx.save();

      // Golden glow — pulses faster once triggered
      const glowSpeed = cp.triggered ? 0.25 : 0.08;
      const glowSize = cp.triggered
        ? 28 + Math.sin(frameCount * glowSpeed) * 10
        : 12 + Math.sin(frameCount * glowSpeed) * 4;
      ctx.shadowColor = '#f4d03f';
      ctx.shadowBlur = glowSize;

      const cashImg = imgs['cash'];
      if (cashImg && cashImg.complete && cashImg.naturalWidth > 0) {
        ctx.drawImage(cashImg, cp.x, cp.y, cp.w, cp.h);
      } else {
        // Fallback: simple drawn pile
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.ellipse(cp.x + cp.w / 2, cp.y + cp.h * 0.75, cp.w * 0.42, cp.h * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4d03f';
        ctx.beginPath();
        ctx.ellipse(cp.x + cp.w / 2, cp.y + cp.h * 0.45, cp.w * 0.35, cp.h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💰', cp.x + cp.w / 2, cp.y + cp.h * 0.55);
      }

      ctx.restore();

      // "HONORAIRES" label with subtle bounce when triggered
      const labelBounce = cp.triggered ? Math.sin(frameCount * 0.18) * 4 : 0;
      ctx.save();
      ctx.font = 'bold 9px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#f4d03f';
      ctx.fillText('HONORAIRES', cp.x + cp.w / 2, cp.y - 10 + labelBounce);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // Collectible Signs
  for (const s of levelData.signs) {
    if (s.collected) continue;
    if (s.x < cameraX - 100 || s.x > cameraX + W + 100) continue;

    const isActive = player && s.index === player.currentSignIndex;
    ctx.globalAlpha = isActive ? 1.0 : 0.4;

    // Light column for active sign
    if (isActive) {
      ctx.globalAlpha = 0.06 + Math.sin(frameCount * 0.05) * 0.03;
      ctx.fillStyle = '#f4a523';
      ctx.fillRect(s.x + 10, s.y - 50, 60, 50);
      ctx.globalAlpha = 1.0;
    }

    // Post
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(s.x + 36, s.y - 30, 8, 30);

    // Board
    if (isActive) {
      ctx.shadowColor = '#fcd116';
      ctx.shadowBlur = 15;
    }
    ctx.fillStyle = '#f4a523';
    ctx.fillRect(s.x, s.y - 50, 80, 24);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x, s.y - 50, 80, 24);

    ctx.fillStyle = '#1a0a2e';
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.text, s.x + 40, s.y - 34);

    // Bouncing arrow for active sign
    if (isActive) {
      const arrowY = s.y - 60 + Math.sin(frameCount * 0.1) * 6;
      ctx.fillStyle = '#f4a523';
      ctx.beginPath();
      ctx.moveTo(s.x + 35, arrowY);
      ctx.lineTo(s.x + 45, arrowY);
      ctx.lineTo(s.x + 40, arrowY + 8);
      ctx.closePath();
      ctx.fill();
    }

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

    // Double jump ring effect
    if (p.doubleJumpRing > 0) {
      const ringAlpha = p.doubleJumpRing / 12;
      const ringRadius = (12 - p.doubleJumpRing) * 3;
      ctx.globalAlpha = ringAlpha * 0.5;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Proximity sign text
    if (levelData.signs) {
      for (const s of levelData.signs) {
        if (s.collected || s.index !== p.currentSignIndex) continue;
        const dist = Math.abs(s.x + 40 - (p.x + p.w / 2));
        if (dist < 150) {
          const alpha = Math.max(0, 1 - dist / 150);
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = '#f4a523';
          ctx.font = 'bold 10px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('→ ' + s.text, p.x + p.w / 2, p.y - 15);
          ctx.globalAlpha = 1;
        }
      }
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

  ctx.restore(); // camera transform

  // Off-screen sign arrow (screen space, after camera restore)
  if (player && levelData.signs) {
    for (const s of levelData.signs) {
      if (s.collected || s.index !== player.currentSignIndex) continue;
      const signScreenX = s.x + 40 - cameraX;
      if (signScreenX < 20) {
        // Arrow on left
        ctx.fillStyle = '#f4a523';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(10, H / 2 - 10);
        ctx.lineTo(10, H / 2 + 10);
        ctx.lineTo(2, H / 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (signScreenX > W - 20) {
        // Arrow on right
        ctx.fillStyle = '#f4a523';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(W - 10, H / 2 - 10);
        ctx.lineTo(W - 10, H / 2 + 10);
        ctx.lineTo(W - 2, H / 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  ctx.restore(); // screen shake
}

function drawPlayer(p) {
  let sheetKey;
  if (p.superTimer > 0) {
    if (p.superTimer <= 180 && Math.floor(frameCount / 5) % 2 === 0) {
      sheetKey = selectedChar + '_sheet';
    } else {
      sheetKey = selectedChar + '_inv';
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

    const cols = 4;
    const rows = 2;
    const frameW = sheet.naturalWidth / cols;
    const frameH = sheet.naturalHeight / rows;
    const frame = Math.max(0, Math.min(p.animFrame, cols * rows - 1));
    const col = frame % cols;
    const row = Math.floor(frame / cols);
    const sx = col * frameW;
    const sy = row * frameH;

    let drawW = 72;
    let drawH = (frameH / frameW) * drawW;

    // Ground pound squash/stretch
    if (p.groundPoundActive) {
      drawW *= 0.7;
      drawH *= 1.3;
    } else if (p.groundPoundLanding > 0) {
      const t = p.groundPoundLanding / 15;
      drawW *= 1 + t * 0.3;
      drawH *= 1 - t * 0.3;
    }
    // Koffi dash stretch
    if (p.dashActive) {
      drawW *= 1.25;
      drawH *= 0.85;
    }

    const drawY = p.y + p.h - drawH + 3;

    ctx.drawImage(sheet, sx, sy, frameW, frameH,
      p.x - (drawW - p.w) / 2, drawY, drawW, drawH);

    ctx.restore();
  } else {
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

// ---- TUTORIAL ----
function drawTutorial() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f4a523';
  ctx.font = '14px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('COMMENT JOUER', W / 2, H / 2 - 70);

  ctx.fillStyle = '#fff';
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.fillText('← → pour bouger', W / 2, H / 2 - 30);
  ctx.fillText('ESPACE pour sauter (x2)', W / 2, H / 2 - 10);

  ctx.fillStyle = '#00e5ff';
  ctx.fillText('Collecte les panneaux', W / 2, H / 2 + 20);
  ctx.fillText('dans l\'ordre!', W / 2, H / 2 + 38);

  if (selectedChar === 'diabate') {
    ctx.fillStyle = '#2ecc71';
    ctx.fillText('BAS en l\'air = Frappe au Sol!', W / 2, H / 2 + 65);
  } else if (selectedChar === 'koffi') {
    ctx.fillStyle = '#f39c12';
    ctx.fillText('BAS au sol = Sprint Éclair!', W / 2, H / 2 + 65);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillText('Appuie sur une touche...', W / 2, H / 2 + 95);
}

// ---- PAUSE OVERLAY ----
function drawPauseOverlay() {
  draw(); // Draw the current game frame
  // Then overlay
  ctx.save();
  ctx.setTransform(G_SCALE, 0, 0, G_SCALE, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f4a523';
  ctx.font = '24px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSE', W / 2, H / 2 - 10);

  ctx.fillStyle = '#fff';
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.fillText('ESC pour reprendre', W / 2, H / 2 + 25);
  ctx.restore();
}

// ---- GAME LOOP ----
function gameLoop() {
  if (!gameRunning) return;
  if (gamePaused) {
    drawPauseOverlay();
    return;
  }
  if (tutorialActive) {
    draw();
    ctx.save();
    ctx.setTransform(G_SCALE, 0, 0, G_SCALE, 0, 0);
    drawTutorial();
    ctx.restore();
    requestAnimationFrame(gameLoop);
    return;
  }
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ---- WINDOW FOCUS HANDLING ----
window.addEventListener('blur', () => {
  keys = {};
  if (gameRunning && !gamePaused) {
    gamePaused = true;
    if (currentMusic) currentMusic.pause();
  }
});
