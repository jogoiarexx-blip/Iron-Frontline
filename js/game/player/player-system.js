export const PLAYER_CONFIG = {
  width: 18,
  height: 28,
  maxHp: 100,
  moveSpeed: 150,
  crouchSpeed: 70,
  jumpVelocity: -250,
};

export function weaponMagSize(weapon) {
  return weapon === "shot" ? 6 : weapon === "rocket" ? 1 : 18;
}

export function getPlayerState(game) {
  if (game.hp <= 0) return "dead";
  if (game.hurtFxT > 0.01) return "hurt";
  if (game.reloadT > 0.01) return "reload";
  if (game.grenadeFxT > 0.01) return "grenade";
  if (game.meleeFxT > 0.01) return "melee";
  if (game.pickupFxT > 0.01) return "pickup";
  if (game.shootFxT > 0.01) return "shoot";
  if (!game.onGround) return "jump";
  if (game.crouch) return "crouch";
  if (Math.abs(game.pvx) > 20) return "run";
  return "idle";
}

export function getPlayerHitbox(game) {
  const state = getPlayerState(game);
  if (state === "dead") return { x: game.px + 2, y: game.py + game.pH * 0.6, w: game.pW + 6, h: 8 };
  if (state === "crouch" || state === "reload") return { x: game.px + 4, y: game.py + 8, w: game.pW - 7, h: 11 };
  if (state === "jump") return { x: game.px + 4, y: game.py + 3, w: game.pW - 6, h: game.pH - 8 };
  return { x: game.px + 3, y: game.py + 4, w: game.pW - 6, h: (game.crouch ? 18 : game.pH) - 6 };
}
