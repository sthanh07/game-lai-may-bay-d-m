import * as THREE from 'three';
import { GameRenderer } from './renderer.js';
import { PlayerShip } from './player.js';
import { GameWorld } from './world.js';
import { PhysicsEngine } from './physics.js';
import { SoundEngine } from './audio.js';

// Hỗ trợ GSAP cả dạng module hoặc global script
const gsap = window.gsap;

/**
 * Trạng thái của trò chơi
 */
const GAME_STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
};

/**
 * Lớp điều phối toàn bộ trò chơi (Game Manager)
 */
export class CyberDriftGame {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        this.state = GAME_STATE.MENU;

        // 1. Khởi tạo các hệ thống con
        this.renderer = new GameRenderer(this.canvas);
        this.soundEngine = new SoundEngine();
        this.player = new PlayerShip(this.renderer.scene);
        this.world = new GameWorld(this.renderer.scene);
        this.physics = new PhysicsEngine(this.player, this.world, this.soundEngine);

        // 2. Điểm số, Hệ số nhân và Thời gian
        this.score = 0;
        this.multiplier = 1;
        this.comboTimer = 0;
        this.crystalsCollected = 0;
        this.highScore = parseInt(localStorage.getItem('cyber_drift_highscore') || '0', 10);

        // 3. Quản lý Delta-time và FPS
        this.clock = new THREE.Clock();
        this.fpsFrames = 0;
        this.fpsTime = 0;
        this.currentFPS = 60;

        // 4. Trạng thái phím điều khiển
        this.input = {
            left: false,
            right: false,
            up: false,
            down: false
        };

        // 5. Kết nối giao diện người dùng (DOM Elements)
        this.bindDOMElements();

        // 6. Đăng ký sự kiện bàn phím & cảm ứng
        this.setupInputListeners();

        // 7. Cập nhật Bảng điểm cao trên Menu
        this.updateLeaderboardUI();

