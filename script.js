const LOGIC_W = 560;
const LOGIC_H = 560;
const gravity = 0.62;
const moveSpeed = 5.2;
const jumpForce = -12.6;
const maxLevels = 100;
const STORAGE_KEY = "neonBlockJumpByLJVLevel";

let canvas;
let player;
let platforms = [];
let goalPlatform = null;
let level = 1;
let leftHeld = false;
let rightHeld = false;
let uiHooked = false;
let gameState = "start";
let levelTransitionLock = false;

const LEVEL_PATTERNS = [
  [80, 130, 82, 136, 88],
  [90, 146, 96, 152, 102],
  [76, 128, 176, 126, 182],
  [94, 150, 210, 156, 220],
  [88, 140, 196, 252, 206],
  [72, 122, 174, 226, 278],
  [100, 154, 208, 262, 316],
  [86, 138, 194, 250, 306],
  [96, 156, 214, 272, 330],
  [78, 132, 188, 244, 300]
];

function setup() {
  canvas = createCanvas(LOGIC_W, LOGIC_H);
  canvas.parent("game-container");
  fitCanvasToContainer();
  window.addEventListener("resize", fitCanvasToContainer);
  window.addEventListener("blur", clearHeldInputs);
  window.addEventListener("pagehide", clearHeldInputs);
  hookUIOnce();
  level = readSavedLevel();
  initLevel();
  updateUI();
  updateStatus("Bereit");
}

function fitCanvasToContainer() {
  if (!canvas) return;
  canvas.elt.style.width = "100%";
  canvas.elt.style.height = "100%";
}

function draw() {
  drawBackground();

  if (gameState === "start") {
    drawPlatforms();
    drawGoalMarker();
    drawPlayer();
    drawMessageScreen("Neon Block Jump by LJV", "Tippen, klicken oder Enter drücken, um zu starten", [215, 162, 207]);
    return;
  }

  if (gameState === "play") {
    updatePlayer();
    drawPlatforms();
    drawGoalMarker();
    drawPlayer();
    checkGoal();
    checkFail();
    return;
  }

  if (gameState === "levelComplete") {
    drawPlatforms();
    drawGoalMarker();
    drawPlayer();
    drawMessageScreen("Level geschafft", "Tippen, klicken oder Enter für das nächste Level", [0, 234, 255]);
    return;
  }

  if (gameState === "gameOver") {
    drawPlatforms();
    drawGoalMarker();
    drawPlayer();
    drawMessageScreen("Game Over", "Tippen, klicken oder Enter zum Neustart", [255, 79, 216]);
    return;
  }

  if (gameState === "victory") {
    drawPlatforms();
    drawGoalMarker();
    drawPlayer();
    drawMessageScreen("Alle 100 Level geschafft", "Tippen, klicken oder Enter für einen neuen Durchlauf", [0, 234, 255]);
  }
}

function drawBackground() {
  background(11, 14, 34);
  noStroke();
  fill(120, 220, 255, 110);
  for (let i = 0; i < 18; i++) {
    const x = (i * 97) % width;
    const y = (i * 67) % height;
    circle(x, y, 2 + (i % 3));
  }
  fill(18, 22, 60);
  for (let i = 0; i < 10; i++) {
    const bw = 36 + (i % 3) * 12;
    const bh = 90 + ((i * 17) % 140);
    const bx = i * 58;
    const by = height - bh;
    rect(bx, by, bw, bh, 4);
  }
}

function drawPlatforms() {
  for (const p of platforms) {
    const isGoal = p === goalPlatform;
    noStroke();
    fill(isGoal ? color(0, 234, 255, 52) : color(255, 79, 216, 36));
    rect(p.x - 4, p.y - 4, p.w + 8, p.h + 8, 12);
    fill(isGoal ? color(0, 234, 255) : color(255, 40, 210));
    rect(p.x, p.y, p.w, p.h, 10);
    fill(isGoal ? color(210, 255, 255, 180) : color(255, 170, 240, 140));
    rect(p.x + 8, p.y + 3, Math.max(8, p.w - 16), 4, 4);
  }
}

function drawGoalMarker() {
  if (!goalPlatform) return;
  noStroke();
  fill(0, 234, 255, 34);
  rect(goalPlatform.x + goalPlatform.w / 2 - 10, goalPlatform.y - 55, 20, 45, 10);
  fill(0, 234, 255, 180);
  triangle(
    goalPlatform.x + goalPlatform.w / 2 - 9, goalPlatform.y - 54,
    goalPlatform.x + goalPlatform.w / 2 - 9, goalPlatform.y - 22,
    goalPlatform.x + goalPlatform.w / 2 + 13, goalPlatform.y - 38
  );
}

