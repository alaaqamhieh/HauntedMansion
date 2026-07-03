// Procedural WebAudio: no sound files. Ambient drone, footsteps that scale
// with gait, a heartbeat that quickens near monsters, and stingers.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.heartGain = null;
    this.heartInterval = 1.4;
    this._heartTimer = 0;
    this._stepAccum = 0;
  }

  // must be called from a user gesture
  init() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    // --- ambient drone: two detuned oscillators through a dark lowpass
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 2;
    for (const [freq, type] of [[54, 'sawtooth'], [55.4, 'triangle'], [110.7, 'sine']]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = freq;
      o.connect(lp);
      o.start();
    }
    lp.connect(droneGain);
    droneGain.connect(this.master);
    // slow swell
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain); lfoGain.connect(droneGain.gain);
    lfo.start();

    // wind whistle (filtered noise)
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = noiseBuf;
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuf; wind.loop = true;
    const windBP = ctx.createBiquadFilter();
    windBP.type = 'bandpass'; windBP.frequency.value = 700; windBP.Q.value = 4;
    const windGain = ctx.createGain(); windGain.gain.value = 0.012;
    wind.connect(windBP); windBP.connect(windGain); windGain.connect(this.master);
    wind.start();
    const windLfo = ctx.createOscillator(); windLfo.frequency.value = 0.11;
    const windLfoG = ctx.createGain(); windLfoG.gain.value = 300;
    windLfo.connect(windLfoG); windLfoG.connect(windBP.frequency); windLfo.start();
  }

  _noiseBurst(dur, freq, q, gain, type = 'bandpass') {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.05);
  }

  _thump(freq, gain, dur = 0.16) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(ctx.currentTime + dur + 0.05);
  }

  footstep(mode) {
    if (!this.ctx) return;
    const vol = mode === 'run' ? 0.30 : mode === 'walk' ? 0.14 : 0.045;
    this._noiseBurst(0.09, 300 + Math.random() * 200, 1.2, vol, 'lowpass');
    if (mode !== 'sneak') this._thump(70, vol * 0.8, 0.08);
  }

  // dist: nearest monster distance; chasing: any monster in chase
  updateHeartbeat(dt, dist, chasing) {
    if (!this.ctx) return;
    let interval, vol;
    if (chasing) { interval = 0.42; vol = 0.5; }
    else if (dist < 5) { interval = 0.55; vol = 0.4; }
    else if (dist < 9) { interval = 0.8; vol = 0.28; }
    else if (dist < 14) { interval = 1.15; vol = 0.14; }
    else { interval = 1.6; vol = 0.0; }
    this._heartTimer += dt;
    if (this._heartTimer >= interval && vol > 0) {
      this._heartTimer = 0;
      this._thump(52, vol, 0.14);
      setTimeout(() => this._thump(44, vol * 0.7, 0.12), 140);
    }
  }

  sting() { // spotted!
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(ctx.currentTime + 1.2);
    this._noiseBurst(0.8, 2000, 0.8, 0.18, 'highpass');
  }

  pickup() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (const [i, f] of [523, 659, 784].entries()) {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 0.7);
    }
  }

  doorCreak() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(90, ctx.currentTime + 1.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(); o.stop(ctx.currentTime + 1.7);
  }

  caught() {
    if (!this.ctx) return;
    this._thump(38, 0.8, 0.5);
    this._noiseBurst(1.2, 800, 0.5, 0.5, 'lowpass');
    this.sting();
  }
}