        // 8. Bắt đầu vòng lặp game
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        console.log('🎮 Cyber-Drift: Zero Gravity đã khởi tạo thành công!');
    }

    /**
     * Tham chiếu đến các phần tử HTML HUD
     */
    bindDOMElements() {
        // Màn hình
        this.uiMenu = document.getElementById('menu-screen');
        this.uiHud = document.getElementById('hud-screen');
        this.uiGameOver = document.getElementById('gameover-screen');
        this.uiPause = document.getElementById('pause-screen');

        // Các chỉ số HUD
        this.hudScore = document.getElementById('hud-score');
        this.hudMultiplier = document.getElementById('hud-multiplier');
        this.hudSpeed = document.getElementById('hud-speed');
        this.hudFPS = document.getElementById('hud-fps');
        this.hudEnergyBar = document.getElementById('hud-energy-bar');
        this.hudEnergyText = document.getElementById('hud-energy-text');
        this.hudAlert = document.getElementById('hud-alert');

        // Các nút bấm
        this.btnPlay = document.getElementById('btn-play');
        this.btnRestart = document.getElementById('btn-restart');
        this.btnResume = document.getElementById('btn-resume');
        this.btnMenu = document.getElementById('btn-menu');
        // Nút Bật/Tắt Âm thanh cố định góc màn hình
        this.btnAudioToggle = document.getElementById('btn-audio-toggle');
        this.audioIconSvg = document.getElementById('audio-icon-svg');
        this.audioStatusLabel = document.getElementById('audio-status-label');
        this.audioWaveBars = document.getElementById('audio-wave-bars');

        // Giao diện Nạp Model 3D .GLB
        this.inputModelUrl = document.getElementById('input-model-url');
        this.btnLoadModel = document.getElementById('btn-load-model');
        this.btnSampleModel = document.getElementById('btn-sample-model');
        this.btnResetModel = document.getElementById('btn-reset-model');
        this.modelStatusBadge = document.getElementById('model-status-badge');

        if (this.btnLoadModel && this.inputModelUrl) {
            this.btnLoadModel.addEventListener('click', () => {
                const url = this.inputModelUrl.value.trim();
                if (!url) {
                    this.showAlert("VUI LÒNG NHẬP LINK FILE .GLB!", "#ffdd00");
                    return;
                }
                this.loadCustomShipModel(url);
            });

            this.btnSampleModel.addEventListener('click', () => {
                const sampleUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/models/gltf/DamagedHelmet/glTF-Binary/DamagedHelmet.glb';
                this.inputModelUrl.value = sampleUrl;
                this.loadCustomShipModel(sampleUrl);
            });

            this.btnResetModel.addEventListener('click', () => {
                this.player.useDefaultProceduralModel();
                this.inputModelUrl.value = '';
                localStorage.removeItem('cyber_drift_model_url');
                if (this.modelStatusBadge) {
                    this.modelStatusBadge.innerText = '✦ KHỐI 3D MẶC ĐỊNH (FALLBACK ACTIVE)';
                    this.modelStatusBadge.className = 'text-[10px] font-orbitron px-2.5 py-0.5 rounded-full border border-cyan-500/40 text-cyan-300 bg-cyan-950/60 shadow-neon-cyan';
                }
                this.showAlert("ĐÃ QUAY VỀ KHỐI 3D MẶC ĐỊNH", "#00f3ff");
            });

            // Tự động khôi phục model đã lưu nếu có
            const savedModelUrl = localStorage.getItem('cyber_drift_model_url');
            if (savedModelUrl) {
                this.inputModelUrl.value = savedModelUrl;
                this.loadCustomShipModel(savedModelUrl);
            }
        }

        // Báo điểm màn hình kết thúc
        this.finalScoreEl = document.getElementById('final-score');
        this.finalHighEl = document.getElementById('final-high');
        this.finalCrystalsEl = document.getElementById('final-crystals');
        this.finalDistanceEl = document.getElementById('final-distance');
        this.newHighScoreBanner = document.getElementById('new-highscore-badge');

        // Gắn sự kiện click nút
        this.btnPlay.addEventListener('click', () => this.startGame());
        this.btnRestart.addEventListener('click', () => this.restartGame());
        this.btnResume.addEventListener('click', () => this.togglePause());
        this.btnMenu.addEventListener('click', () => this.returnToMenu());

        // Sự kiện nút Bật / Tắt âm thanh Synthesizer
        if (this.btnAudioToggle) {
            this.btnAudioToggle.addEventListener('click', () => {
                const isMuted = this.soundEngine.toggleMute();
                this.updateMuteUI(isMuted);
                this.showAlert(isMuted ? "SYNTH AUDIO: MUTED" : "SYNTH AUDIO: ACTIVE", isMuted ? "#ff0077" : "#00f3ff");
            });
            this.updateMuteUI(this.soundEngine.isMuted);
        }

        // Nút cảm ứng Mobile HUD
        const touchLeft = document.getElementById('touch-left');
        const touchRight = document.getElementById('touch-right');
        const touchFlip = document.getElementById('touch-flip');
        const touchBoost = document.getElementById('touch-boost');

        if (touchLeft) {
            touchLeft.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.left = true; });
            touchLeft.addEventListener('touchend', (e) => { e.preventDefault(); this.input.left = false; });
        }
        if (touchRight) {
            touchRight.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.right = true; });
            touchRight.addEventListener('touchend', (e) => { e.preventDefault(); this.input.right = false; });
        }
        if (touchFlip) {
            touchFlip.addEventListener('touchstart', (e) => { e.preventDefault(); this.triggerGravityFlip(); });
        }
        if (touchBoost) {
            touchBoost.addEventListener('touchstart', (e) => { e.preventDefault(); this.triggerBoost(); });
        }
    }

    /**
     * Cập nhật giao diện Trạng thái Nút Âm thanh ở góc màn hình
     */
    updateMuteUI(isMuted) {
        if (!this.audioIconSvg || !this.audioStatusLabel) return;

        if (isMuted) {
            // Biểu tượng loa bị gạch chéo
            this.audioIconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />';
            this.audioIconSvg.parentElement.className = 'text-gray-500 flex items-center justify-center w-6 h-6';
            this.audioStatusLabel.innerText = 'TẮT [M]';
            this.audioStatusLabel.className = 'text-xs font-orbitron font-bold text-gray-500 tracking-wider';
            if (this.audioWaveBars) {
                this.audioWaveBars.classList.add('hidden');
            }
            if (this.btnAudioToggle) {
                this.btnAudioToggle.style.borderColor = 'rgba(107, 114, 128, 0.4)';
                this.btnAudioToggle.style.boxShadow = 'none';
            }
        } else {
            // Biểu tượng loa phát sóng âm neon
            this.audioIconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />';
            this.audioIconSvg.parentElement.className = 'text-neonCyan flex items-center justify-center w-6 h-6';
            this.audioStatusLabel.innerText = 'BẬT [M]';
            this.audioStatusLabel.className = 'text-xs font-orbitron font-bold text-neonCyan tracking-wider';
            if (this.audioWaveBars) {
                this.audioWaveBars.classList.remove('hidden');
            }
            if (this.btnAudioToggle) {
                this.btnAudioToggle.style.borderColor = 'rgba(0, 243, 255, 0.4)';
                this.btnAudioToggle.style.boxShadow = '0 0 20px rgba(0, 243, 255, 0.35)';
            }
        }
    }

    /**
     * Nạp model 3D .glb tùy chọn với cơ chế Fallback tự động
     */
    loadCustomShipModel(url) {
        if (!this.modelStatusBadge) return;

        this.modelStatusBadge.innerText = '⌛ ĐANG TẢI MODEL .GLB (DÙNG FALLBACK)...';
        this.modelStatusBadge.className = 'text-[10px] font-orbitron px-2.5 py-0.5 rounded-full border border-yellow-500/50 text-yellow-300 bg-yellow-950/60 shadow-lg animate-pulse';

        this.player.loadModelFromURL(
            url,
            // Tiến trình tải (Progress)
            (percent) => {
                if (this.modelStatusBadge) {
                    this.modelStatusBadge.innerText = `⌛ ĐANG TẢI: ${Math.round(percent)}% (DÙNG FALLBACK)...`;
                }
            },
            // Tải thành công (Success)
            (gltf) => {
                if (this.modelStatusBadge) {
                    this.modelStatusBadge.innerText = '✓ ĐÃ TẢI MODEL .GLB THÀNH CÔNG!';
                    this.modelStatusBadge.className = 'text-[10px] font-orbitron px-2.5 py-0.5 rounded-full border border-green-500/50 text-green-300 bg-green-950/60 shadow-lg';
                }
                localStorage.setItem('cyber_drift_model_url', url);
                this.showAlert("CUSTOM 3D MODEL DEPLOYED!", "#00ffcc");
            },
            // Tải thất bại (Error) -> Khối 3D mặc định giữ vững làm fallback
            (err) => {
                if (this.modelStatusBadge) {
                    this.modelStatusBadge.innerText = '⚠️ LỖI TẢI - ĐÃ DÙNG KHỐI 3D FALLBACK';
                    this.modelStatusBadge.className = 'text-[10px] font-orbitron px-2.5 py-0.5 rounded-full border border-red-500/50 text-red-300 bg-red-950/60 shadow-lg';
                }
                this.showAlert("FALLBACK TO PROCEDURAL MESH", "#ff0077");
            }
        );
    }

    /**
     * Đăng ký sự kiện bàn phím
     */
    setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
                this.input.left = true;
            }
            if (e.code === 'KeyD' || e.code === 'ArrowRight') {
                this.input.right = true;
            }
            if (e.code === 'KeyW' || e.code === 'ArrowUp') {
                this.input.up = true;
            }
            if (e.code === 'KeyS' || e.code === 'ArrowDown') {
                this.input.down = true;
            }

            // SPACEBAR: Kích hoạt Tăng Tốc Hyper-Boost & Kéo Giãn Góc Nhìn FOV Warp
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.state === GAME_STATE.PLAYING) {
                    this.triggerBoost();
                }
            }

            // Phím G hoặc Phím F: Đảo trọng lực Antigravity Flip hoặc Boost phụ
            if (e.code === 'KeyG') {
                if (this.state === GAME_STATE.PLAYING) {
                    this.triggerGravityFlip();
                }
            }

            if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                if (this.state === GAME_STATE.PLAYING) {
                    this.triggerBoost();
                }
            }

            // Phím P hoặc ESC: Tạm dừng game
            if (e.code === 'KeyP' || e.code === 'Escape') {
                if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED) {
                    this.togglePause();
                }
            }

            // Phím M: Tắt / Mở âm thanh
            if (e.code === 'KeyM') {
                const muted = this.soundEngine.toggleMute();
                this.updateMuteUI(muted);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
                this.input.left = false;
            }
            if (e.code === 'KeyD' || e.code === 'ArrowRight') {
                this.input.right = false;
            }
            if (e.code === 'KeyW' || e.code === 'ArrowUp') {
                this.input.up = false;
            }
            if (e.code === 'KeyS' || e.code === 'ArrowDown') {
                this.input.down = false;
            }
        });
    }

    /**
     * Kích hoạt đảo trọng lực trần / sàn
     */
    triggerGravityFlip() {
        this.player.toggleGravity();
        this.soundEngine.playGravityFlip();
        this.showAlert(this.player.isCeiling ? "GRAVITY INVERTED: CEILING" : "GRAVITY RESTORED: FLOOR", "#00f3ff");

        // Camera tilt nhẹ tạo cảm giác quán tính
        if (gsap) {
            gsap.to(this.renderer.camera.rotation, {
                z: this.player.isCeiling ? 0.08 : -0.08,
                duration: 0.25,
                yoyo: true,
                repeat: 1,
                ease: "power2.out"
            });
        }
    }

    /**
     * Kích hoạt Hyper-Boost với hiệu ứng kéo giãn góc nhìn FOV Warp (Spacebar)
     */
    triggerBoost() {
        const success = this.physics.activateBoost();
        if (success) {
            this.showAlert("HYPER-BOOST FOV WARP ENGAGED!", "#ff0077");

            // Hiệu ứng GSAP FOV Warp kéo giãn thấu kính từ 65 lên 98 độ
            if (gsap) {
                gsap.killTweensOf(this.renderer.camera);
                gsap.killTweensOf(this.renderer.baseCameraPos);

                gsap.to(this.renderer.camera, {
                    fov: 98,
                    duration: 0.35,
                    ease: "power2.out",
                    onUpdate: () => this.renderer.camera.updateProjectionMatrix()
                });

                // Camera lùi nhẹ về sau tạo cảm giác siêu gia tốc
                gsap.to(this.renderer.baseCameraPos, {
                    z: 9.8,
                    duration: 0.35,
                    ease: "power2.out"
                });
            }
        }
    }

    /**
     * Hiển thị dòng chữ thông báo trên HUD
     */
    showAlert(text, color = "#00f3ff") {
        if (!this.hudAlert) return;
        this.hudAlert.innerText = text;
        this.hudAlert.style.color = color;
        this.hudAlert.style.textShadow = `0 0 15px ${color}`;

        if (gsap) {
            gsap.killTweensOf(this.hudAlert);
            gsap.fromTo(this.hudAlert,
                { opacity: 1, scale: 1.25, y: -10 },
                { opacity: 0, scale: 1.0, y: -30, duration: 1.2, ease: "power2.out" }
            );
        }
    }

    /**
     * Bắt đầu trò chơi mới từ Menu
     */
    startGame() {
        this.soundEngine.init();
        this.soundEngine.playUIClick();

        this.score = 0;
        this.multiplier = 1;
        this.crystalsCollected = 0;

        this.player.reset();
        this.world.reset();
        this.physics.reset();

        this.uiMenu.classList.add('hidden');
        this.uiGameOver.classList.add('hidden');
        this.uiPause.classList.add('hidden');
        this.uiHud.classList.remove('hidden');

        // Hiệu ứng GSAP Camera Intro: Lướt từ phía sau vào góc chơi chuẩn
        this.renderer.camera.position.set(0, 10, 22);
        if (gsap) {
            gsap.to(this.renderer.camera.position, {
                x: 0,
                y: 3.5,
                z: 8.5,
                duration: 1.2,
                ease: "power3.out"
            });
        }

        this.state = GAME_STATE.PLAYING;
        this.showAlert("SYSTEM ENGAGED - GOOD LUCK!", "#00ffcc");
    }

    /**
     * Chơi lại tức thì không cần reload trình duyệt
     */
    restartGame() {
        this.startGame();
    }

    /**
     * Tạm dừng hoặc tiếp tục chơi
     */
    togglePause() {
        if (this.state === GAME_STATE.PLAYING) {
            this.state = GAME_STATE.PAUSED;
            this.uiPause.classList.remove('hidden');
        } else if (this.state === GAME_STATE.PAUSED) {
            this.state = GAME_STATE.PLAYING;
            this.uiPause.classList.add('hidden');
            this.clock.getDelta(); // Bỏ qua khoảng delta khi đang pause
        }
    }

    /**
     * Quay lại màn hình Menu chính
     */
    returnToMenu() {
        this.state = GAME_STATE.MENU;
        this.uiMenu.classList.remove('hidden');
        this.uiHud.classList.add('hidden');
        this.uiGameOver.classList.add('hidden');
        this.uiPause.classList.add('hidden');

        this.player.reset();
        this.world.reset();
        this.updateLeaderboardUI();
    }

    /**
     * Xử lý va chạm -> Rung màn hình Camera Shake + Nổ vỡ thành mảnh 3D + Game Over
     */
    handleGameOver() {
        if (this.state === GAME_STATE.GAMEOVER) return;
        this.state = GAME_STATE.GAMEOVER;

        // 1. Kích hoạt hiệu ứng nổ vỡ thành nhiều mảnh 3D nhỏ (3D Debris Explosion)
        this.player.trigger3DExplosion();

        // 2. Kích hoạt hiệu ứng Rung màn hình cực mạnh (Camera Shake)
        this.renderer.triggerCameraShake(1.35, 0.85);

        // 3. Hiệu ứng chớp đỏ màn hình cảnh báo va chạm hủy diệt
        const flashEl = document.getElementById('screen-flash');
        if (flashEl) {
            flashEl.style.opacity = '1';
            setTimeout(() => { flashEl.style.opacity = '0'; }, 220);
        }

        // 4. Hồi phục FOV camera về mặc định
        if (gsap) {
            gsap.to(this.renderer.camera, {
                fov: this.renderer.baseFov,
                duration: 0.5,
                ease: "power2.out",
                onUpdate: () => this.renderer.camera.updateProjectionMatrix()
            });
            gsap.to(this.renderer.baseCameraPos, {
                z: 8.5,
                duration: 0.5
            });
        }

        // 5. Kiểm tra Kỷ lục mới (High Score)
        const isNewRecord = this.score > this.highScore;
        if (isNewRecord) {
            this.highScore = Math.floor(this.score);
            localStorage.setItem('cyber_drift_highscore', this.highScore);
            this.newHighScoreBanner.classList.remove('hidden');
        } else {
            this.newHighScoreBanner.classList.add('hidden');
        }

        // Cập nhật thông số màn hình Game Over
        this.finalScoreEl.innerText = Math.floor(this.score).toLocaleString();
        this.finalHighEl.innerText = this.highScore.toLocaleString();
        this.finalCrystalsEl.innerText = this.crystalsCollected;
        this.finalDistanceEl.innerText = `${Math.floor(this.world.distanceTraveled)}m`;

        // 6. Trì hoãn 0.85s để người chơi quan sát cảnh tượng các mảnh vỡ 3D bay tản mác trước khi hiện modal
        setTimeout(() => {
            if (this.state === GAME_STATE.GAMEOVER) {
                this.uiGameOver.classList.remove('hidden');
                this.uiHud.classList.add('hidden');
            }
        }, 850);
    }

    /**
     * Xử lý khi người chơi thu thập Tinh thể Năng lượng
     */
    handleCollectCrystal() {
        this.crystalsCollected++;
        this.score += 150 * this.multiplier;
        this.comboTimer = 4.0; // Giữ combo trong 4 giây

        // Tăng multiplier tối đa x4
        if (this.crystalsCollected % 4 === 0 && this.multiplier < 4) {
            this.multiplier++;
            this.showAlert(`COMBO MULTIPLIER x${this.multiplier}!`, "#ffdd00");
        }

        // Hiệu ứng GSAP nảy điểm số
        if (gsap && this.hudScore) {
            gsap.fromTo(this.hudScore,
                { scale: 1.3, color: '#00ffcc' },
                { scale: 1.0, color: '#ffffff', duration: 0.3 }
            );
        }
    }

    /**
     * Cập nhật danh sách điểm cao trên giao diện Menu
     */
    updateLeaderboardUI() {
        const topEl = document.getElementById('menu-highscore');
        if (topEl) {
            topEl.innerText = this.highScore.toLocaleString();
        }
    }

    /**
     * Vòng lặp Render và Logic chính theo chuẩn Delta-Time
     */
    animate() {
        requestAnimationFrame(this.animate);

        let delta = this.clock.getDelta();
        // Giới hạn delta tối đa 0.1s để chống giật lag khi người dùng chuyển tab
        delta = Math.min(delta, 0.1);

        // Tính toán FPS thực tế
        this.fpsFrames++;
        this.fpsTime += delta;
        if (this.fpsTime >= 0.5) {
            this.currentFPS = Math.round(this.fpsFrames / this.fpsTime);
            if (this.hudFPS) this.hudFPS.innerText = `${this.currentFPS} FPS`;
            this.fpsFrames = 0;
            this.fpsTime = 0;
        }

        // Trạng thái MENU: Phi thuyền bay lơ lửng trình diễn
        if (this.state === GAME_STATE.MENU) {
            const time = this.clock.getElapsedTime();
            this.player.mesh.position.y = -1.2 + Math.sin(time * 2.0) * 0.3;
            this.player.mesh.position.x = Math.sin(time * 1.2) * 1.4;
            this.player.mesh.rotation.z = Math.sin(time * 1.2) * -0.15;
            this.world.update(delta * 0.4, false);
            this.renderer.render();
            return;
        }

        // Trạng thái PAUSED: Giữ nguyên khung hình
        if (this.state === GAME_STATE.PAUSED) {
            this.renderer.render();
            return;
        }

        // Trạng thái GAMEOVER: Tiếp tục render mảnh vỡ 3D và rung camera
        if (this.state === GAME_STATE.GAMEOVER) {
            this.renderer.updateCameraShake(delta);
            this.player.update(delta, this.input, false);
            this.world.update(delta * 0.2, false);
            this.renderer.render();
            return;
        }

        // Trạng thái PLAYING: Cập nhật cơ học game đầy đủ
        if (this.state === GAME_STATE.PLAYING) {
            const isBoosting = this.physics.isBoosting;

            // Cập nhật rung màn hình nếu đang có hiệu ứng
            this.renderer.updateCameraShake(delta);

            // 1. Cập nhật vị trí & điều khiển của phi thuyền
            this.player.update(delta, this.input, isBoosting);

            // 2. Cập nhật chuyển động thế giới, chướng ngại vật & sao
            this.world.update(delta, isBoosting);

            // 3. Cập nhật vật lý, năng lượng boost & kiểm tra va chạm
            this.physics.update(
                delta,
                () => this.handleGameOver(),
                () => this.handleCollectCrystal()
            );

            // 4. Tính điểm số (Tăng dần theo khoảng cách + tốc độ)
            const scorePerSec = (this.world.currentSpeed * 1.2) * this.multiplier;
            this.score += scorePerSec * delta;

            // Giảm dần combo multiplier nếu lâu không nhặt tinh thể
            if (this.comboTimer > 0) {
                this.comboTimer -= delta;
                if (this.comboTimer <= 0) {
                    this.multiplier = 1;
                }
            }

            // Hồi phục Camera FOV và Camera Z mượt mà khi kết thúc boost
            if (!isBoosting) {
                if (this.renderer.camera.fov > this.renderer.baseFov) {
                    this.renderer.camera.fov = THREE.MathUtils.lerp(this.renderer.camera.fov, this.renderer.baseFov, delta * 4.0);
                    this.renderer.camera.updateProjectionMatrix();
                }
                this.renderer.baseCameraPos.z = THREE.MathUtils.lerp(this.renderer.baseCameraPos.z, 8.5, delta * 4.0);
            }

            // 5. Cập nhật các chỉ số lên HUD
            if (this.hudScore) {
                this.hudScore.innerText = Math.floor(this.score).toLocaleString();
            }
            if (this.hudMultiplier) {
                this.hudMultiplier.innerText = `x${this.multiplier}`;
                this.hudMultiplier.style.color = this.multiplier > 1 ? '#00f3ff' : '#6b7280';
            }
            if (this.hudSpeed) {
                const speedKmh = Math.floor(this.world.currentSpeed * 3.6);
                this.hudSpeed.innerText = `${speedKmh} KM/H`;
            }
            if (this.hudEnergyBar) {
                const energyPercent = Math.floor((this.physics.boostEnergy / this.physics.maxEnergy) * 100);
                this.hudEnergyBar.style.width = `${energyPercent}%`;
                if (this.hudEnergyText) {
                    this.hudEnergyText.innerText = `${energyPercent}%`;
                }

                if (isBoosting) {
                    this.hudEnergyBar.style.backgroundColor = '#ff0077';
                    this.hudEnergyBar.style.boxShadow = '0 0 16px #ff0077';
                } else {
                    this.hudEnergyBar.style.backgroundColor = '#00f3ff';
                    this.hudEnergyBar.style.boxShadow = '0 0 12px #00f3ff';
                }
            }
        }

        // Render cảnh 3D qua EffectComposer & UnrealBloomPass
        this.renderer.render();
    }
}

// Khởi chạy khi tài liệu tải xong
window.addEventListener('DOMContentLoaded', () => {
    window.game = new CyberDriftGame();
});
