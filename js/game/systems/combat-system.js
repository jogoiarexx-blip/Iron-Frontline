import { aabb } from "../render/render-utils.js";

export function spawnProjectile(game, x, y, vx, vy, dmg, owner, nade, weapon = "default") {
    game.bullets.push({
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

export function updateProjectiles(game, dt) {
    for (const b of game.bullets) {
        if (!b.active)
            continue;
        b.vy += b.g * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0 || b.y > game.phase.ground + 8) {
            if (b.isNade)
                game.boom(b.x, b.y, b.owner, b.dmg);
            b.active = false;
            continue;
        }
        const box = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
        if (b.owner === "p") {
            for (const a of game.actors) {
                if (!a.alive || (a.kind !== "enemy" && a.kind !== "vehicle" && a.kind !== "crate" && a.kind !== "barrel"))
                    continue;
                if (aabb(box, game.actorBox(a))) {
                    game.hurtActor(a, b.dmg);
                    if (b.isNade)
                        game.boom(b.x, b.y, "p", b.dmg);
                    b.active = false;
                    break;
                }
            }
            if (b.active && game.boss && game.boss.st !== "intro" && aabb(box, game.boss)) {
                game.hurtBoss(b.dmg);
                game.burst(b.x, b.y, "#fc8", 5);
                b.active = false;
            }
        }
        else if (game.hp > 0 && aabb(box, game.pbox())) {
            game.hurtPlayer(b.dmg);
            b.active = false;
        }
    }
    game.bullets = game.bullets.filter((b) => b.active);
}

export function damageActor(game, a, dmg) {
    if (a.type === "shield" && a.state === "fight")
        dmg *= 0.48;
    a.hp -= dmg;
    a.hurt = 0.1;
    game.burst(a.x + a.w / 2, a.y + a.h / 2, "#fc8", 4);
    if (a.hp <= 0) {
        a.alive = false;
        a.t = 0.4;
        game.kills++;
        game.score += a.score;
        game.hitstop = 0.04;
        game.shake = Math.max(game.shake, 3);
        game.audio.hit();
        if (a.kind === "barrel")
            game.boom(a.x, a.y, "p", 30);
        if (a.kind === "crate" && a.type !== "barricade")
            game.dropPickup(a.x, a.y);
        if (a.kind === "crate" && a.type === "barricade") {
            game.burst(a.x + a.w / 2, a.y + a.h / 2, "#8f7455", 18);
            game.shake = Math.max(game.shake, 5);
        }
        if (a.kind === "vehicle") {
            game.boom(a.x + a.w / 2, a.y, "p", 20);
            game.score += 200;
        }
    }
}

export function dropPickupItem(game, x, y) {
    const types = ["hp", "shot", "rocket", "nade"];
    const type = types[Math.floor(Math.random() * types.length)];
    game.actors.push({
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

export function explodeAt(game, x, y, owner, dmg) {
    game.burst(x, y, "#f80", 16);
    game.shake = 7;
    game.audio.explode();
    const r = 28;
    const box = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
    if (owner === "p") {
        for (const a of game.actors) {
            if (a.alive && aabb(box, game.actorBox(a)))
                game.hurtActor(a, dmg);
        }
        if (game.boss)
            game.hurtBoss(dmg * 0.6);
    }
    else if (aabb(box, game.pbox()))
        game.hurtPlayer(dmg * 0.5);
}

export function damagePlayer(game, n) {
    if (game.inv > 0 || game.hp <= 0)
        return;
    game.hp -= n;
    game.inv = 0.75;
    game.hurtFxT = game.hp <= 0 ? 0.9 : 0.2;
    game.shake = 6;
    game.audio.hit();
    if (game.hp <= 0) {
        game.hp = 0;
        game.burst(game.px, game.py, "#f44", 12);
    }
}

export function spawnMuzzleFx(game, x, y, dir, casing = true) {
    for (let i = 0; i < 5; i++) {
        game.parts.push({
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
        game.parts.push({
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

export function spawnWeaponSmoke(game, x, y, dir) {
    for (let i = 0; i < 5; i++) {
        game.parts.push({
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

export function spawnBurst(game, x, y, c, n) {
    for (let i = 0; i < n; i++) {
        game.parts.push({
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

export function updateParticles(game, dt) {
    for (const p of game.parts) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 240 * dt;
        if (p.life <= 0)
            p.active = false;
    }
    if (game.parts.length > 220)
        game.parts = game.parts.filter((p) => p.active);
}

