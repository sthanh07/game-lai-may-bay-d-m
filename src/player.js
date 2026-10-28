import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Lớp đại diện cho Phi thuyền người chơi (Player Spaceship)
 * Hỗ trợ GLTFLoader để nạp model 3D .glb tùy chỉnh,
 * đồng thời giữ nguyên khối 3D thủ tục (Procedural Mesh) làm Fallback hoàn hảo
 * nếu đường link chưa tải xong hoặc gặp sự cố mạng.
 */
export class PlayerShip {
    constructor(scene) {
        this.scene = scene;

        // Nhóm gốc chứa toàn bộ các thành phần của tàu
        this.mesh = new THREE.Group();
        this.scene.add(this.mesh);

        // Nhóm thân vỏ tàu có thể ẩn/hiện khi phát nổ
        this.shipBody = new THREE.Group();
        this.mesh.add(this.shipBody);

        // 1. Nhóm khối 3D thủ tục mặc định (Default Procedural Mesh Fallback)
        this.proceduralBody = new THREE.Group();
        this.shipBody.add(this.proceduralBody);

        // 2. Nhóm chứa model 3D tùy chỉnh tải từ GLTF/GLB
        this.customModelGroup = new THREE.Group();
        this.shipBody.add(this.customModelGroup);
        this.customModelGroup.visible = false; // Mặc định ẩn cho đến khi tải xong

        // Trạng thái nạp model
        this.isUsingCustomModel = false;
        this.isLoadingModel = false;
        this.gltfLoader = new GLTFLoader();

        // Vị trí mặc định
        this.laneWidth = 6.8;
        this.floorY = -2.6;
        this.ceilingY = 2.6;
        this.isCeiling = false;

        // Tọa độ mục tiêu và tọa độ hiện tại (dùng để nội suy mượt mà - Lerp)
        this.targetX = 0;
        this.currentX = 0;
        this.targetY = this.floorY;
        this.currentY = this.floorY;

        // Góc quay động (Roll & Pitch)
        this.targetRoll = 0;
        this.currentRoll = 0;
        this.targetPitch = 0;
        this.currentPitch = 0;
        this.flipAngle = 0; // Góc xoay lật 180 độ khi đổi trọng lực

        // Trạng thái sống sót
        this.isDestroyed = false;

        // Kích thước Bounding Box (AABB) cho va chạm
        this.boundingBox = new THREE.Box3();

        // Xây dựng mô hình 3D thủ tục mặc định (Luôn có sẵn 100%)
        this.buildProceduralShip();

        // Xây dựng hệ thống hạt khói lửa động cơ (Thruster Particle Trail)
        this.setupThrusterParticles();

        // Xây dựng hệ thống mảnh vỡ 3D khi tàu bị hủy (3D Hull Debris Chunks)
        this.setup3DDebris();

        // Đèn pha gắn trên tàu
        this.setupShipLight();

        this.reset();
    }

    /**
     * Tải model 3D định dạng .glb tùy chỉnh với cơ chế Fallback mượt mà
     */
    loadModelFromURL(url, onProgress, onSuccess, onError) {
        if (!url || typeof url !== 'string') return;

        this.isLoadingModel = true;
        console.log(`🚀 Bắt đầu tải model 3D từ URL: ${url}`);

        // Trong quá trình tải, khối Procedural mặc định vẫn tiếp tục hiển thị làm Fallback
        this.proceduralBody.visible = true;

        this.gltfLoader.load(
            url,
            // 1. Tải thành công
            (gltf) => {
                this.isLoadingModel = false;
                console.log('✅ Model 3D .GLB đã tải thành công!');

                // Dọn dẹp model cũ trong nhóm custom nếu có
                while (this.customModelGroup.children.length > 0) {
                    const obj = this.customModelGroup.children[0];
                    this.customModelGroup.remove(obj);
                }

                const loadedModel = gltf.scene;

                // Chuẩn hóa kích thước và căn giữa mô hình (Normalize Scale & Center)
                const bbox = new THREE.Box3().setFromObject(loadedModel);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const center = new THREE.Vector3();
                bbox.getCenter(center);

                // Dịch chuyển tâm về gốc tọa độ
                loadedModel.position.x = -center.x;
                loadedModel.position.y = -center.y;
                loadedModel.position.z = -center.z;

                // Cân đối tỉ lệ scale sao cho chiều lớn nhất vừa vặn khoảng 3.6 unit
                const maxDim = Math.max(size.x, size.y, size.z);
                const targetScale = 3.6 / (maxDim || 1);
                this.customModelGroup.scale.set(targetScale, targetScale, targetScale);

                // Duyệt qua tất cả các mesh con để tối ưu đổ bóng & vật liệu
                loadedModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        // Tăng độ phát quang nhẹ nếu có vật liệu
                        if (child.material) {
                            child.material.roughness = Math.min(child.material.roughness, 0.4);
                        }
                    }
                });

