import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Quản lý WebGL Renderer, Scene, Camera và Hiệu ứng Hậu kỳ Bloom (UnrealBloomPass),
 * cùng Hệ thống Rung Màn hình Camera Shake và Kéo Giãn FOV Warp.
 */
export class GameRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // 1. Khởi tạo Scene với màu đen vũ trụ Cyberpunk và Sương mù sương khói
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020308);
        this.scene.fog = new THREE.FogExp2(0x050716, 0.013);

        // 2. Camera góc nhìn thứ 3 bám sau phi thuyền
        this.camera = new THREE.PerspectiveCamera(65, this.width / this.height, 0.1, 800);
        this.baseCameraPos = new THREE.Vector3(0, 3.5, 8.5);
        this.camera.position.copy(this.baseCameraPos);
        this.camera.lookAt(0, 0, -15);
        this.baseFov = 65;

        // Quản lý hiệu ứng rung màn hình Camera Shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;

        // 3. WebGL Renderer tối ưu hóa hiệu năng
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        // 4. Ánh sáng Neon Cyberpunk (Cyan & Magenta)
        this.setupLights();

        // 5. Post-Processing: EffectComposer + UnrealBloomPass tạo hiệu ứng phát sáng neon rực rỡ
        this.setupPostProcessing();

        // 6. Lắng nghe sự kiện thay đổi kích thước màn hình
        window.addEventListener('resize', () => this.onWindowResize());
    }

    /**
     * Thiết lập hệ thống ánh sáng phong cách Cyberpunk
     */
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x0a1026, 1.4);
        this.scene.add(ambientLight);

        const cyanDirLight = new THREE.DirectionalLight(0x00f3ff, 2.0);
        cyanDirLight.position.set(-15, 20, 10);
        this.scene.add(cyanDirLight);

        const magentaDirLight = new THREE.DirectionalLight(0xff0077, 2.0);
        magentaDirLight.position.set(15, -10, 10);
        this.scene.add(magentaDirLight);

        const frontLight = new THREE.DirectionalLight(0x00ffaa, 1.2);
        frontLight.position.set(0, 0, -100);
        this.scene.add(frontLight);
    }

    /**
     * Khởi tạo chuỗi hiệu ứng hậu kỳ Bloom
     */
    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.width, this.height),
            1.6,   // Cường độ sáng
            0.45,  // Bán kính tỏa sáng
            0.22   // Ngưỡng phát sáng
        );
        this.composer.addPass(this.bloomPass);
    }

    /**
     * Kích hoạt hiệu ứng Rung Màn hình Camera Shake cực mạnh khi va chạm
     */
    triggerCameraShake(intensity = 0.9, duration = 0.65) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeTimer = 0;
    }

    /**
     * Cập nhật biên độ rung theo hàm suy giảm phân rã (Decay)
     */
    updateCameraShake(delta) {
        if (this.shakeTimer < this.shakeDuration) {
            this.shakeTimer += delta;
            const progress = this.shakeTimer / this.shakeDuration;
            // Độ suy giảm phi tuyến tính mượt mà
            const decay = Math.max(0, (1 - progress) ** 2);
            const currentAmp = this.shakeIntensity * decay;

            // Rung giật vị trí
            this.camera.position.x = this.baseCameraPos.x + (Math.random() - 0.5) * currentAmp * 1.4;
            this.camera.position.y = this.baseCameraPos.y + (Math.random() - 0.5) * currentAmp * 1.2;
            this.camera.position.z = this.baseCameraPos.z + (Math.random() - 0.5) * currentAmp * 0.8;

            // Nghiêng giật góc quay
            this.camera.rotation.z = (Math.random() - 0.5) * currentAmp * 0.15;
            this.camera.rotation.x = (Math.random() - 0.5) * currentAmp * 0.08;
        } else if (this.shakeDuration > 0) {
            // Khôi phục vị trí camera ban đầu
            this.shakeDuration = 0;
            this.camera.position.copy(this.baseCameraPos);
            this.camera.rotation.z = 0;
            this.camera.rotation.x = 0;
        }
    }

    /**
     * Xử lý khi người dùng co giãn cửa sổ trình duyệt
     */
    onWindowResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        if (this.composer) {
            this.composer.setSize(this.width, this.height);
        }
        if (this.bloomPass) {
            this.bloomPass.resolution.set(this.width, this.height);
        }
    }

    /**
     * Render một khung hình thông qua Post-Processing
     */
    render() {
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}
