import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PieceFactory } from './PieceFactory.js';
import { Animator } from './Animator.js';

export class VisualBoard {
    constructor(containerId, onSquareClick) {
        this.factory = new PieceFactory();
        this.animator = new Animator();
        this.pieces = new Array(64).fill(null);
        this.onClickCallback = onSquareClick;

        this.initScene();
        this.createBoard();
        this.createInteractionLayer(); // 新增：隱形互動層
        this.setupInteraction();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(3.5, 12, 12); // 調整相機中心點，對齊棋盤中心

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(3.5, 0, 3.5); // 鎖定棋盤中心 (0~7 的中心是 3.5)

        // 燈光
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 15, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        // 擴大陰影範圍確保覆蓋全棋盤
        dirLight.shadow.camera.left = -10;
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.top = 10;
        dirLight.shadow.camera.bottom = -10;
        this.scene.add(dirLight);
    }

    // 核心方法：統一管理座標，解決模型脫離問題
    getCoord(index) {
        const x = index % 8;
        const z = Math.floor(index / 8);
        return new THREE.Vector3(x, 0, z);
    }

    createBoard() {
        const boardGroup = new THREE.Group();
        const matLight = new THREE.MeshStandardMaterial({ color: 0xebecd0, roughness: 0.5 });
        const matDark = new THREE.MeshStandardMaterial({ color: 0x779556, roughness: 0.5 });

        for (let i = 0; i < 64; i++) {
            const x = i % 8;
            const z = Math.floor(i / 8);
            const isLight = (x + z) % 2 === 0;
            const geo = new THREE.BoxGeometry(1, 0.2, 1);
            const square = new THREE.Mesh(geo, isLight ? matLight : matDark);
            
            // 使用統一坐標，並稍微往下移一點點，讓棋子站在 0 平面上
            const pos = this.getCoord(i);
            square.position.set(pos.x, -0.1, pos.z);
            
            square.receiveShadow = true;
            boardGroup.add(square);
        }
        
        // 木框
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(9, 0.15, 9),
            new THREE.MeshStandardMaterial({ color: 0x4d3319 })
        );
        frame.position.set(3.5, -0.2, 3.5);
        frame.receiveShadow = true;
        boardGroup.add(frame);
        
        this.scene.add(boardGroup);

        // 提示光圈
        this.highlightMesh = new THREE.Mesh(
            new THREE.RingGeometry(0.35, 0.45, 32),
            new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
        );
        this.highlightMesh.rotation.x = -Math.PI/2;
        this.highlightMesh.visible = false;
        this.scene.add(this.highlightMesh);
        
