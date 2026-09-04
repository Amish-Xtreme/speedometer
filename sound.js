/**
 * Engine Sound Synthesizer using Web Audio API
 * Generates procedural V8 exhaust growl, RPM pitch shifting,
 * throttle resonance, and rev-limiter pops without any audio sample dependencies.
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.masterGain = null;
        
        // Synth components
        this.osc1 = null;
        this.osc2 = null;
        this.subOsc = null;
        this.filter = null;
        this.gainNode = null;
        this.distortion = null;
        
        // State tracking
        this.lastRevLimiterState = false;
    }
    
    initAudio() {
        if (this.ctx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            
            // Master volume
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
            
            // Main lowpass filter (throttle resonance)
            this.filter = this.ctx.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.setValueAtTime(300, this.ctx.currentTime);
            this.filter.Q.setValueAtTime(3.5, this.ctx.currentTime);
            
            // Subtle distortion for engine grittiness
            this.distortion = this.ctx.createWaveShaper();
            this.distortion.curve = this.makeDistortionCurve(18);
            this.distortion.oversample = '2x';
            
            // Main oscillators (V8 firing order simulation)
            this.osc1 = this.ctx.createOscillator();
            this.osc1.type = 'sawtooth';
            this.osc1.frequency.setValueAtTime(55, this.ctx.currentTime);
            
            this.osc2 = this.ctx.createOscillator();
            this.osc2.type = 'triangle';
            this.osc2.frequency.setValueAtTime(110, this.ctx.currentTime);
            
            // Sub-harmonic bass oscillator
            this.subOsc = this.ctx.createOscillator();
            this.subOsc.type = 'sine';
            this.subOsc.frequency.setValueAtTime(27.5, this.ctx.currentTime);
            
            // Dynamic engine gain
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);
            
            // Wiring
            this.osc1.connect(this.distortion);
            this.osc2.connect(this.distortion);
            this.subOsc.connect(this.filter);
            
            this.distortion.connect(this.filter);
            this.filter.connect(this.gainNode);
            this.gainNode.connect(this.masterGain);
            
            this.osc1.start();
            this.osc2.start();
            this.subOsc.start();
        } catch (e) {
            console.warn('Web Audio API not supported or blocked:', e);
        }
    }
    
    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 20;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }
    
    toggle() {
        if (!this.ctx) {
            this.initAudio();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.enabled = !this.enabled;
        if (!this.enabled && this.gainNode) {
            this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        }
        return this.enabled;
    }
    
    update(physics) {
        if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
        
        const now = this.ctx.currentTime;
        const rpm = Math.max(800, physics.rpm);
        const throttle = physics.effectiveThrottle;
        
        // V8 4-stroke firing frequency: (RPM / 60) * 4 firing pulses/sec
        const baseFreq = (rpm / 60) * 4.0;
        
        // Update oscillator frequencies
        this.osc1.frequency.setTargetAtTime(baseFreq, now, 0.03);
        this.osc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.03);
        this.subOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.03);
        
        // Throttle resonance: opening the throttle opens the filter intake wide
        const filterCutoff = 280 + (rpm / 8000) * 1600 + throttle * 2800;
        this.filter.frequency.setTargetAtTime(filterCutoff, now, 0.04);
        
        // Volume dynamic: louder at higher RPM and under throttle
        const targetGain = 0.15 + (rpm / 8000) * 0.25 + throttle * 0.35;
        this.gainNode.gain.setTargetAtTime(targetGain, now, 0.04);
        
        // Rev limiter exhaust pop
        if (physics.revLimiterActive && !this.lastRevLimiterState) {
            this.triggerBackfirePop();
        }
        this.lastRevLimiterState = physics.revLimiterActive;
    }
    
    triggerBackfirePop() {
        if (!this.ctx || !this.enabled) return;
        try {
            const now = this.ctx.currentTime;
            // Short burst of filtered white noise for exhaust pop
            const bufferSize = this.ctx.sampleRate * 0.08;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const popFilter = this.ctx.createBiquadFilter();
            popFilter.type = 'bandpass';
            popFilter.frequency.setValueAtTime(450 + Math.random() * 300, now);
            popFilter.Q.setValueAtTime(1.5, now);
            
            const popGain = this.ctx.createGain();
            popGain.gain.setValueAtTime(0.5, now);
            popGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            
            noise.connect(popFilter);
            popFilter.connect(popGain);
            popGain.connect(this.masterGain);
            
            noise.start(now);
            noise.stop(now + 0.08);
        } catch (e) {
            // Ignore sound error
        }
    }
}

if (typeof window !== 'undefined') {
    window.SoundEngine = SoundEngine;
}
