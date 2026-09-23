/** Procedural military arcade audio — unlocked on first gesture. */
export class GameAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.volume = 0.7;
        this.muted = false;
        this.musicTimer = 0;
        this.step = 0;
        this.mode = "off";
        this.siren = false;
    }
    unlock() {
        if (this.ctx) {
            void this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.22;
        this.sfxGain.gain.value = 0.45;
        this.master.gain.value = this.volume;
        this.musicGain.connect(this.master);
        this.sfxGain.connect(this.master);
        this.master.connect(this.ctx.destination);
    }
    setVolume(v) {
        this.volume = v;
        if (this.master)
            this.master.gain.value = this.muted ? 0 : v;
    }
    setMode(mode) {
        this.mode = mode;
        this.siren = mode === "warning";
    }
    update(dt) {
        if (!this.ctx || this.muted || this.mode === "off")
            return;
        this.musicTimer += dt;
        const beat = this.mode === "boss" ? 0.14 : this.mode === "warning" ? 0.22 : 0.18;
        if (this.musicTimer >= beat) {
            this.musicTimer -= beat;
            this.step++;
            if (this.siren)
                this.blip(880 + (this.step % 2) * 220, 0.12, "sawtooth", 0.08);
            else if (this.mode === "silence") {
                /* dramatic pause */
            }
            else if (this.mode === "boss") {
                const n = [55, 55, 82, 0, 55, 73, 82, 110][this.step % 8];
                if (n)
                    this.blip(n, 0.12, "square", 0.12);
                if (this.step % 2 === 0)
                    this.noise(0.04, 0.08);
            }
            else {
                const n = [110, 0, 146, 110, 0, 164, 110, 98][this.step % 8];
                if (n)
                    this.blip(n, 0.1, "square", 0.07);
                if (this.step % 4 === 0)
                    this.noise(0.03, 0.05);
            }
        }
    }
    shoot() {
        this.blip(920, 0.04, "square", 0.06);
    }
    grenade() {
        this.noise(0.18, 0.2);
    }
    explode() {
        this.noise(0.28, 0.28);
        this.blip(90, 0.2, "sawtooth", 0.12);
    }
    hit() {
        this.blip(180, 0.06, "square", 0.08);
    }
    pickup() {
        this.blip(660, 0.08, "triangle", 0.08);
        this.blip(880, 0.1, "triangle", 0.06);
    }
    warning() {
        this.setMode("warning");
    }
    impact() {
        this.blip(40, 0.35, "sawtooth", 0.2);
        this.noise(0.4, 0.3);
    }
    blip(freq, dur, type, gain) {
        if (!this.ctx || !this.sfxGain)
            return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.connect(g);
        g.connect(this.mode === "phase" || this.mode === "boss" || this.mode === "warning" ? this.musicGain : this.sfxGain);
        // route notes to music bus if low
        if (freq < 200)
            g.connect(this.musicGain);
        else
            g.connect(this.sfxGain);
        o.start();
        o.stop(this.ctx.currentTime + dur);
    }
    noise(dur, gain) {
        if (!this.ctx || !this.sfxGain)
            return;
        const n = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
        const d = n.getChannelData(0);
        for (let i = 0; i < d.length; i++)
            d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = this.ctx.createBufferSource();
        const g = this.ctx.createGain();
        src.buffer = n;
        g.gain.value = gain;
        src.connect(g);
        g.connect(this.sfxGain);
        src.start();
    }
}
