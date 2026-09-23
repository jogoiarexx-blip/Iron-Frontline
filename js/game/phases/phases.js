export const PHASES = [
  {
    id: "01",
    num: "01",
    name: "CITY UNDER FIRE",
    title: "Ash Vale drops into a burning district. Push east. Extract civilians.",
    width: 4600,
    ground: 176,
    sky: ["#0a1220", "#2a1a18"],
    next: "02",
    boss: { id: "iron", name: "WAR MACHINE", sub: '"THE IRON DEVOURER"' },
    mini: { time: 22, type: "jeep" },
    events: [
      { time: 1.2, type: "spawn", enemy: "rifle", side: "right", count: 2 },
      { time: 3.5, type: "spawn", enemy: "knife", side: "left", count: 2 },
      { time: 5.2, type: "barrel" },
      { time: 6, type: "spawn", enemy: "gren", side: "right", count: 1 },
      { time: 8, type: "crate" },
      { time: 9.5, type: "arena", enemy: "rifle", count: 5, text: "STREET LOCKDOWN" },
      { time: 11.5, type: "collapse", text: "BUILDING COLLAPSE!" },
      { time: 12, type: "hostage", text: "RESCUE THE CIVILIAN" },
      { time: 14, type: "spawn", enemy: "shield", side: "left", count: 1 },
      { time: 16, type: "spawn", enemy: "sniper", side: "right", count: 1 },
      { time: 17.5, type: "spawn", enemy: "para", side: "right", count: 2 },
      { time: 20, type: "barricade", text: "DESTROY THE BARRICADE" },
      { time: 26, type: "spawn", enemy: "rocket", side: "right", count: 1 },
      { time: 28, type: "arena", enemy: "rifle", count: 6, text: "CROSS FIRE" },
      { time: 30, type: "spawn", enemy: "turret", side: "right", count: 1 },
      { time: 32, type: "secret" },
      { time: 34, type: "spawn", enemy: "heavy", side: "right", count: 1 },
      { time: 36, type: "arena", enemy: "shield", count: 4, text: "BREAK THE LINE" },
      { time: 38, type: "collapse", text: "CITY IS COMING DOWN" },
      { time: 39, type: "barrel" },
      { time: 44, type: "bossPrep", text: "BOSS AREA" },
    ],
  },
  {
    id: "02",
    num: "02",
    name: "DESERT ASSAULT",
    title: "Heat shimmer. Convoy wrecks. Hold the ridge.",
    width: 4400,
    ground: 176,
    sky: ["#24180c", "#6a4020"],
    next: "03",
    boss: { id: "sand", name: "DUNE CRAWLER", sub: '"THE THIRST ENGINE"' },
    mini: { time: 20, type: "tank" },
    events: [
      { time: 1, type: "spawn", enemy: "rifle", side: "right", count: 3 },
      { time: 4, type: "spawn", enemy: "gren", side: "left", count: 1 },
      { time: 8, type: "spawn", enemy: "rifle", side: "right", count: 2 },
      { time: 11, type: "hostage" },
      { time: 13, type: "spawn", enemy: "heavy", side: "right", count: 1 },
      { time: 16, type: "crate" },
      { time: 26, type: "spawn", enemy: "rifle", side: "left", count: 4 },
      { time: 30, type: "spawn", enemy: "heavy", side: "right", count: 1 },
      { time: 34, type: "secret" },
      { time: 38, type: "spawn", enemy: "gren", side: "right", count: 2 },
      { time: 42, type: "bossPrep" },
    ],
  },
  {
    id: "03",
    num: "03",
    name: "IRON HARBOR",
    title: "Night docks. Cranes. One last machine in the water.",
    width: 4800,
    ground: 176,
    sky: ["#050814", "#102030"],
    next: null,
    boss: { id: "dread", name: "HARBOR DREAD", sub: '"THE WET IRON"' },
    mini: { time: 21, type: "gunship" },
    events: [
      { time: 1.2, type: "spawn", enemy: "rifle", side: "right", count: 2 },
      { time: 4, type: "spawn", enemy: "rifle", side: "left", count: 3 },
      { time: 7, type: "spawn", enemy: "heavy", side: "right", count: 1 },
      { time: 10, type: "hostage" },
      { time: 12, type: "crate" },
      { time: 15, type: "spawn", enemy: "gren", side: "left", count: 2 },
      { time: 18, type: "spawn", enemy: "rifle", side: "right", count: 3 },
      { time: 28, type: "spawn", enemy: "heavy", side: "left", count: 1 },
      { time: 32, type: "secret" },
      { time: 35, type: "spawn", enemy: "rifle", side: "right", count: 4 },
      { time: 40, type: "spawn", enemy: "gren", side: "right", count: 2 },
      { time: 45, type: "bossPrep" },
    ],
  },
];

export function getPhaseById(id) {
  return PHASES.find((phase) => phase.id === id) ?? PHASES[0];
}

export function phaseTriggerX(phase, time) {
  const events = phase.events;
  const bossTime = Math.max(1, events[events.length - 1]?.time ?? 45);
  const travelStart = 180;
  const travelEnd = Math.max(travelStart + 1, phase.width - 620);
  return travelStart + (time / bossTime) * (travelEnd - travelStart);
}
