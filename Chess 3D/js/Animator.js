import gsap from 'gsap';

export class Animator {
    // 一般移動
    movePiece(mesh, targetPos, type) {
        return new Promise(resolve => {
            const tl = gsap.timeline({ onComplete: resolve });
            
            // 騎士跳躍
            if (type.toLowerCase() === 'n') {
                // 上升
                tl.to(mesh.position, { y: 2, duration: 0.3, ease: "power1.out" })
                  // 平移
                  .to(mesh.position, { x: targetPos.x, z: targetPos.z, duration: 0.4, ease: "none" }, "<")
                  // 落下
                  .to(mesh.position, { y: 0, duration: 0.3, ease: "bounce.out" });
            } else {
                // 滑行
                tl.to(mesh.position, { 
                    x: targetPos.x, 
                    z: targetPos.z, 
                    duration: 0.5, 
                    ease: "power2.inOut" 
                });
            }
        });
    }

    // 吃子特效 (擊倒)
    killPiece(mesh) {
        return new Promise(resolve => {
            const tl = gsap.timeline({ onComplete: () => {
                // 動畫結束後從場景移除
                if(mesh.parent) mesh.parent.remove(mesh);
                resolve();
            }});

            // 向後倒下 + 縮小 + 透明
            tl.to(mesh.rotation, { x: Math.PI / 2, duration: 0.4, ease: "power2.in" })
              .to(mesh.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.3 }, "-=0.2")
              .to(mesh.position, { y: -0.5, duration: 0.3 }, "<");
        });
    }
}