function drawPlayer() {
  noStroke();
  fill(0, 234, 255, 50);
  circle(player.x + player.r, player.y + player.r, player.r * 2.8);
  fill(0, 234, 255);
  circle(player.x + player.r, player.y + player.r, player.r * 2);
  fill(180, 255, 255, 180);
  circle(player.x + player.r - 5, player.y + player.r - 5, player.r * 0.6);
}

function updatePlayer() {
  player.prevY = player.y;
  const dir = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
  player.x += dir * moveSpeed;
  player.x = constrain(player.x, 0, width - player.r * 2);

  player.vy += gravity;
  player.y += player.vy;
  player.onGround = false;

  for (const p of platforms) {
    const playerBottomPrev = player.prevY + player.r * 2;
    const playerBottomNow = player.y + player.r * 2;
    const overlapX = player.x + player.r * 2 > p.x && player.x < p.x + p.w;
    const falling = player.vy >= 0;
    const crossingTop = playerBottomPrev <= p.y && playerBottomNow >= p.y;

    if (overlapX && falling && crossingTop) {
      player.y = p.y - player.r * 2;
      player.vy = 0;
      player.onGround = true;
    }
  }
}

function initPlayer(startX, startY) {
  player = { x: startX, y: startY, r: 14, vy: 0, prevY: startY, onGround: true };
}

function initLevel() {
  generatePlatforms(level);
  const startPlatform = platforms[0];
  initPlayer(startPlatform.x + startPlatform.w / 2 - 14, startPlatform.y - 28);
  goalPlatform = platforms[platforms.length - 1];
  updateUI();
}

function resetLevel() {
  initLevel();
  gameState = "play";
  updateStatus("Level neu gestartet");
}

function nextLevel() {
  if (levelTransitionLock) return;
  levelTransitionLock = true;
  if (level < maxLevels) {
    level++;
    saveProgressInternal(level);
    updateUI();
    gameState = "levelComplete";
    updateStatus("Level geschafft");
  } else {
    gameState = "victory";
    updateStatus("Sieg");
  }
  setTimeout(() => { levelTransitionLock = false; }, 220);
}

function checkGoal() {
  const centerX = player.x + player.r;
  const standingOnGoal =
    player.onGround &&
    Math.abs(player.y + player.r * 2 - goalPlatform.y) < 1 &&
    centerX > goalPlatform.x &&
    centerX < goalPlatform.x + goalPlatform.w;

  if (standingOnGoal) nextLevel();
}

function checkFail() {
  if (player.y > height + 80) {
    gameState = "gameOver";
    updateStatus("Versuch fehlgeschlagen");
  }
}

function generatePlatforms(lvl) {
  platforms = [];
  const count = Math.min(5 + Math.floor((lvl - 1) / 20), 7);
  const widthShrink = Math.min(14, Math.floor((lvl - 1) / 10));
  const normalW = Math.max(118, 140 - widthShrink);
  const goalW = Math.max(136, normalW + 18);
  const bottomY = height - 58;
  const topY = count === 5 ? 250 : count === 6 ? 220 : 196;
  const stepY = (bottomY - topY) / (count - 1);

  const basePattern = LEVEL_PATTERNS[(lvl - 1) % LEVEL_PATTERNS.length];
  const xPositions = basePattern.slice(0, count);

  for (let i = 0; i < count; i++) {
    const y = bottomY - i * stepY;
    const w = i === count - 1 ? goalW : normalW;
    const h = 14;
    const x = constrain(xPositions[i], 24, width - w - 24);
    platforms.push({ x, y, w, h });
  }
}

function drawMessageScreen(title, subtitle, accent) {
  noStroke();
  fill(10, 14, 35, 228);
  rect(width * 0.1, height * 0.23, width * 0.8, height * 0.36, 22);

  stroke(accent[0], accent[1], accent[2], 160);
  strokeWeight(2);
  noFill();
  rect(width * 0.1, height * 0.23, width * 0.8, height * 0.36, 22);

  noStroke();
  fill(accent[0], accent[1], accent[2]);
  textAlign(CENTER, CENTER);
  textSize(28);
  text(title, width / 2, height * 0.34);

  fill(230);
  textSize(16);
  text(subtitle, width / 2, height * 0.43);

  fill(200);
  textSize(14);
  text("Aktuelles Level: " + level, width / 2, height * 0.51);
}

