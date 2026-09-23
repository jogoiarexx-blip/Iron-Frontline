import { aabb } from "../render/render-utils.js";
import { PLAYER_CONFIG } from "./player-system.js";
import { writeSave } from "../save.js";

export function updatePlayerController(game, dt) {
    if (game.hp <= 0)
        return;
    const a = game.input.actions;
    game.crouch = a.crouch && game.onGround;
    const locked = game.reloadT > 0.01 || game.grenadeFxT > 0.01 || game.meleeFxT > 0.01;
    const spd = game.crouch ? PLAYER_CONFIG.crouchSpeed : PLAYER_CONFIG.moveSpeed;
    game.pvx = locked ? game.pvx * 0.45 : a.moveX * spd;
    if (a.moveX > 0.2)
        game.facing = "right";
    else if (a.moveX < -0.2)
        game.facing = "left";
    if (game.onGround)
        game.coyote = 0.1;
    else
        game.coyote -= dt;
    if (a.jumpPressed)
        game.jumpBuf = 0.12;
    else
        game.jumpBuf -= dt;
    if (!locked && game.jumpBuf > 0 && game.coyote > 0) {
        game.pvy = PLAYER_CONFIG.jumpVelocity;
        game.onGround = false;
        game.coyote = 0;
        game.jumpBuf = 0;
    }
    if (!a.jump && game.pvy < 0)
        game.pvy *= 0.55;
    const grav = game.pvy > 0 ? 980 : 720;
    game.pvy += grav * dt;
    if (game.pvy > 380)
        game.pvy = 380;
    game.px += game.pvx * dt;
    game.py += game.pvy * dt;
    const g = game.phase.ground;
    const h = game.crouch ? 18 : game.pH;
    if (game.py + h >= g) {
        game.py = g - h;
        game.pvy = 0;
        game.onGround = true;
    }
    else
        game.onGround = false;
    game.px = Math.max(0, Math.min(game.phase.width - game.pW, game.px));
    if (game.arenaActive && game.px > game.arenaGateX)
        game.px = game.arenaGateX;
    for (const ob of game.actors) {
        if (!ob.active || !ob.alive || ob.kind !== "crate" || ob.type !== "barricade")
            continue;
        const pbox = game.pbox();
        const box = game.actorBox(ob);
        if (!aabb(pbox, box))
            continue;
        if (game.pvx >= 0)
            game.px = box.x - game.pW - 1;
        else
            game.px = box.x + box.w + 1;
        game.pvx = 0;
    }
    game.shootCd -= dt;
    game.nadeCd -= dt;
    game.weaponT -= dt;
    if (game.weaponT <= 0 && game.weapon !== "rifle") {
        game.weapon = "rifle";
        game.ammoMax = game.weaponMagSize("rifle");
        game.ammo = Math.min(game.ammoMax, game.ammo || game.ammoMax);
    }
    game.reloadT = Math.max(0, game.reloadT - dt);
    if (game.reloadT === 0 && game.reloadFxT > 0) {
        game.ammoMax = game.weaponMagSize();
        game.ammo = game.ammoMax;
        game.reloadFxT = 0;
    }
    game.inv -= dt;
    game.shootFxT = Math.max(0, game.shootFxT - dt);
    game.meleeFxT = Math.max(0, game.meleeFxT - dt);
    game.grenadeFxT = Math.max(0, game.grenadeFxT - dt);
    game.hurtFxT = Math.max(0, game.hurtFxT - dt);
    game.pickupFxT = Math.max(0, game.pickupFxT - dt);
    game.anim += dt * (Math.abs(game.pvx) > 20 ? 12 : 6);
    if (a.reload)
        game.startReload();
    if (a.shoot && game.reloadT <= 0 && game.shootCd <= 0 && game.grenadeFxT <= 0.01 && game.meleeFxT <= 0.01) {
        if (game.ammo <= 0)
            game.startReload(true);
        else
            game.firePlayer();
    }
    if (a.grenade && game.reloadT <= 0 && game.nadeCd <= 0 && game.nades > 0) {
        game.nades--;
        game.nadeCd = 0.9;
        game.grenadeFxT = 0.36;
        const dir = game.facing === "right" ? 1 : -1;
        game.spawnBullet(game.muzzle().x, game.muzzle().y, dir * 160, -140, 48, "p", true);
        game.audio.grenade();
    }
    if (a.melee && game.reloadT <= 0 && game.grenadeFxT <= 0.01)
        game.tryMelee();
    const pb = game.pbox();
    for (const act of game.actors) {
        if (!act.active || !act.alive)
            continue;
        if (!aabb(pb, game.actorBox(act)))
            continue;
        if (act.kind === "hostage" && act.state === "tied") {
            act.state = "free";
            game.rescues++;
            game.score += act.score;
            game.audio.pickup();
        }
        if (act.kind === "secret") {
            act.alive = false;
            act.active = false;
            game.secrets++;
            game.score += act.score;
            game.save.secrets.push(`${game.phase.id}-${game.secrets}`);
            writeSave(game.save);
            game.audio.pickup();
        }
        if (act.kind === "pickup") {
            act.alive = false;
            act.active = false;
            game.pickupFxT = 0.45;
            if (act.type === "hp")
                game.hp = Math.min(game.maxHp, game.hp + 30);
            if (act.type === "shot") {
                game.weapon = "shot";
                game.weaponT = 12;
                game.ammoMax = game.weaponMagSize("shot");
                game.ammo = game.ammoMax;
                game.objective = "SHOTGUN EQUIPPED";
                game.objectiveT = 1.1;
            }
            if (act.type === "rocket") {
                game.weapon = "rocket";
                game.weaponT = 10;
                game.ammoMax = game.weaponMagSize("rocket");
                game.ammo = game.ammoMax;
                game.objective = "ROCKET LAUNCHER EQUIPPED";
                game.objectiveT = 1.1;
            }
            if (act.type === "nade")
                game.nades += 2;
            game.audio.pickup();
        }
    }
}