                this.customModelGroup.add(loadedModel);

                // Kích hoạt hiển thị model tùy chỉnh và ẩn khối procedural fallback
                this.customModelGroup.visible = true;
                this.proceduralBody.visible = false;
                this.isUsingCustomModel = true;

                if (onSuccess) {
                    onSuccess(gltf);
                }
            },
            // 2. Tiến trình tải
            (xhr) => {
                if (xhr.lengthComputable && onProgress) {
                    const percentComplete = (xhr.loaded / xhr.total) * 100;
                    onProgress(percentComplete);
                }
            },
            // 3. Xử lý lỗi: Giữ nguyên khối 3D Procedural mặc định
            (err) => {
                this.isLoadingModel = false;
                this.isUsingCustomModel = false;
                this.proceduralBody.visible = true;
                this.customModelGroup.visible = false;
                console.warn('⚠️ Không thể tải tệp model 3D, tiếp tục sử dụng khối 3D mặc định (Fallback):', err);

                if (onError) {
                    onError(err);
                }
            }
        );
    }

    /**
     * Khôi phục về khối 3D Procedural mặc định
     */
    useDefaultProceduralModel() {
        this.isUsingCustomModel = false;
        this.proceduralBody.visible = true;
        this.customModelGroup.visible = false;
    }

    /**
     * Tạo hình khối phi thuyền không gian bằng các khối hình học cơ bản của Three.js
     * (Khối 3D mặc định chạy tức thì không cần tải mạng)
     */
    buildProceduralShip() {
        const hullMaterial = new THREE.MeshStandardMaterial({
            color: 0x141824,
            roughness: 0.25,
            metalness: 0.85,
            flatShading: true
        });

        const cyanNeonMaterial = new THREE.MeshStandardMaterial({
            color: 0x00f3ff,
            emissive: 0x00f3ff,
            emissiveIntensity: 2.2,
            roughness: 0.1,
            metalness: 0.5
        });

        const magentaNeonMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0077,
            emissive: 0xff0077,
            emissiveIntensity: 2.0,
            roughness: 0.1,
            metalness: 0.5
        });

        const cockpitMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x0088cc,
            emissiveIntensity: 1.5,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.9
        });

        // 1. Thân chính hình chóp khí động học (Main Fuselage)
        const bodyGeo = new THREE.ConeGeometry(0.75, 3.2, 5);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMesh = new THREE.Mesh(bodyGeo, hullMaterial);
        bodyMesh.scale.set(1.1, 0.45, 1.0);
        bodyMesh.castShadow = true;
        this.proceduralBody.add(bodyMesh);

        // 2. Kính buồng lái lăng trụ phát quang (Cockpit)
        const cockpitGeo = new THREE.CylinderGeometry(0.25, 0.45, 1.4, 4);
        cockpitGeo.rotateX(Math.PI / 2);
        const cockpitMesh = new THREE.Mesh(cockpitGeo, cockpitMaterial);
        cockpitMesh.position.set(0, 0.22, -0.2);
        cockpitMesh.scale.set(0.8, 0.45, 0.9);
        this.proceduralBody.add(cockpitMesh);

        // 3. Cánh trái và cánh phải (Swept Wings)
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.lineTo(2.4, -0.6);
        wingShape.lineTo(2.2, -1.5);
        wingShape.lineTo(0, -0.9);
        wingShape.closePath();

        const extrudeSettings = { depth: 0.08, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wingGeo.rotateX(Math.PI / 2);

        // Cánh phải
        const rightWing = new THREE.Mesh(wingGeo, hullMaterial);
        rightWing.position.set(0.3, 0.05, 0.3);
        this.proceduralBody.add(rightWing);

        // Cánh trái (lật ngược trục X)
        const leftWing = rightWing.clone();
        leftWing.scale.set(-1, 1, 1);
        leftWing.position.set(-0.3, 0.05, 0.3);
        this.proceduralBody.add(leftWing);

        // 4. Dải đèn Neon trên rìa mép cánh
        const wingStripGeo = new THREE.BoxGeometry(2.3, 0.05, 0.08);
        const rightStrip = new THREE.Mesh(wingStripGeo, magentaNeonMaterial);
        rightStrip.position.set(1.4, 0.1, -0.2);
        rightStrip.rotation.y = -Math.PI / 12;
        this.proceduralBody.add(rightStrip);

        const leftStrip = rightStrip.clone();
        leftStrip.position.set(-1.4, 0.1, -0.2);
        leftStrip.rotation.y = Math.PI / 12;
        this.proceduralBody.add(leftStrip);

        // 5. Hai ống xả động cơ Plasma kép phía sau (Dual Plasma Engines)
        const engineGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.9, 8);
        engineGeo.rotateX(Math.PI / 2);

        const engineLeft = new THREE.Mesh(engineGeo, hullMaterial);
        engineLeft.position.set(-0.6, 0.05, 1.2);
        this.proceduralBody.add(engineLeft);

        const engineRight = new THREE.Mesh(engineGeo, hullMaterial);
        engineRight.position.set(0.6, 0.05, 1.2);
        this.proceduralBody.add(engineRight);

        // Lõi phát quang Plasma trong ống xả
        const exhaustCoreGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.2, 8);
        exhaustCoreGeo.rotateX(Math.PI / 2);

        this.leftPlasmaExhaust = new THREE.Mesh(exhaustCoreGeo, cyanNeonMaterial);
        this.leftPlasmaExhaust.position.set(-0.6, 0.05, 1.65);
        this.proceduralBody.add(this.leftPlasmaExhaust);

        this.rightPlasmaExhaust = new THREE.Mesh(exhaustCoreGeo, cyanNeonMaterial);
        this.rightPlasmaExhaust.position.set(0.6, 0.05, 1.65);
        this.proceduralBody.add(this.rightPlasmaExhaust);

        // 6. Vây ổn định đuôi đứng (Vertical Tail Stabilizer)
        const finGeo = new THREE.BoxGeometry(0.08, 0.8, 0.9);
        const fin = new THREE.Mesh(finGeo, hullMaterial);
        fin.position.set(0, 0.5, 0.8);
        fin.rotation.x = -Math.PI / 8;
        this.proceduralBody.add(fin);

        const finGlowGeo = new THREE.BoxGeometry(0.1, 0.8, 0.08);
        const finGlow = new THREE.Mesh(finGlowGeo, cyanNeonMaterial);
        finGlow.position.set(0, 0.55, 1.0);
        finGlow.rotation.x = -Math.PI / 8;
        this.proceduralBody.add(finGlow);
    }

    /**
     * Đèn pha PointLight chiếu sáng gắn ngay trên mũi phi thuyền
     */
    setupShipLight() {
        this.shipLight = new THREE.PointLight(0x00f3ff, 3.5, 25);
        this.shipLight.position.set(0, 0.3, -1.8);
        this.shipBody.add(this.shipLight);

        // Đèn đuôi phát quang màu hồng tím
        this.tailLight = new THREE.PointLight(0xff0077, 2.0, 10);
        this.tailLight.position.set(0, 0.2, 2.0);
        this.shipBody.add(this.tailLight);
    }

    /**
     * Hệ thống hạt khói plasma phun từ động cơ phản lực
     */
    setupThrusterParticles() {
        this.particleCount = 90;
        this.particlesData = [];

        const pGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);

        const cyanColor = new THREE.Color(0x00f3ff);
        const magentaColor = new THREE.Color(0xff00aa);

        for (let i = 0; i < this.particleCount; i++) {
            positions[i * 3 + 0] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;

            const c = (i % 2 === 0) ? cyanColor : magentaColor;
            colors[i * 3 + 0] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            this.particlesData.push({
                x: 0,
                y: 0,
                z: 0,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                vz: 8.0 + Math.random() * 12.0,
                life: Math.random(),
                maxLife: 0.25 + Math.random() * 0.2
            });
        }

        pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const pMat = new THREE.PointsMaterial({
            size: 0.28,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(pGeo, pMat);
        this.scene.add(this.particleSystem);
    }

    /**
     * Khởi tạo hệ thống mảnh vỡ 3D hình học văng tung toé khi tàu bị tiêu diệt
     */
    setup3DDebris() {
        this.debrisCount = 52;
        this.debrisGroup = new THREE.Group();
        this.scene.add(this.debrisGroup);
        this.debrisData = [];

        const debrisMaterials = [
            new THREE.MeshStandardMaterial({
                color: 0x00f3ff,
                emissive: 0x00f3ff,
                emissiveIntensity: 2.8,
                roughness: 0.2
            }),
            new THREE.MeshStandardMaterial({
                color: 0xff0077,
                emissive: 0xff0077,
                emissiveIntensity: 2.8,
                roughness: 0.2
            }),
            new THREE.MeshStandardMaterial({
                color: 0x1a2035,
                metalness: 0.9,
                roughness: 0.2,
                flatShading: true
            })
        ];

        const geometries = [
            new THREE.TetrahedronGeometry(0.35, 0),
            new THREE.OctahedronGeometry(0.28, 0),
            new THREE.BoxGeometry(0.3, 0.15, 0.45),
            new THREE.ConeGeometry(0.2, 0.45, 4)
        ];

        for (let i = 0; i < this.debrisCount; i++) {
            const geo = geometries[i % geometries.length];
            const mat = debrisMaterials[i % debrisMaterials.length];
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            this.debrisGroup.add(mesh);

            this.debrisData.push({
                mesh: mesh,
                active: false,
                vx: 0, vy: 0, vz: 0,
                rx: 0, ry: 0, rz: 0,
                scale: 1,
                life: 0,
                maxLife: 1.8
            });
        }
    }

    /**
     * Kích hoạt hiệu ứng nổ vỡ thành nhiều mảnh 3D nhỏ khi tàu va chạm hủy diệt
     */
    trigger3DExplosion() {
        this.isDestroyed = true;
        this.shipBody.visible = false;
        if (this.particleSystem) {
            this.particleSystem.visible = false;
        }

        const centerPos = this.mesh.position.clone();

        for (let i = 0; i < this.debrisCount; i++) {
            const d = this.debrisData[i];
            d.active = true;
            d.life = 0;
            d.maxLife = 1.4 + Math.random() * 0.8;
            d.scale = 0.8 + Math.random() * 0.6;

            d.mesh.position.set(
                centerPos.x + (Math.random() - 0.5) * 1.8,
                centerPos.y + (Math.random() - 0.5) * 1.2,
                centerPos.z + (Math.random() - 0.5) * 2.2
            );
            d.mesh.scale.set(d.scale, d.scale, d.scale);
            d.mesh.visible = true;

            const angleTheta = Math.random() * Math.PI * 2;
            const anglePhi = Math.acos(2 * Math.random() - 1);
            const speed = 14.0 + Math.random() * 22.0;

            d.vx = Math.sin(anglePhi) * Math.cos(angleTheta) * speed;
            d.vy = Math.sin(anglePhi) * Math.sin(angleTheta) * speed;
            d.vz = Math.cos(anglePhi) * speed * 0.6;

            d.rx = (Math.random() - 0.5) * 16.0;
            d.ry = (Math.random() - 0.5) * 16.0;
            d.rz = (Math.random() - 0.5) * 16.0;
        }
    }

    /**
     * Cập nhật chuyển động bay và tan biến của các mảnh vỡ 3D
     */
    update3DDebris(delta) {
        if (!this.isDestroyed) return;

        for (let i = 0; i < this.debrisCount; i++) {
            const d = this.debrisData[i];
            if (d.active) {
                d.life += delta;
                if (d.life >= d.maxLife) {
                    d.active = false;
                    d.mesh.visible = false;
                } else {
                    d.mesh.position.x += d.vx * delta;
                    d.mesh.position.y += d.vy * delta;
                    d.mesh.position.z += d.vz * delta;

                    d.vx *= (1 - 1.2 * delta);
                    d.vy *= (1 - 1.2 * delta);
                    d.vz *= (1 - 1.2 * delta);

                    d.mesh.rotation.x += d.rx * delta;
                    d.mesh.rotation.y += d.ry * delta;
                    d.mesh.rotation.z += d.rz * delta;

                    const progress = d.life / d.maxLife;
                    const curScale = Math.max(0.01, d.scale * (1 - progress));
                    d.mesh.scale.set(curScale, curScale, curScale);
                }
            }
        }
    }

    /**
     * Cập nhật chuyển động của các hạt phản lực
     */
    updateParticles(delta, isBoosting) {
        if (!this.particleSystem || this.isDestroyed) return;

        const posAttr = this.particleSystem.geometry.attributes.position;
        const positions = posAttr.array;

        const leftExhaustWorld = new THREE.Vector3(-0.6, 0.05, 1.8).applyMatrix4(this.mesh.matrixWorld);
        const rightExhaustWorld = new THREE.Vector3(0.6, 0.05, 1.8).applyMatrix4(this.mesh.matrixWorld);

        const speedMultiplier = isBoosting ? 2.4 : 1.0;

        for (let i = 0; i < this.particleCount; i++) {
            const p = this.particlesData[i];
            p.life += delta;

            if (p.life >= p.maxLife) {
                p.life = 0;
                const source = (i % 2 === 0) ? leftExhaustWorld : rightExhaustWorld;
                p.x = source.x + (Math.random() - 0.5) * 0.15;
                p.y = source.y + (Math.random() - 0.5) * 0.15;
                p.z = source.z;
                p.vx = (Math.random() - 0.5) * (isBoosting ? 0.8 : 0.4);
                p.vy = (Math.random() - 0.5) * (isBoosting ? 0.8 : 0.4);
                p.vz = (10.0 + Math.random() * 18.0) * speedMultiplier;
            } else {
                p.x += p.vx * delta;
                p.y += p.vy * delta;
                p.z += p.vz * delta;
            }

            positions[i * 3 + 0] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
        }

        posAttr.needsUpdate = true;
    }

    /**
     * Kích hoạt đổi trọng lực Antigravity Flip (Lộn ngược trần/sàn)
     */
    toggleGravity() {
        if (this.isDestroyed) return;
        this.isCeiling = !this.isCeiling;
        this.targetY = this.isCeiling ? this.ceilingY : this.floorY;
    }

    /**
     * Cập nhật vị trí, góc nghiêng và tính toán AABB
     */
    update(delta, input, isBoosting) {
        if (this.isDestroyed) {
            this.update3DDebris(delta);
            return;
        }

        // 1. Xử lý di chuyển ngang tự do trong hành lang
        const moveSpeed = 16.0;
        if (input.left) {
            this.targetX -= moveSpeed * delta;
        }
        if (input.right) {
            this.targetX += moveSpeed * delta;
        }

        this.targetX = Math.max(-this.laneWidth, Math.min(this.laneWidth, this.targetX));

        // 2. Tinh chỉnh độ cao nhẹ theo phím W/S hoặc Up/Down
        let pitchOffsetY = 0;
        if (input.up) {
            pitchOffsetY = this.isCeiling ? -0.8 : 0.8;
            this.targetPitch = this.isCeiling ? 0.2 : -0.2;
        } else if (input.down) {
            pitchOffsetY = this.isCeiling ? 0.8 : -0.8;
            this.targetPitch = this.isCeiling ? -0.2 : 0.2;
        } else {
            this.targetPitch = 0;
        }

        const effectiveTargetY = this.targetY + pitchOffsetY;

        // 3. Nội suy vị trí mượt mà (Lerp)
        const lerpFactorX = 1 - Math.exp(-12 * delta);
        const lerpFactorY = 1 - Math.exp(-9 * delta);
        const prevX = this.currentX;

        this.currentX += (this.targetX - this.currentX) * lerpFactorX;
        this.currentY += (effectiveTargetY - this.currentY) * lerpFactorY;

        this.mesh.position.x = this.currentX;
        this.mesh.position.y = this.currentY;
        this.mesh.position.z = 0;

        // 4. Góc nghiêng thân tàu khi lượn trái/phải (Bank Roll)
        const horizontalVelocity = (this.currentX - prevX) / (delta || 0.016);
        this.targetRoll = -horizontalVelocity * 0.035;
        this.targetRoll = Math.max(-0.65, Math.min(0.65, this.targetRoll));

        const targetFlip = this.isCeiling ? Math.PI : 0;
        const lerpFlip = 1 - Math.exp(-8 * delta);
        this.flipAngle += (targetFlip - this.flipAngle) * lerpFlip;

        this.currentRoll += (this.targetRoll - this.currentRoll) * (1 - Math.exp(-10 * delta));
        this.currentPitch += (this.targetPitch - this.currentPitch) * (1 - Math.exp(-10 * delta));

        this.mesh.rotation.z = this.flipAngle + (this.isCeiling ? -this.currentRoll : this.currentRoll);
        this.mesh.rotation.x = this.currentPitch;
        this.mesh.rotation.y = -this.targetRoll * 0.4;

        // 5. Hiệu ứng động cơ khi Boost
        if (isBoosting) {
            if (this.leftPlasmaExhaust) this.leftPlasmaExhaust.scale.set(1.4, 2.0, 1.4);
            if (this.rightPlasmaExhaust) this.rightPlasmaExhaust.scale.set(1.4, 2.0, 1.4);
            this.shipLight.intensity = 6.0;
        } else {
            if (this.leftPlasmaExhaust) this.leftPlasmaExhaust.scale.set(1.0, 1.0, 1.0);
            if (this.rightPlasmaExhaust) this.rightPlasmaExhaust.scale.set(1.0, 1.0, 1.0);
            this.shipLight.intensity = 3.5;
        }

        // 6. Cập nhật khói lửa hạt động cơ
        this.updateParticles(delta, isBoosting);

        // 7. Cập nhật AABB Bounding Box để kiểm tra va chạm
        this.boundingBox.setFromObject(this.shipBody);
    }

    /**
     * Đặt lại trạng thái ban đầu của phi thuyền
     */
    reset() {
        this.isDestroyed = false;
        this.shipBody.visible = true;

        if (this.isUsingCustomModel) {
            this.customModelGroup.visible = true;
            this.proceduralBody.visible = false;
        } else {
            this.proceduralBody.visible = true;
            this.customModelGroup.visible = false;
        }

        if (this.particleSystem) {
            this.particleSystem.visible = true;
        }

        for (let d of this.debrisData) {
            d.active = false;
            d.mesh.visible = false;
        }

        this.isCeiling = false;
        this.targetX = 0;
        this.currentX = 0;
        this.targetY = this.floorY;
        this.currentY = this.floorY;
        this.targetRoll = 0;
        this.currentRoll = 0;
        this.targetPitch = 0;
        this.currentPitch = 0;
        this.flipAngle = 0;

        this.mesh.position.set(0, this.floorY, 0);
        this.mesh.rotation.set(0, 0, 0);
        this.boundingBox.setFromObject(this.shipBody);
    }
}
