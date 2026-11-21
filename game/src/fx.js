// Visual effects for Neon Bay: the mission marker beam and ring, the
// mission-complete banner, and the location title card. The banner and the
// title card are DOM; the beam and ring are 3D.
import * as THREE from '../vendor/three.module.min.js';

export function makeMarker() {
  const group = new THREE.Group();
  group.name = 'marker';
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#ffd23e',
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 18, 16, 1, true), beamMat);
  beam.position.y = 9;
  group.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#ffd23e',
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);
  group.userData.beam = beam;
  group.userData.ring = ring;
  return group;
}

export function pulseMarker(marker, t) {
  const s = 1 + Math.sin(t * 3) * 0.08;
  marker.userData.ring.scale.set(s, s, 1);
  marker.userData.beam.material.opacity = 0.16 + Math.sin(t * 3) * 0.06;
}

export function showBanner(el, text, sub) {
  if (!el) return;
  el.textContent = '';
  const big = document.createElement('div');
  big.textContent = text;
  big.className = 'banner-big';
  const small = document.createElement('div');
  small.textContent = sub || '';
  small.className = 'banner-small';
  el.appendChild(big);
  el.appendChild(small);
  el.classList.add('show');
  window.setTimeout(() => el.classList.remove('show'), 12000);
}

export function showTitleCard(el, place, sub) {
  if (!el) return;
  el.textContent = '';
  const big = document.createElement('div');
  big.textContent = place;
  big.className = 'title-big';
  const small = document.createElement('div');
  small.textContent = sub || '';
  small.className = 'title-small';
  el.appendChild(big);
  el.appendChild(small);
  el.classList.add('show');
  window.setTimeout(() => el.classList.remove('show'), 12000);
}