export function firePlayerController(game) {
    game.shootFxT = game.weapon === "rocket" ? 0.34 : game.weapon === "shot" ? 0.24 : 0.18;
    const m = game.muzzle();
    const dir = game.facing === "right" ? 1 : -1;
    const up = game.input.actions.aimUp || (!game.onGround && game.input.actions.jump);
    const ang = up ? -0.45 : 0;
    if (game.weapon === "shot") {
        game.shootCd = 0.28;
        for (let i = -2; i <= 2; i++) {
            const a = ang + i * 0.12;
            game.spawnBullet(m.x, m.y, Math.cos(a) * 280 * dir, Math.sin(a) * 280, 8, "p", false, "shot");
        }
        game.ammo -= 1;
    }
    else if (game.weapon === "rocket") {
        game.shootCd = 0.45;
        game.spawnBullet(m.x, m.y, dir * 220, Math.sin(ang) * 220, 40, "p", true, "rocket");
        game.ammo -= 1;
    }
    else {
        game.shootCd = 0.11;
        game.spawnBullet(m.x, m.y, dir * 340, Math.sin(ang) * 340, 12, "p", false, "rifle");
        game.ammo -= 1;
    }
    if (game.weapon === "rocket") {
        game.muzzleFx(m.x, m.y, dir, false);
        game.weaponSmoke(m.x - dir * 8, m.y, -dir);
        game.shake = Math.max(game.shake, 5);
    }
    else if (game.weapon === "shot") {
        game.muzzleFx(m.x, m.y, dir, true);
        game.weaponSmoke(m.x - dir * 2, m.y, -dir);
        game.shake = Math.max(game.shake, 3.5);
    }
    else {
        game.muzzleFx(m.x, m.y, dir, true);
        game.shake = Math.max(game.shake, 1.8);
    }
    if (game.ammo <= 0)
        game.startReload(true);
    game.audio.shoot();
}

export function tryMeleeController(game) {
    game.meleeFxT = 0.24;
    const dir = game.facing === "right" ? 1 : -1;
    const box = { x: game.px + (dir > 0 ? game.pW : -16), y: game.py + 8, w: 16, h: 14 };
    for (const a of game.actors) {
        if (a.kind !== "enemy" || !a.alive)
            continue;
        if (aabb(box, game.actorBox(a)))
            game.hurtActor(a, 24);
    }
}

export function getMuzzle(game) {
    const dir = game.facing === "right" ? 1 : -1;
    return { x: game.px + game.pW / 2 + dir * 14, y: game.py + (game.crouch ? 10 : 12) };
}

export function getPlayerBox(game) {
    const st = game.playerState();
    if (st === "dead")
        return { x: game.px + 2, y: game.py + game.pH * 0.6, w: game.pW + 6, h: 8 };
    if (st === "crouch" || st === "reload")
        return { x: game.px + 4, y: game.py + 8, w: game.pW - 7, h: 11 };
    if (st === "jump")
        return { x: game.px + 4, y: game.py + 3, w: game.pW - 6, h: game.pH - 8 };
    return { x: game.px + 3, y: game.py + 4, w: game.pW - 6, h: (game.crouch ? 18 : game.pH) - 6 };
}

