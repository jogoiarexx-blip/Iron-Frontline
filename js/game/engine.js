import { AssetManager } from "./assets.js";
import { GameAudio } from "./audio.js";
import { Input } from "./input.js";
import { loadSave, recordRun, unlockMission, writeSave } from "./save.js";
import { PHASES, getPhaseById, phaseTriggerX } from "./phases/phases.js";
import { getEnemySpec, getActorHitbox } from "./enemies/enemy-system.js";
import { PLAYER_CONFIG, weaponMagSize, getPlayerState } from "./player/player-system.js";
import { createBossState } from "./bosses/boss-system.js";
import { updatePlayerController, firePlayerController, tryMeleeController, getMuzzle, getPlayerBox } from "./player/player-controller.js";
import { updateEnemyAI, clearEnemyProjectiles } from "./enemies/enemy-ai.js";
import { updateBossCombat, runBossAttack, damageBoss } from "./bosses/boss-combat.js";
import { spawnProjectile, updateProjectiles, damageActor, dropPickupItem, explodeAt, damagePlayer, spawnMuzzleFx, spawnWeaponSmoke, spawnBurst, updateParticles } from "./systems/combat-system.js";
import { updateCamera } from "./core/camera-system.js";
import { renderGame, renderWorld, renderPlayer, renderActor, renderBoss, renderPixelSoldier } from "./render/renderer.js";


