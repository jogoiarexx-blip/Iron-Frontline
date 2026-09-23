import { VW } from "../core/constants.js";

export function updateEnemyAI(game, dt) {
    const g = game.phase.ground;
    for (const a of game.actors) {
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
        const dist = Math.abs(a.x - game.px);
        if (dist > 900)
            continue;
        if (a.kind === "enemy") {
            if (a.state === "drop") {
                a.y += 90 * dt;
                if (a.y + a.h >= g) {
                    a.y = g - a.h;
                    a.state = "fight";
                    game.burst(a.x + a.w / 2, a.y, "#bbb", 5);
                }
            }
            else if (a.state === "enter") {
                a.t -= dt;
                a.x += (a.facing === "right" ? 1 : -1) * a.enter * 1.2 * dt;
                if (a.t <= 0)
                    a.state = "fight";
            }
            else if (a.state === "flee") {
                const fleeDir = a.x < game.px ? -1 : 1;
                a.facing = fleeDir > 0 ? "right" : "left";
                a.x += fleeDir * 120 * dt;
                a.t -= dt;
                if (a.t < -1.2) {
                    a.alive = false;
                    a.active = false;
                }
            }
            else {
                const dx = game.px - a.x;
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
                        game.hurtPlayer(13);
                        game.hitstop = 0.025;
                    }
                    else if (a.type === "gren" && adx < 240) {
                        a.shoot = 1.6;
                        a.fireFx = 0.22;
                        game.spawnBullet(a.x + a.w / 2, a.y + 8, dir * 120, -90, 18, "e", true, "gren");
                    }
                    else if (a.type === "rocket" && adx < 290) {
                        a.shoot = 2.1;
                        a.fireFx = 0.28;
                        game.spawnBullet(a.x + a.w / 2 + dir * 10, a.y + 8, dir * 155, -45, 25, "e", true, "rocket");
                        game.weaponSmoke(a.x + a.w / 2 - dir * 8, a.y + 8, -dir);
                    }
                    else if (a.type === "sniper" && adx < 330) {
                        a.shoot = 2.4;
                        a.fireFx = 0.16;
                        game.spawnBullet(a.x + a.w / 2 + dir * 10, a.y + 9, dir * 330, 0, 20, "e", false, "sniper");
                        game.muzzleFx(a.x + a.w / 2 + dir * 14, a.y + 9, dir, false);
                    }
                    else if (a.type === "turret" && adx < 300) {
                        a.shoot = 0.55;
                        a.fireFx = 0.18;
                        game.spawnBullet(a.x + a.w / 2 + dir * 12, a.y + 7, dir * 240, 0, 10, "e", false, "turret");
                        game.muzzleFx(a.x + a.w / 2 + dir * 15, a.y + 7, dir, false);
                    }
                    else if (a.type !== "knife" && adx < 220) {
                        a.shoot = a.type === "heavy" ? 0.7 : 1.1;
                        a.fireFx = a.type === "heavy" ? 0.22 : 0.14;
                        game.spawnBullet(a.x + a.w / 2 + dir * 10, a.y + 10, dir * 200, 0, a.type === "heavy" ? 14 : 8, "e", false, a.type === "heavy" ? "heavy" : "rifle");
                        game.muzzleFx(a.x + a.w / 2 + dir * 14, a.y + 10, dir, false);
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
                a.y += Math.sin(game.clock * 3) * 10 * dt;
                a.shoot -= dt;
                if (a.shoot <= 0) {
                    a.shoot = 0.55;
                    a.fireFx = 0.18;
                    game.spawnBullet(a.x + 10, a.y + 16, 0, 160, 12, "e", false, "gunship");
                }
            }
            else {
                a.x += a.vx * dt;
                const dx = game.px - a.x;
                a.turret = Math.atan2(game.py - a.y, dx);
                a.shoot -= dt;
                if (a.shoot <= 0) {
                    a.shoot = a.type === "tank" ? 0.9 : 0.5;
                    a.fireFx = 0.18;
                    const sp = a.type === "tank" ? 180 : 220;
                    game.spawnBullet(a.x + a.w / 2, a.y + 6, Math.cos(a.turret) * sp, Math.sin(a.turret) * sp, 12, "e", false, a.type);
                }
            }
            if (a.x < game.camX - 80 && a.vx < 0) {
                a.vx *= -1;
                a.facing = "right";
            }
            if (a.x > game.camX + VW + 40 && a.vx > 0) {
                a.vx *= -1;
                a.facing = "left";
            }
        }
        else if (a.kind === "hostage" && a.state === "free") {
            a.x += 40 * dt;
        }
    }
    if (game.screen === "miniboss") {
        const live = game.actors.some((x) => x.kind === "vehicle" && x.alive);
        if (!live) {
            game.screen = "play";
            game.objective = "ADVANCE EAST";
            game.objectiveT = 2;
        }
    }
    if (game.arenaActive) {
        const threats = game.actors.some((x) => x.active && x.alive && (x.kind === "enemy" || x.kind === "vehicle"));
        if (!threats) {
            game.arenaActive = false;
            game.objective = "AREA CLEAR — MOVE!";
            game.objectiveT = 2;
            game.score += 250;
            game.audio.pickup();
        }
    }
}

export function clearEnemyProjectiles(game) {
    for (const b of game.bullets) {
        if (b.owner === "e")
            b.active = false;
    }
}

