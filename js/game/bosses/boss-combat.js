import { VW } from "../core/constants.js";
import { aabb } from "../render/render-utils.js";
import { bossAttackCooldown, warMachineMovement } from "./boss-system.js";

export function updateBossCombat(game, dt) {
    const b = game.boss;
    if (!b || b.st === "end")
        return;
    const g = game.phase.ground;
    b.fireFx = Math.max(0, b.fireFx - dt);
    b.cue = Math.max(0, b.cue - dt);
    if (b.st === "intro") {
        b.t -= dt;
        const targetX = game.camX + VW - 26 - b.w;
        b.x += b.vx * dt;
        if (b.id === "iron" && b.x <= targetX + 14 && game.wallBreak > 0.45) {
            game.wallBreak = 0.28;
            game.setpieceFlash = 0.18;
            game.shake = 14;
            game.audio.explode();
            for (let i = 0; i < 3; i++)
                game.burst(targetX + 14 + i * 8, g - 28 - i * 10, "#c86", 10);
        }
        if (b.x < targetX)
            b.x = targetX;
        game.burst(b.x + 10, g - 4, "#c84", 3);
        if (Math.random() < 0.35)
            game.burst(b.x + 8 + Math.random() * (b.w - 16), b.y + b.h - 10, "#77665a", 3);
        if (b.t <= 0) {
            b.st = "p1";
            b.inv = false;
            b.vx = 0;
            game.objective = b.id === "iron" ? "DESTROY WAR MACHINE" : "DESTROY THE BOSS";
            game.objectiveT = 2.4;
        }
        return;
    }
    if (b.st === "death") {
        b.t -= dt;
        game.shake = Math.max(game.shake, 6 + (3 - b.t));
        if (Math.random() < 0.5)
            game.burst(b.x + Math.random() * b.w, b.y + Math.random() * b.h, "#fc3", 8);
        if (b.t <= 0) {
            for (let i = 0; i < 28; i++)
                game.burst(b.x + b.w / 2, b.y + b.h / 2, "#f40", 14);
            game.shake = 16;
            game.audio.explode();
            b.st = "end";
            game.finishMission();
        }
        return;
    }
    if (b.st === "t1" || b.st === "t2") {
        b.t -= dt;
        game.burst(b.x + Math.random() * b.w, b.y + 10, "#f80", 6);
        game.shake = 5;
        if (b.t <= 0) {
            b.phase++;
            b.inv = false;
            b.st = b.phase === 2 ? "p2" : "p3";
            b.cue = 1.2;
            game.objective = b.id === "iron" ? `WAR MACHINE PHASE ${b.phase}` : `BOSS PHASE ${b.phase}`;
            game.objectiveT = 2.1;
            game.audio.warning();
            game.setpieceFlash = 0.12;
        }
        return;
    }
    const dx = game.px - b.x;
    if (dx > 10)
        b.facing = "right";
    else if (dx < -10)
        b.facing = "left";
    const arenaLeft = Math.max(0, game.phase.width - VW + 10);
    const arenaRight = game.phase.width - b.w - 16;
    if (b.id === "iron") {
        const movement = warMachineMovement(b.phase);
        const targetX = Math.max(arenaLeft, Math.min(arenaRight, game.px - (game.px < b.x ? -movement.offset : movement.offset)));
        b.vx = Math.max(-movement.speed, Math.min(movement.speed, (targetX - b.x) * 1.45));
        b.x += b.vx * dt;
        if (Math.abs(targetX - b.x) < 8)
            b.vx *= 0.4;
        if (Math.random() < 0.18 * dt)
            game.burst(b.x + Math.random() * b.w, b.y + b.h - 6, "#544840", 2);
    }
    b.atk -= dt;
    if (b.atk <= 0) {
        game.bossAttack(b);
        b.atk = bossAttackCooldown(b.phase);
    }
    if (b.y + b.h < g)
        b.y += 80 * dt;
    else
        b.y = g - b.h;
    if (aabb(game.pbox(), { x: b.x + 10, y: b.y + 8, w: b.w - 20, h: b.h - 10 }))
        game.hurtPlayer(b.phase >= 3 ? 18 : 12);
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

export function runBossAttack(game, b) {
    const dir = b.facing === "right" ? 1 : -1;
    const mx = b.x + b.w / 2 + dir * 40;
    const my = b.y + 22;
    const g = game.phase.ground;
    b.fireFx = b.phase >= 3 ? 0.24 : 0.18;
    if (b.id === "sand") {
        if (b.phase === 1) {
            for (let i = -1; i <= 1; i++)
                game.spawnBullet(mx, my, dir * 180, i * 32, 13, "e", false);
        }
        else if (b.phase === 2) {
            for (let i = 0; i < 5; i++)
                game.spawnBullet(mx, my, dir * (145 + i * 18), -55 + i * 24, 12, "e", false);
        }
        else {
            for (let i = -2; i <= 2; i++)
                game.spawnBullet(mx, my, dir * 205, i * 42, 14, "e", false);
            game.spawnBullet(b.x + b.w / 2, b.y + 6, dir * 110, -150, 24, "e", true);
        }
    }
    else if (b.id === "dread") {
        if (b.phase === 1) {
            game.spawnBullet(mx, my, dir * 175, 0, 15, "e", false);
            game.spawnBullet(mx, b.y + 40, dir * 145, 38, 12, "e", false);
        }
        else if (b.phase === 2) {
            for (let i = -1; i <= 1; i++)
                game.spawnBullet(mx, my + i * 9, dir * 190, i * 38, 13, "e", false);
            game.spawnBullet(mx, b.y + 10, dir * 105, -130, 20, "e", true);
        }
        else {
            for (let i = -2; i <= 2; i++)
                game.spawnBullet(mx, my + i * 7, dir * 220, i * 28, 14, "e", false);
            game.spawnBullet(game.px, 20, 0, 150, 18, "e", false);
        }
    }
    else {
        if (b.phase === 1) {
            for (let i = -1; i <= 1; i++)
                game.spawnBullet(mx, my + i * 9, dir * 210, i * 28, 14, "e", false, "wm-rifle");
            game.spawnBullet(mx, my, dir * 240, 0, 10, "e", false, "wm-rifle");
        }
        else if (b.phase === 2) {
            for (let i = -2; i <= 2; i++)
                game.spawnBullet(mx, my + i * 4, dir * (190 + Math.abs(i) * 14), i * 34, 13, "e", false, "wm-cannon");
            game.spawnBullet(b.x + b.w / 2, b.y + 10, dir * 125, -145, 24, "e", true, "wm-rocket");
            b.vx += -dir * 18;
        }
        else {
            for (let i = -2; i <= 2; i++)
                game.spawnBullet(mx, my + i * 6, dir * 235, i * 30, 15, "e", false, "wm-burst");
            game.spawnBullet(b.x + b.w / 2 - dir * 8, b.y + 8, dir * 130, -170, 26, "e", true, "wm-rocket");
            const sy = g - 10;
            game.spawnBullet(b.x + (dir > 0 ? b.w - 10 : 10), sy, dir * 160, 0, 14, "e", false, "wm-wave");
            game.spawnBullet(b.x + (dir > 0 ? b.w - 10 : 10), sy - 8, dir * 205, -30, 12, "e", false, "wm-wave");
            game.burst(b.x + b.w / 2, g - 4, "#ffae52", 10);
            game.shake = Math.max(game.shake, 8);
        }
    }
    game.shake = Math.max(game.shake, b.phase >= 3 ? 4 : 2);
    game.audio.shoot();
}

export function damageBoss(game, n) {
    const b = game.boss;
    if (!b || b.inv || b.st === "death" || b.st === "intro" || b.st === "end")
        return;
    b.hp -= n;
    game.score += 4;
    if (b.hp <= 0) {
        b.hp = 0;
        b.st = "death";
        b.t = 3.2;
        b.inv = true;
        game.screen = "bossDeath";
        game.audio.setMode("off");
        game.audio.explode();
    }
}

