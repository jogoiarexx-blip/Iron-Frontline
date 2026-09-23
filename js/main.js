import { IronFrontline } from "./game/engine.js";

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const game = new IronFrontline(canvas);
window.ironFrontline = game;

const overlays = ["menu", "loading", "intro", "paused", "gameover", "complete"];
const missionNames = ["CITY UNDER FIRE", "DESERT ASSAULT", "IRON HARBOR"];
const fmt = (n) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const hide = (id, v) => $(id)?.classList.toggle("hidden", v);

function setOverlay(active) {
  overlays.forEach((id) => hide(id, id !== active));
}

function renderMissions(hud) {
  const host = $("missions");
  const signature = `${hud.unlocked.join(",")}|${JSON.stringify(hud.best)}`;
  if (host.dataset.signature === signature) return;
  host.dataset.signature = signature;
  host.innerHTML = "";
  ["01", "02", "03"].forEach((id, i) => {
    const unlocked = hud.unlocked.includes(i + 1);
    const btn = document.createElement("button");
    btn.className = "mission-btn";
    btn.disabled = !unlocked;
    const best = hud.best[id] ? `BEST ${hud.best[id]}` : !unlocked ? "LOCKED" : "";
    btn.innerHTML = `<span class="mission-code">M${id}</span><span>${missionNames[i]}</span><span class="mission-meta">${best}</span>`;
    btn.addEventListener("click", () => game.playMission(id));
    host.append(btn);
  });
}

function updateHud(hud) {
  renderMissions(hud);
  const playing = ["play", "miniboss", "bossPrep", "bossWarn", "bossIntro", "bossFight", "bossDeath"].includes(hud.screen);
  hide("topHud", !playing);
  $("touchControls").classList.toggle("playing", playing);
  $("hpBar").style.width = `${Math.max(0, Math.min(100, hud.hp / Math.max(1, hud.maxHp) * 100))}%`;
  $("weaponText").textContent = `${hud.weapon.toUpperCase()} · AMMO ${hud.ammo}/${hud.ammoMax} · G ${hud.grenades}${hud.reloading ? " · RELOAD" : ""}`;
  $("scoreText").textContent = `SCORE ${hud.score}`;
  $("missionText").textContent = hud.missionTitle;

  hide("objective", !playing || !hud.objective);
  $("objective").textContent = hud.objective || "";

  hide("bossHud", !hud.showBossHud);
  $("bossName").textContent = hud.bossName;
  $("bossSub").textContent = hud.bossSub;
  $("bossBar").style.width = `${Math.max(0, Math.min(100, hud.bossHp / Math.max(1, hud.bossMax) * 100))}%`;

  hide("warning", hud.screen !== "bossWarn");
  hide("debug", !hud.debug);
  $("debug").textContent = hud.debug || "";
  $("padText").textContent = hud.gamepad ? `PAD ${hud.gamepad}` : "";
  $("flashBtn").textContent = `FLASH ${hud.reduceFlash ? "OFF" : "ON"}`;

  if (hud.screen === "menu") setOverlay("menu");
  else if (hud.screen === "loading") {
    setOverlay("loading");
    $("loadingMission").textContent = hud.missionName;
    $("loadingTitle").textContent = hud.missionTitle;
    $("loadingStatus").textContent = `LOADING… ${hud.loadStatus || ""}`;
    $("loadBar").style.width = `${hud.loadPct}%`;
    $("loadPct").textContent = `${hud.loadPct}%`;
  } else if (hud.screen === "intro") {
    setOverlay("intro");
    $("introMission").textContent = hud.missionName;
    $("introTitle").textContent = hud.missionTitle;
  } else if (hud.screen === "paused") setOverlay("paused");
  else if (hud.screen === "over") setOverlay("gameover");
  else if (hud.screen === "complete") {
    setOverlay("complete");
    $("results").innerHTML = `
      <div>SCORE <strong>${hud.score}</strong></div>
      <div>TIME <strong>${fmt(hud.time)}</strong></div>
      <div>KILLS <strong>${hud.kills}</strong></div>
      <div>RESCUES <strong>${hud.rescues}</strong></div>
      <div>SECRETS <strong>${hud.secrets}</strong></div>
      <div>RANK <strong>${hud.rank}</strong></div>`;
  } else setOverlay(null);
}

game.onHud = updateHud;
game.start();
updateHud(game.hud);

$("debugBtn").addEventListener("click", () => game.toggleDebug());
$("flashBtn").addEventListener("click", () => game.setFlash(!game.hud.reduceFlash));
$("resumeBtn").addEventListener("click", () => game.resume());
$("pauseMenuBtn").addEventListener("click", () => game.toMenu());
$("retryBtn").addEventListener("click", () => game.retry());
$("overMenuBtn").addEventListener("click", () => game.toMenu());
$("continueBtn").addEventListener("click", () => game.continueAfterComplete());

function bindHold(el, down, up) {
  const start = (e) => { e.preventDefault(); el.classList.add("active"); down(); };
  const end = (e) => { e.preventDefault(); el.classList.remove("active"); up(); };
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("pointerleave", (e) => { if (e.buttons) end(e); });
}

document.querySelectorAll("[data-touch]").forEach((el) => {
  const action = el.dataset.touch;
  if (action === "left") bindHold(el, () => game.input.touchMoveX = -1, () => game.input.touchMoveX = 0);
  if (action === "right") bindHold(el, () => game.input.touchMoveX = 1, () => game.input.touchMoveX = 0);
  if (action === "jump") bindHold(el, () => game.input.touchJump = true, () => game.input.touchJump = false);
  if (action === "shoot") bindHold(el, () => game.input.touchShoot = true, () => game.input.touchShoot = false);
  if (action === "grenade") bindHold(el, () => game.input.touchGrenade = true, () => game.input.touchGrenade = false);
  if (action === "melee") bindHold(el, () => game.input.touchMelee = true, () => game.input.touchMelee = false);
  if (action === "reload") bindHold(el, () => game.input.touchReload = true, () => game.input.touchReload = false);
  if (action === "crouch") bindHold(el, () => game.input.touchCrouch = true, () => game.input.touchCrouch = false);
});

window.addEventListener("beforeunload", () => game.destroy());
