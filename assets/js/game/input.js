const GAME_KEYS = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    "KeyJ",
    "KeyZ",
    "KeyK",
    "KeyX",
    "Escape",
    "KeyP",
    "Enter",
    "KeyF",
    "KeyR",
]);
function radialDeadzone(x, y, dz = 0.18) {
    const m = Math.hypot(x, y);
    if (m < dz)
        return { x: 0, y: 0 };
    const scale = (m - dz) / (1 - dz) / m;
    return { x: x * scale, y: y * scale };
}
export class Input {
    constructor() {
        this.keys = new Set();
        this.injected = new Set();
        this.prev = new Set();
        this.enabled = true;
        this.gamepadConnected = false;
        this.gamepadId = "";
        this.touchMoveX = 0;
        this.touchJump = false;
        this.touchShoot = false;
        this.touchGrenade = false;
        this.touchPause = false;
        this.touchMelee = false;
        this.touchReload = false;
        this.touchCrouch = false;
        this.actions = {
            moveX: 0,
            moveY: 0,
            jump: false,
            jumpPressed: false,
            shoot: false,
            grenade: false,
            melee: false,
            reload: false,
            pause: false,
            confirm: false,
            crouch: false,
            aimUp: false,
        };
        this.lastActions = { ...this.actions };
        this.unsubs = [];
    }
    attach(el) {
        const kd = (e) => {
            if (GAME_KEYS.has(e.code))
                e.preventDefault();
            this.keys.add(e.code);
        };
        const ku = (e) => this.keys.delete(e.code);
        const clear = () => this.keys.clear();
        window.addEventListener("keydown", kd);
        window.addEventListener("keyup", ku);
        window.addEventListener("blur", clear);
        const visibility = () => {
            if (document.hidden)
                this.keys.clear();
        };
        document.addEventListener("visibilitychange", visibility);
        const pd = (e) => {
            if (e.target === el)
                e.preventDefault();
        };
        el.addEventListener("pointerdown", pd);
        this.unsubs.push(() => {
            window.removeEventListener("keydown", kd);
            window.removeEventListener("keyup", ku);
            window.removeEventListener("blur", clear);
            document.removeEventListener("visibilitychange", visibility);
            el.removeEventListener("pointerdown", pd);
        });
    }
    destroy() {
        this.unsubs.forEach((u) => u());
        this.unsubs = [];
    }
    setInjectedKeys(codes) {
        this.injected = new Set(codes);
    }
    down(code) {
        return this.keys.has(code) || this.injected.has(code);
    }
    update() {
        this.lastActions = { ...this.actions };
        let mx = 0;
        let my = 0;
        if (this.down("KeyA") || this.down("ArrowLeft"))
            mx -= 1;
        if (this.down("KeyD") || this.down("ArrowRight"))
            mx += 1;
        if (this.down("KeyW") || this.down("ArrowUp"))
            my -= 1;
        if (this.down("KeyS") || this.down("ArrowDown"))
            my += 1;
        mx += this.touchMoveX;
        const pads = navigator.getGamepads?.() ?? [];
        this.gamepadConnected = false;
        for (const gp of pads) {
            if (!gp)
                continue;
            this.gamepadConnected = true;
            this.gamepadId = gp.id;
            const stick = radialDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
            if (Math.abs(stick.x) > 0.01)
                mx = stick.x;
            if (stick.y > 0.45)
                my = 1;
            if (stick.y < -0.45)
                my = -1;
            if (gp.buttons[14]?.pressed)
                mx = -1;
            if (gp.buttons[15]?.pressed)
                mx = 1;
            if (gp.buttons[12]?.pressed)
                my = -1;
            if (gp.buttons[13]?.pressed)
                my = 1;
            break;
        }
        mx = Math.max(-1, Math.min(1, mx));
        const jump = this.down("Space") ||
            this.down("KeyW") ||
            this.down("ArrowUp") ||
            this.touchJump ||
            this.pad(0) ||
            this.pad(3) ||
            this.pad(12);
        const shoot = this.down("KeyJ") ||
            this.down("KeyZ") ||
            this.touchShoot ||
            this.pad(2) ||
            this.pad(5) ||
            this.pad(7);
        const grenade = this.down("KeyK") || this.down("KeyX") || this.touchGrenade || this.pad(1);
        const pause = this.down("Escape") || this.down("KeyP") || this.touchPause || this.pad(9);
        const crouch = this.touchCrouch || this.down("KeyS") || this.down("ArrowDown") || this.pad(13);
        const melee = this.touchMelee || this.down("KeyF") || this.pad(4);
        const reload = this.down("KeyR") || this.touchReload || this.pad(6);
        const confirm = this.down("Enter") || this.pad(0);
        this.actions = {
            moveX: mx,
            moveY: my,
            jump,
            jumpPressed: jump && !this.lastActions.jump,
            shoot,
            grenade: grenade && !this.lastActions.grenade,
            melee: melee && !this.lastActions.melee,
            reload: reload && !this.lastActions.reload,
            pause: pause && !this.lastActions.pause,
            confirm: confirm && !this.lastActions.confirm,
            crouch,
            aimUp: my < -0.4 && !this.actions.jump ? true : my < -0.4,
        };
        this.touchPause = false;
    }
    pad(i) {
        const pads = navigator.getGamepads?.() ?? [];
        for (const gp of pads) {
            if (gp?.buttons[i]?.pressed)
                return true;
        }
        return false;
    }
}
