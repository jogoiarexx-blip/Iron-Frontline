const GLOBAL_ASSETS = [
    ["player-idle", "./assets/sprites/player-idle.webp"],
    ["player-run", "./assets/sprites/player-run.webp"],
    ["player-core-sheet", "./assets/sprites/player-core-sheet.png"],
    ["player-rifle-sheet", "./assets/sprites/player-rifle-sheet.png"],
    ["player-weapon-sheet", "./assets/sprites/player-weapon-sheet.png"],
    ["player-special-sheet", "./assets/sprites/player-special-sheet.png"],
    ["enemy-rifle-sheet", "./assets/sprites/enemy-rifle-sheet.png"],
    ["enemy-heavy-sheet", "./assets/sprites/enemy-heavy-sheet.png"],
    ["fx-explode", "./assets/sprites/fx-explode.webp"],
];
const PHASE_ASSETS = {
    "01": [
        ["enemy-rifle", "./assets/sprites/enemy-rifle.webp"],
        ["enemy-heavy", "./assets/sprites/enemy-heavy.webp"],
        ["jeep", "./assets/sprites/jeep.webp"],
        ["boss-iron", "./assets/sprites/boss-iron.webp"],
    ],
    "02": [
        ["enemy-rifle", "./assets/sprites/enemy-rifle.webp"],
        ["enemy-heavy", "./assets/sprites/enemy-heavy.webp"],
    ],
    "03": [
        ["enemy-rifle", "./assets/sprites/enemy-rifle.webp"],
        ["enemy-heavy", "./assets/sprites/enemy-heavy.webp"],
    ],
};
export class AssetManager {
    constructor() {
        this.global = new Map();
        this.phase = new Map();
        this.loaded = 0;
        this.total = 0;
        this.currentPhase = null;
        this.failures = [];
    }
    get(key) {
        return this.phase.get(key) ?? this.global.get(key) ?? null;
    }
    async loadImage(src, key) {
        return new Promise((resolve) => {
            const img = new Image();
            img.decoding = "async";
            img.onload = () => {
                if (img.decode)
                    img.decode().then(() => resolve(img)).catch(() => resolve(img));
                else
                    resolve(img);
            };
            img.onerror = () => {
                this.failures.push({ key, error: `failed to load ${src}`, phase: this.currentPhase ?? "global" });
                resolve(null);
            };
            img.src = src;
        });
    }
    async loadGlobal(onProgress) {
        this.total = GLOBAL_ASSETS.length;
        this.loaded = 0;
        for (const [key, src] of GLOBAL_ASSETS) {
            if (!this.global.has(key)) {
                const img = await this.loadImage(src, key);
                if (img)
                    this.global.set(key, img);
            }
            this.loaded++;
            onProgress?.(this.loaded, this.total, key);
            await yieldFrame();
        }
    }
    async loadPhase(id, onProgress) {
        if (this.currentPhase !== id)
            this.unloadPhase();
        this.currentPhase = id;
        const list = PHASE_ASSETS[id] ?? [];
        this.total = Math.max(1, list.length);
        this.loaded = 0;
        if (list.length === 0) {
            this.loaded = 1;
            onProgress?.(1, 1, "phase-data");
            return;
        }
        for (const [key, src] of list) {
            const img = await this.loadImage(src, key);
            if (img)
                this.phase.set(key, img);
            this.loaded++;
            onProgress?.(this.loaded, this.total, key);
            await yieldFrame();
        }
    }
    unloadPhase() {
        this.phase.clear();
        this.currentPhase = null;
    }
}
function yieldFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
export function drawSheet(ctx, img, frame, cols, rows, dx, dy, dw, dh, facing, ox = 0, oy = 0, nativeFacing = "right") {
    const fw = img.width / cols;
    const fh = img.height / rows;
    const col = frame % cols;
    const row = Math.floor(frame / cols) % rows;
    ctx.save();
    ctx.translate(dx + dw / 2, dy + dh / 2);
    // Some generated enemy/boss sheets point left natively. Flip only when
    // requested facing differs from the sheet's native orientation.
    if (facing !== nativeFacing)
        ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, col * fw, row * fh, fw, fh, -dw / 2 + ox, -dh / 2 + oy, dw, dh);
    ctx.restore();
}
