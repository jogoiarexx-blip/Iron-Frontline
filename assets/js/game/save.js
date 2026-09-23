const KEY = "iron-frontline-save-v1";
const VERSION = 1;
const DEFAULTS = {
    version: VERSION,
    unlocked: [1],
    bestScore: {},
    bestTime: {},
    secrets: [],
    characters: ["ash"],
    difficulties: [],
    achievements: [],
    reduceFlash: false,
    volume: 0.7,
};
export function loadSave() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed, version: VERSION };
    }
    catch {
        return { ...DEFAULTS };
    }
}
export function writeSave(data) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...data, version: VERSION }));
    }
    catch {
        /* quota / private mode */
    }
}
export function unlockMission(data, id) {
    if (!data.unlocked.includes(id))
        data.unlocked.push(id);
    writeSave(data);
}
export function recordRun(data, mission, score, time) {
    data.bestScore[mission] = Math.max(data.bestScore[mission] ?? 0, score);
    const prev = data.bestTime[mission];
    data.bestTime[mission] = prev == null ? time : Math.min(prev, time);
    writeSave(data);
}
