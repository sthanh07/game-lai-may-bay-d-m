import * as THREE from 'three';

/**
 * Quản lý Môi trường Vũ trụ Cyberpunk, Lưới Sàn/Trần Động, Bầu trời Sao, Cổng Lượng tử
 * và Hệ thống Tái sử dụng Đối tượng (Object Pooling) cho Chướng ngại vật & Tinh thể Năng lượng.
 */
export class GameWorld {
    constructor(scene) {
        this.scene = scene;

        // Tốc độ và tiến trình của thế giới
        this.baseSpeed = 38.0;
        this.currentSpeed = this.baseSpeed;
        this.maxSpeed = 115.0;
        this.distanceTraveled = 0;
        this.survivalTime = 0;

        // Nhóm chứa toàn bộ vật thể của thế giới
        this.worldGroup = new THREE.Group();
        this.scene.add(this.worldGroup);

        // 1. Tạo vân lưới Neon (Procedural Canvas Texture)
        this.createGridTexture();

        // 2. Tạo sàn và trần hành lang
        this.createCorridorSurfaces();

        // 3. Tạo bầu trời 2,500 hạt sao không gian (Warp Starfield)
        this.createStarfield();

        // 4. Tạo các vòng cổng Neon bát giác định kỳ (Speed Rings)
        this.createSpeedRings();

        // 5. Khởi tạo Object Pool cho Chướng ngại vật (Obstacles)
        this.initObstaclePool();

        // 6. Khởi tạo Object Pool cho Tinh thể Năng lượng (Crystals)
        this.initCrystalPool();

        // 7. Khởi tạo Hệ thống hạt nổ (Explosion Particles Pool)
        this.initExplosionPool();

        // Biến kiểm soát nhịp sinh vật thể
        this.spawnZ = -180;
        this.nextSpawnDistance = 24;
    }

    /**
     * Tự động sinh hoa văn lưới Neon bằng Canvas 2D trong bộ nhớ RAM (Zero file tải ngoài)
     */
    createGridTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#02040b';
        ctx.fillRect(0, 0, 256, 256);

        // Vẽ đường viền lưới phát sáng
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 10;
        ctx.strokeRect(0, 0, 256, 256);

        // Lưới phụ mờ hơn bên trong
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(128, 0); ctx.lineTo(128, 256);
        ctx.moveTo(0, 128); ctx.lineTo(256, 128);
        ctx.stroke();