function clearHeldInputs() {
  leftHeld = false;
  rightHeld = false;
}

function keyPressed() {
  if (keyCode === LEFT_ARROW) leftHeld = true;
  if (keyCode === RIGHT_ARROW) rightHeld = true;

  if ((key === " " || keyCode === 32) && gameState === "play" && player.onGround) {
    player.vy = jumpForce;
    player.onGround = false;
  }

  if ((key === "s" || key === "S") && gameState !== "start") saveProgress();
  if (keyCode === ENTER) advanceState();
  return false;
}

function keyReleased() {
  if (keyCode === LEFT_ARROW) leftHeld = false;
  if (keyCode === RIGHT_ARROW) rightHeld = false;
  return false;
}

function mousePressed() {
  advanceState();
  return false;
}

function touchStarted() {
  return false;
}

function advanceState() {
  if (gameState === "start") {
    gameState = "play";
    updateStatus("Läuft");
    return;
  }
  if (gameState === "levelComplete") {
    initLevel();
    gameState = "play";
    updateStatus("Nächstes Level");
    return;
  }
  if (gameState === "gameOver") {
    resetLevel();
    return;
  }
  if (gameState === "victory") {
    level = 1;
    saveProgressInternal(level);
    initLevel();
    gameState = "start";
    updateStatus("Neuer Durchlauf");
  }
}

function hold(el, on, off) {
  if (!el) return;
  const start = (e) => { e.preventDefault(); on(); };
  const end = (e) => { e.preventDefault(); off(); };
  el.addEventListener("touchstart", start, { passive: false });
  el.addEventListener("touchend", end, { passive: false });
  el.addEventListener("touchcancel", end, { passive: false });
  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", end);
  el.addEventListener("mouseleave", end);
}

function hookUIOnce() {
  if (uiHooked) return;
  uiHooked = true;

  const continueBtn = document.getElementById("continueButton");
  const restartBtn = document.getElementById("restartButton");
  const saveBtn = document.getElementById("saveButton");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  const jumpBtn = document.getElementById("jumpBtn");

  continueBtn.onclick = () => {
    level = readSavedLevel();
    initLevel();
    gameState = "play";
    updateStatus("Fortgesetzt");
    flashOverlayText("Weiter ab Level " + level);
  };

  restartBtn.onclick = () => {
    level = 1;
    saveProgressInternal(level);
    initLevel();
    gameState = "play";
    updateStatus("Neu gestartet");
  };

  saveBtn.onclick = saveProgress;
  hold(leftBtn, () => leftHeld = true, () => leftHeld = false);
  hold(rightBtn, () => rightHeld = true, () => rightHeld = false);

  const jumpStart = (e) => {
    e.preventDefault();
    if (gameState === "play" && player.onGround) {
      player.vy = jumpForce;
      player.onGround = false;
    }
  };
  jumpBtn.addEventListener("touchstart", jumpStart, { passive: false });
  jumpBtn.addEventListener("mousedown", jumpStart);
}

function updateUI() {
  const levelInfo = document.getElementById("level-info");
  const progressBar = document.getElementById("progress-bar");
  if (levelInfo) levelInfo.textContent = `Level ${level} von ${maxLevels}`;
  if (progressBar) progressBar.style.width = `${(level / maxLevels) * 100}%`;
}

function updateStatus(text) {
  const pill = document.getElementById("status-pill");
  if (pill) pill.textContent = text;
}

function saveProgressInternal(value = level) {
  localStorage.setItem(STORAGE_KEY, String(value));
}

function saveProgress() {
  saveProgressInternal(level);
  updateStatus("Gespeichert");
  flashOverlayText("Gespeichert");
}

function readSavedLevel() {
  const saved = Number(localStorage.getItem(STORAGE_KEY) || "1");
  return Math.min(Math.max(saved, 1), maxLevels);
}

function flashOverlayText(msg) {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;
  const tag = document.createElement("div");
  tag.textContent = msg;
  Object.assign(tag.style, {
    position: "absolute",
    left: "50%",
    top: "16px",
    transform: "translateX(-50%)",
    color: "#eef3ff",
    background: "rgba(10,14,35,.92)",
    border: "1px solid rgba(0,234,255,.35)",
    borderRadius: "999px",
    padding: "8px 14px",
    fontWeight: "700",
    opacity: "0",
    transition: "opacity .18s ease"
  });
  overlay.appendChild(tag);
  requestAnimationFrame(() => tag.style.opacity = "1");
  setTimeout(() => tag.style.opacity = "0", 900);
  setTimeout(() => tag.remove(), 1250);
}
