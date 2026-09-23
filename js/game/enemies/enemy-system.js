const DEFAULT_ENEMY = { w: 16, h: 26, hp: 28, spd: 70, score: 100, color: "#a33" };

export const ENEMY_SPECS = {
  rifle: DEFAULT_ENEMY,
  heavy: { w: 22, h: 30, hp: 90, spd: 42, score: 300, color: "#6a3030" },
  gren: { w: 16, h: 26, hp: 45, spd: 55, score: 180, color: "#8a5a20" },
  knife: { w: 15, h: 25, hp: 34, spd: 95, score: 140, color: "#8a3038" },
  shield: { w: 20, h: 28, hp: 120, spd: 38, score: 350, color: "#39566b" },
  rocket: { w: 18, h: 27, hp: 55, spd: 46, score: 260, color: "#56652d" },
  sniper: { w: 16, h: 26, hp: 38, spd: 22, score: 240, color: "#4b4f67" },
  para: { w: 16, h: 26, hp: 32, spd: 58, score: 180, color: "#596d45" },
  turret: { w: 22, h: 20, hp: 100, spd: 0, score: 320, color: "#4b555c" },
};

export function getEnemySpec(type) {
  return ENEMY_SPECS[type] ?? DEFAULT_ENEMY;
}

export function getActorHitbox(actor) {
  if (actor.kind === "vehicle") return { x: actor.x + 2, y: actor.y + 3, w: actor.w - 4, h: actor.h - 4 };
  if (actor.kind !== "enemy") return { x: actor.x, y: actor.y, w: actor.w, h: actor.h };
  if (!actor.alive) return { x: actor.x + 2, y: actor.y + actor.h * 0.55, w: Math.max(8, actor.w - 4), h: Math.max(6, actor.h * 0.35) };
  if (actor.type === "shield") return { x: actor.x + 4, y: actor.y + 4, w: actor.w - 8, h: actor.h - 5 };
  if (actor.type === "knife") return { x: actor.x + 3, y: actor.y + 4, w: actor.w - 6, h: actor.h - 5 };
  if (actor.type === "turret") return { x: actor.x + 2, y: actor.y + 5, w: actor.w - 4, h: actor.h - 5 };
  if (actor.state === "drop") return { x: actor.x + 3, y: actor.y + 2, w: actor.w - 6, h: actor.h - 3 };
  return { x: actor.x + 3, y: actor.y + 3, w: actor.w - 6, h: actor.h - 4 };
}
