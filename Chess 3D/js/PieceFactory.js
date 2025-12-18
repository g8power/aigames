import * as THREE from 'three';

export class PieceFactory {
    constructor() {
        this.materials = {
            white: new THREE.MeshStandardMaterial({ 
                color: 0xffffff, roughness: 0.1, metalness: 0.1,
                envMapIntensity: 1.0 
            }),
            black: new THREE.MeshStandardMaterial({ 
                color: 0x111111, roughness: 0.2, metalness: 0.4,
                envMapIntensity: 1.0 
            })
        };
    }

    // 建立棋子剖面圖的點 (Points)
    getProfile(type) {
        const points = [];
        const push = (x, y) => points.push(new THREE.Vector2(x, y));

        // 通用底座
        push(0, 0); push(0.4, 0); push(0.4, 0.1); push(0.3, 0.15);

        if (type === 'p') { // 兵 Pawn
            push(0.3, 0.15); push(0.15, 0.4); push(0.1, 0.6); 
            push(0.12, 0.65); push(0.08, 0.7); // 脖子
            // 頭 (球型擬合)
            for(let i=0; i<=5; i++) push(0.18 * Math.sin(i/5*Math.PI), 0.7 + 0.18 - 0.18*Math.cos(i/5*Math.PI));
        } else if (type === 'r') { // 車 Rook
            push(0.3, 0.15); push(0.25, 0.6); push(0.3, 0.8);
            push(0.2, 0.8); push(0.2, 0.7); // 城堡內凹
        } else if (type === 'b') { // 主教 Bishop
            push(0.25, 0.2); push(0.1, 0.6); push(0.15, 0.75);
            // 尖頭
            push(0.02, 0.95); push(0.05, 1.0); push(0, 1.05);
        } else if (type === 'q') { // 皇后 Queen
            push(0.3, 0.2); push(0.15, 0.6); push(0.25, 0.9);
            push(0.28, 0.95); push(0.1, 0.95); push(0.15, 1.1); push(0, 1.15);
        } else if (type === 'k') { // 國王 King
            push(0.35, 0.2); push(0.2, 0.7); push(0.3, 0.95);
            push(0.2, 1.0); push(0, 1.25); // 十字架會在別處處理
        } 
        
        // 騎士比較特殊，不能只用車床，這裡我們先做一個底座，然後組合幾何體
        else if (type === 'n') {
            push(0.3, 0.15); push(0.2, 0.4); push(0, 0.45);
        }

        return points;
    }

    createPiece(char) {
        const type = char.toLowerCase();
        const mat = (char === char.toUpperCase()) ? this.materials.white : this.materials.black;
        const group = new THREE.Group();

        // 1. 生成身體 (Lathe)
        const points = this.getProfile(type);
        const latheGeo = new THREE.LatheGeometry(points, 32);
        const body = new THREE.Mesh(latheGeo, mat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // 2. 特殊細節處理
        if (type === 'k') {
            // 十字架
            const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), mat);
            crossV.position.y = 1.35;
            const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.08), mat);
            crossH.position.y = 1.35;
            group.add(crossV, crossH);
        }
        else if (type === 'n') {
            // 騎士的馬頭 (簡單的幾何拼接，做出馬的輪廓)
            const headGeo = new THREE.BoxGeometry(0.25, 0.4, 0.5);
            const head = new THREE.Mesh(headGeo, mat);
            head.position.set(0, 0.7, 0.1);
            head.rotation.x = -Math.PI / 8;
            
            // 鬃毛
            const maneGeo = new THREE.BoxGeometry(0.05, 0.4, 0.1);
            const mane = new THREE.Mesh(maneGeo, mat);
            mane.position.set(0, 0.75, -0.2);

            group.add(head, mane);
        }

        return group;
    }
}