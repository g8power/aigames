// js/Animator.js
import gsap from 'gsap';

export class Animator {
    movePiece(mesh, targetPos, type) {
        return new Promise(resolve => {
            // --- 核彈級清除 ---
            // 殺死該物件身上「所有」屬性的動畫
            gsap.killTweensOf(mesh);
            gsap.killTweensOf(mesh.position);
            gsap.killTweensOf(mesh.rotation);
            gsap.killTweensOf(mesh.scale);

            // 強制恢復物理屬性
            mesh.scale.set(1, 1, 1);
            
            // 確保材質透明度恢復 (如果死亡動畫動到了透明度)
            mesh.traverse((node) => {
                if (node.isMesh) {
                    node.material.opacity = 1;
                    node.material.transparent = false;
                }
            });

            const tl = gsap.timeline({ onComplete: resolve });
            
            if (type.toLowerCase() === 'n') {
                // 騎士跳躍
                tl.to(mesh.position, { y: 2, duration: 0.3, ease: "power1.out" })
                  .to(mesh.position, { x: targetPos.x, z: targetPos.z, duration: 0.4, ease: "none" }, "<")
                  .to(mesh.position, { y: 0, duration: 0.3, ease: "bounce.out" });
            } else {
                // 一般滑行
                tl.to(mesh.position, { 
                    x: targetPos.x, 
                    z: targetPos.z, 
                    y: 0, 
                    duration: 0.35, // 稍微加快一點節奏
                    ease: "power2.inOut" 
                });
            }
        });
    }

    killPiece(mesh) {
        return new Promise(resolve => {
            // 對於替身，我們不需要太客氣，直接播動畫然後銷毀
            const tl = gsap.timeline({ onComplete: () => {
                // 確保從場景徹底移除
                if(mesh.parent) mesh.parent.remove(mesh);
                // 釋放記憶體
                mesh.traverse((node) => {
                    if (node.isMesh) {
                        node.geometry.dispose();
                        if (node.material.map) node.material.map.dispose();
                        node.material.dispose();
                    }
                });
                resolve();
            }});

            // 死亡動畫：後倒 + 縮小 + 下沉
            tl.to(mesh.rotation, { x: Math.PI / 2, duration: 0.4, ease: "power2.in" })
              .to(mesh.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.3 }, "-=0.2")
              .to(mesh.position, { y: -1, duration: 0.3 }, "<");
        });
    }
}