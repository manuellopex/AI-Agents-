// Genera public/models/tree.glb — palmera estilizada de prueba para
// validar el pipeline de assets (Paso 2). Reemplazable por arte final.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync } from 'fs';

// Polyfill mínimo de FileReader para GLTFExporter en Node
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.({ target: this });
      this.onload?.({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = 'data:application/octet-stream;base64,' + Buffer.from(buf).toString('base64');
      this.onloadend?.({ target: this });
      this.onload?.({ target: this });
    });
  }
};

const tree = new THREE.Group();
tree.name = 'PalmTree';

const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3d, roughness: 0.9 });
const frondMat = new THREE.MeshStandardMaterial({ color: 0x2fa05e, roughness: 0.85, side: THREE.DoubleSide });
const frondMat2 = new THREE.MeshStandardMaterial({ color: 0x45bd72, roughness: 0.85, side: THREE.DoubleSide });
const cocoMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });

// Tronco curvado: segmentos apilados con deriva lateral y anillos
let px = 0, py = 0, lean = 0.16;
for (let i = 0; i < 7; i++) {
  const h = 0.42;
  const r = 0.16 - i * 0.012;
  const seg = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.008, r, h, 8), trunkMat);
  seg.position.set(px, py + h / 2, 0);
  seg.rotation.z = -lean * 0.45;
  tree.add(seg);
  // Anillo de corteza
  if (i % 2 === 0) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.005, 0.018, 6, 10), trunkMat);
    ring.position.set(px, py + h, 0);
    ring.rotation.x = Math.PI / 2;
    tree.add(ring);
  }
  py += h * 0.96;
  px += lean * h;
}

// Corona de frondas: planos curvados (cilindros abiertos aplastados)
const top = new THREE.Vector3(px, py + 0.05, 0);
for (let i = 0; i < 7; i++) {
  const a = (i / 7) * Math.PI * 2;
  const frond = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.04, 1.7, 5, 3, true, 0, Math.PI * 0.7),
    i % 2 ? frondMat : frondMat2,
  );
  frond.position.copy(top);
  frond.rotation.set(Math.PI * 0.62, a, 0, 'YXZ');
  frond.translateY(-0.7);
  frond.scale.z = 0.35;
  tree.add(frond);
}
// Cocos
for (let i = 0; i < 3; i++) {
  const a = i * 2.1;
  const coco = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 7), cocoMat);
  coco.position.set(top.x + Math.cos(a) * 0.16, top.y - 0.12, Math.sin(a) * 0.16);
  tree.add(coco);
}

const exporter = new GLTFExporter();
exporter.parse(
  tree,
  (result) => {
    writeFileSync('public/models/tree.glb', Buffer.from(result));
    console.log('✔ public/models/tree.glb generado:', Buffer.from(result).length, 'bytes');
  },
  (err) => { console.error('Error exportando:', err); process.exit(1); },
  { binary: true },
);
