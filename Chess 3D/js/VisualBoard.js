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

        // 建立一個變數來阻擋重複觸發
        let isTouchInteraction = false;

        const handleInput = (clientX, clientY, isTouch) => {
            // 如果是滑鼠點擊，但剛剛才發生過觸控，則忽略這次滑鼠點擊 (防止雙重觸發)
            if (!isTouch && isTouchInteraction) {
                isTouchInteraction = false; // 重置旗標
                return; 
            }
            if (isTouch) isTouchInteraction = true;

            this.checkIntersection(clientX, clientY);
        };

        // --- 滑鼠 ---
        this.renderer.domElement.addEventListener('click', (e) => {
            handleInput(e.clientX, e.clientY, false);
        });

        // --- 觸控 ---
        let touchStartX = 0, touchStartY = 0;

        this.renderer.domElement.addEventListener('touchstart', (e) => {
            if(e.touches.length > 0) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: false });

        this.renderer.domElement.addEventListener('touchend', (e) => {
            if(e.changedTouches.length > 0) {
                // 關鍵：阻止瀏覽器產生額外的 click 事件
                e.preventDefault(); 
                
                const x = e.changedTouches[0].clientX;
                const y = e.changedTouches[0].clientY;
                
                // 防手抖：移動太遠視為旋轉視角
                if (Math.abs(x - touchStartX) < 10 && Math.abs(y - touchStartY) < 10) {
                    handleInput(x, y, true);
                }
            }
        }, { passive: false });

        // ... resize 監聽保持不變 ...
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
        // --- 修正 1: 絕對禁止原地移動 (防止自殺 BUG) ---
        if (from === to) return;

        const piece = this.pieces[from];
        const victim = this.pieces[to];
        const type = boardState[to];

        if (!piece) {
            this.spawnPieces(boardState);
            return;
        }

        // --- 修正 2: 替身攻擊 (防止繼承死亡狀態) ---
        if (victim) {
            if (captured) {
                // 建立替身 (Clone)
                const clone = victim.clone();
                clone.position.copy(victim.position);
                clone.rotation.copy(victim.rotation);
                
                // 確保材質獨立
                clone.traverse((node) => {
                    if (node.isMesh) node.material = node.material.clone();
                });
                
                this.scene.add(clone);

                // 立刻刪除真身 (讓位給攻擊者)
                this.scene.remove(victim);
                // 對替身播放死亡動畫
                this.animator.killPiece(clone);
            } else {
                // 如果不是吃子 (幽靈)，直接刪除
                this.scene.remove(victim);
            }
            this.pieces[to] = null;
        }

        // 更新陣列
        this.pieces[to] = piece;
        this.pieces[from] = null;

        // 計算目標
        const targetPos = this.getCoord(to);

        // --- 修正 3: 移動前強制重置狀態 ---
        piece.visible = true;
        piece.scale.set(1, 1, 1);
        piece.position.y = 0;
        piece.rotation.x = 0;
        piece.rotation.z = 0;

        // 執行移動
        await this.animator.movePiece(piece, targetPos, type);

        // 最終校正
        if (piece) {
            piece.position.copy(targetPos);
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