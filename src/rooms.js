// Furnishing + lighting for every room. Each room gets its own palette,
// light color and props so no two rooms feel alike. Also places the clue
// note, the (randomized) basement key and the basement door.
import * as THREE from 'three';
import { ROOMS, WALL_H } from './house.js';
import { woodTexture, tileTexture, stoneTexture, carpetTexture, cobwebTexture } from './textures.js';

const KEY_SPOTS = [
  { room: 'study', pos: [-19.8, 1.42, 8], desc: 'on the fireplace mantel in the STUDY' },
  { room: 'dining', pos: [16.5, 0.95, -8], desc: 'on the long table in the DINING ROOM' },
  { room: 'conservatory', pos: [14, 1.06, 8], desc: 'at the old fountain in the CONSERVATORY' },
];

export function furnishRooms(scene) {
  const group = new THREE.Group();
  const furnitureAABBs = [];  // blocks the player (ghosts drift through)
  const occluders = [];       // tall pieces that also block monster sight
  const flickers = [];        // fn(t, dt) light animators

  const M = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...opts });
  const darkWood = M({ color: 0x2e2016 });
  const midWood = M({ color: 0x4a3524 });
  const cloth = M({ color: 0x3a2a2e });
  const brass = M({ color: 0x8a6d2f, roughness: 0.4, metalness: 0.6 });
  const iron = M({ color: 0x2a2c30, roughness: 0.5, metalness: 0.7 });
  const paper = M({ color: 0xcfc3a5, roughness: 1 });

  function box(w, h, d, x, y, z, mat, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
    return m;
  }
  function cyl(rt, rb, h, x, y, z, mat, seg = 12) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }
  function solid(x, z, w, d) { furnitureAABBs.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }); }
  function tall(x, z, w, d) { solid(x, z, w, d); occluders.push(furnitureAABBs[furnitureAABBs.length - 1]); }
  function light(color, intensity, dist, x, y, z) {
    const l = new THREE.PointLight(color, intensity, dist, 1.8);
    l.position.set(x, y, z);
    group.add(l);
    return l;
  }
  function floorPlane(roomId, tex, y = 0.001) {
    const r = ROOMS[roomId];
    const w = r.x[1] - r.x[0], d = r.z[1] - r.z[0];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M({ map: tex, color: 0xbbbbbb, roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((r.x[0] + r.x[1]) / 2, y, (r.z[0] + r.z[1]) / 2);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  function flickerLight(l, base, speed, depth) {
    let seed = Math.random() * 100;
    flickers.push((t) => {
      l.intensity = base * (1 - depth + depth * (0.5 + 0.5 * Math.sin(t * speed + seed) * Math.sin(t * speed * 2.7 + seed * 3)));
    });
  }

  // ============================================================ FOYER =====
  floorPlane('foyer', woodTexture('#4a3320', '#32220f', 5));
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 9), M({ map: carpetTexture(), color: 0xcccccc }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.012, -8); group.add(rug);
    // chandelier
    cyl(0.06, 0.06, 1.2, 0, 3.0, -8, iron);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 8, 24), brass);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 2.45, -8); group.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      box(0.07, 0.24, 0.07, Math.cos(a) * 0.8, 2.6, -8 + Math.sin(a) * 0.8, paper);
    }
    const chand = light(0xffb45e, 70, 18, 0, 2.5, -8);
    flickerLight(chand, 70, 6, 0.14);
    // ruined staircase against the north wall (roped off)
    for (let i = 0; i < 8; i++) box(3.2, 0.24, 0.5, 0, 0.12 + i * 0.26, -11.4 - i * 0.32, darkWood);
    box(3.4, 1.1, 0.08, 0, 1.9, -13.75, darkWood);
    solid(0, -12.5, 3.6, 3.4);
    box(3.2, 0.05, 0.05, 0, 1.0, -10.2, M({ color: 0x7a1f1f })); // rope
    // grandfather clock (tall)
    box(0.9, 2.5, 0.5, -6.4, 1.25, -4, darkWood); tall(-6.4, -4, 1.0, 0.6);
    box(0.55, 0.55, 0.1, -6.4, 1.9, -3.72, brass);
    // faded old portrait (right side; the left spot belongs to Lord Blackwood)
    box(1.3, 1.8, 0.08, 3.5, 2.0, -13.8, darkWood);
    box(1.05, 1.55, 0.04, 3.5, 2.0, -13.74, M({ color: 0x141018 }));
    // side table + vase
    box(1.2, 0.85, 0.5, 6.3, 0.42, -6, midWood); solid(6.3, -6, 1.3, 0.6);
    cyl(0.14, 0.2, 0.5, 6.3, 1.1, -6, M({ color: 0x33424e, roughness: 0.3 }));
  }

  // ========================================================== LIBRARY =====
  floorPlane('library', woodTexture('#3a2a1a', '#241708', 5));
  {
    const bookColors = [0x5e2f2f, 0x2f4a3a, 0x2f3a5e, 0x6b5a2f, 0x4a2f52];
    function bookshelf(x, z, ry = 0) {
      box(2.4, 2.7, 0.55, x, 1.35, z, darkWood, ry);
      const right = Math.abs(Math.sin(ry)) > 0.5;
      for (let s = 0; s < 4; s++) {
        for (let b = 0; b < 9; b++) {
          const mat = M({ color: bookColors[(s * 9 + b) % bookColors.length] });
          const off = -1.0 + b * 0.24 + Math.random() * 0.04;
          const bw = 0.17, bh = 0.4 + Math.random() * 0.12;
          if (right) box(0.3, bh, bw, x + Math.sin(ry) * 0.1, 0.55 + s * 0.6, z + off, mat);
          else box(bw, bh, 0.3, x + off, 0.55 + s * 0.6, z - Math.cos(ry) * 0.1, mat);
        }
      }
    }
    // wall shelves
    for (const sx of [-19, -16.4, -13.8]) { bookshelf(sx, -13.6); tall(sx, -13.6, 2.5, 0.7); }
    bookshelf(-20.6, -8, Math.PI / 2); tall(-20.6, -8, 0.7, 2.5);
    // freestanding aisles — good hiding spots
    bookshelf(-16.5, -7.2); tall(-16.5, -7.2, 2.5, 0.7);
    bookshelf(-12, -9.8); tall(-12, -9.8, 2.5, 0.7);
    // reading desk with the clue note + green banker's lamp
    box(1.8, 0.06, 1.0, -9.2, 0.78, -5.5, midWood);
    for (const [lx, lz] of [[-9.95, -5.9], [-8.45, -5.9], [-9.95, -5.1], [-8.45, -5.1]])
      box(0.08, 0.78, 0.08, lx, 0.39, lz, midWood);
    solid(-9.2, -5.5, 1.9, 1.1);
    const note = box(0.3, 0.012, 0.42, -9.35, 0.815, -5.45, paper, 0.3);
    cyl(0.05, 0.09, 0.32, -8.8, 0.97, -5.7, brass);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.14, 12, 1, true),
      M({ color: 0x1f5c33, emissive: 0x0e4020, emissiveIntensity: 0.8, side: THREE.DoubleSide }));
    shade.position.set(-8.8, 1.18, -5.7); group.add(shade);
    light(0x59d98a, 20, 10, -8.8, 1.25, -5.6);
    // armchair
    box(1.1, 0.5, 1.0, -10, 0.25, -9.5, cloth); box(1.1, 0.9, 0.25, -10, 0.7, -10.05, cloth);
    solid(-10, -9.7, 1.2, 1.5);
    var noteMesh = note; // interactable, exported below
  }

  // =========================================================== DINING =====
  floorPlane('dining', woodTexture('#513a24', '#38260f', 5));
  {
    // long table
    box(7, 0.1, 2.0, 14, 0.85, -8, midWood);
    for (const [lx, lz] of [[11, -8.7], [17, -8.7], [11, -7.3], [17, -7.3]])
      box(0.16, 0.85, 0.16, lx, 0.42, lz, midWood);
    solid(14, -8, 7.2, 2.2);
    // chairs
    for (let i = 0; i < 4; i++) {
      const cx = 11.4 + i * 1.8;
      for (const side of [-1, 1]) {
        const cz = -8 + side * 1.55;
        box(0.5, 0.45, 0.5, cx, 0.22, cz, darkWood);
        box(0.5, 0.85, 0.1, cx, 0.85, cz + side * 0.22, darkWood);
        solid(cx, cz, 0.55, 0.6);
      }
    }
    // candelabra with flickering flames
    cyl(0.05, 0.16, 0.5, 14, 1.15, -8, brass);
    for (const dx of [-0.3, 0, 0.3]) {
      box(0.05, 0.2, 0.05, 14 + dx, 1.45, -8, paper);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6),
        new THREE.MeshBasicMaterial({ color: 0xffc46b }));
      flame.position.set(14 + dx, 1.62, -8); group.add(flame);
    }
    const cand = light(0xff9a3c, 42, 14, 14, 1.8, -8);
    flickerLight(cand, 42, 11, 0.35);
    // china cabinet (tall) + sideboard
    box(2.6, 2.4, 0.6, 14, 1.2, -13.6, darkWood); tall(14, -13.6, 2.7, 0.7);
    box(0.9, 0.9, 0.04, 13.4, 1.5, -13.28, M({ color: 0x202830, roughness: 0.2 }));
    box(0.9, 0.9, 0.04, 14.6, 1.5, -13.28, M({ color: 0x202830, roughness: 0.2 }));
    box(2.0, 1.0, 0.55, 20.6, 0.5, -8, midWood); solid(20.6, -8, 0.7, 2.1);
    for (const bz of [-8.5, -8.1, -7.6]) cyl(0.05, 0.05, 0.32, 20.55, 1.16, bz, M({ color: 0x1c3324, roughness: 0.2 }));
  }

  // ========================================================== KITCHEN =====
  floorPlane('kitchen', tileTexture('#1c1f24', '#7e838b', 8));
  {
    const counter = M({ color: 0x4e5258, roughness: 0.6 });
    const steel = M({ color: 0x71767c, roughness: 0.35, metalness: 0.7 });
    // counters along the south wall + stove
    box(6.5, 0.92, 0.9, -1.5, 0.46, 13.3, counter); solid(-1.5, 13.3, 6.6, 1.0);
    box(1.4, 0.98, 0.95, 3.4, 0.49, 13.3, steel); solid(3.4, 13.3, 1.5, 1.05);
    for (const bx of [-3.5, -2.2, -0.9, 0.4]) cyl(0.16, 0.16, 0.02, bx, 0.94, 13.2, iron);
    // fridge (tall occluder)
    box(1.2, 2.2, 0.9, -6.3, 1.1, 4.2, steel); tall(-6.3, 4.2, 1.3, 1.0);
    // island with hanging pots
    box(2.6, 0.92, 1.3, 0, 0.46, 8, counter); solid(0, 8, 2.7, 1.4);
    box(2.2, 0.05, 0.7, 0, 2.35, 8, iron);
    for (const dx of [-0.8, -0.27, 0.27, 0.8]) {
      box(0.02, 0.25, 0.02, dx, 2.2, 8, iron);
      cyl(0.14, 0.11, 0.16, dx, 2.02, 8, steel);
    }
    // sink + shelves
    box(2.2, 0.92, 0.9, -6.3, 0.46, 10.5, counter); solid(-6.3, 10.5, 2.3, 1.0);
    // cold humming fluorescent light
    box(1.6, 0.06, 0.3, 0, 3.3, 8, new THREE.MeshBasicMaterial({ color: 0xb8d4e8 }));
    const cold = light(0x9fc8e8, 48, 16, 0, 3.1, 8);
    flickers.push((t) => { cold.intensity = Math.random() < 0.02 ? 10 : 48; }); // fluorescent stutter
  }

  // ============================================================ STUDY =====
  floorPlane('study', woodTexture('#2c1d12', '#1a0f05', 5));
  {
    const stone = M({ map: stoneTexture('#4a4440', 2), color: 0xaaaaaa });
    // fireplace on the west wall
    box(0.9, 2.2, 2.6, -20.5, 1.1, 8, stone); tall(-20.5, 8, 1.1, 2.7);
    box(1.0, 0.16, 3.0, -20.4, 1.35, 8, darkWood); // mantel
    const emb = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7),
      new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
    emb.rotation.y = Math.PI / 2; emb.position.set(-20.02, 0.55, 8); group.add(emb);
    const fire = light(0xff6a26, 55, 15, -19.6, 0.8, 8);
    flickerLight(fire, 55, 9, 0.4);
    flickers.push((t) => { emb.material.color.setHSL(0.05, 1, 0.45 + 0.15 * Math.sin(t * 7.3)); });
    // big desk + chair
    box(2.2, 0.1, 1.1, -13, 0.8, 7, darkWood);
    box(0.5, 0.8, 1.0, -13.75, 0.4, 7, darkWood); box(0.5, 0.8, 1.0, -12.25, 0.4, 7, darkWood);
    solid(-13, 7, 2.3, 1.2);
    box(0.6, 0.5, 0.6, -13, 0.25, 8.3, cloth); box(0.6, 0.9, 0.12, -13, 0.7, 8.62, cloth);
    solid(-13, 8.4, 0.7, 0.8);
    // safe
    box(1.0, 1.2, 1.0, -19.4, 0.6, 13.2, iron); solid(-19.4, 13.2, 1.1, 1.1);
    cyl(0.12, 0.12, 0.06, -19.4, 0.75, 12.66, brass);
    // globe
    cyl(0.05, 0.4, 0.9, -9.5, 0.45, 12.5, darkWood);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), M({ color: 0x3a4a5c, roughness: 0.4 }));
    globe.position.set(-9.5, 1.15, 12.5); group.add(globe);
    solid(-9.5, 12.5, 0.8, 0.8);
    // leather armchairs facing the fire
    for (const az of [5.8, 10.2]) {
      box(1.0, 0.5, 1.0, -17.5, 0.25, az, M({ color: 0x3a2118 }));
      box(0.25, 0.95, 1.0, -16.95, 0.65, az, M({ color: 0x3a2118 }));
      solid(-17.3, az, 1.3, 1.1);
    }
    // tall bookcase near the door
    box(2.2, 2.6, 0.55, -11, 1.3, 2.7, darkWood); tall(-11, 2.7, 2.3, 0.65);
  }

  // ===================================================== CONSERVATORY =====
  floorPlane('conservatory', tileTexture('#2a3630', '#5c6e60', 6));
  {
    const leaf = M({ color: 0x2f5238, roughness: 1 });
    const leafDark = M({ color: 0x22402a, roughness: 1 });
    const pot = M({ color: 0x5c4032, roughness: 0.9 });
    function plant(x, z, s = 1, isTall = false) {
      cyl(0.35 * s, 0.45 * s, 0.5 * s, x, 0.25 * s, z, pot);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 10, 8), Math.random() > 0.5 ? leaf : leafDark);
      bush.position.set(x, (0.5 + 0.55) * s, z);
      bush.scale.y = 1.3; group.add(bush);
      if (isTall) { const b2 = bush.clone(); b2.position.y += 0.8 * s; b2.scale.setScalar(0.7 * s); group.add(b2); tall(x, z, s, s); }
      else solid(x, z, 0.9 * s, 0.9 * s);
    }
    plant(9, 4, 1.4, true); plant(19.5, 5, 1.5, true); plant(19, 12.5, 1.3, true);
    plant(9.5, 12, 1.1); plant(12, 12.8, 0.9); plant(18, 9.5, 1.0); plant(10.5, 8.5, 0.9);
    // dry fountain (key spot)
    cyl(1.3, 1.5, 0.5, 14, 0.25, 8, stoneTextureMat()); solid(14, 8, 2.8, 2.8);
    cyl(0.18, 0.24, 1.0, 14, 0.9, 8, stoneTextureMat());
    cyl(0.55, 0.18, 0.12, 14, 1.42, 8, stoneTextureMat());
    // wrought-iron bench
    box(1.6, 0.08, 0.5, 17.5, 0.45, 12.8, iron); box(1.6, 0.6, 0.08, 17.5, 0.8, 13.05, iron);
    solid(17.5, 12.9, 1.7, 0.7);
    // moonlight through the glass roof
    const moon = light(0x8fb4e8, 50, 19, 14, 3.4, 8);
    flickers.push((t) => { moon.intensity = 45 + 7 * Math.sin(t * 0.4); }); // clouds drifting
    function stoneTextureMat() { return M({ color: 0x8a8578, roughness: 0.95 }); }
  }

  // ========================================================== HALLWAY =====
  floorPlane('hallway', stoneTexture('#4a4342', 6));
  {
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(38, 1.6), M({ map: carpetTexture('#3a1a2e', '#54283e'), color: 0xcccccc }));
    runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.012, 0); group.add(runner);
    // candle sconces
    for (const sx of [-10, 2, 12]) {
      box(0.18, 0.4, 0.12, sx, 1.9, -1.86, brass);
      const sc = light(0xffab52, 18, 9, sx, 2.15, -1.6);
      flickerLight(sc, 18, 13, 0.4);
    }
    // console table + dead flowers
    box(1.4, 0.85, 0.45, -4, 0.42, 1.7, darkWood); solid(-4, 1.7, 1.5, 0.55);
    cyl(0.1, 0.14, 0.35, -4, 1.05, 1.7, M({ color: 0x2f3a44, roughness: 0.3 }));
  }

  // =========================================================== CELLAR =====
  floorPlane('cellar', stoneTexture('#33302e', 3));
  {
    // heavy basement door on the far west wall
    const door = box(0.18, 2.5, 1.8, -26.7, 1.25, 0, M({ color: 0x241a10, roughness: 0.95 }));
    for (const dy of [0.5, 1.25, 2.0]) box(0.06, 0.16, 1.9, -26.58, dy, 0, iron);
    box(0.08, 0.3, 0.14, -26.56, 1.25, 0.6, brass); // handle
    cyl(0.045, 0.045, 0.1, -26.55, 1.0, 0.6, iron); // keyhole plate
    var basementDoorMesh = door;
    // crates + barrel
    box(0.9, 0.9, 0.9, -25.6, 0.45, -1.3, midWood); box(0.7, 0.7, 0.7, -25.5, 1.25, -1.35, midWood);
    solid(-25.6, -1.3, 1.0, 1.0);
    cyl(0.42, 0.42, 0.95, -24.2, 0.47, 1.4, midWood, 14); solid(-24.2, 1.4, 0.9, 0.9);
    // swinging bare bulb
    const bulbPivot = new THREE.Group(); bulbPivot.position.set(-24, 3.5, 0); group.add(bulbPivot);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9), iron);
    cord.position.y = -0.45; bulbPivot.add(cord);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe8b0 }));
    bulb.position.y = -0.95; bulbPivot.add(bulb);
    const bl = new THREE.PointLight(0xffd890, 30, 12, 1.6); bl.position.y = -1.0; bulbPivot.add(bl);
    flickers.push((t) => {
      bulbPivot.rotation.z = 0.28 * Math.sin(t * 1.1);
      bulbPivot.rotation.x = 0.12 * Math.sin(t * 0.7 + 2);
      bl.intensity = Math.random() < 0.015 ? 6 : 30;
    });
  }

  // ================================================ FAMILY PORTRAITS ======
  // The user's pictures, hung in ornate gilt frames with picture lights.
  const texLoader = new THREE.TextureLoader();
  function hangPainting(url, w, h, x, y, z, ry) {
    const g = new THREE.Group();
    const gilt = M({ color: 0xa8842f, roughness: 0.35, metalness: 0.65 });
    const outer = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, h + 0.24, 0.09), gilt);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.11), darkWood);
    const tex = texLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    canvas.position.z = 0.062;
    // small brass picture light above the frame
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), brass);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(0, h / 2 + 0.24, 0.12);
    const glow = new THREE.PointLight(0xffd9a0, 5, 3.5, 1.8);
    glow.position.set(0, h / 2 + 0.1, 0.45);
    g.add(outer, inner, canvas, lamp, glow);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    group.add(g);
    return g;
  }
  // Lord Blackwood presides over the foyer; the "cousins" hang by the library desk
  hangPainting('./assets/portraits/lord-blackwood.jpg', 1.5, 1.84, -3.5, 2.05, -13.72, 0);
  hangPainting('./assets/portraits/the-cousins.jpg', 1.05, 1.87, -7.24, 1.95, -4.5, -Math.PI / 2);
  const paintingSpots = {
    lord: { pos: new THREE.Vector3(-3.5, 1.6, -13.7), radius: 2.6, label: 'Examine the portrait' },
    cousins: { pos: new THREE.Vector3(-7.4, 1.6, -4.5), radius: 2.4, label: 'Examine the strange painting' },
  };

  // ==================================================== HIDING WARDROBES ==
  const wardrobes = [];
  function wardrobe(cx, cz, fx, fz) { // f = outward facing direction (unit axis)
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.5, 0.85), darkWood);
    body.position.y = 1.25;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    for (const side of [-1, 1]) { // double doors with seam + knobs
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.26, 0.06), midWood);
      door.position.set(side * 0.34, 1.22, 0.44);
      g.add(door);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), brass);
      knob.position.set(side * 0.08, 1.22, 0.49);
      g.add(knob);
    }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.12, 1.0), darkWood);
    crown.position.y = 2.56;
    g.add(crown);
    g.position.set(cx, 0, cz);
    g.rotation.y = Math.atan2(fx, fz); // rotate local +z to face (fx,fz)
    group.add(g);
    tall(cx, cz, Math.abs(fx) > 0.5 ? 0.9 : 1.5, Math.abs(fx) > 0.5 ? 1.5 : 0.9);
    wardrobes.push({
      pos: new THREE.Vector3(cx + fx * 1.0, 1.2, cz + fz * 1.0), // interact point (in front)
      radius: 1.6,
      label: 'Hide in the wardrobe',
      hideAt: { x: cx + fx * 0.1, z: cz + fz * 0.1 },
      exitAt: { x: cx + fx * 1.25, z: cz + fz * 1.25 },
      lookYaw: Math.atan2(-fx, -fz), // face outward while hidden
      center: { x: cx, z: cz },
    });
  }
  wardrobe(-20.35, -3.4, 1, 0);   // library, west wall
  wardrobe(-7.65, 12.5, -1, 0);   // study, east wall
  wardrobe(6.35, 11.4, -1, 0);    // kitchen pantry, east wall

  // ==================================================== CREAKY FLOORBOARDS
  const creakBoards = [];
  const creakMat = M({ map: woodTexture('#241505', '#120a02', 2), color: 0x8a7a66, roughness: 1 });
  for (const [bx, bz, bw, bd] of [
    [0.6, -1.1, 1.5, 1.1],    // hallway by foyer door
    [-15.6, 0.4, 1.3, 1.2],   // hallway west stretch
    [9.8, 0.7, 1.4, 1.1],     // hallway east stretch
    [-14.2, -3.1, 1.3, 1.2],  // inside library door
    [14.1, -3.2, 1.3, 1.2],   // inside dining door
    [0.3, 3.1, 1.4, 1.2],     // inside kitchen door
    [-13.7, 3.2, 1.3, 1.2],   // inside study door
    [14.3, 3.2, 1.3, 1.2],    // inside conservatory door
    [-22.4, 0.6, 1.2, 1.3],   // cellar corridor mouth
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), creakMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(bx, 0.02, bz);
    group.add(m);
    creakBoards.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2 });
  }

  // ======================================================= STORM WINDOWS ==
  const windowGlassMats = [];
  function stormWindow(x, z, nx, nz) { // n = inward normal
    const ry = Math.atan2(nx, nz);
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 0.1), darkWood);
    g.add(frame);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x141c2c, roughness: 0.15,
      emissive: 0x8fb0e0, emissiveIntensity: 0.35,
    });
    windowGlassMats.push(glassMat);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.86), glassMat);
    glass.position.z = 0.06;
    g.add(glass);
    // muntin cross
    const mv = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 0.04), darkWood);
    mv.position.z = 0.08; g.add(mv);
    const mh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.04), darkWood);
    mh.position.z = 0.08; g.add(mh);
    // heavy old curtains
    for (const side of [-1, 1]) {
      const cur = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.5, 0.16), M({ color: 0x3a1d24, roughness: 1 }));
      cur.position.set(side * 0.95, 0.05, 0.14);
      g.add(cur);
    }
    const moonSpill = new THREE.PointLight(0x7a9cd8, 7, 7, 1.9);
    moonSpill.position.set(0, 0.3, 0.8);
    g.add(moonSpill);
    g.position.set(x, 2.0, z);
    g.rotation.y = ry;
    group.add(g);
  }
  stormWindow(-5.3, -13.78, 0, 1);   // foyer, left of the stairs
  stormWindow(5.3, -13.78, 0, 1);    // foyer, right of the stairs
  stormWindow(-20.78, -5, 1, 0);     // library west
  stormWindow(20.78, -5, -1, 0);     // dining east
  stormWindow(-20.78, 11, 1, 0);     // study west
  stormWindow(-2.5, 13.78, 0, -1);   // kitchen south
  stormWindow(13, 13.78, 0, -1);     // conservatory south
  stormWindow(18.5, 13.78, 0, -1);   // conservatory south 2

  // ================================================= COBWEBS + DUST + DECOR
  const webTex = cobwebTexture();
  const webMat = new THREE.MeshBasicMaterial({
    map: webTex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
  });
  for (const [wx, wy, wz, wry] of [
    [6.6, 3.25, -13.6, Math.PI * 1.25],
    [-20.7, 3.25, -13.6, Math.PI * 1.75],
    [-26.7, 3.2, -1.7, Math.PI * 1.75],
    [-26.7, 3.2, 1.7, Math.PI * 1.25],
    [-20.7, 3.25, 13.6, Math.PI * 0.75],
    [20.7, 3.25, -2.35, Math.PI * 0.25],
  ]) {
    const web = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), webMat);
    web.position.set(wx, wy, wz);
    web.rotation.y = wry;
    web.rotation.x = 0.35;
    group.add(web);
  }
  // drifting dust motes
  {
    const N = 380;
    const base = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      base[i * 3] = -26 + Math.random() * 47;
      base[i * 3 + 1] = 0.3 + Math.random() * 2.9;
      base[i * 3 + 2] = -13.5 + Math.random() * 27;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xcfc7b0, size: 0.035, transparent: true, opacity: 0.35,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    group.add(dust);
    const attr = geo.getAttribute('position');
    flickers.push((t) => {
      for (let i = 0; i < N; i++) {
        attr.array[i * 3] = base[i * 3] + 0.25 * Math.sin(t * 0.21 + i * 1.7);
        attr.array[i * 3 + 1] = base[i * 3 + 1] + 0.30 * Math.sin(t * 0.13 + i * 2.3);
      }
      attr.needsUpdate = true;
    });
  }
  // ceiling beams in the grand rooms
  const beamMat = M({ color: 0x241a10, roughness: 0.95 });
  for (const [xa, xb, zs] of [
    [-6.8, 6.8, [-12, -9.5, -7, -4.5]],    // foyer
    [7.2, 20.8, [-12, -9.5, -7, -4.5]],    // dining
    [-20.8, -7.2, [4.5, 7, 9.5, 12]],      // study
  ]) {
    for (const bz of zs) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, 0.22, 0.2), beamMat);
      beam.position.set((xa + xb) / 2, WALL_H - 0.12, bz);
      beam.castShadow = true;
      group.add(beam);
    }
  }
  // stone pillars in the cellar corridor
  for (const [px, pz] of [[-23, -1.6], [-23, 1.6], [-25.2, -1.6], [-25.2, 1.6]]) {
    const pil = cyl(0.22, 0.28, WALL_H, px, WALL_H / 2, pz, M({ map: stoneTexture('#3a3634', 2), color: 0x999999 }));
    pil.castShadow = true;
    solid(px, pz, 0.5, 0.5);
  }

  // ======================================================== DIARY PAGES ===
  // 5 physical pages; a 6th is found behind Lord Blackwood's portrait.
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0xd8cba0, roughness: 1, emissive: 0x8a7a40, emissiveIntensity: 0.4,
    side: THREE.DoubleSide,
  });
  const pageItems = [];
  for (const [id, px, py, pz] of [
    [0, -10, 0.53, -9.4],     // library armchair
    [2, 20.42, 1.04, -7.4],   // dining sideboard
    [3, 0.5, 0.945, 8.25],    // kitchen island
    [4, -12.7, 0.87, 7.15],   // study desk
    [5, 17.3, 0.51, 12.75],   // conservatory bench
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.34), pageMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI;
    m.position.set(px, py, pz);
    group.add(m);
    pageItems.push({ id, mesh: m, pos: new THREE.Vector3(px, py, pz), radius: 2.0, taken: false });
  }
  flickers.push((t) => { pageMat.emissiveIntensity = 0.3 + 0.18 * Math.sin(t * 2.4); });

  // ======================================================== KEY + NOTE ====
  const keySpot = KEY_SPOTS[Math.floor(Math.random() * KEY_SPOTS.length)];
  const keyGroup = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd9a441, roughness: 0.25, metalness: 0.9,
    emissive: 0x8a5f14, emissiveIntensity: 0.55,
  });
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.024, 8, 18), gold);
  head.position.y = 0.11; keyGroup.add(head);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2), gold);
  shaft.position.y = -0.03; keyGroup.add(shaft);
  const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), gold);
  tooth1.position.set(0.04, -0.1, 0); keyGroup.add(tooth1);
  const tooth2 = tooth1.clone(); tooth2.position.y = -0.05; keyGroup.add(tooth2);
  keyGroup.position.set(...keySpot.pos);
  const keyLight = new THREE.PointLight(0xd9a441, 6, 4.5, 2);
  keyGroup.add(keyLight);
  group.add(keyGroup);
  flickers.push((t) => {
    keyGroup.rotation.y = t * 1.4;
    keyGroup.position.y = keySpot.pos[1] + 0.05 * Math.sin(t * 2.2);
    keyLight.intensity = 5 + 2 * Math.sin(t * 3.1);
  });

  scene.add(group);

  return {
    group,
    furnitureAABBs,
    occluders,
    flickers,
    keySpot,
    keyGroup,
    noteMesh,
    basementDoorMesh,
    wardrobes,
    creakBoards,
    windowGlassMats,
    pageItems,
    interactables: {
      note: { pos: new THREE.Vector3(-9.35, 0.8, -5.45), radius: 2.2, label: 'Read the note' },
      key: { pos: new THREE.Vector3(...keySpot.pos), radius: 2.2, label: 'Take the basement key' },
      door: { pos: new THREE.Vector3(-26.6, 1.25, 0), radius: 2.6, label: 'Open the basement door' },
      portraitLord: paintingSpots.lord,
      portraitCousins: paintingSpots.cousins,
    },
  };
}
