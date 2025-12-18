import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PieceFactory } from './PieceFactory.js';
import { Animator } from './Animator.js';

export class VisualBoard {
    constructor(containerId, onSquareClick) {
        this.factory = new PieceFactory();
        this.animator = new Animator();
        this.pieces = new Array(64).fill(null); // 儲存 Mesh
        this.squares = []; // 儲存格子 Mesh 用於點擊
        this.onClickCallback = onSquareClick;

        this.initScene();
        this.createBoard();
        this.setupInteraction();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 10, 12);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(3.5, 0, 3.5);

        // 燈光
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // 點光源增加戲劇性
        const spot = new THREE.SpotLight(0xffaa00, 5);
        spot.position.set(0, 5, 0);
        spot.angle = Math.PI/4;
        this.scene.add(spot);
    }

    createBoard() {
        const boardGroup = new THREE.Group();
        const matLight = new THREE.MeshStandardMaterial({ color: 0xebecd0, roughness: 0.5 });
        const matDark = new THREE.MeshStandardMaterial({ color: 0x779556, roughness: 0.5 });

        for (let z = 0; z < 8; z++) {
            for (let x = 0; x < 8; x++) {
                const isLight = (x + z) % 2 === 0;
                const geo = new THREE.BoxGeometry(1, 0.2, 1);
                const square = new THREE.Mesh(geo, isLight ? matLight : matDark);
                square.position.set(x, -0.1, z);
                square.receiveShadow = true;
                square.userData = { index: z * 8 + x };
                boardGroup.add(square);
                this.squares.push(square);
            }
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
            new THREE.RingGeometry(0.3, 0.4, 32),
            new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide })
        );
        this.highlightMesh.rotation.x = -Math.PI/2;
        this.highlightMesh.visible = false;
        this.scene.add(this.highlightMesh);
        
        this.dotsGroup = new THREE.Group();
        this.scene.add(this.dotsGroup);
    }

    setupInteraction() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        window.addEventListener('click', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.squares);
            if (intersects.length > 0) {
                this.onClickCallback(intersects[0].object.userData.index);
            }
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // --- 遊戲狀態同步 ---

    spawnPieces(logicBoard) {
        // 清除舊棋子
        this.pieces.forEach(p => { if(p) this.scene.remove(p); });
        this.pieces.fill(null);

        for(let i=0; i<64; i++) {
            const char = logicBoard[i];
            if(char !== '.') {
                const mesh = this.factory.createPiece(char);
                const r = Math.floor(i/8), c = i%8;
                mesh.position.set(c, 0, r);
                
                // 調整面向：騎士
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
        const r = Math.floor(to/8), c = to%8;
        const type = boardState[to]; // 已經是移動後的狀態，取得棋子類型

        this.pieces[to] = piece; // 更新參考
        this.pieces[from] = null;

        // 如果有吃子，執行擊殺動畫
        if(victim && captured) {
            this.animator.killPiece(victim);
        }

        // 執行移動動畫
        await this.animator.movePiece(piece, new THREE.Vector3(c, 0, r), type);
    }

    updateHighlights(selected, moves) {
        if (selected !== -1) {
            const r = Math.floor(selected / 8), c = selected % 8;
            this.highlightMesh.position.set(c, 0.01, r);
            this.highlightMesh.visible = true;
        } else {
            this.highlightMesh.visible = false;
        }

        // 清除舊點
        while(this.dotsGroup.children.length > 0) { 
            this.dotsGroup.remove(this.dotsGroup.children[0]); 
        }

        // 產生合法移動點
        moves.forEach(idx => {
            const r = Math.floor(idx / 8), c = idx % 8;
            const dot = new THREE.Mesh(
                new THREE.CircleGeometry(0.15, 16),
                new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            );
            dot.rotation.x = -Math.PI/2;
            dot.position.set(c, 0.02, r);
            this.dotsGroup.add(dot);
        });
    }
}