import { VW, VH } from "../core/constants.js";
import { drawSheet } from "../assets.js";
import { hash } from "./render-utils.js";

export function renderGame(game) {
    const ctx = game.ctx;
    const s = game.canvas.width / VW;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sx = (Math.random() - 0.5) * game.shake;
    const sy = (Math.random() - 0.5) * game.shake;
    ctx.save();
    ctx.translate(-Math.round(game.camX + sx), -Math.round(game.camY + sy));
    game.drawWorld();
    for (const a of game.actors)
        if (a.active)
            game.drawActor(a);
    if (game.boss && game.boss.st !== "end")
        game.drawBoss(game.boss);
    game.drawPlayer();
    for (const b of game.bullets)
        if (b.active) {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        }
    for (const p of game.parts) {
        if (!p.active)
            continue;
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    if (game.wallBreak > 0 && (game.screen === "bossIntro" || game.screen === "bossWarn")) {
        ctx.fillStyle = "#3a2a22";
        const gx = game.phase.width - 80;
        ctx.fillRect(gx, 40, 18, game.phase.ground - 40);
    }
    ctx.restore();
    if (game.setpieceFlash > 0) {
        ctx.fillStyle = `rgba(255,170,90,${Math.min(0.28, game.setpieceFlash)})`;
        ctx.fillRect(0, 0, VW, VH);
    }
    if (game.screen === "bossWarn") {
        ctx.fillStyle = game.save.reduceFlash ? "rgba(120,0,0,0.12)" : "rgba(160,0,0,0.18)";
        ctx.fillRect(0, 0, VW, VH);
        ctx.strokeStyle = `rgba(255,40,40,${0.5 + Math.sin(performance.now() / 80) * 0.5})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, VW - 4, VH - 4);
    }
}

export function renderWorld(game) {
    const ctx = game.ctx;
    const g = game.phase.ground;
    const [c0, c1] = game.phase.sky;
    const grd = ctx.createLinearGradient(0, 0, 0, VH);
    grd.addColorStop(0, c0);
    grd.addColorStop(1, c1);
    ctx.fillStyle = grd;
    ctx.fillRect(game.camX - 4, 0, VW + 8, VH);
    const far = game.camX * 0.25;
    ctx.fillStyle = game.phase.id === "02" ? "#3a2814" : "#121a28";
    for (let i = 0; i < 24; i++) {
        const x = i * 90 - (far % 90);
        const h = 40 + ((i * 17) % 50);
        ctx.fillRect(x, g - 50 - h * 0.4, 70, h);
    }
    const mid = game.camX * 0.55;
    for (let i = 0; i < 20; i++) {
        const x = i * 120 - (mid % 120);
        const h = 70 + ((i * 31) % 60);
        ctx.fillStyle = game.phase.id === "03" ? "#152030" : game.phase.id === "02" ? "#5a3a1c" : "#1c2838";
        ctx.fillRect(x, g - h, 88, h);
        ctx.fillStyle = game.phase.id === "03" ? "#c8a030" : "#3a80b0";
        for (let wy = 10; wy < h - 10; wy += 12) {
            for (let wx = 8; wx < 80; wx += 14) {
                if (hash(i * 50 + wy + wx) > 0.35)
                    ctx.fillRect(x + wx, g - h + wy, 6, 6);
            }
        }
    }
    if (game.phase.id === "01") {
        // Layered ruined city set dressing. Deterministic from world coordinates.
        for (let x = 180; x < game.phase.width - 260; x += 360) {
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
                const pulse = 0.55 + Math.sin(game.clock * 8 + x) * 0.25;
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
                    ctx.arc(carX + 21 + Math.sin(game.clock + k) * 3, g - 28 - k * 13 - j * 14, 8 + k * 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
        }
        // overhead cables and hanging signs, giving depth and motion reference.
        ctx.strokeStyle = "rgba(15,18,20,0.75)";
        ctx.lineWidth = 1;
        for (let x = 100; x < game.phase.width; x += 520) {
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
        for (let x = 70; x < game.phase.width; x += 150) {
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
    ctx.fillStyle = game.phase.id === "02" ? "#c4a06a" : "#2a2e32";
    ctx.fillRect(0, g, game.phase.width, VH - g);
    ctx.fillStyle = game.phase.id === "02" ? "#a88448" : "#3a4044";
    for (let x = 0; x < game.phase.width; x += 16)
        ctx.fillRect(x, g - 3, 10, 3);
    // street lamps / cacti
    ctx.fillStyle = "#c8b060";
    for (let x = 80; x < game.phase.width; x += 220) {
        ctx.fillRect(x, g - 36, 3, 36);
        ctx.fillRect(x - 4, g - 36, 10, 3);
    }
    if (game.phase.id === "01") {
        // close foreground debris scrolls at world speed and breaks up empty road.
        for (let x = 250; x < game.phase.width; x += 430) {
            ctx.fillStyle = "#17191b";
            ctx.fillRect(x, g + 21, 72, 6);
            ctx.fillRect(x + 12, g + 15, 25, 5);
            ctx.fillStyle = "#48372c";
            ctx.fillRect(x + 54, g + 13, 10, 8);
        }
    }
}

export function renderPlayer(game) {
    const ctx = game.ctx;
    const core = game.assets.get("player-core-sheet");
    const rifle = game.assets.get("player-rifle-sheet");
    const weaponSheet = game.assets.get("player-weapon-sheet");
    const special = game.assets.get("player-special-sheet");
    const h = game.crouch ? 18 : game.pH;
    const drawX = game.px - 8;
    const drawY = game.py - 10;
    const drawW = game.pW + 18;
    const drawH = h + 18;
    let rendered = false;
    const drawCore = (frame) => {
        if (!core)
            return false;
        drawSheet(ctx, core, frame, 8, 4, drawX, drawY, drawW, drawH, game.facing);
        return true;
    };
    const drawRifle = (frame) => {
        if (!rifle)
            return false;
        drawSheet(ctx, rifle, frame, 4, 4, drawX, drawY, drawW, drawH, game.facing);
        return true;
    };
    const drawWeapon = (frame) => {
        if (!weaponSheet)
            return false;
        drawSheet(ctx, weaponSheet, frame, 4, 4, drawX, drawY, drawW, drawH, game.facing);
        return true;
    };
    const drawSpecial = (frame) => {
        if (!special)
            return false;
        drawSheet(ctx, special, frame, 6, 4, drawX, drawY, drawW, drawH, game.facing);
        return true;
    };
    if (game.hp <= 0) {
        const deathFrame = 18 + Math.min(3, Math.floor(game.deadT / 0.22));
        rendered = drawSpecial(deathFrame);
    }
    else if (game.hurtFxT > 0.01) {
        const hurtFrame = game.hurtFxT > 0.1 ? 12 : 13;
        rendered = drawSpecial(hurtFrame);
    }
    else if (game.reloadT > 0.01) {
        if (game.weapon === "rifle") {
            const seq = [12, 13, 14, 15];
            const total = Math.max(0.001, game.reloadFxT || 0.58);
            const idx = Math.min(seq.length - 1, Math.floor((total - game.reloadT) / (total / seq.length)));
            rendered = drawRifle(seq[idx]);
        }
        else {
            const seq = [8, 9, 10, 11];
            const total = Math.max(0.001, game.reloadFxT || (game.weapon === "rocket" ? 0.8 : 0.72));
            const idx = Math.min(seq.length - 1, Math.floor((total - game.reloadT) / (total / seq.length)));
            rendered = drawWeapon(seq[idx]);
        }
    }
    else if (game.grenadeFxT > 0.01) {
        const seq = [0, 1, 2, 3, 4, 5];
        const idx = Math.min(seq.length - 1, Math.floor((0.36 - game.grenadeFxT) / 0.06));
        rendered = drawSpecial(seq[idx]);
    }
    else if (game.meleeFxT > 0.01) {
        const seq = [6, 7, 8, 9, 10, 11];
        const idx = Math.min(seq.length - 1, Math.floor((0.24 - game.meleeFxT) / 0.04));
        rendered = drawSpecial(seq[idx]);
    }
    else if (game.pickupFxT > 0.01) {
        const seq = [8, 9, 10, 11];
        const idx = Math.min(seq.length - 1, Math.floor((0.45 - game.pickupFxT) / 0.1125));
        rendered = drawWeapon(seq[idx]);
    }
    else if (game.shootFxT > 0.01) {
        if (game.weapon === "shot") {
            const seq = [0, 1, 2, 3];
            const idx = Math.min(seq.length - 1, Math.floor((0.24 - game.shootFxT) / 0.06));
            rendered = drawWeapon(seq[idx]);
        }
        else if (game.weapon === "rocket") {
            const seq = [4, 5, 6, 7];
            const idx = Math.min(seq.length - 1, Math.floor((0.34 - game.shootFxT) / 0.085));
            rendered = drawWeapon(seq[idx]);
        }
        else {
            const base = game.crouch ? 4 : !game.onGround ? 8 : 0;
            const seq = [base, base + 1, base + 2, base + 3];
            const total = 0.18;
            const idx = Math.min(seq.length - 1, Math.floor((total - game.shootFxT) / (total / seq.length)));
            rendered = drawRifle(seq[idx]);
        }
    }
    if (!rendered) {
        if (!game.onGround) {
            const jumpFrame = 24 + Math.min(7, Math.floor((game.anim * 0.75) % 8));
            rendered = drawCore(jumpFrame);
        }
        else if (game.crouch) {
            rendered = drawCore(16 + (Math.floor(game.anim * 0.25) % 2));
        }
        else if (Math.abs(game.pvx) > 20) {
            rendered = drawCore(8 + (Math.floor(game.anim) % 8));
        }
        else {
            rendered = drawCore(Math.floor(game.anim * 0.5) % 4);
        }
    }
    if (!rendered) {
        const img = Math.abs(game.pvx) > 20 ? game.assets.get("player-run") : game.assets.get("player-idle");
        const frame = Math.floor(game.anim) % 4;
        if (img)
            drawSheet(ctx, img, frame, 2, 2, game.px - 4, game.py - 4, game.pW + 8, h + 8, game.facing);
        else
            game.pixelSoldier(game.px, game.py, game.pW, h, game.facing, "#4a8", true);
    }
    if (game.inv > 0 && Math.sin(game.inv * 40) < 0) {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = "#fff";
        ctx.fillRect(game.px, game.py, game.pW, h);
        ctx.globalAlpha = 1;
    }
}

export function renderActor(game, a) {
    if (a.x + a.w < game.camX - 20 || a.x > game.camX + VW + 20)
        return;
    const ctx = game.ctx;
    if (a.kind === "enemy") {
        const rifleSheet = game.assets.get("enemy-rifle-sheet");
        const heavySheet = game.assets.get("enemy-heavy-sheet");
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
        else if (a.state === "enter" || (a.type !== "turret" && Math.abs(game.px - a.x) > 55))
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
            game.pixelSoldier(a.x, a.y, a.w, a.h, a.facing, a.color, false);
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
            const hb = game.actorBox(a);
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#fff";
            ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
            ctx.globalAlpha = 1;
        }
    }
    else if (a.kind === "vehicle") {
        const jeep = a.type === "jeep" ? game.assets.get("jeep") : null;
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
        ctx.fillRect(a.x, a.y + Math.sin(game.clock * 6) * 2, a.w, a.h);
    }
}

export function renderBoss(game, b) {
    const img = b.id === "iron" ? game.assets.get("boss-iron") : null;
    const fr = Math.floor(game.clock * 4) % 4;
    const ctx = game.ctx;
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
        game.burst(muzzleX, muzzleY, "#ffcf74", 1);
    }
    const hpRatio = b.hp / b.max;
    if (hpRatio < 0.7 && Math.random() < 0.5)
        game.burst(b.x + Math.random() * b.w, b.y + 8 + Math.random() * (b.h - 16), "#66584a", 1);
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

export function renderPixelSoldier(game, x, y, w, h, facing, color, player) {
    const ctx = game.ctx;
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

