import * as THREE from 'three';

/**
 * Xử lý phát hiện va chạm AABB 3D, Quản lý Hệ thống Năng lượng và Hyper-Boost
 */
export class PhysicsEngine {
    constructor(player, world, soundEngine) {
        this.player = player;
        this.world = world;
        this.soundEngine = soundEngine;

        // Quản lý năng lượng Hyper-Boost (0 - 100%)
        this.boostEnergy = 50;
        this.maxEnergy = 100;
        this.isBoosting = false;
        this.boostDuration = 3.5;
        this.boostTimer = 0;

        // Tạm thời bất khả xâm phạm sau khi va chạm hoặc trong khi boost
        this.invulnerableTimer = 0;
    }

    /**
     * Kích hoạt chế độ Hyper-Boost
     */
    activateBoost() {
        if (this.boostEnergy >= 30 && !this.isBoosting) {
            this.isBoosting = true;
            this.boostTimer = this.boostDuration;
            this.soundEngine.playHyperBoost();
            return true;
        }
        return false;
    }

    /**
     * Cập nhật năng lượng, thời gian boost và kiểm tra va chạm
     */
    update(delta, onCrashCallback, onCollectCrystalCallback) {
        // 1. Quản lý Boost & Hồi năng lượng
        if (this.isBoosting) {
            this.boostTimer -= delta;
            // Tiêu hao năng lượng tương ứng theo thời gian
            this.boostEnergy = Math.max(0, this.boostEnergy - (this.maxEnergy / this.boostDuration) * delta);

            if (this.boostTimer <= 0 || this.boostEnergy <= 0) {
                this.isBoosting = false;
                this.boostTimer = 0;
            }
        } else {
            // Năng lượng tự phục hồi thụ động chậm dần
            this.boostEnergy = Math.min(this.maxEnergy, this.boostEnergy + 4.5 * delta);
        }

        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer -= delta;
        }

        // 2. Thu nhỏ hộp va chạm AABB của người chơi một chút (Padding) để gameplay công bằng và mượt mà hơn
        const playerBox = this.player.boundingBox.clone();
        playerBox.expandByScalar(-0.15);

        // 3. Kiểm tra va chạm với Tinh thể Năng lượng (Crystals)
        for (let crystal of this.world.crystals) {
            if (crystal.active) {
                if (playerBox.intersectsBox(crystal.boundingBox)) {
                    // Thu thập tinh thể thành công!
                    crystal.active = false;
                    crystal.mesh.visible = false;

                    // Hồi phục 20% thanh năng lượng Boost
                    this.boostEnergy = Math.min(this.maxEnergy, this.boostEnergy + 20);

                    // Hiệu ứng âm thanh và chùm hạt nổ Cyan
                    this.soundEngine.playCrystalCollect();
                    this.world.triggerExplosion(
                        crystal.mesh.position.x,
                        crystal.mesh.position.y,
                        crystal.mesh.position.z,
                        0x00ffcc,
                        25
                    );

                    if (onCollectCrystalCallback) {
                        onCollectCrystalCallback();
                    }
                }
            }
        }

        // 4. Kiểm tra va chạm với Chướng ngại vật (Obstacles)
        for (let obstacle of this.world.obstacles) {
            if (obstacle.active) {
                const obstacleBox = obstacle.boundingBox.clone();
                obstacleBox.expandByScalar(-0.18);

                if (playerBox.intersectsBox(obstacleBox)) {
                    if (this.isBoosting) {
                        // Khi đang ở trạng thái Hyper-Boost: Phá hủy tan tành chướng ngại vật cản đường!
                        obstacle.active = false;
                        obstacle.mesh.visible = false;
                        this.world.triggerExplosion(
                            obstacle.mesh.position.x,
                            obstacle.mesh.position.y,
                            obstacle.mesh.position.z,
                            0xff0044,
                            40
                        );
                        this.soundEngine.playCrashExplosion();
                    } else if (this.invulnerableTimer <= 0) {
                        // Va chạm khi không có boost -> Game Over
                        this.world.triggerExplosion(
                            this.player.mesh.position.x,
                            this.player.mesh.position.y,
                            this.player.mesh.position.z,
                            0xff0055,
                            50
                        );
                        this.soundEngine.playCrashExplosion();

                        if (onCrashCallback) {
                            onCrashCallback();
                        }
                        break;
                    }
                }
            }
        }
    }

    /**
     * Đặt lại trạng thái vật lý
     */
    reset() {
        this.boostEnergy = 60;
        this.isBoosting = false;
        this.boostTimer = 0;
        this.invulnerableTimer = 0;
    }
}
