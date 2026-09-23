import { AssetManager, drawSheet } from "./assets.js";
import { GameAudio } from "./audio.js";
import { Input } from "./input.js";
import { loadSave, recordRun, unlockMission, writeSave } from "./save.js";
import { PHASES, getPhaseById, phaseTriggerX } from "./phases/phases.js";
import { getEnemySpec, getActorHitbox } from "./enemies/enemy-system.js";
import { PLAYER_CONFIG, weaponMagSize, getPlayerState, getPlayerHitbox } from "./player/player-system.js";
import { createBossState, bossAttackCooldown, warMachineMovement } from "./bosses/boss-system.js";
import { aabb, hash } from "./render/render-utils.js";
export const VW = 384;
export const VH = 216;
const FIXED = 1 / 60;
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
        if (this.hp <= 0)
            return;
        const a = this.input.actions;
        this.crouch = a.crouch && this.onGround;
        const locked = this.reloadT > 0.01 || this.grenadeFxT > 0.01 || this.meleeFxT > 0.01;
        const spd = this.crouch ? PLAYER_CONFIG.crouchSpeed : PLAYER_CONFIG.moveSpeed;
        this.pvx = locked ? this.pvx * 0.45 : a.moveX * spd;
        if (a.moveX > 0.2)
            this.facing = "right";
        else if (a.moveX < -0.2)
            this.facing = "left";
        if (this.onGround)
            this.coyote = 0.1;
        else
            this.coyote -= dt;
        if (a.jumpPressed)
            this.jumpBuf = 0.12;
        else
            this.jumpBuf -= dt;
        if (!locked && this.jumpBuf > 0 && this.coyote > 0) {
            this.pvy = PLAYER_CONFIG.jumpVelocity;
            this.onGround = false;
            this.coyote = 0;
            this.jumpBuf = 0;
        }
        if (!a.jump && this.pvy < 0)
            this.pvy *= 0.55;
        const grav = this.pvy > 0 ? 980 : 720;
        this.pvy += grav * dt;
        if (this.pvy > 380)
            this.pvy = 380;
        this.px += this.pvx * dt;
        this.py += this.pvy * dt;
        const g = this.phase.ground;
        const h = this.crouch ? 18 : this.pH;
        if (this.py + h >= g) {
            this.py = g - h;
            this.pvy = 0;
            this.onGround = true;
        }
        else
            this.onGround = false;
        this.px = Math.max(0, Math.min(this.phase.width - this.pW, this.px));
        if (this.arenaActive && this.px > this.arenaGateX)
            this.px = this.arenaGateX;
        for (const ob of this.actors) {
            if (!ob.active || !ob.alive || ob.kind !== "crate" || ob.type !== "barricade")
                continue;
            const pbox = this.pbox();
            const box = this.actorBox(ob);
            if (!aabb(pbox, box))
                continue;
            if (this.pvx >= 0)
                this.px = box.x - this.pW - 1;
            else
                this.px = box.x + box.w + 1;
            this.pvx = 0;
        }
        this.shootCd -= dt;
        this.nadeCd -= dt;
        this.weaponT -= dt;
        if (this.weaponT <= 0 && this.weapon !== "rifle") {
            this.weapon = "rifle";
            this.ammoMax = this.weaponMagSize("rifle");
            this.ammo = Math.min(this.ammoMax, this.ammo || this.ammoMax);
        }
        this.reloadT = Math.max(0, this.reloadT - dt);
        if (this.reloadT === 0 && this.reloadFxT > 0) {
            this.ammoMax = this.weaponMagSize();
            this.ammo = this.ammoMax;
            this.reloadFxT = 0;
        }
        this.inv -= dt;
        this.shootFxT = Math.max(0, this.shootFxT - dt);
        this.meleeFxT = Math.max(0, this.meleeFxT - dt);
        this.grenadeFxT = Math.max(0, this.grenadeFxT - dt);
        this.hurtFxT = Math.max(0, this.hurtFxT - dt);
        this.pickupFxT = Math.max(0, this.pickupFxT - dt);
        this.anim += dt * (Math.abs(this.pvx) > 20 ? 12 : 6);
        if (a.reload)
            this.startReload();
        if (a.shoot && this.reloadT <= 0 && this.shootCd <= 0 && this.grenadeFxT <= 0.01 && this.meleeFxT <= 0.01) {
            if (this.ammo <= 0)
                this.startReload(true);
            else
                this.firePlayer();
        }
        if (a.grenade && this.reloadT <= 0 && this.nadeCd <= 0 && this.nades > 0) {
            this.nades--;
            this.nadeCd = 0.9;
            this.grenadeFxT = 0.36;
            const dir = this.facing === "right" ? 1 : -1;
            this.spawnBullet(this.muzzle().x, this.muzzle().y, dir * 160, -140, 48, "p", true);
            this.audio.grenade();
        }
        if (a.melee && this.reloadT <= 0 && this.grenadeFxT <= 0.01)
            this.tryMelee();
        const pb = this.pbox();
        for (const act of this.actors) {
            if (!act.active || !act.alive)
                continue;
            if (!aabb(pb, this.actorBox(act)))
                continue;
            if (act.kind === "hostage" && act.state === "tied") {
                act.state = "free";
                this.rescues++;
                this.score += act.score;
                this.audio.pickup();
            }
            if (act.kind === "secret") {
                act.alive = false;
                act.active = false;
                this.secrets++;
                this.score += act.score;
                this.save.secrets.push(`${this.phase.id}-${this.secrets}`);
                writeSave(this.save);
                this.audio.pickup();
            }
            if (act.kind === "pickup") {
                act.alive = false;
                act.active = false;
                this.pickupFxT = 0.45;
                if (act.type === "hp")
                    this.hp = Math.min(this.maxHp, this.hp + 30);
                if (act.type === "shot") {
                    this.weapon = "shot";
                    this.weaponT = 12;
                    this.ammoMax = this.weaponMagSize("shot");
                    this.ammo = this.ammoMax;
                    this.objective = "SHOTGUN EQUIPPED";
                    this.objectiveT = 1.1;
                }
                if (act.type === "rocket") {
                    this.weapon = "rocket";
                    this.weaponT = 10;
                    this.ammoMax = this.weaponMagSize("rocket");
                    this.ammo = this.ammoMax;
                    this.objective = "ROCKET LAUNCHER EQUIPPED";
                    this.objectiveT = 1.1;
                }
                if (act.type === "nade")
                    this.nades += 2;
                this.audio.pickup();
            }
        }
    }
    firePlayer() {
        this.shootFxT = this.weapon === "rocket" ? 0.34 : this.weapon === "shot" ? 0.24 : 0.18;
        const m = this.muzzle();
        const dir = this.facing === "right" ? 1 : -1;
        const up = this.input.actions.aimUp || (!this.onGround && this.input.actions.jump);
        const ang = up ? -0.45 : 0;
        if (this.weapon === "shot") {
            this.shootCd = 0.28;
            for (let i = -2; i <= 2; i++) {
                const a = ang + i * 0.12;
                this.spawnBullet(m.x, m.y, Math.cos(a) * 280 * dir, Math.sin(a) * 280, 8, "p", false, "shot");
            }
            this.ammo -= 1;
        }
        else if (this.weapon === "rocket") {
            this.shootCd = 0.45;
            this.spawnBullet(m.x, m.y, dir * 220, Math.sin(ang) * 220, 40, "p", true, "rocket");
            this.ammo -= 1;
        }
        else {
            this.shootCd = 0.11;
            this.spawnBullet(m.x, m.y, dir * 340, Math.sin(ang) * 340, 12, "p", false, "rifle");
            this.ammo -= 1;
        }
        if (this.weapon === "rocket") {
            this.muzzleFx(m.x, m.y, dir, false);
            this.weaponSmoke(m.x - dir * 8, m.y, -dir);
            this.shake = Math.max(this.shake, 5);
        }
        else if (this.weapon === "shot") {
            this.muzzleFx(m.x, m.y, dir, true);
            this.weaponSmoke(m.x - dir * 2, m.y, -dir);
            this.shake = Math.max(this.shake, 3.5);
        }
        else {
            this.muzzleFx(m.x, m.y, dir, true);
            this.shake = Math.max(this.shake, 1.8);
        }
        if (this.ammo <= 0)
            this.startReload(true);
        this.audio.shoot();
    }
    tryMelee() {
        this.meleeFxT = 0.24;
        const dir = this.facing === "right" ? 1 : -1;
        const box = { x: this.px + (dir > 0 ? this.pW : -16), y: this.py + 8, w: 16, h: 14 };
        for (const a of this.actors) {
            if (a.kind !== "enemy" || !a.alive)
                continue;
            if (aabb(box, this.actorBox(a)))
                this.hurtActor(a, 24);
        }
    }
    muzzle() {
        const dir = this.facing === "right" ? 1 : -1;
        return { x: this.px + this.pW / 2 + dir * 14, y: this.py + (this.crouch ? 10 : 12) };
    }
    pbox() {
        const st = this.playerState();
        if (st === "dead")
            return { x: this.px + 2, y: this.py + this.pH * 0.6, w: this.pW + 6, h: 8 };
        if (st === "crouch" || st === "reload")
            return { x: this.px + 4, y: this.py + 8, w: this.pW - 7, h: 11 };
        if (st === "jump")
            return { x: this.px + 4, y: this.py + 3, w: this.pW - 6, h: this.pH - 8 };
        return { x: this.px + 3, y: this.py + 4, w: this.pW - 6, h: (this.crouch ? 18 : this.pH) - 6 };
    }
    updateActors(dt) {
        const g = this.phase.ground;
        for (const a of this.actors) {
            if (!a.active)
                continue;
            if (!a.alive) {
                a.t -= dt;
                a.anim += dt * 6;
                if (a.t <= 0)
                    a.active = false;
                continue;
            }
            a.hurt -= dt;
            a.fireFx = Math.max(0, a.fireFx - dt);
            a.anim += dt * (Math.abs(a.vx) > 1 ? 8 : 4);
            const dist = Math.abs(a.x - this.px);
            if (dist > 900)
                continue;
            if (a.kind === "enemy") {
                if (a.state === "drop") {
                    a.y += 90 * dt;
                    if (a.y + a.h >= g) {
                        a.y = g - a.h;
                        a.state = "fight";
                        this.burst(a.x + a.w / 2, a.y, "#bbb", 5);
                    }
                }
                else if (a.state === "enter") {
                    a.t -= dt;
                    a.x += (a.facing === "right" ? 1 : -1) * a.enter * 1.2 * dt;
                    if (a.t <= 0)
                        a.state = "fight";
                }
                else if (a.state === "flee") {
                    const fleeDir = a.x < this.px ? -1 : 1;
                    a.facing = fleeDir > 0 ? "right" : "left";
                    a.x += fleeDir * 120 * dt;
                    a.t -= dt;
                    if (a.t < -1.2) {
                        a.alive = false;
                        a.active = false;
                    }
                }
                else {
                    const dx = this.px - a.x;
                    if (dx > 8)
                        a.facing = "right";
                    else if (dx < -8)
                        a.facing = "left";
                    const adx = Math.abs(dx);
                    const desired = a.type === "sniper" ? 190 : a.type === "rocket" ? 150 : a.type === "knife" ? 22 : a.type === "shield" ? 58 : 90;
                    if (a.type !== "turret" && adx > desired + 16) {
                        a.x += Math.sign(dx) * Math.abs(a.vx) * (a.type === "knife" ? 0.75 : 0.35) * dt;
                    }
                    a.shoot -= dt;
                    if (a.shoot <= 0) {
                        const dir = a.facing === "right" ? 1 : -1;
                        if (a.type === "knife" && adx < 34) {
                            a.shoot = 0.7;
                            a.fireFx = 0.15;
                            this.hurtPlayer(13);
                            this.hitstop = 0.025;
                        }
                        else if (a.type === "gren" && adx < 240) {
                            a.shoot = 1.6;
                            a.fireFx = 0.22;
                            this.spawnBullet(a.x + a.w / 2, a.y + 8, dir * 120, -90, 18, "e", true, "gren");
                        }
                        else if (a.type === "rocket" && adx < 290) {
                            a.shoot = 2.1;
                            a.fireFx = 0.28;
                            this.spawnBullet(a.x + a.w / 2 + dir * 10, a.y + 8, dir * 155, -45, 25, "e", true, "rocket");
                            this.weaponSmoke(a.x + a.w / 2 - dir * 8, a.y + 8, -dir);
                        }
                        else if (a.type === "sniper" && adx < 330) {
                            a.shoot = 2.4;
                            a.fireFx = 0.16;
                            this.spawnBullet(a.x + a.w / 2 + dir * 10, a.y + 9, dir * 330, 0, 20, "e", false, "sniper");
                            this.muzzleFx(a.x + a.w / 2 + dir * 14, a.y + 9, dir, false);
                        }
                        else if (a.type === "turret" && adx < 300) {
                            a.shoot = 0.55;
                            a.fireFx = 0.18;
                            this.spawnBullet(a.x + a.w / 2 + dir * 12, a.y + 7, dir * 240, 0, 10, "e", false, "turret");
                            this.muzzleFx(a.x + a.w / 2 + dir * 15, a.y + 7, dir, false);
                        }
                        else if (a.type !== "knife" && adx < 220) {
                            a.shoot = a.type === "heavy" ? 0.7 : 1.1;
                            a.fireFx = a.type === "heavy" ? 0.22 : 0.14;
                            this.spawnBullet(a.x + a.w / 2 + dir * 10, a.y + 10, dir * 200, 0, a.type === "heavy" ? 14 : 8, "e", false, a.type === "heavy" ? "heavy" : "rifle");
                            this.muzzleFx(a.x + a.w / 2 + dir * 14, a.y + 10, dir, false);
                        }
                        else {
                            a.shoot = 0.25;
                        }
                    }
                }
                if (a.y + a.h < g)
                    a.y += 220 * dt;
                else
                    a.y = g - a.h;
            }
            else if (a.kind === "vehicle") {
                if (a.type === "gunship") {
                    a.x += a.vx * dt;
                    a.y += Math.sin(this.clock * 3) * 10 * dt;
                    a.shoot -= dt;
                    if (a.shoot <= 0) {
                        a.shoot = 0.55;
                        a.fireFx = 0.18;
                        this.spawnBullet(a.x + 10, a.y + 16, 0, 160, 12, "e", false, "gunship");
                    }
                }
                else {
                    a.x += a.vx * dt;
                    const dx = this.px - a.x;
                    a.turret = Math.atan2(this.py - a.y, dx);
                    a.shoot -= dt;
                    if (a.shoot <= 0) {
                        a.shoot = a.type === "tank" ? 0.9 : 0.5;
                        a.fireFx = 0.18;
                        const sp = a.type === "tank" ? 180 : 220;
                        this.spawnBullet(a.x + a.w / 2, a.y + 6, Math.cos(a.turret) * sp, Math.sin(a.turret) * sp, 12, "e", false, a.type);
                    }
                }
                if (a.x < this.camX - 80 && a.vx < 0) {
                    a.vx *= -1;
                    a.facing = "right";
                }
                if (a.x > this.camX + VW + 40 && a.vx > 0) {
                    a.vx *= -1;
                    a.facing = "left";
                }
            }
            else if (a.kind === "hostage" && a.state === "free") {
                a.x += 40 * dt;
            }
        }
        if (this.screen === "miniboss") {
            const live = this.actors.some((x) => x.kind === "vehicle" && x.alive);
            if (!live) {
                this.screen = "play";
                this.objective = "ADVANCE EAST";
                this.objectiveT = 2;
            }
        }
        if (this.arenaActive) {
            const threats = this.actors.some((x) => x.active && x.alive && (x.kind === "enemy" || x.kind === "vehicle"));
            if (!threats) {
                this.arenaActive = false;
                this.objective = "AREA CLEAR — MOVE!";
                this.objectiveT = 2;
                this.score += 250;
                this.audio.pickup();
            }
        }
    }
    fleeEnemies() {
        for (const b of this.bullets) {
            if (b.owner === "e")
                b.active = false;
        }
    }
    updateBoss(dt) {
        const b = this.boss;
        if (!b || b.st === "end")
            return;
        const g = this.phase.ground;
        b.fireFx = Math.max(0, b.fireFx - dt);
        b.cue = Math.max(0, b.cue - dt);
        if (b.st === "intro") {
            b.t -= dt;
            const targetX = this.camX + VW - 26 - b.w;
            b.x += b.vx * dt;
            if (b.id === "iron" && b.x <= targetX + 14 && this.wallBreak > 0.45) {
                this.wallBreak = 0.28;
                this.setpieceFlash = 0.18;
                this.shake = 14;
                this.audio.explode();
                for (let i = 0; i < 3; i++)
                    this.burst(targetX + 14 + i * 8, g - 28 - i * 10, "#c86", 10);
            }
            if (b.x < targetX)
                b.x = targetX;
            this.burst(b.x + 10, g - 4, "#c84", 3);
            if (Math.random() < 0.35)
                this.burst(b.x + 8 + Math.random() * (b.w - 16), b.y + b.h - 10, "#77665a", 3);
            if (b.t <= 0) {
                b.st = "p1";
                b.inv = false;
                b.vx = 0;
                this.objective = b.id === "iron" ? "DESTROY WAR MACHINE" : "DESTROY THE BOSS";
                this.objectiveT = 2.4;
            }
            return;
        }
        if (b.st === "death") {
            b.t -= dt;
            this.shake = Math.max(this.shake, 6 + (3 - b.t));
            if (Math.random() < 0.5)
                this.burst(b.x + Math.random() * b.w, b.y + Math.random() * b.h, "#fc3", 8);
            if (b.t <= 0) {
                for (let i = 0; i < 28; i++)
                    this.burst(b.x + b.w / 2, b.y + b.h / 2, "#f40", 14);
                this.shake = 16;
                this.audio.explode();
                b.st = "end";
                this.finishMission();
            }
            return;
        }
        if (b.st === "t1" || b.st === "t2") {
            b.t -= dt;
            this.burst(b.x + Math.random() * b.w, b.y + 10, "#f80", 6);
            this.shake = 5;
            if (b.t <= 0) {
                b.phase++;
                b.inv = false;
                b.st = b.phase === 2 ? "p2" : "p3";
                b.cue = 1.2;
                this.objective = b.id === "iron" ? `WAR MACHINE PHASE ${b.phase}` : `BOSS PHASE ${b.phase}`;
                this.objectiveT = 2.1;
                this.audio.warning();
                this.setpieceFlash = 0.12;
            }
            return;
        }
        const dx = this.px - b.x;
        if (dx > 10)
            b.facing = "right";
        else if (dx < -10)
            b.facing = "left";
        const arenaLeft = Math.max(0, this.phase.width - VW + 10);
        const arenaRight = this.phase.width - b.w - 16;
        if (b.id === "iron") {
            const movement = warMachineMovement(b.phase);
            const targetX = Math.max(arenaLeft, Math.min(arenaRight, this.px - (this.px < b.x ? -movement.offset : movement.offset)));
            b.vx = Math.max(-movement.speed, Math.min(movement.speed, (targetX - b.x) * 1.45));
            b.x += b.vx * dt;
            if (Math.abs(targetX - b.x) < 8)
                b.vx *= 0.4;
            if (Math.random() < 0.18 * dt)
                this.burst(b.x + Math.random() * b.w, b.y + b.h - 6, "#544840", 2);
        }
        b.atk -= dt;
        if (b.atk <= 0) {
            this.bossAttack(b);
            b.atk = bossAttackCooldown(b.phase);
        }
        if (b.y + b.h < g)
            b.y += 80 * dt;
        else
            b.y = g - b.h;
        if (aabb(this.pbox(), { x: b.x + 10, y: b.y + 8, w: b.w - 20, h: b.h - 10 }))
            this.hurtPlayer(b.phase >= 3 ? 18 : 12);
        const ratio = b.hp / b.max;
        if (b.phase === 1 && ratio <= 0.7) {
            b.st = "t1";
            b.t = 1.3;
            b.inv = true;
        }
        else if (b.phase === 2 && ratio <= 0.4) {
            b.st = "t2";
            b.t = 1.5;
            b.inv = true;
        }
    }
    bossAttack(b) {
        const dir = b.facing === "right" ? 1 : -1;
        const mx = b.x + b.w / 2 + dir * 40;
        const my = b.y + 22;
        const g = this.phase.ground;
        b.fireFx = b.phase >= 3 ? 0.24 : 0.18;
        if (b.id === "sand") {
            if (b.phase === 1) {
                for (let i = -1; i <= 1; i++)
                    this.spawnBullet(mx, my, dir * 180, i * 32, 13, "e", false);
            }
            else if (b.phase === 2) {
                for (let i = 0; i < 5; i++)
                    this.spawnBullet(mx, my, dir * (145 + i * 18), -55 + i * 24, 12, "e", false);
            }
            else {
                for (let i = -2; i <= 2; i++)
                    this.spawnBullet(mx, my, dir * 205, i * 42, 14, "e", false);
                this.spawnBullet(b.x + b.w / 2, b.y + 6, dir * 110, -150, 24, "e", true);
            }
        }
        else if (b.id === "dread") {
            if (b.phase === 1) {
                this.spawnBullet(mx, my, dir * 175, 0, 15, "e", false);
                this.spawnBullet(mx, b.y + 40, dir * 145, 38, 12, "e", false);
            }
            else if (b.phase === 2) {
                for (let i = -1; i <= 1; i++)
                    this.spawnBullet(mx, my + i * 9, dir * 190, i * 38, 13, "e", false);
                this.spawnBullet(mx, b.y + 10, dir * 105, -130, 20, "e", true);
            }
            else {
                for (let i = -2; i <= 2; i++)
                    this.spawnBullet(mx, my + i * 7, dir * 220, i * 28, 14, "e", false);
                this.spawnBullet(this.px, 20, 0, 150, 18, "e", false);
            }
        }
        else {
            if (b.phase === 1) {
                for (let i = -1; i <= 1; i++)
                    this.spawnBullet(mx, my + i * 9, dir * 210, i * 28, 14, "e", false, "wm-rifle");
                this.spawnBullet(mx, my, dir * 240, 0, 10, "e", false, "wm-rifle");
            }
            else if (b.phase === 2) {
                for (let i = -2; i <= 2; i++)
                    this.spawnBullet(mx, my + i * 4, dir * (190 + Math.abs(i) * 14), i * 34, 13, "e", false, "wm-cannon");
                this.spawnBullet(b.x + b.w / 2, b.y + 10, dir * 125, -145, 24, "e", true, "wm-rocket");
                b.vx += -dir * 18;
            }
            else {
                for (let i = -2; i <= 2; i++)
                    this.spawnBullet(mx, my + i * 6, dir * 235, i * 30, 15, "e", false, "wm-burst");
                this.spawnBullet(b.x + b.w / 2 - dir * 8, b.y + 8, dir * 130, -170, 26, "e", true, "wm-rocket");
                const sy = g - 10;
                this.spawnBullet(b.x + (dir > 0 ? b.w - 10 : 10), sy, dir * 160, 0, 14, "e", false, "wm-wave");
                this.spawnBullet(b.x + (dir > 0 ? b.w - 10 : 10), sy - 8, dir * 205, -30, 12, "e", false, "wm-wave");
                this.burst(b.x + b.w / 2, g - 4, "#ffae52", 10);
                this.shake = Math.max(this.shake, 8);
            }
        }
        this.shake = Math.max(this.shake, b.phase >= 3 ? 4 : 2);
        this.audio.shoot();
    }
    hurtBoss(n) {
        const b = this.boss;
        if (!b || b.inv || b.st === "death" || b.st === "intro" || b.st === "end")
            return;
        b.hp -= n;
        this.score += 4;
        if (b.hp <= 0) {
            b.hp = 0;
            b.st = "death";
            b.t = 3.2;
            b.inv = true;
            this.screen = "bossDeath";
            this.audio.setMode("off");
            this.audio.explode();
        }
    }
    spawnBullet(x, y, vx, vy, dmg, owner, nade, weapon = "default") {
        this.bullets.push({
            x,
            y,
            vx,
            vy,
            dmg,
            owner,
            life: nade ? 2.2 : 1.4,
            r: nade ? 4 : 2,
            g: nade ? 520 : 0,
            isNade: nade,
            active: true,
            color: owner === "p" ? (nade ? "#7f6" : weapon === "shot" ? "#ffd070" : "#ff4") : "#f64",
        });
    }
    updateBullets(dt) {
        for (const b of this.bullets) {
            if (!b.active)
                continue;
            b.vy += b.g * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0 || b.y > this.phase.ground + 8) {
                if (b.isNade)
                    this.boom(b.x, b.y, b.owner, b.dmg);
                b.active = false;
                continue;
            }
            const box = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
            if (b.owner === "p") {
                for (const a of this.actors) {
                    if (!a.alive || (a.kind !== "enemy" && a.kind !== "vehicle" && a.kind !== "crate" && a.kind !== "barrel"))
                        continue;
                    if (aabb(box, this.actorBox(a))) {
                        this.hurtActor(a, b.dmg);
                        if (b.isNade)
                            this.boom(b.x, b.y, "p", b.dmg);
                        b.active = false;
                        break;
                    }
                }
                if (b.active && this.boss && this.boss.st !== "intro" && aabb(box, this.boss)) {
                    this.hurtBoss(b.dmg);
                    this.burst(b.x, b.y, "#fc8", 5);
                    b.active = false;
                }
            }
            else if (this.hp > 0 && aabb(box, this.pbox())) {
                this.hurtPlayer(b.dmg);
                b.active = false;
            }
        }
        this.bullets = this.bullets.filter((b) => b.active);
    }
    hurtActor(a, dmg) {
        if (a.type === "shield" && a.state === "fight")
            dmg *= 0.48;
        a.hp -= dmg;
        a.hurt = 0.1;
        this.burst(a.x + a.w / 2, a.y + a.h / 2, "#fc8", 4);
        if (a.hp <= 0) {
            a.alive = false;
            a.t = 0.4;
            this.kills++;
            this.score += a.score;
            this.hitstop = 0.04;
            this.shake = Math.max(this.shake, 3);
            this.audio.hit();
            if (a.kind === "barrel")
                this.boom(a.x, a.y, "p", 30);
            if (a.kind === "crate" && a.type !== "barricade")
                this.dropPickup(a.x, a.y);
            if (a.kind === "crate" && a.type === "barricade") {
                this.burst(a.x + a.w / 2, a.y + a.h / 2, "#8f7455", 18);
                this.shake = Math.max(this.shake, 5);
            }
            if (a.kind === "vehicle") {
                this.boom(a.x + a.w / 2, a.y, "p", 20);
                this.score += 200;
            }
        }
    }
    dropPickup(x, y) {
        const types = ["hp", "shot", "rocket", "nade"];
        const type = types[Math.floor(Math.random() * types.length)];
        this.actors.push({
            kind: "pickup",
            type,
            x,
            y,
            w: 10,
            h: 10,
            vx: 0,
            hp: 1,
            max: 1,
            facing: "right",
            state: "idle",
            t: 8,
            shoot: 0,
            score: 0,
            color: "#8f8",
            enter: 0,
            turret: 0,
            active: true,
            alive: true,
            hurt: 0,
            anim: Math.random() * 10,
            fireFx: 0,
        });
    }
    boom(x, y, owner, dmg) {
        this.burst(x, y, "#f80", 16);
        this.shake = 7;
        this.audio.explode();
        const r = 28;
        const box = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
        if (owner === "p") {
            for (const a of this.actors) {
                if (a.alive && aabb(box, this.actorBox(a)))
                    this.hurtActor(a, dmg);
            }
            if (this.boss)
                this.hurtBoss(dmg * 0.6);
        }
        else if (aabb(box, this.pbox()))
            this.hurtPlayer(dmg * 0.5);
    }
    hurtPlayer(n) {
        if (this.inv > 0 || this.hp <= 0)
            return;
        this.hp -= n;
        this.inv = 0.75;
        this.hurtFxT = this.hp <= 0 ? 0.9 : 0.2;
        this.shake = 6;
        this.audio.hit();
        if (this.hp <= 0) {
            this.hp = 0;
            this.burst(this.px, this.py, "#f44", 12);
        }
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
        for (let i = 0; i < 5; i++) {
            this.parts.push({
                x: x + dir * (2 + Math.random() * 4),
                y: y + (Math.random() - 0.5) * 4,
                vx: dir * (40 + Math.random() * 70),
                vy: (Math.random() - 0.5) * 50,
                life: 0.08 + Math.random() * 0.08,
                max: 0.16,
                c: i < 2 ? "#fff7b0" : "#ff9b30",
                s: 1 + Math.random() * 2,
                active: true,
            });
        }
        if (casing) {
            this.parts.push({
                x: x - dir * 3,
                y: y - 1,
                vx: -dir * (35 + Math.random() * 25),
                vy: -75 - Math.random() * 35,
                life: 0.45,
                max: 0.45,
                c: "#c99b37",
                s: 1.5,
                active: true,
            });
        }
    }
    weaponSmoke(x, y, dir) {
        for (let i = 0; i < 5; i++) {
            this.parts.push({
                x,
                y,
                vx: dir * (15 + Math.random() * 30) + (Math.random() - 0.5) * 18,
                vy: -20 - Math.random() * 28,
                life: 0.28 + Math.random() * 0.25,
                max: 0.5,
                c: i % 2 ? "#777" : "#aaa",
                s: 2 + Math.random() * 2.5,
                active: true,
            });
        }
    }
    burst(x, y, c, n) {
        for (let i = 0; i < n; i++) {
            this.parts.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 160,
                vy: (Math.random() - 0.5) * 160 - 30,
                life: 0.25 + Math.random() * 0.35,
                max: 0.5,
                c,
                s: 1 + Math.random() * 2,
                active: true,
            });
        }
    }
    updateParts(dt) {
        for (const p of this.parts) {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 240 * dt;
            if (p.life <= 0)
                p.active = false;
        }
        if (this.parts.length > 220)
            this.parts = this.parts.filter((p) => p.active);
    }
    updateCam(dt) {
        this.shake *= 0.88;
        let tx = this.px - VW * 0.35;
        if (this.camMode === "arena" && this.boss)
            tx = this.phase.width - VW - 8;
        if (this.camMode === "cine" && this.boss)
            tx = this.boss.x - VW * 0.55;
        this.camX += (tx - this.camX) * Math.min(1, 6 * dt);
        this.camX = Math.max(0, Math.min(this.phase.width - VW, this.camX));
        this.camY = 0;
    }
    draw() {
        const ctx = this.ctx;
        const s = this.canvas.width / VW;
        ctx.setTransform(s, 0, 0, s, 0, 0);
        ctx.imageSmoothingEnabled = false;
        const sx = (Math.random() - 0.5) * this.shake;
        const sy = (Math.random() - 0.5) * this.shake;
        ctx.save();
        ctx.translate(-Math.round(this.camX + sx), -Math.round(this.camY + sy));
        this.drawWorld();
        for (const a of this.actors)
            if (a.active)
                this.drawActor(a);
        if (this.boss && this.boss.st !== "end")
            this.drawBoss(this.boss);
        this.drawPlayer();
        for (const b of this.bullets)
            if (b.active) {
                ctx.fillStyle = b.color;
                ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
            }
        for (const p of this.parts) {
            if (!p.active)
                continue;
            ctx.globalAlpha = Math.max(0, p.life / p.max);
            ctx.fillStyle = p.c;
            ctx.fillRect(p.x, p.y, p.s, p.s);
        }
        ctx.globalAlpha = 1;
        if (this.wallBreak > 0 && (this.screen === "bossIntro" || this.screen === "bossWarn")) {
            ctx.fillStyle = "#3a2a22";
            const gx = this.phase.width - 80;
            ctx.fillRect(gx, 40, 18, this.phase.ground - 40);
        }
        ctx.restore();
        if (this.setpieceFlash > 0) {
            ctx.fillStyle = `rgba(255,170,90,${Math.min(0.28, this.setpieceFlash)})`;
            ctx.fillRect(0, 0, VW, VH);
        }
        if (this.screen === "bossWarn") {
            ctx.fillStyle = this.save.reduceFlash ? "rgba(120,0,0,0.12)" : "rgba(160,0,0,0.18)";
            ctx.fillRect(0, 0, VW, VH);
            ctx.strokeStyle = `rgba(255,40,40,${0.5 + Math.sin(performance.now() / 80) * 0.5})`;
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, VW - 4, VH - 4);
        }
    }
    drawWorld() {
        const ctx = this.ctx;
        const g = this.phase.ground;
        const [c0, c1] = this.phase.sky;
        const grd = ctx.createLinearGradient(0, 0, 0, VH);
        grd.addColorStop(0, c0);
        grd.addColorStop(1, c1);
        ctx.fillStyle = grd;
        ctx.fillRect(this.camX - 4, 0, VW + 8, VH);
        const far = this.camX * 0.25;
        ctx.fillStyle = this.phase.id === "02" ? "#3a2814" : "#121a28";
        for (let i = 0; i < 24; i++) {
            const x = i * 90 - (far % 90);
            const h = 40 + ((i * 17) % 50);
            ctx.fillRect(x, g - 50 - h * 0.4, 70, h);
        }
        const mid = this.camX * 0.55;
        for (let i = 0; i < 20; i++) {
            const x = i * 120 - (mid % 120);
            const h = 70 + ((i * 31) % 60);
            ctx.fillStyle = this.phase.id === "03" ? "#152030" : this.phase.id === "02" ? "#5a3a1c" : "#1c2838";
            ctx.fillRect(x, g - h, 88, h);
            ctx.fillStyle = this.phase.id === "03" ? "#c8a030" : "#3a80b0";
            for (let wy = 10; wy < h - 10; wy += 12) {
                for (let wx = 8; wx < 80; wx += 14) {
                    if (hash(i * 50 + wy + wx) > 0.35)
                        ctx.fillRect(x + wx, g - h + wy, 6, 6);
                }
            }
        }
        if (this.phase.id === "01") {
            // Layered ruined city set dressing. Deterministic from world coordinates.
            for (let x = 180; x < this.phase.width - 260; x += 360) {
                const j = hash(x * 0.013);
                // damaged storefront / wall mass
                ctx.fillStyle = j > 0.5 ? "#34383c" : "#2b3034";
                ctx.fillRect(x, g - 52 - j * 18, 72, 52 + j * 18);
                ctx.fillStyle = "#111518";
                ctx.fillRect(x + 9, g - 39, 17, 25);
                ctx.fillRect(x + 43, g - 42, 18, 28);
                ctx.fillStyle = j > 0.55 ? "#b84b24" : "#4a6470";
                ctx.fillRect(x + 6, g - 55 - j * 18, 58, 5);
                // broken window sparks/fire glow
                if (j > 0.38) {
                    const pulse = 0.55 + Math.sin(this.clock * 8 + x) * 0.25;
                    ctx.globalAlpha = pulse;
                    ctx.fillStyle = "#ff6a20";
                    ctx.fillRect(x + 47, g - 37, 10, 7);
                    ctx.fillStyle = "#ffd060";
                    ctx.fillRect(x + 50, g - 35, 5, 3);
                    ctx.globalAlpha = 1;
                }
                // wrecked car
                const carX = x + 95 + j * 35;
                ctx.fillStyle = "#252a2e";
                ctx.fillRect(carX, g - 14, 42, 11);
                ctx.fillStyle = "#38424a";
                ctx.fillRect(carX + 9, g - 20, 20, 7);
                ctx.fillStyle = "#101316";
                ctx.fillRect(carX + 4, g - 4, 10, 4);
                ctx.fillRect(carX + 30, g - 4, 10, 4);
                // sandbag / timber defensive position
                ctx.fillStyle = "#6f5430";
                ctx.fillRect(x + 165, g - 9, 39, 6);
                ctx.fillRect(x + 169, g - 15, 31, 6);
                // smoke column
                if (j > 0.2) {
                    ctx.globalAlpha = 0.15;
                    ctx.fillStyle = "#adb4b8";
                    for (let k = 0; k < 4; k++) {
                        ctx.beginPath();
                        ctx.arc(carX + 21 + Math.sin(this.clock + k) * 3, g - 28 - k * 13 - j * 14, 8 + k * 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                }
            }
            // overhead cables and hanging signs, giving depth and motion reference.
            ctx.strokeStyle = "rgba(15,18,20,0.75)";
            ctx.lineWidth = 1;
            for (let x = 100; x < this.phase.width; x += 520) {
                ctx.beginPath();
                ctx.moveTo(x, 55);
                ctx.quadraticCurveTo(x + 100, 72, x + 205, 58);
                ctx.stroke();
                ctx.fillStyle = "#7c3c28";
                ctx.fillRect(x + 90, 65, 26, 13);
                ctx.fillStyle = "#d0a35a";
                ctx.fillRect(x + 95, 69, 16, 2);
            }
            // road cracks / scattered rubble in gameplay plane.
            ctx.strokeStyle = "#1b1d20";
            for (let x = 70; x < this.phase.width; x += 150) {
                ctx.beginPath();
                ctx.moveTo(x, g + 4);
                ctx.lineTo(x + 11, g + 9);
                ctx.lineTo(x + 25, g + 6);
                ctx.stroke();
                ctx.fillStyle = "#555b5f";
                ctx.fillRect(x + 34, g - 3, 4, 3);
                ctx.fillRect(x + 43, g - 2, 6, 2);
            }
        }
        ctx.fillStyle = this.phase.id === "02" ? "#c4a06a" : "#2a2e32";
        ctx.fillRect(0, g, this.phase.width, VH - g);
        ctx.fillStyle = this.phase.id === "02" ? "#a88448" : "#3a4044";
        for (let x = 0; x < this.phase.width; x += 16)
            ctx.fillRect(x, g - 3, 10, 3);
        // street lamps / cacti
        ctx.fillStyle = "#c8b060";
        for (let x = 80; x < this.phase.width; x += 220) {
            ctx.fillRect(x, g - 36, 3, 36);
            ctx.fillRect(x - 4, g - 36, 10, 3);
        }
        if (this.phase.id === "01") {
            // close foreground debris scrolls at world speed and breaks up empty road.
            for (let x = 250; x < this.phase.width; x += 430) {
                ctx.fillStyle = "#17191b";
                ctx.fillRect(x, g + 21, 72, 6);
                ctx.fillRect(x + 12, g + 15, 25, 5);
                ctx.fillStyle = "#48372c";
                ctx.fillRect(x + 54, g + 13, 10, 8);
            }
        }
    }
    drawPlayer() {
        const ctx = this.ctx;
        const core = this.assets.get("player-core-sheet");
        const rifle = this.assets.get("player-rifle-sheet");
        const weaponSheet = this.assets.get("player-weapon-sheet");
        const special = this.assets.get("player-special-sheet");
        const h = this.crouch ? 18 : this.pH;
        const drawX = this.px - 8;
        const drawY = this.py - 10;
        const drawW = this.pW + 18;
        const drawH = h + 18;
        let rendered = false;
        const drawCore = (frame) => {
            if (!core)
                return false;
            drawSheet(ctx, core, frame, 8, 4, drawX, drawY, drawW, drawH, this.facing);
            return true;
        };
        const drawRifle = (frame) => {
            if (!rifle)
                return false;
            drawSheet(ctx, rifle, frame, 4, 4, drawX, drawY, drawW, drawH, this.facing);
            return true;
        };
        const drawWeapon = (frame) => {
            if (!weaponSheet)
                return false;
            drawSheet(ctx, weaponSheet, frame, 4, 4, drawX, drawY, drawW, drawH, this.facing);
            return true;
        };
        const drawSpecial = (frame) => {
            if (!special)
                return false;
            drawSheet(ctx, special, frame, 6, 4, drawX, drawY, drawW, drawH, this.facing);
            return true;
        };
        if (this.hp <= 0) {
            const deathFrame = 18 + Math.min(3, Math.floor(this.deadT / 0.22));
            rendered = drawSpecial(deathFrame);
        }
        else if (this.hurtFxT > 0.01) {
            const hurtFrame = this.hurtFxT > 0.1 ? 12 : 13;
            rendered = drawSpecial(hurtFrame);
        }
        else if (this.reloadT > 0.01) {
            if (this.weapon === "rifle") {
                const seq = [12, 13, 14, 15];
                const total = Math.max(0.001, this.reloadFxT || 0.58);
                const idx = Math.min(seq.length - 1, Math.floor((total - this.reloadT) / (total / seq.length)));
                rendered = drawRifle(seq[idx]);
            }
            else {
                const seq = [8, 9, 10, 11];
                const total = Math.max(0.001, this.reloadFxT || (this.weapon === "rocket" ? 0.8 : 0.72));
                const idx = Math.min(seq.length - 1, Math.floor((total - this.reloadT) / (total / seq.length)));
                rendered = drawWeapon(seq[idx]);
            }
        }
        else if (this.grenadeFxT > 0.01) {
            const seq = [0, 1, 2, 3, 4, 5];
            const idx = Math.min(seq.length - 1, Math.floor((0.36 - this.grenadeFxT) / 0.06));
            rendered = drawSpecial(seq[idx]);
        }
        else if (this.meleeFxT > 0.01) {
            const seq = [6, 7, 8, 9, 10, 11];
            const idx = Math.min(seq.length - 1, Math.floor((0.24 - this.meleeFxT) / 0.04));
            rendered = drawSpecial(seq[idx]);
        }
        else if (this.pickupFxT > 0.01) {
            const seq = [8, 9, 10, 11];
            const idx = Math.min(seq.length - 1, Math.floor((0.45 - this.pickupFxT) / 0.1125));
            rendered = drawWeapon(seq[idx]);
        }
        else if (this.shootFxT > 0.01) {
            if (this.weapon === "shot") {
                const seq = [0, 1, 2, 3];
                const idx = Math.min(seq.length - 1, Math.floor((0.24 - this.shootFxT) / 0.06));
                rendered = drawWeapon(seq[idx]);
            }
            else if (this.weapon === "rocket") {
                const seq = [4, 5, 6, 7];
                const idx = Math.min(seq.length - 1, Math.floor((0.34 - this.shootFxT) / 0.085));
                rendered = drawWeapon(seq[idx]);
            }
            else {
                const base = this.crouch ? 4 : !this.onGround ? 8 : 0;
                const seq = [base, base + 1, base + 2, base + 3];
                const total = 0.18;
                const idx = Math.min(seq.length - 1, Math.floor((total - this.shootFxT) / (total / seq.length)));
                rendered = drawRifle(seq[idx]);
            }
        }
        if (!rendered) {
            if (!this.onGround) {
                const jumpFrame = 24 + Math.min(7, Math.floor((this.anim * 0.75) % 8));
                rendered = drawCore(jumpFrame);
            }
            else if (this.crouch) {
                rendered = drawCore(16 + (Math.floor(this.anim * 0.25) % 2));
            }
            else if (Math.abs(this.pvx) > 20) {
                rendered = drawCore(8 + (Math.floor(this.anim) % 8));
            }
            else {
                rendered = drawCore(Math.floor(this.anim * 0.5) % 4);
            }
        }
        if (!rendered) {
            const img = Math.abs(this.pvx) > 20 ? this.assets.get("player-run") : this.assets.get("player-idle");
            const frame = Math.floor(this.anim) % 4;
            if (img)
                drawSheet(ctx, img, frame, 2, 2, this.px - 4, this.py - 4, this.pW + 8, h + 8, this.facing);
            else
                this.pixelSoldier(this.px, this.py, this.pW, h, this.facing, "#4a8", true);
        }
        if (this.inv > 0 && Math.sin(this.inv * 40) < 0) {
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = "#fff";
            ctx.fillRect(this.px, this.py, this.pW, h);
            ctx.globalAlpha = 1;
        }
    }
    drawActor(a) {
        if (a.x + a.w < this.camX - 20 || a.x > this.camX + VW + 20)
            return;
        const ctx = this.ctx;
        if (a.kind === "enemy") {
            const rifleSheet = this.assets.get("enemy-rifle-sheet");
            const heavySheet = this.assets.get("enemy-heavy-sheet");
            const heavyVisual = a.type === "heavy" || a.type === "shield" || a.type === "rocket";
            const sheet = heavyVisual ? heavySheet : rifleSheet;
            const drawX = a.x - (heavyVisual ? 7 : 6);
            const drawY = a.y - (heavyVisual ? 8 : 6);
            const drawW = Math.max(a.w + (heavyVisual ? 16 : 12), heavyVisual ? 36 : 29);
            const drawH = Math.max(a.h + (heavyVisual ? 17 : 13), heavyVisual ? 44 : 39);
            let fr = 0;
            if (!a.alive)
                fr = 12 + Math.min(3, Math.max(0, Math.floor((0.4 - Math.max(0, a.t)) / 0.1)));
            else if (a.hurt > 0.01)
                fr = 12;
            else if (a.fireFx > 0.01)
                fr = 8 + Math.min(3, Math.floor(((a.type === "rocket" ? 0.28 : 0.22) - a.fireFx) / 0.055));
            else if (a.state === "enter" || (a.type !== "turret" && Math.abs(this.px - a.x) > 55))
                fr = 4 + (Math.floor(a.anim) % 4);
            else
                fr = Math.floor(a.anim * 0.5) % 4;
            if (sheet && a.type !== "turret") {
                drawSheet(ctx, sheet, Math.max(0, Math.min(15, fr)), 4, 4, drawX, drawY, drawW, drawH, a.facing);
            }
            else if (a.type === "turret") {
                ctx.fillStyle = a.color;
                ctx.fillRect(a.x, a.y + 6, a.w, a.h - 6);
                ctx.fillStyle = "#222";
                ctx.fillRect(a.x + 4, a.y + 2, a.w - 8, 8);
                const d = a.facing === "right" ? 1 : -1;
                ctx.fillRect(a.x + a.w / 2, a.y + 5, d * 15, 3);
            }
            else {
                this.pixelSoldier(a.x, a.y, a.w, a.h, a.facing, a.color, false);
            }
            const dir = a.facing === "right" ? 1 : -1;
            if (a.type === "shield" && a.alive) {
                ctx.fillStyle = "#657b8c";
                ctx.fillRect(a.x + (dir > 0 ? a.w - 1 : -5), a.y + 4, 7, 19);
                ctx.fillStyle = "#1d2830";
                ctx.fillRect(a.x + (dir > 0 ? a.w + 1 : -3), a.y + 8, 3, 5);
            }
            else if (a.type === "rocket" && a.alive) {
                ctx.fillStyle = "#2d3528";
                const rx = a.x + (dir > 0 ? 0 : 2);
                ctx.fillRect(rx, a.y + 3, a.w - 2, 4);
                ctx.fillStyle = "#77805c";
                ctx.fillRect(a.x + (dir > 0 ? a.w - 2 : -2), a.y + 3, 5, 4);
            }
            else if (a.type === "sniper" && a.alive) {
                ctx.fillStyle = "#242833";
                ctx.fillRect(a.x + (dir > 0 ? a.w - 2 : -11), a.y + 9, 13, 2);
                ctx.fillStyle = "#a22";
                ctx.fillRect(a.x + (dir > 0 ? a.w + 8 : -11), a.y + 9, 2, 2);
            }
            else if (a.type === "gren" && a.alive) {
                ctx.fillStyle = "#7a5723";
                ctx.fillRect(a.x + 3, a.y + 11, Math.max(4, a.w - 6), 5);
                ctx.fillStyle = "#909060";
                ctx.fillRect(a.x + (dir > 0 ? a.w - 1 : -4), a.y + 8, 5, 5);
            }
            if (a.type === "para" && a.state === "drop") {
                ctx.strokeStyle = "#ddd";
                ctx.beginPath();
                ctx.arc(a.x + a.w / 2, a.y - 8, 13, Math.PI, 0);
                ctx.stroke();
            }
            if (a.hurt > 0) {
                const hb = this.actorBox(a);
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = "#fff";
                ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
                ctx.globalAlpha = 1;
            }
        }
        else if (a.kind === "vehicle") {
            const jeep = a.type === "jeep" ? this.assets.get("jeep") : null;
            if (jeep && a.type === "jeep") {
                drawSheet(ctx, jeep, 0, 1, 1, a.x, a.y, a.w, a.h, a.facing, 0, 0, "left");
            }
            else {
                ctx.fillStyle = a.color;
                ctx.fillRect(a.x, a.y, a.w, a.h);
                ctx.fillStyle = "#222";
                ctx.fillRect(a.x + 4, a.y + a.h - 6, 8, 6);
                ctx.fillRect(a.x + a.w - 12, a.y + a.h - 6, 8, 6);
                ctx.save();
                ctx.translate(a.x + a.w / 2, a.y + 6);
                ctx.rotate(a.turret);
                ctx.fillStyle = "#333";
                ctx.fillRect(0, -2, 16, 4);
                ctx.restore();
            }
        }
        else if (a.kind === "hostage") {
            ctx.fillStyle = a.color;
            ctx.fillRect(a.x, a.y, a.w, a.h);
            ctx.fillStyle = "#222";
            ctx.fillRect(a.x + 3, a.y + 2, 6, 4);
        }
        else if (a.kind === "crate") {
            if (a.type === "barricade") {
                ctx.fillStyle = "#705438";
                ctx.fillRect(a.x, a.y + 5, a.w, a.h - 5);
                ctx.fillStyle = "#98734d";
                for (let i = 0; i < 3; i++)
                    ctx.fillRect(a.x + 2 + i * 9, a.y + 2 + (i % 2) * 4, 8, 13);
                ctx.fillStyle = "#3a3028";
                ctx.fillRect(a.x - 2, a.y + a.h - 5, a.w + 4, 5);
                ctx.strokeStyle = "#c29a68";
                ctx.strokeRect(a.x, a.y + 5, a.w, a.h - 5);
            }
            else {
                ctx.fillStyle = "#8a6230";
                ctx.fillRect(a.x, a.y, a.w, a.h);
                ctx.strokeStyle = "#3a2a10";
                ctx.strokeRect(a.x, a.y, a.w, a.h);
            }
        }
        else if (a.kind === "barrel") {
            ctx.fillStyle = "#c44818";
            ctx.fillRect(a.x, a.y, a.w, a.h);
            ctx.fillStyle = "#222";
            ctx.fillRect(a.x, a.y + 6, a.w, 2);
        }
        else if (a.kind === "secret") {
            ctx.fillStyle = "#e8b84a";
            ctx.fillRect(a.x + 2, a.y, 2, a.h);
            ctx.fillRect(a.x + 4, a.y, 8, 6);
        }
        else if (a.kind === "pickup") {
            ctx.fillStyle = a.type === "hp" ? "#6fbf3a" : a.type === "nade" ? "#7d6" : "#e8b84a";
            ctx.fillRect(a.x, a.y + Math.sin(this.clock * 6) * 2, a.w, a.h);
        }
    }
    drawBoss(b) {
        const img = b.id === "iron" ? this.assets.get("boss-iron") : null;
        const fr = Math.floor(this.clock * 4) % 4;
        const ctx = this.ctx;
        if (img)
            drawSheet(ctx, img, fr, 2, 2, b.x, b.y, b.w, b.h, b.facing, 0, 0, "left");
        else {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = "#f22";
            ctx.fillRect(b.facing === "left" ? b.x + 12 : b.x + b.w - 22, b.y + 14, 10, 8);
            ctx.fillStyle = "#222";
            ctx.fillRect(b.x + 8, b.y + b.h - 12, 16, 12);
            ctx.fillRect(b.x + b.w - 24, b.y + b.h - 12, 16, 12);
            const dir = b.facing === "right" ? 1 : -1;
            ctx.fillStyle = "#333";
            ctx.fillRect(b.x + b.w / 2, b.y + 20, dir * 40, 8);
        }
        const muzzleX = b.x + (b.facing === "right" ? b.w - 12 : 12);
        const muzzleY = b.y + 25;
        if (b.fireFx > 0.01) {
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = "#ffd27a";
            ctx.beginPath();
            ctx.moveTo(muzzleX, muzzleY - 5);
            ctx.lineTo(muzzleX + (b.facing === "right" ? 18 : -18), muzzleY);
            ctx.lineTo(muzzleX, muzzleY + 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            this.burst(muzzleX, muzzleY, "#ffcf74", 1);
        }
        const hpRatio = b.hp / b.max;
        if (hpRatio < 0.7 && Math.random() < 0.5)
            this.burst(b.x + Math.random() * b.w, b.y + 8 + Math.random() * (b.h - 16), "#66584a", 1);
        if (b.id === "iron") {
            ctx.fillStyle = b.phase >= 3 ? "rgba(255,70,30,0.55)" : b.phase === 2 ? "rgba(255,120,30,0.4)" : "rgba(255,90,20,0.28)";
            ctx.fillRect(b.x + (b.facing === "right" ? b.w - 28 : 16), b.y + 11, 12, 6);
            if (b.phase >= 2)
                ctx.fillRect(b.x + b.w / 2 - 5, b.y + 8, 10, 4);
        }
        if (b.cue > 0.01) {
            ctx.globalAlpha = Math.min(0.35, b.cue * 0.3);
            ctx.fillStyle = "#fff";
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.globalAlpha = 1;
        }
    }
    pixelSoldier(x, y, w, h, facing, color, player) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        if (facing === "left")
            ctx.scale(-1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = player ? "#2a6a44" : "#3a2020";
        ctx.fillRect(-w / 2 - 1, -h / 2 - 3, w + 2, 7);
        ctx.fillStyle = player ? "#7ad" : "#c22";
        ctx.fillRect(-4, -h / 2, 9, 4);
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(2, -3, 12, 4);
        ctx.restore();
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