        this.dotsGroup = new THREE.Group();
        this.scene.add(this.dotsGroup);
    }

    // --- 關鍵修正：建立隱形互動層 ---
    createInteractionLayer() {
        // 創建一個覆蓋整個棋盤的透明平面 (8x8 大小)
        const geometry = new THREE.PlaneGeometry(8, 8);
        // visible: false 代表看不見，但在 Raycaster 中仍然可以檢測到 (只要設定 recursive 或直接檢測它)
        // 但為了保險，我們設為 visible: true 但 opacity: 0
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, visible: false }); 
        
        this.interactionPlane = new THREE.Mesh(geometry, material);
        this.interactionPlane.rotation.x = -Math.PI / 2; // 躺平
        this.interactionPlane.position.set(3.5, 0.05, 3.5); // 稍微浮在格子上方一點點，防止被遮擋
        this.scene.add(this.interactionPlane);
    }

    setupInteraction() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // 手機觸控邏輯變數
        let touchStartX = 0;
        let touchStartY = 0;
        let isDragging = false;

        const handleInputStart = (x, y) => {
            touchStartX = x;
            touchStartY = y;
            isDragging = false;
        };

        const handleInputEnd = (x, y) => {
            // 計算移動距離
            const dx = Math.abs(x - touchStartX);
            const dy = Math.abs(y - touchStartY);

            // 如果移動超過 5px，視為旋轉鏡頭，不是點擊
            if (dx > 5 || dy > 5) return;

            // 執行點擊檢測
            this.checkIntersection(x, y);
        };

        // 滑鼠事件
        this.renderer.domElement.addEventListener('mousedown', (e) => handleInputStart(e.clientX, e.clientY));
        this.renderer.domElement.addEventListener('mouseup', (e) => handleInputEnd(e.clientX, e.clientY));

        // 觸控事件 (重要：passive: false 允許我們控制行為)
        this.renderer.domElement.addEventListener('touchstart', (e) => {
            if(e.touches.length > 0) handleInputStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        this.renderer.domElement.addEventListener('touchend', (e) => {
            if(e.changedTouches.length > 0) {
                // e.preventDefault(); // 在某些手機瀏覽器防止雙擊縮放
                handleInputEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
            }
        }, { passive: false });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.animate();
    }

    checkIntersection(clientX, clientY) {
        this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // --- 關鍵修正：只檢測隱形互動層 ---
        // 這樣無論棋子多大、擋住哪裡，我們永遠檢測的是「平面上的座標」
        const intersects = this.raycaster.intersectObject(this.interactionPlane);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            // 將世界座標轉換為棋盤格索引 (0~7)
            const x = Math.round(point.x);
            const z = Math.round(point.z);

            // 邊界檢查
            if (x >= 0 && x < 8 && z >= 0 && z < 8) {
                const index = z * 8 + x;
                this.onClickCallback(index);
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // --- 遊戲狀態同步 ---

    spawnPieces(logicBoard) {
        // 1. 徹底清除舊棋子
        this.pieces.forEach(p => { 
            if(p) {
                // 關鍵：先殺死動畫，再刪除模型
                import('gsap').then(({default: gsap}) => gsap.killTweensOf(p));
                this.scene.remove(p);
                // 釋放資源
                p.traverse((node) => {
                    if (node.isMesh) {
                        node.geometry.dispose();
                        node.material.dispose();
                    }
                });
            } 
        });
        this.pieces.fill(null);

        // 2. 重新生成
        for(let i=0; i<64; i++) {
            const char = logicBoard[i];
            if(char !== '.') {
                const mesh = this.factory.createPiece(char);
                const pos = this.getCoord(i);
                mesh.position.copy(pos);
                
                if(char.toLowerCase() === 'n') {
                    mesh.rotation.y = (char === 'N') ? Math.PI/2 : -Math.PI/2;
                }
                
                this.scene.add(mesh);
                this.pieces[i] = mesh;
            }
        }
    }

    async performMove(from, to, boardState, captured) {
        const piece = this.pieces[from];
        const victim = this.pieces[to];
        const type = boardState[to];

        // 1. 防呆：如果來源棋子不見了，強制重繪
        if (!piece) {
            this.spawnPieces(boardState);
            return;
        }

        // 2. 清理來源位置
        this.pieces[from] = null;

        // 3. 處理吃子邏輯 (替身模式)
        if (victim) {
            // 如果是吃子 (captured = true)
            if (captured) {
                // A. 建立替身 (Clone)
                const clone = victim.clone();
                clone.position.copy(victim.position);
                clone.rotation.copy(victim.rotation);
                
                // B. 確保替身材質也是獨立的 (避免影響其他棋子)
                clone.traverse((node) => {
                    if (node.isMesh) node.material = node.material.clone();
                });
                
                this.scene.add(clone);

                // C. 立刻刪除真身 (讓位給攻擊者)
                this.scene.remove(victim);
                
                // D. 對替身播放死亡動畫 (這不會影響到任何人)
                this.animator.killPiece(clone);
            } else {
                // 如果不是吃子 (可能是殘留的幽靈)，直接刪除
                this.scene.remove(victim);
            }
            
            // 確保陣列位置清空
            this.pieces[to] = null;
        }

        // 4. 更新陣列：攻擊者就位
        this.pieces[to] = piece;

        // 5. 準備移動攻擊者
        const targetPos = this.getCoord(to);

        // 強制重置攻擊者的狀態 (以防萬一它身上有殘留動畫)
        // 這一步非常重要！確保它是「滿血」狀態
        piece.visible = true;
        piece.scale.set(1, 1, 1);
        // 修正：不要重置 rotation.y，因為騎士的方向要保留
        piece.rotation.x = 0;
        piece.rotation.z = 0;
        piece.position.y = 0;

        // 6. 執行移動動畫
        await this.animator.movePiece(piece, targetPos, type);

        // 7. 動畫結束後的最終校正
        if (piece) {
            piece.position.copy(targetPos);
            piece.position.y = 0;
            piece.scale.set(1, 1, 1);
        }
    }

    updateHighlights(selected, moves) {
        if (selected !== -1) {
            const pos = this.getCoord(selected);
            this.highlightMesh.position.set(pos.x, 0.02, pos.z);
            this.highlightMesh.visible = true;
        } else {
            this.highlightMesh.visible = false;
        }

        while(this.dotsGroup.children.length > 0) { 
            this.dotsGroup.remove(this.dotsGroup.children[0]); 
        }

        moves.forEach(idx => {
            const pos = this.getCoord(idx);
            const dot = new THREE.Mesh(
                new THREE.CircleGeometry(0.15, 16),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 })
            );
            dot.rotation.x = -Math.PI/2;
            dot.position.set(pos.x, 0.05, pos.z); // 稍微調高，防止被棋盤遮擋
            this.dotsGroup.add(dot);
        });
    }
}