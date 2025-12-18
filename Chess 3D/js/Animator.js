// js/Animator.js
import gsap from 'gsap';

export class Animator {
    // 一般移動
    movePiece(mesh, targetPos, type) {
        return new Promise(resolve => {
            // --- 修正重點 1: 強制停止該棋子當前的所有動畫 ---
            gsap.killTweensOf(mesh.position);
            gsap.killTweensOf(mesh.rotation);
            gsap.killTweensOf(mesh.scale);

            // --- 修正重點 2: 強制重置狀態，防止它處於「半死不活」的狀態 ---
            mesh.scale.set(1, 1, 1);
            mesh.rotation.x = 0; 
            mesh.rotation.z = 0;
            // 確保起點 Y 軸在盤面上 (除非它是騎士正在跳，但這裡我們強制歸零比較安全)
            mesh.position.y = 0; 

            const tl = gsap.timeline({ onComplete: resolve });
            
            // 騎士跳躍
            if (type.toLowerCase() === 'n') {
                tl.to(mesh.position, { y: 2, duration: 0.3, ease: "power1.out" })
                  .to(mesh.position, { x: targetPos.x, z: targetPos.z, duration: 0.4, ease: "none" }, "<")
                  .to(mesh.position, { y: 0, duration: 0.3, ease: "bounce.out" });
            } else {
                // 滑行
                tl.to(mesh.position, { 
                    x: targetPos.x, 
                    z: targetPos.z, 
                    y: 0, // 強制鎖定 Y 軸為 0，防止滑行時下沉
                    duration: 0.4, 
                    ease: "power2.inOut" 
                });
            }
        });
    }

    // 吃子特效 (擊倒)
    killPiece(mesh) {
        return new Promise(resolve => {
            // 也先殺死舊動畫
            gsap.killTweensOf(mesh.position);
            gsap.killTweensOf(mesh.scale);

            const tl = gsap.timeline({ onComplete: () => {
                if(mesh.parent) mesh.parent.remove(mesh);
                resolve();
            }});

            tl.to(mesh.rotation, { x: Math.PI / 2, duration: 0.4, ease: "power2.in" })
              .to(mesh.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.3 }, "-=0.2")
              .to(mesh.position, { y: -0.5, duration: 0.3 }, "<");
        });
    }
}