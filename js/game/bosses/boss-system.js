export function createBossState(def, camX, viewportWidth, ground) {
  return {
    id: def.id,
    name: def.name,
    sub: def.sub,
    x: camX + viewportWidth + 46,
    y: ground - (def.id === "iron" ? 72 : 64),
    w: def.id === "dread" ? 110 : 96,
    h: def.id === "iron" ? 72 : 64,
    hp: def.id === "sand" ? 1400 : 1200,
    max: def.id === "sand" ? 1400 : 1200,
    facing: "left",
    phase: 1,
    st: "intro",
    t: 3.8,
    atk: 1.2,
    inv: true,
    color: def.id === "sand" ? "#c4843a" : def.id === "dread" ? "#3a5a6a" : "#8a3030",
    vx: -110,
    fireFx: 0,
    cue: 0,
  };
}

export function bossAttackCooldown(phase) {
  return phase === 1 ? 1.45 : phase === 2 ? 0.98 : 0.66;
}

export function warMachineMovement(phase) {
  if (phase >= 3) return { offset: 82, speed: 62 };
  if (phase === 2) return { offset: 104, speed: 46 };
  return { offset: 122, speed: 34 };
}
