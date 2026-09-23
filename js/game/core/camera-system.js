import { VW, VH } from "./constants.js";

export function updateCamera(game, dt) {
    game.shake *= 0.88;
    let tx = game.px - VW * 0.35;
    if (game.camMode === "arena" && game.boss)
        tx = game.phase.width - VW - 8;
    if (game.camMode === "cine" && game.boss)
        tx = game.boss.x - VW * 0.55;
    game.camX += (tx - game.camX) * Math.min(1, 6 * dt);
    game.camX = Math.max(0, Math.min(game.phase.width - VW, game.camX));
    game.camY = 0;
}

