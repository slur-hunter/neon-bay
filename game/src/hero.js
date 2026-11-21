// Rico on foot: a simple humanoid with walk bob, arm swing and a punch
// pose. Movement is camera-relative; forward walks AWAY from the camera.
import * as THREE from 'three';

export function makeHero(scene) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2f6fb2 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  const capMat = new THREE.MeshLambertMaterial({ color: 0xd84a2f });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pants);
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), shirt);
  armL.position.set(-0.4, 1.2, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.75;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), capMat);
  cap.position.y = 1.98;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.2), capMat);
  brim.position.set(0, 1.93, 0.28);
  g.add(legL, legR, torso, armL, armR, head, cap, brim);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(g);

  const hero = {
    group: g,
    x: 0, z: 0, yaw: 0,
    speed: 0,
    bob: 0,
    punchT: 0,
    punchCooldown: 0,
    update(dt, moving, punch) {
      hero.bob += dt * (moving ? 11 : 0);
      const swing = moving ? Math.sin(hero.bob) * 0.55 : 0;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8;
      if (punch) {
        armR.rotation.x = -1.9;
        hero.punchT = 0.22;
      } else if (hero.punchT > 0) {
        hero.punchT -= dt;
        armR.rotation.x = -1.9 * Math.max(0, hero.punchT / 0.22);
      }
      g.position.set(hero.x, Math.abs(Math.sin(hero.bob)) * 0.06, hero.z);
      g.rotation.y = hero.yaw;
    },
  };
  return hero;
}