import { VW, VH, FIXED } from "./core/constants.js";
export { VW, VH } from "./core/constants.js";
export class IronFrontline {
    constructor(canvas) {
        this.input = new Input();
        this.audio = new GameAudio();
        this.assets = new AssetManager();
        this.save = loadSave();
        this.screen = "menu";
        this.debug = false;
        this.running = false;
        this.acc = 0;
        this.last = 0;
        this.raf = 0;
        this.dpr = 1;
        this.phase = PHASES[0];
        this.eventI = 0;
        this.clock = 0;
        this.spawnBlock = false;
        this.camX = 0;
        this.camY = 0;
        this.shake = 0;
        this.camMode = "follow";
        this.hitstop = 0;
        this.px = 48;
        this.py = 120;
        this.pvx = 0;
        this.pvy = 0;
        this.pW = PLAYER_CONFIG.width;
        this.pH = PLAYER_CONFIG.height;
        this.facing = "right";
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.hp = PLAYER_CONFIG.maxHp;
        this.maxHp = PLAYER_CONFIG.maxHp;
        this.inv = 0;
        this.shootCd = 0;
        this.nadeCd = 0;
        this.nades = 3;
        this.weapon = "rifle";
        this.weaponT = 0;
        this.ammo = 18;
        this.ammoMax = 18;
        this.reloadT = 0;
        this.reloadFxT = 0;
        this.crouch = false;
        this.score = 0;
        this.kills = 0;
        this.rescues = 0;
        this.secrets = 0;
        this.anim = 0;
        this.shootFxT = 0;
        this.meleeFxT = 0;
        this.grenadeFxT = 0;
        this.hurtFxT = 0;
        this.pickupFxT = 0;
        this.checkpoint = false;
        this.deadT = 0;
        this.actors = [];
        this.bullets = [];
        this.parts = [];
        this.boss = null;
        this.seqT = 0;
        this.wallBreak = 0;
        this.loadPct = 0;
        this.loadStatus = "READY";
        this.fps = 60;
        this.frames = 0;
        this.fpsT = 0;
        this.miniDone = false;
        this.objective = "ADVANCE EAST";
        this.objectiveT = 0;
        this.arenaActive = false;
        this.arenaGateX = 0;
        this.setpieceFlash = 0;
        this.prevPlay = "play";
        this.onResize = () => this.resize();
        this.canvas = canvas;
        const c = canvas.getContext("2d");
        if (!c)
            throw new Error("no 2d");
        this.ctx = c;
        this.hud = this.snap();
        this.input.attach(canvas);
        this.resize();
        window.addEventListener("resize", this.onResize);
        this.wireControlsTest();
        window.__game = this;
    }
    forceBoss() {
        this.startBossPrep();
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.last = performance.now();
        const loop = (t) => {
            if (!this.running)
                return;
            let dt = Math.min(0.05, (t - this.last) / 1000);
            this.last = t;
            this.acc += dt;
            this.fpsT += dt;
            this.frames++;
            if (this.fpsT >= 1) {
                this.fps = this.frames;
                this.frames = 0;
                this.fpsT = 0;
            }
            while (this.acc >= FIXED) {
                this.step(FIXED);
                this.acc -= FIXED;
            }
            this.draw();
            this.pushHud();
            this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
    }
    destroy() {
        this.running = false;
        cancelAnimationFrame(this.raf);
        this.input.destroy();
        window.removeEventListener("resize", this.onResize);
        if (window.__game === this)
            delete window.__game;
    }
    resize() {
        const r = this.canvas.parentElement?.getBoundingClientRect();
        const w = r?.width ?? window.innerWidth;
        const h = r?.height ?? window.innerHeight;
        this.dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssScale = Math.max(0.5, Math.min(w / VW, h / VH));
        const renderScale = Math.max(1, Math.round(cssScale * this.dpr));
        this.canvas.style.width = `${Math.floor(VW * cssScale)}px`;
        this.canvas.style.height = `${Math.floor(VH * cssScale)}px`;
        this.canvas.width = VW * renderScale;
        this.canvas.height = VH * renderScale;
    }
    playMission(id) {
        this.audio.unlock();
        const p = getPhaseById(id);
        void this.beginPhase(p, false);
    }
    continueAfterComplete() {
        if (this.phase.next)
            this.playMission(this.phase.next);
        else
            this.screen = "menu";
    }
    resume() {
        if (this.screen === "paused")
            this.screen = this.prevPlay;
    }
    retry() {
        void this.beginPhase(this.phase, this.checkpoint);
    }
    toMenu() {
        this.screen = "menu";
        this.audio.setMode("off");
        this.clearWorld();
    }
    toggleDebug() {
        this.debug = !this.debug;
    }
    setFlash(v) {
        this.save.reduceFlash = v;
        writeSave(this.save);
    }
    async beginPhase(p, fromCk) {
        this.phase = p;
        this.screen = "loading";
        this.loadPct = 0;
        this.loadStatus = "UNLOADING";
        this.assets.unloadPhase();
        this.clearWorld();
        this.loadStatus = "LOADING ASSETS";
        if (this.assets.global.size === 0) {
            await this.assets.loadGlobal((l, t) => {
                this.loadPct = Math.floor((l / t) * 70);
                this.loadStatus = `GLOBAL ${l}/${t}`;
            });
        }
        else
            this.loadPct = 70;
        await this.assets.loadPhase(p.id, (l, t, n) => {
            this.loadPct = 70 + Math.floor((l / t) * 30);
            this.loadStatus = n ?? "PHASE";
        });
        this.loadPct = 100;
        this.loadStatus = "READY";
        this.resetPlayer(fromCk);
        this.clock = 0;
        this.eventI = fromCk ? p.events.length : 0;
        this.spawnBlock = fromCk;
        this.checkpoint = fromCk;
        this.miniDone = fromCk;
        this.camMode = "follow";
        if (fromCk) {
            this.screen = "bossPrep";
            this.seqT = 1.2;
        }
        else {
            this.screen = "intro";
            this.seqT = 2.1;
        }
        this.audio.setMode("phase");
    }
    resetPlayer(atBoss) {
        this.px = atBoss ? this.phase.width - 520 : 40;
        this.py = this.phase.ground - 40;
        this.pvx = 0;
        this.pvy = 0;
        this.hp = this.maxHp;
        this.inv = 1;
        this.shootFxT = 0;
        this.meleeFxT = 0;
        this.grenadeFxT = 0;
        this.hurtFxT = 0;
        this.pickupFxT = 0;
        this.nades = 3;
        this.weapon = "rifle";
        this.ammoMax = 18;
        this.ammo = this.ammoMax;
        this.reloadT = 0;
        this.reloadFxT = 0;
        this.facing = "right";
        this.score = atBoss ? this.score : 0;
        if (!atBoss) {
            this.kills = 0;
            this.rescues = 0;
            this.secrets = 0;
        }
        this.deadT = 0;
        this.objective = atBoss ? "REACH THE BOSS" : "ADVANCE EAST";
        this.objectiveT = 2.5;
        this.arenaActive = false;
        this.arenaGateX = 0;
        this.setpieceFlash = 0;
        this.boss = null;
        this.camX = Math.max(0, this.px - 80);
    }
    clearWorld() {
        this.actors = [];
        this.bullets = [];
        this.parts = [];
        this.boss = null;
        this.spawnBlock = false;
    }
    step(dt) {
        this.input.update();
        this.audio.update(dt);
        if (this.screen === "menu")
            return;
        if (this.screen === "loading")
            return;
        if (this.screen === "paused") {
            if (this.input.actions.pause)
                this.screen = "play";
            return;
        }
        if (this.screen === "intro") {
            this.seqT -= dt;
            if (this.seqT <= 0)
                this.screen = "play";
            return;
        }
        if (this.screen === "complete") {
            if (this.input.actions.confirm || this.input.actions.jumpPressed)
                this.continueAfterComplete();
            return;
        }
        if (this.screen === "over")
            return;
        if (this.input.actions.pause && (this.screen === "play" || this.screen === "bossFight" || this.screen === "miniboss")) {
            this.prevPlay = this.screen;
            this.screen = "paused";
            return;
        }
        if (this.hitstop > 0) {
            this.hitstop -= dt;
            return;
        }
        if (this.screen === "play" || this.screen === "miniboss") {
            this.clock += dt;
            this.objectiveT = Math.max(0, this.objectiveT - dt);
            this.setpieceFlash = Math.max(0, this.setpieceFlash - dt);
            this.runEvents();
            this.updatePlayer(dt);
            this.updateActors(dt);
            this.updateBullets(dt);
            this.updateParts(dt);
            this.updateCam(dt);
            if (this.hp <= 0)
                this.killPlayer(dt);
        }
        else if (this.screen === "bossPrep") {
            this.updatePlayer(dt);
            this.updateActors(dt);
            this.updateBullets(dt);
            this.updateParts(dt);
            this.updateCam(dt);
            this.seqT -= dt;
            this.fleeEnemies();
            if (this.seqT <= 0) {
                this.screen = "bossWarn";
                this.seqT = 2.6;
                this.audio.warning();
                this.shake = 4;
            }
        }
        else if (this.screen === "bossWarn") {
            this.updatePlayer(dt);
            this.updateParts(dt);
            this.updateCam(dt);
            this.seqT -= dt;
            if (this.seqT <= 0)
                this.startBossIntro();
        }
        else if (this.screen === "bossIntro") {
            this.updateBoss(dt);
            this.updateParts(dt);
            this.updateCam(dt);
            this.seqT -= dt;
            if (this.seqT <= 0) {
                this.screen = "bossFight";
                this.camMode = "arena";
                this.audio.setMode("boss");
                if (this.boss)
                    this.boss.inv = false;
            }
        }
        else if (this.screen === "bossFight") {
            this.updatePlayer(dt);
            this.updateBoss(dt);
            this.updateBullets(dt);
            this.updateParts(dt);
            this.updateCam(dt);
            if (this.hp <= 0)
                this.killPlayer(dt);
        }
        else if (this.screen === "bossDeath") {
            this.updateBoss(dt);
            this.updateParts(dt);
            this.updateCam(dt);
        }
    }
    runEvents() {
        if (this.screen === "miniboss" || this.arenaActive)
            return;
        const evs = this.phase.events;
        const triggerFor = (time) => phaseTriggerX(this.phase, time);
        while (this.eventI < evs.length && this.px >= triggerFor(evs[this.eventI].time)) {
            const e = evs[this.eventI];
            this.eventI++;
            if (e.text) {
                this.objective = e.text;
                this.objectiveT = 2.6;
            }
            if (e.type === "spawn" && !this.spawnBlock) {
                for (let i = 0; i < (e.count ?? 1); i++)
                    this.spawnEnemy(e.enemy ?? "rifle", e.side ?? "right", i);
            }
            else if (e.type === "ambush" && !this.spawnBlock) {
                const total = e.count ?? 4;
                for (let i = 0; i < total; i++)
                    this.spawnEnemy(e.enemy ?? "rifle", i % 2 === 0 ? "left" : "right", Math.floor(i / 2));
            }
            else if (e.type === "arena" && !this.spawnBlock) {
                this.startArena(e.enemy ?? "rifle", e.count ?? 4, e.text ?? "CLEAR THE AREA");
                break;
            }
            else if (e.type === "collapse")
                this.triggerCollapse();
            else if (e.type === "barricade")
                this.spawnBarricade();
            else if (e.type === "hostage")
                this.spawnHostage();
            else if (e.type === "crate")
                this.spawnCrate();
            else if (e.type === "barrel")
                this.spawnBarrel();
            else if (e.type === "secret")
                this.spawnSecret();
            else if (e.type === "bossPrep")
                this.startBossPrep();
        }
        const miniX = triggerFor(this.phase.mini.time);
        if (!this.miniDone && !this.spawnBlock && this.px >= miniX) {
            this.miniDone = true;
            this.spawnMini(this.phase.mini.type);
        }
    }
    startArena(enemy, total, text) {
        this.arenaActive = true;
        this.arenaGateX = Math.min(this.phase.width - 700, this.px + 115);
        this.objective = text;
        this.objectiveT = 4;
        this.shake = Math.max(this.shake, 4);
        for (let i = 0; i < total; i++) {
            const side = i % 2 === 0 ? "right" : "left";
            const type = i === total - 1 && enemy === "rifle" ? "heavy" : enemy;
            this.spawnEnemy(type, side, Math.floor(i / 2));
        }
    }
    triggerCollapse() {
        const x = this.camX + VW * 0.72;
        this.setpieceFlash = 0.22;
        this.shake = 12;
        this.audio.explode();
        this.burst(x, this.phase.ground - 70, "#ff9a42", 28);
        this.burst(x + 18, this.phase.ground - 35, "#7b6858", 24);
        this.spawnBarrel(x - 22);
        this.spawnBarrel(x + 38);
        this.spawnBarricade(x + 18);
    }
    spawnBarricade(x = this.camX + VW * 0.7) {
        this.actors.push({
            kind: "crate", type: "barricade", x, y: this.phase.ground - 24,
            w: 28, h: 24, vx: 0, hp: 70, max: 70, facing: "right", state: "idle", t: 0,
            shoot: 0, score: 120, color: "#6e5334", enter: 0, turret: 0, active: true, alive: true,
            hurt: 0, anim: 0, fireFx: 0,
        });
    }
    startBossPrep() {
        this.spawnBlock = true;
        this.checkpoint = true;
        this.screen = "bossPrep";
        this.seqT = 2.4;
        this.audio.setMode("phase");
        this.camMode = "follow";
        this.objective = "AREA CLEAR — WARNING";
        this.objectiveT = 3;
        for (const a of this.actors) {
            if (a.kind === "enemy" && a.alive)
                a.state = "flee";
        }
    }
    startBossIntro() {
        this.screen = "bossIntro";
        this.seqT = 4.2;
        this.audio.setMode("silence");
        this.camMode = "cine";
        this.wallBreak = 1.2;
        this.objective = this.phase.boss.id === "iron" ? "WAR MACHINE APPROACHING" : "BOSS INBOUND";
        this.objectiveT = 3.2;
        const b = this.phase.boss;
        const ground = this.phase.ground;
        this.boss = createBossState(b, this.camX, VW, ground);
        this.audio.impact();
        this.shake = 10;
        this.setpieceFlash = 0.15;
    }
    spawnEnemy(type, side, i) {
        const g = this.phase.ground;
        const margin = 28 + i * 22;
        const x = side === "left" ? this.camX - margin : this.camX + VW + margin;
        const facing = side === "left" ? "right" : "left";
        const spec = getEnemySpec(type);
        this.actors.push({
            kind: "enemy",
            type,
            x,
            y: type === "para" ? 28 + i * 16 : g - spec.h,
            w: spec.w,
            h: spec.h,
            vx: facing === "right" ? spec.spd : -spec.spd,
            hp: spec.hp,
            max: spec.hp,
            facing,
            state: type === "para" ? "drop" : "enter",
            t: type === "para" ? 1.4 : 0.55,
            shoot: 0.4 + Math.random(),
            score: spec.score,
            color: spec.color,
            enter: spec.spd,
            turret: 0,
            active: true,
            alive: true,
            hurt: 0,
            anim: Math.random() * 10,
            fireFx: 0,
        });
    }
    spawnMini(type) {
        if (this.spawnBlock)
            return;
        this.screen = "miniboss";
        this.objective = "DESTROY THE ARMORED UNIT";
        this.objectiveT = 3;
        const g = this.phase.ground;
        const x = this.camX + VW + 40;
        if (type === "jeep" || type === "tank") {
            this.actors.push({
                kind: "vehicle",
                type,
                x,
                y: g - (type === "tank" ? 28 : 22),
                w: type === "tank" ? 48 : 40,
                h: type === "tank" ? 28 : 22,
                vx: -70,
                hp: type === "tank" ? 220 : 140,
                max: type === "tank" ? 220 : 140,
                facing: "left",
                state: "drive",
                t: 0,
                shoot: 0.6,
                score: 800,
                color: "#4a5a3a",
                enter: 0,
                turret: Math.PI,
                active: true,
                alive: true,
                hurt: 0,
                anim: 0,
                fireFx: 0,
            });
        }
        else {
            this.actors.push({
                kind: "vehicle",
                type: "gunship",
                x,
                y: 36,
                w: 52,
                h: 18,
                vx: -80,
                hp: 180,
                max: 180,
                facing: "left",
                state: "fly",
                t: 0,
                shoot: 0.5,
                score: 900,
                color: "#3a4a4a",
                enter: 0,
                turret: 0,
                active: true,
                alive: true,
                hurt: 0,
                anim: 0,
                fireFx: 0,
            });
        }
    }
    spawnBarrel(x = this.camX + VW * 0.72) {
        this.actors.push({
            kind: "barrel", type: "explosive", x, y: this.phase.ground - 18,
            w: 12, h: 18, vx: 0, hp: 24, max: 24, facing: "right", state: "idle", t: 0,
            shoot: 0, score: 60, color: "#c44818", enter: 0, turret: 0, active: true, alive: true, hurt: 0,
            anim: 0,
            fireFx: 0,
        });
    }
    spawnHostage() {
        this.actors.push({
            kind: "hostage",
            type: "civ",
            x: this.camX + VW * 0.55,
            y: this.phase.ground - 22,
            w: 12,
            h: 22,
            vx: 0,
            hp: 1,
            max: 1,
            facing: "right",
            state: "tied",
            t: 0,
            shoot: 0,
            score: 400,
            color: "#d8c090",
            enter: 0,
            turret: 0,
            active: true,
            alive: true,
            hurt: 0,
            anim: Math.random() * 10,
            fireFx: 0,
        });
    }
    spawnCrate() {
        this.actors.push({
            kind: "crate",
            type: "crate",
            x: this.camX + VW * 0.7,
            y: this.phase.ground - 14,
            w: 14,
            h: 14,
            vx: 0,
            hp: 20,
            max: 20,
            facing: "right",
            state: "idle",
            t: 0,
            shoot: 0,
            score: 50,
            color: "#8a6a30",
            enter: 0,
            turret: 0,
            active: true,
            alive: true,
            hurt: 0,
            anim: Math.random() * 10,
            fireFx: 0,
        });
        this.actors.push({
            kind: "barrel",
            type: "barrel",
            x: this.camX + VW * 0.35,
            y: this.phase.ground - 16,
            w: 10,
            h: 16,
            vx: 0,
            hp: 12,
            max: 12,
            facing: "right",
            state: "idle",
            t: 0,
            shoot: 0,
            score: 40,
            color: "#b05020",
            enter: 0,
            turret: 0,
            active: true,
            alive: true,
            hurt: 0,
            anim: Math.random() * 10,
            fireFx: 0,
        });
    }
    spawnSecret() {
        this.actors.push({
            kind: "secret",
            type: "flag",
            x: this.camX + 30,
            y: this.phase.ground - 18,
            w: 10,
            h: 16,
            vx: 0,
            hp: 1,
            max: 1,
            facing: "right",
            state: "idle",
            t: 0,
            shoot: 0,
            score: 1000,
            color: "#e8b84a",
            enter: 0,
            turret: 0,
            active: true,
            alive: true,
            hurt: 0,
            anim: Math.random() * 10,
            fireFx: 0,
        });
    }
    weaponMagSize(w = this.weapon) {
        return weaponMagSize(w);
    }
    playerState() {
        return getPlayerState(this);
    }
    actorBox(a) {
        return getActorHitbox(a);
    }
    updatePlayer(dt) {
        return updatePlayerController(this, dt);
    }
    firePlayer() {
        return firePlayerController(this);
    }
    tryMelee() {
        return tryMeleeController(this);
    }
    muzzle() {
        return getMuzzle(this);
    }
    pbox() {
        return getPlayerBox(this);
    }
    updateActors(dt) {
        return updateEnemyAI(this, dt);
    }
    fleeEnemies() {
        return clearEnemyProjectiles(this);
    }
    updateBoss(dt) {
        return updateBossCombat(this, dt);
    }
    bossAttack(b) {
        return runBossAttack(this, b);
    }
    hurtBoss(n) {
        return damageBoss(this, n);
    }
    spawnBullet(x, y, vx, vy, dmg, owner, nade, weapon = "default") {
        return spawnProjectile(this, x, y, vx, vy, dmg, owner, nade, weapon);
    }
    updateBullets(dt) {
        return updateProjectiles(this, dt);
    }
    hurtActor(a, dmg) {
        return damageActor(this, a, dmg);
    }
    dropPickup(x, y) {
        return dropPickupItem(this, x, y);
    }
    boom(x, y, owner, dmg) {
        return explodeAt(this, x, y, owner, dmg);
    }
    hurtPlayer(n) {
        return damagePlayer(this, n);
    }
    killPlayer(dt) {
        this.deadT += dt;
        if (this.deadT > 1.4)
            this.finishDeath();
    }
    finishDeath() {
        this.screen = "over";
        this.audio.setMode("off");
    }
    finishMission() {
        this.screen = "complete";
        const n = parseInt(this.phase.id, 10);
        unlockMission(this.save, n + 1);
        recordRun(this.save, this.phase.id, this.score, this.clock);
        this.audio.setMode("off");
        this.audio.pickup();
    }
    muzzleFx(x, y, dir, casing = true) {
        return spawnMuzzleFx(this, x, y, dir, casing);
    }
    weaponSmoke(x, y, dir) {
        return spawnWeaponSmoke(this, x, y, dir);
    }
    burst(x, y, c, n) {
        return spawnBurst(this, x, y, c, n);
    }
    updateParts(dt) {
        return updateParticles(this, dt);
    }
    updateCam(dt) {
        return updateCamera(this, dt);
    }
    draw() {
        return renderGame(this);
    }
    drawWorld() {
        return renderWorld(this);
    }
    drawPlayer() {
        return renderPlayer(this);
    }
    drawActor(a) {
        return renderActor(this, a);
    }
    drawBoss(b) {
        return renderBoss(this, b);
    }
    pixelSoldier(x, y, w, h, facing, color, player) {
        return renderPixelSoldier(this, x, y, w, h, facing, color, player);
    }
    snap() {
        const performanceScore = this.score + this.kills * 35 + this.rescues * 450 + this.secrets * 700 - Math.floor(this.clock * 3);
        const rank = performanceScore >= 6500 ? "S" : performanceScore >= 4200 ? "A" : performanceScore >= 2200 ? "B" : "C";
        return {
            screen: this.screen,
            missionName: `MISSION ${this.phase.num}`,
            missionTitle: this.phase.name,
            loadPct: this.loadPct,
            loadStatus: this.loadStatus,
            hp: this.hp,
            maxHp: this.maxHp,
            score: this.score,
            weapon: this.weapon,
            ammo: this.ammo,
            ammoMax: this.ammoMax,
            reloading: this.reloadT > 0,
            grenades: this.nades,
            time: this.clock,
            kills: this.kills,
            rescues: this.rescues,
            secrets: this.secrets,
            rank,
            bossName: this.boss?.name ?? "",
            bossSub: this.boss?.sub ?? "",
            bossHp: this.boss?.hp ?? 0,
            bossMax: this.boss?.max ?? 1,
            showBossHud: !!(this.boss && (this.screen === "bossFight" || this.screen === "bossIntro" || this.screen === "bossDeath")),
            debug: this.debug
                ? `FPS ${this.fps}  ${this.screen}  e:${this.actors.length} b:${this.bullets.length} p:${this.parts.length} gp:${this.input.gamepadConnected ? "ON" : "off"}`
                : "",
            flash: this.screen === "bossWarn",
            reduceFlash: this.save.reduceFlash,
            gamepad: this.input.gamepadConnected ? this.input.gamepadId.slice(0, 28) : "",
            unlocked: this.save.unlocked,
            best: this.save.bestScore,
            objective: this.objectiveT > 0 ? this.objective : "",
        };
    }
    pushHud() {
        this.hud = this.snap();
        this.onHud?.(this.hud);
    }
    wireControlsTest() {
        window.__controlsTest = {
            getYaw: () => (this.facing === "left" ? Math.PI : 0),
            getSpeed: () => Math.hypot(this.pvx, this.pvy),
            setKeys: (codes) => this.input.setInjectedKeys(codes),
            setSteer: (v) => {
                this.input.setInjectedKeys(v > 0.2 ? ["KeyD"] : v < -0.2 ? ["KeyA"] : []);
            },
        };
    }
}