        this.gridTexture = new THREE.CanvasTexture(canvas);
        this.gridTexture.wrapS = THREE.RepeatWrapping;
        this.gridTexture.wrapT = THREE.RepeatWrapping;
        this.gridTexture.repeat.set(6, 40);
    }

    /**
     * Tạo bề mặt sàn, trần và các rào chắn lan can năng lượng phát sáng
     */
    createCorridorSurfaces() {
        const corridorWidth = 20;
        const corridorLength = 400;

        const gridMaterial = new THREE.MeshBasicMaterial({
            map: this.gridTexture,
            transparent: true,
            opacity: 0.9,
            depthWrite: true
        });

        // Sàn nhà (Floor)
        const floorGeo = new THREE.PlaneGeometry(corridorWidth, corridorLength);
        this.floorMesh = new THREE.Mesh(floorGeo, gridMaterial);
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.position.set(0, -3.8, -corridorLength / 2 + 30);
        this.worldGroup.add(this.floorMesh);

        // Trần nhà (Ceiling)
        this.ceilingMesh = new THREE.Mesh(floorGeo, gridMaterial);
        this.ceilingMesh.rotation.x = Math.PI / 2;
        this.ceilingMesh.position.set(0, 3.8, -corridorLength / 2 + 30);
        this.worldGroup.add(this.ceilingMesh);

        // Các dải chùm tia năng lượng lan can hai bên (Side Beams)
        const beamMat = new THREE.MeshStandardMaterial({
            color: 0xff0077,
            emissive: 0xff0077,
            emissiveIntensity: 3.0,
            roughness: 0.2
        });
        const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, corridorLength, 6);
        beamGeo.rotateX(Math.PI / 2);

        // 4 thanh dầm phát quang dọc theo 4 góc hành lang
        const beamPositions = [
            [-corridorWidth / 2, -3.8],
            [corridorWidth / 2, -3.8],
            [-corridorWidth / 2, 3.8],
            [corridorWidth / 2, 3.8]
        ];

        beamPositions.forEach(([x, y]) => {
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.set(x, y, -corridorLength / 2 + 30);
            this.worldGroup.add(beam);
        });
    }

    /**
     * Bầu trời sao 2,500 điểm bay vụt về phía camera (Starfield)
     */
    createStarfield() {
        this.starCount = 2500;
        const starGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.starCount * 3);
        const colors = new Float32Array(this.starCount * 3);

        this.starSpeeds = new Float32Array(this.starCount);

        const colorPalette = [
            new THREE.Color(0x00f3ff), // Cyan
            new THREE.Color(0xffffff), // White
            new THREE.Color(0xff00aa), // Magenta
            new THREE.Color(0x7b2cbf)  // Purple
        ];

        for (let i = 0; i < this.starCount; i++) {
            // Phân bố trong một hình hộp chữ nhật kéo dài về phía trước (-Z)
            positions[i * 3 + 0] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 2] = -Math.random() * 350;

            const chosenColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i * 3 + 0] = chosenColor.r;
            colors[i * 3 + 1] = chosenColor.g;
            colors[i * 3 + 2] = chosenColor.b;

            this.starSpeeds[i] = 0.8 + Math.random() * 0.7;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starMat = new THREE.PointsMaterial({
            size: 0.35,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.starfield = new THREE.Points(starGeo, starMat);
        this.worldGroup.add(this.starfield);
    }

    /**
     * Các cổng neon bát giác xuất hiện định kỳ (Speed Rings)
     */
    createSpeedRings() {
        this.speedRings = [];
        const ringGeo = new THREE.TorusGeometry(5.2, 0.08, 6, 8); // Hình bát giác mềm
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x00f3ff,
            emissive: 0x00f3ff,
            emissiveIntensity: 2.2,
            roughness: 0.2
        });

        for (let i = 0; i < 6; i++) {
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(0, 0, -i * 50 - 30);
            this.worldGroup.add(ring);
            this.speedRings.push(ring);
        }
    }

    /**
     * Khởi tạo Object Pool cho Chướng ngại vật (Obstacles)
     */
    initObstaclePool() {
        this.obstaclePoolSize = 25;
        this.obstacles = [];

        // Vật liệu phát sáng đỏ rực nguy hiểm
        const hazardMat = new THREE.MeshStandardMaterial({
            color: 0xff0044,
            emissive: 0xff0033,
            emissiveIntensity: 2.8,
            roughness: 0.2,
            metalness: 0.8
        });

        // Vật liệu khung kim loại tối
        const frameMat = new THREE.MeshStandardMaterial({
            color: 0x111118,
            roughness: 0.4,
            metalness: 0.9
        });

        for (let i = 0; i < this.obstaclePoolSize; i++) {
            const group = new THREE.Group();

            // Loại 1: Rào chắn laser ngang (Horizontal Laser Gate)
            const horizontalGroup = new THREE.Group();
            const barGeo = new THREE.CylinderGeometry(0.18, 0.18, 7.5, 8);
            barGeo.rotateZ(Math.PI / 2);
            const barMesh = new THREE.Mesh(barGeo, hazardMat);
            horizontalGroup.add(barMesh);

            const postGeo = new THREE.BoxGeometry(0.5, 1.8, 0.5);
            const postLeft = new THREE.Mesh(postGeo, frameMat);
            postLeft.position.set(-3.75, 0, 0);
            horizontalGroup.add(postLeft);
            const postRight = postLeft.clone();
            postRight.position.set(3.75, 0, 0);
            horizontalGroup.add(postRight);

            // Loại 2: Cột năng lượng đứng (Vertical Plasma Column)
            const verticalGroup = new THREE.Group();
            const colGeo = new THREE.CylinderGeometry(0.35, 0.35, 5.0, 8);
            const colMesh = new THREE.Mesh(colGeo, hazardMat);
            verticalGroup.add(colMesh);

            // Loại 3: Khối gai năng lượng xoay (Rotating Spike Core)
            const rotatingGroup = new THREE.Group();
            const coreGeo = new THREE.OctahedronGeometry(1.2, 0);
            const coreMesh = new THREE.Mesh(coreGeo, hazardMat);
            rotatingGroup.add(coreMesh);
            const ringGeo = new THREE.TorusGeometry(1.9, 0.1, 4, 16);
            const ringMesh = new THREE.Mesh(ringGeo, hazardMat);
            rotatingGroup.add(ringMesh);

            group.add(horizontalGroup);
            group.add(verticalGroup);
            group.add(rotatingGroup);

            group.visible = false;
            this.worldGroup.add(group);

            this.obstacles.push({
                mesh: group,
                subTypes: {
                    horizontal: horizontalGroup,
                    vertical: verticalGroup,
                    rotating: rotatingGroup
                },
                active: false,
                type: 'horizontal',
                boundingBox: new THREE.Box3(),
                rotSpeed: 0
            });
        }
    }

    /**
     * Khởi tạo Object Pool cho Tinh thể Năng lượng (Crystals)
     */
    initCrystalPool() {
        this.crystalPoolSize = 25;
        this.crystals = [];

        // Tinh thể hình bát diện phát sáng màu Cyan ngọc bích
        const crystalGeo = new THREE.OctahedronGeometry(0.7, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0x00ffcc,
            emissive: 0x00ffbb,
            emissiveIntensity: 2.2,
            roughness: 0.1,
            metalness: 0.8
        });

        // Vòng quầng sáng nhỏ xoay quanh tinh thể
        const ringGeo = new THREE.TorusGeometry(1.0, 0.04, 4, 12);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 1.8
        });

        for (let i = 0; i < this.crystalPoolSize; i++) {
            const group = new THREE.Group();
            const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
            group.add(crystalMesh);

            const haloRing = new THREE.Mesh(ringGeo, ringMat);
            group.add(haloRing);

            group.visible = false;
            this.worldGroup.add(group);

            this.crystals.push({
                mesh: group,
                innerCrystal: crystalMesh,
                haloRing: haloRing,
                active: false,
                boundingBox: new THREE.Box3(),
                baseY: 0,
                floatOffset: Math.random() * Math.PI * 2
            });
        }
    }

    /**
     * Hệ thống hạt nổ năng lượng tái sử dụng (Explosion Particles Pool)
     */
    initExplosionPool() {
        this.explosionCount = 180;
        this.explosionData = [];

        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.explosionCount * 3);
        const colors = new Float32Array(this.explosionCount * 3);

        for (let i = 0; i < this.explosionCount; i++) {
            positions[i * 3 + 0] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 999; // Ẩn khỏi màn hình
            colors[i * 3 + 0] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;

            this.explosionData.push({
                active: false,
                x: 0, y: 0, z: 0,
                vx: 0, vy: 0, vz: 0,
                life: 0,
                maxLife: 0.5
            });
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.4,
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.explosionMesh = new THREE.Points(geo, mat);
        this.worldGroup.add(this.explosionMesh);
    }

    /**
     * Kích hoạt hiệu ứng nổ hạt tại một tọa độ
     */
    triggerExplosion(x, y, z, colorHex = 0x00f3ff, count = 30) {
        const c = new THREE.Color(colorHex);
        let spawned = 0;

        for (let i = 0; i < this.explosionCount && spawned < count; i++) {
            const p = this.explosionData[i];
            if (!p.active) {
                p.active = true;
                p.x = x;
                p.y = y;
                p.z = z;
                p.life = 0;
                p.maxLife = 0.4 + Math.random() * 0.3;

                // Vận tốc bung hình cầu đa hướng
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const speed = 12 + Math.random() * 18;

                p.vx = Math.sin(phi) * Math.cos(theta) * speed;
                p.vy = Math.sin(phi) * Math.sin(theta) * speed;
                p.vz = Math.cos(phi) * speed;

                // Gán màu cho hạt
                const colAttr = this.explosionMesh.geometry.attributes.color.array;
                colAttr[i * 3 + 0] = c.r;
                colAttr[i * 3 + 1] = c.g;
                colAttr[i * 3 + 2] = c.b;

                spawned++;
            }
        }
    }

    /**
     * Tự động sinh vật thể mới dọc theo hành lang
     */
    spawnWorldElements() {
        const laneXs = [-4.6, 0, 4.6]; // 3 làn bay chính
        const isCeilingObstacle = Math.random() > 0.5;
        const obstacleY = isCeilingObstacle ? 2.5 : -2.5;

        // 1. Sinh chướng ngại vật
        const freeObstacle = this.obstacles.find(o => !o.active);
        if (freeObstacle) {
            freeObstacle.active = true;
            freeObstacle.mesh.visible = true;

            const types = ['horizontal', 'vertical', 'rotating'];
            const chosenType = types[Math.floor(Math.random() * types.length)];
            freeObstacle.type = chosenType;

            // Bật sub-type tương ứng
            freeObstacle.subTypes.horizontal.visible = (chosenType === 'horizontal');
            freeObstacle.subTypes.vertical.visible = (chosenType === 'vertical');
            freeObstacle.subTypes.rotating.visible = (chosenType === 'rotating');

            const chosenLaneX = laneXs[Math.floor(Math.random() * laneXs.length)];

            if (chosenType === 'horizontal') {
                // Rào ngang chắn một nửa độ cao (ở sàn hoặc trần)
                freeObstacle.mesh.position.set(0, obstacleY, this.spawnZ);
            } else if (chosenType === 'vertical') {
                // Cột đứng chắn một làn cụ thể
                freeObstacle.mesh.position.set(chosenLaneX, 0, this.spawnZ);
            } else {
                // Khối xoay lơ lửng ở giữa làn
                freeObstacle.mesh.position.set(chosenLaneX, (Math.random() > 0.5 ? 1.8 : -1.8), this.spawnZ);
                freeObstacle.rotSpeed = (Math.random() - 0.5) * 4.0;
            }

            freeObstacle.boundingBox.setFromObject(freeObstacle.mesh);
        }

        // 2. Sinh tinh thể năng lượng tại làn an toàn
        const freeCrystal = this.crystals.find(c => !c.active);
        if (freeCrystal) {
            freeCrystal.active = true;
            freeCrystal.mesh.visible = true;

            // Tìm làn khác với chướng ngại vật để tạo đường bay cho người chơi
            const safeLanes = laneXs.filter(x => {
                if (!freeObstacle) return true;
                return Math.abs(x - freeObstacle.mesh.position.x) > 2.0;
            });
            const crystalX = safeLanes.length > 0
                ? safeLanes[Math.floor(Math.random() * safeLanes.length)]
                : laneXs[Math.floor(Math.random() * laneXs.length)];

            const crystalY = (Math.random() > 0.5) ? 2.5 : -2.5;
            freeCrystal.baseY = crystalY;
            freeCrystal.mesh.position.set(crystalX, crystalY, this.spawnZ - 12);
            freeCrystal.boundingBox.setFromObject(freeCrystal.mesh);
        }
    }

    /**
     * Vòng lặp cập nhật chuyển động của toàn bộ thế giới
     */
    update(delta, isBoosting) {
        this.survivalTime += delta;

        // Tăng dần tốc độ theo thời gian sống sót (Difficulty Scaling)
        const targetBaseSpeed = THREE.MathUtils.clamp(this.baseSpeed + this.survivalTime * 0.85, this.baseSpeed, this.maxSpeed);
        const boostMultiplier = isBoosting ? 1.85 : 1.0;
        this.currentSpeed = targetBaseSpeed * boostMultiplier;

        const frameMoveDist = this.currentSpeed * delta;
        this.distanceTraveled += frameMoveDist;

        // 1. Cuộn hoa văn lưới sàn và trần (UV offset)
        if (this.gridTexture) {
            this.gridTexture.offset.y -= (this.currentSpeed * 0.02) * delta;
        }

        // 2. Cập nhật Starfield bay vụt về phía người chơi
        const starPositions = this.starfield.geometry.attributes.position.array;
        for (let i = 0; i < this.starCount; i++) {
            const zIdx = i * 3 + 2;
            starPositions[zIdx] += this.currentSpeed * this.starSpeeds[i] * delta;
            if (starPositions[zIdx] > 15) {
                starPositions[zIdx] = -320;
                starPositions[i * 3 + 0] = (Math.random() - 0.5) * 80;
                starPositions[i * 3 + 1] = (Math.random() - 0.5) * 50;
            }
        }
        this.starfield.geometry.attributes.position.needsUpdate = true;

        // 3. Cập nhật các vòng tốc độ Neon (Speed Rings)
        for (let ring of this.speedRings) {
            ring.position.z += this.currentSpeed * delta;
            ring.rotation.z += 0.4 * delta;
            if (ring.position.z > 20) {
                ring.position.z -= 300;
            }
        }

        // 4. Cập nhật Chướng ngại vật trong Object Pool
        for (let obstacle of this.obstacles) {
            if (obstacle.active) {
                obstacle.mesh.position.z += this.currentSpeed * delta;

                // Nếu là khối xoay thì quay quanh trục
                if (obstacle.type === 'rotating') {
                    obstacle.subTypes.rotating.rotation.z += obstacle.rotSpeed * delta;
                    obstacle.subTypes.rotating.rotation.x += 1.5 * delta;
                }

                obstacle.boundingBox.setFromObject(obstacle.mesh);

                // Trôi qua khỏi người chơi -> Tái sử dụng
                if (obstacle.mesh.position.z > 15) {
                    obstacle.active = false;
                    obstacle.mesh.visible = false;
                }
            }
        }

        // 5. Cập nhật Tinh thể Năng lượng trong Object Pool
        for (let crystal of this.crystals) {
            if (crystal.active) {
                crystal.mesh.position.z += this.currentSpeed * delta;

                // Tự xoay và nhấp nhô bồng bềnh
                crystal.innerCrystal.rotation.y += 3.0 * delta;
                crystal.innerCrystal.rotation.x += 1.5 * delta;
                crystal.haloRing.rotation.z -= 2.0 * delta;

                crystal.mesh.position.y = crystal.baseY + Math.sin(this.survivalTime * 4 + crystal.floatOffset) * 0.35;
                crystal.boundingBox.setFromObject(crystal.mesh);

                if (crystal.mesh.position.z > 15) {
                    crystal.active = false;
                    crystal.mesh.visible = false;
                }
            }
        }

        // 6. Cập nhật hạt nổ (Explosion Particles)
        const expPos = this.explosionMesh.geometry.attributes.position.array;
        for (let i = 0; i < this.explosionCount; i++) {
            const p = this.explosionData[i];
            if (p.active) {
                p.life += delta;
                if (p.life >= p.maxLife) {
                    p.active = false;
                    expPos[i * 3 + 2] = 999; // Đưa ra ngoài màn hình
                } else {
                    p.x += p.vx * delta;
                    p.y += p.vy * delta;
                    p.z += (p.vz + this.currentSpeed * 0.5) * delta;

                    expPos[i * 3 + 0] = p.x;
                    expPos[i * 3 + 1] = p.y;
                    expPos[i * 3 + 2] = p.z;
                }
            }
        }
        this.explosionMesh.geometry.attributes.position.needsUpdate = true;

        // 7. Nhịp sinh thế giới mới
        this.nextSpawnDistance -= frameMoveDist;
        if (this.nextSpawnDistance <= 0) {
            this.spawnWorldElements();
            // Khoảng cách spawn co ngắn dần khi tốc độ cao để duy trì nhịp độ gay cấn
            this.nextSpawnDistance = Math.max(18, 32 - (this.currentSpeed - this.baseSpeed) * 0.12);
        }
    }

    /**
     * Đặt lại trạng thái ban đầu của thế giới khi chơi lại (Reset Scene)
     */
    reset() {
        this.currentSpeed = this.baseSpeed;
        this.distanceTraveled = 0;
        this.survivalTime = 0;
        this.nextSpawnDistance = 20;

        for (let o of this.obstacles) {
            o.active = false;
            o.mesh.visible = false;
            o.mesh.position.set(0, 0, -999);
        }

        for (let c of this.crystals) {
            c.active = false;
            c.mesh.visible = false;
            c.mesh.position.set(0, 0, -999);
        }

        for (let i = 0; i < this.explosionCount; i++) {
            this.explosionData[i].active = false;
            this.explosionMesh.geometry.attributes.position.array[i * 3 + 2] = 999;
        }
        this.explosionMesh.geometry.attributes.position.needsUpdate = true;
    }
}
