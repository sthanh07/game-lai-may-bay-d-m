/**
 * Hệ thống âm thanh Procedural Sound Synthesizer dựa trên Web Audio API
 * Tự động tạo toàn bộ hiệu ứng âm thanh Sci-Fi bằng mã nguồn (Zero Audio Files)!
 */
export class SoundEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.masterGain = null;
        this.bgmInterval = null;
        this.isInitialized = false;

        // Tải trạng thái tắt tiếng từ LocalStorage (mặc định mở âm thanh)
        const savedMute = localStorage.getItem('cyber_drift_muted');
        if (savedMute !== null) {
            this.isMuted = savedMute === 'true';
        }
    }

    /**
     * Khởi tạo AudioContext sau lần tương tác đầu tiên của người dùng
     */
    init() {
        if (this.isInitialized) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();

            // Nút điều chỉnh âm lượng tổng
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            this.isInitialized = true;

            // Khởi động giai điệu Cyberpunk Ambient BGM
            this.startCyberpunkAmbientBGM();
        } catch (e) {
            console.warn('Web Audio API không được hỗ trợ hoặc bị chặn trên trình duyệt này:', e);
        }
    }

    /**
     * Đảm bảo AudioContext luôn ở trạng thái active
     */
    ensureResume() {
        if (!this.isInitialized) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Bật hoặc tắt âm thanh toàn hệ thống
     */
    toggleMute() {
        this.ensureResume();
        this.isMuted = !this.isMuted;
        localStorage.setItem('cyber_drift_muted', this.isMuted.toString());

        if (this.masterGain && this.ctx) {
            // Chuyển mượt âm lượng tránh tiếng nổ click pop
            const targetGain = this.isMuted ? 0 : 0.65;
            this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
        }

        // Phát tiếng beep phản hồi khi bật âm thanh
        if (!this.isMuted) {
            this.playFeedbackBeep();
        }

        return this.isMuted;
    }

    /**
     * Tiếng beep phản hồi giao diện khi người dùng tương tác nút bấm
     */
    playFeedbackBeep() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    /**
     * 1. HIỆU ỨNG ÂM THANH KHI PHI THUYỀN ĂN ĐIỂM (Thu thập Tinh thể Năng lượng)
     * Bộ dao động kép (Dual Oscillator Shimmer) + Chuỗi hòa âm Arpeggio ngân vang lấp lánh
     */
    playCrystalCollect() {
        if (!this.ctx || this.isMuted) return;
        this.ensureResume();

        const now = this.ctx.currentTime;
        // Chuỗi hòa âm tươi sáng: C6, E6, G6, C7 (1046.5Hz, 1318.5Hz, 1568Hz, 2093Hz)
        const arpeggioNotes = [1046.5, 1318.5, 1568.0, 2093.0];

        arpeggioNotes.forEach((freq, idx) => {
            const noteStart = now + idx * 0.035;

            // Dao động chính (Sine wave mềm mại)
            const oscMain = this.ctx.createOscillator();
            oscMain.type = 'sine';
            oscMain.frequency.setValueAtTime(freq, noteStart);
            oscMain.frequency.exponentialRampToValueAtTime(freq * 1.06, noteStart + 0.2); // Tần số trượt nhẹ lên trên

            // Dao động phụ tạo hòa âm lung linh (Triangle wave lấp lánh với detune)
            const oscShimmer = this.ctx.createOscillator();
            oscShimmer.type = 'triangle';
            oscShimmer.frequency.setValueAtTime(freq * 2, noteStart);
            oscShimmer.detune.setValueAtTime(8, noteStart); // Lệch 8 cents tạo hiệu ứng chorus

            // Bộ lọc dải tần làm sáng tiếng
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 1.5, noteStart);
            filter.Q.value = 1.8;

            // Bộ bao âm lượng (Envelope ADSR)
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.28, noteStart + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.28);

            oscMain.connect(gain);
            oscShimmer.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            oscMain.start(noteStart);
            oscShimmer.start(noteStart);
            oscMain.stop(noteStart + 0.3);
            oscShimmer.stop(noteStart + 0.3);
        });
    }

    /**
     * 2. HIỆU ỨNG ÂM THANH KHI BẬT CHẾ ĐỘ PHẢN TRỌNG LỰC (Antigravity Flip)
     * Sub-bass Drop cực sâu + Tần số quét cộng hưởng không-thời gian (Resonant Frequency Sweep)
     */
    playGravityFlip() {
        if (!this.ctx || this.isMuted) return;
        this.ensureResume();

        const now = this.ctx.currentTime;
        const duration = 0.42;

        // A. Cú giáng Sub-bass tần số thấp tạo áp lực đảo chiều trường hấp dẫn
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(260, now);
        subOsc.frequency.exponentialRampToValueAtTime(42, now + duration);

        subGain.gain.setValueAtTime(0.48, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        subOsc.connect(subGain);
        subGain.connect(this.masterGain);
        subOsc.start(now);
        subOsc.stop(now + duration);

        // B. Dao động Sawtooth qua Resonant Lowpass Filter quét đảo chiều (Laser Warp Whoosh)
        const warpOsc = this.ctx.createOscillator();
        const warpFilter = this.ctx.createBiquadFilter();
        const warpGain = this.ctx.createGain();

        warpOsc.type = 'sawtooth';
        warpOsc.frequency.setValueAtTime(140, now);
        warpOsc.frequency.exponentialRampToValueAtTime(420, now + duration * 0.5);
        warpOsc.frequency.exponentialRampToValueAtTime(70, now + duration);

        warpFilter.type = 'lowpass';
        warpFilter.frequency.setValueAtTime(3200, now);
        warpFilter.frequency.exponentialRampToValueAtTime(350, now + duration);
        warpFilter.Q.value = 6.0; // Độ cộng hưởng cao tạo tiếng xé gió đặc trưng sci-fi

        warpGain.gain.setValueAtTime(0.3, now);
        warpGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        warpOsc.connect(warpFilter);
        warpFilter.connect(warpGain);
        warpGain.connect(this.masterGain);

        warpOsc.start(now);
        warpOsc.stop(now + duration);

        // C. Lớp tiếng ồn gió xoáy tốc độ
        this.playNoiseWhoosh(0.35, 1200, 180);
    }

    /**
     * 3. HIỆU ỨNG ÂM THANH KHI VA CHẠM NỔ TUNG (Crash / Explosion)
     * Cú nổ chấn động Sub-boom + Tiếng ồn trắng vỡ vụn + Bộ méo tiếng bão hòa (Distortion)
     */
    playCrashExplosion() {
        if (!this.ctx || this.isMuted) return;
        this.ensureResume();

        const now = this.ctx.currentTime;
        const duration = 0.95;

        // A. Cú nổ chấn động tần số thấp (Sub-bass impact)
        const impactOsc = this.ctx.createOscillator();
        const impactGain = this.ctx.createGain();

        impactOsc.type = 'sawtooth';
        impactOsc.frequency.setValueAtTime(130, now);
        impactOsc.frequency.exponentialRampToValueAtTime(22, now + duration);

        impactGain.gain.setValueAtTime(0.75, now);
        impactGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        impactOsc.connect(impactGain);
        impactGain.connect(this.masterGain);
        impactOsc.start(now);
        impactOsc.stop(now + duration);

        // B. Lớp tiếng ồn nổ hạt vỡ vụn (White Noise Debris Layer)
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = buffer;

        // Bộ lọc Lowpass quét từ cao xuống thấp mô phỏng sóng nổ lan tỏa
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + duration);
        filter.Q.value = 3.5;

        // Waveshaper tạo méo tiếng kim loại giòn tan
        const waveShaper = this.ctx.createWaveShaper();
        waveShaper.curve = this.createDistortionCurve(20);
        waveShaper.oversample = '4x';

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.65, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        whiteNoise.connect(filter);
        filter.connect(waveShaper);
        waveShaper.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        whiteNoise.start(now);
        whiteNoise.stop(now + duration);
    }

    /**
     * Tạo đường cong méo tiếng phi tuyến tính (Distortion Curve)
     */
    createDistortionCurve(amount = 20) {
        const k = amount;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    /**
     * Âm thanh kích hoạt Hyper-Boost
     */
    playHyperBoost() {
        if (!this.ctx || this.isMuted) return;
        this.ensureResume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.45);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, now);
        filter.frequency.linearRampToValueAtTime(3600, now + 0.45);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.65);
    }

    /**
     * Tạo tiếng gió lướt nhanh (Noise Whoosh)
     */
    playNoiseWhoosh(duration, startFreq, endFreq) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(startFreq, now);
        filter.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
        filter.Q.value = 3.0;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + duration);
    }

    /**
     * Tiếng click tương tác giao diện
     */
    playUIClick() {
        if (!this.ctx || this.isMuted) return;
        this.ensureResume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.06);
    }

    /**
     * Nhạc nền Sci-Fi Synthwave Arpeggiator tự động sinh trong không gian vũ trụ
     */
    startCyberpunkAmbientBGM() {
        if (this.bgmInterval) return;

        // Chuỗi hợp âm Cyberpunk: Dm - Bb - F - C
        const arpSequences = [
            [293.66, 349.23, 440.00, 587.33], // Dm: D4, F4, A4, D5
            [233.08, 293.66, 349.23, 466.16], // Bb: Bb3, D4, F4, Bb4
            [261.63, 329.63, 392.00, 523.25], // C:  C4, E4, G4, C5
            [220.00, 261.63, 329.63, 440.00]  // Am: A3, C4, E4, A4
        ];

        let chordIndex = 0;
        let noteIndex = 0;

        this.bgmInterval = setInterval(() => {
            if (!this.ctx || this.isMuted) return;
            const now = this.ctx.currentTime;

            const chord = arpSequences[chordIndex];
            const freq = chord[noteIndex];

            // Synth Pluck với filter decay
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1600, now);
            filter.frequency.exponentialRampToValueAtTime(220, now + 0.22);

            gain.gain.setValueAtTime(0.045, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.26);

            noteIndex++;
            if (noteIndex >= chord.length) {
                noteIndex = 0;
                chordIndex = (chordIndex + 1) % arpSequences.length;
            }
        }, 180); // Nhịp ~130 BPM
    }
}
