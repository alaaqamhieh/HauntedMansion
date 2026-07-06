// Mansion layout: walls with door openings, collision AABBs, line-of-sight
// tests and a small nav graph used by the monsters to chase through doorways.
import * as THREE from 'three';
import { wallpaperTexture } from './textures.js';

export const WALL_H = 3.6;
export const WALL_T = 0.3;
export const DOOR_W = 2.0;
export const DOOR_H = 2.5;

// Room bounds (x/z ranges). The hallway spine connects everything; the cellar
// corridor stub on the far west holds the locked basement door.
export const ROOMS = {
  library:      { name: 'Library',        x: [-21, -7], z: [-14, -2] },
  foyer:        { name: 'Grand Foyer',    x: [-7, 7],   z: [-14, -2] },
  dining:       { name: 'Dining Room',    x: [7, 21],   z: [-14, -2] },
  hallway:      { name: 'Hallway',        x: [-21, 21], z: [-2, 2] },
  study:        { name: 'Study',          x: [-21, -7], z: [2, 14] },
  kitchen:      { name: 'Kitchen',        x: [-7, 7],   z: [2, 14] },
  conservatory: { name: 'Conservatory',   x: [7, 21],   z: [2, 14] },
  cellar:       { name: 'Cellar Corridor',x: [-27, -21],z: [-2, 2] },
};

export function roomAt(x, z) {
  for (const [id, r] of Object.entries(ROOMS)) {
    if (x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1]) return id;
  }
  return null;
}

// ---------------------------------------------------------------- walls ----

// Wall spec: horizontal (along x, fixed z) or vertical (along z, fixed x),
// doors = center coordinates along the wall's axis.
const WALL_SPECS = [
  { dir: 'h', z: -14, from: -21, to: 21, doors: [] },                    // north exterior
  { dir: 'h', z: -2,  from: -27, to: 21, doors: [-14, 0, 14] },          // north rooms <-> hallway/cellar
  { dir: 'h', z: 2,   from: -27, to: 21, doors: [-14, 0, 14] },          // hallway/cellar <-> south rooms
  { dir: 'h', z: 14,  from: -21, to: 21, doors: [] },                    // south exterior
  { dir: 'v', x: -27, from: -2,  to: 2,  doors: [] },                    // cellar west (basement door wall)
  { dir: 'v', x: -21, from: -14, to: -2, doors: [] },                    // library west
  { dir: 'v', x: -21, from: 2,   to: 14, doors: [] },                    // study west
  { dir: 'v', x: -7,  from: -14, to: -2, doors: [-8] },                  // library <-> foyer
  { dir: 'v', x: -7,  from: 2,   to: 14, doors: [8] },                   // study <-> kitchen
  { dir: 'v', x: 7,   from: -14, to: -2, doors: [-8] },                  // foyer <-> dining
  { dir: 'v', x: 7,   from: 2,   to: 14, doors: [8] },                   // kitchen <-> conservatory
  { dir: 'v', x: 21,  from: -14, to: 14, doors: [] },                    // east exterior
];

export function buildHouse(scene) {
  const wallAABBs = [];   // full-height segments: block movement + sight
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallpaperTexture(), color: 0x9a93a6, roughness: 0.95,
  });
  const lintelMat = new THREE.MeshStandardMaterial({ color: 0x3a3542, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x241d16, roughness: 0.8 });

  function addBox(w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  }

  function addSegment(spec, a, b) {
    if (b - a < 0.01) return;
    const len = b - a;
    const mid = (a + b) / 2;
    if (spec.dir === 'h') {
      addBox(len, WALL_H, WALL_T, mid, WALL_H / 2, spec.z, wallMat);
      // baseboard + crown molding give the walls period detail
      addBox(len, 0.2, WALL_T + 0.1, mid, 0.1, spec.z, trimMat);
      addBox(len, 0.14, WALL_T + 0.12, mid, WALL_H - 0.07, spec.z, trimMat);
      wallAABBs.push({
        minX: a, maxX: b,
        minZ: spec.z - WALL_T / 2, maxZ: spec.z + WALL_T / 2,
      });
    } else {
      addBox(WALL_T, WALL_H, len, spec.x, WALL_H / 2, mid, wallMat);
      addBox(WALL_T + 0.1, 0.2, len, spec.x, 0.1, mid, trimMat);
      addBox(WALL_T + 0.12, 0.14, len, spec.x, WALL_H - 0.07, mid, trimMat);
      wallAABBs.push({
        minX: spec.x - WALL_T / 2, maxX: spec.x + WALL_T / 2,
        minZ: a, maxZ: b,
      });
    }
  }

  for (const spec of WALL_SPECS) {
    const doors = [...spec.doors].sort((p, q) => p - q);
    let cursor = spec.from;
    for (const d of doors) {
      addSegment(spec, cursor, d - DOOR_W / 2);
      // lintel above the doorway + door frame trim
      const lh = WALL_H - DOOR_H;
      if (spec.dir === 'h') {
        addBox(DOOR_W, lh, WALL_T, d, DOOR_H + lh / 2, spec.z, lintelMat);
        addBox(DOOR_W + 0.3, 0.12, WALL_T + 0.12, d, DOOR_H + 0.06, spec.z, trimMat);
        addBox(0.14, DOOR_H, WALL_T + 0.12, d - DOOR_W / 2, DOOR_H / 2, spec.z, trimMat);
        addBox(0.14, DOOR_H, WALL_T + 0.12, d + DOOR_W / 2, DOOR_H / 2, spec.z, trimMat);
      } else {
        addBox(WALL_T, lh, DOOR_W, spec.x, DOOR_H + lh / 2, d, lintelMat);
        addBox(WALL_T + 0.12, 0.12, DOOR_W + 0.3, spec.x, DOOR_H + 0.06, d, trimMat);
        addBox(WALL_T + 0.12, DOOR_H, 0.14, spec.x, DOOR_H / 2, d - DOOR_W / 2, trimMat);
        addBox(WALL_T + 0.12, DOOR_H, 0.14, spec.x, DOOR_H / 2, d + DOOR_W / 2, trimMat);
      }
      cursor = d + DOOR_W / 2;
    }
    addSegment(spec, cursor, spec.to);
  }

  // ceiling
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 28),
    new THREE.MeshStandardMaterial({ color: 0x17141c, roughness: 1 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(-3, WALL_H, 0);
  group.add(ceil);

  scene.add(group);
  return { group, wallAABBs };
}

// ---------------------------------------------------- geometry helpers ----

// 2D segment vs AABB (slab method), with optional inflation.
export function segmentHitsAABB(x1, z1, x2, z2, box, inflate = 0) {
  const minX = box.minX - inflate, maxX = box.maxX + inflate;
  const minZ = box.minZ - inflate, maxZ = box.maxZ + inflate;
  const dx = x2 - x1, dz = z2 - z1;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    let t1 = (minX - x1) / dx, t2 = (maxX - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (z1 < minZ || z1 > maxZ) return false;
  } else {
    let t1 = (minZ - z1) / dz, t2 = (maxZ - z1) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export function losClear(ax, az, bx, bz, aabbs, inflate = 0) {
  for (const box of aabbs) {
    if (segmentHitsAABB(ax, az, bx, bz, box, inflate)) return false;
  }
  return true;
}

// circle (point + radius) vs AABB list
export function circleHits(x, z, r, aabbs) {
  for (const b of aabbs) {
    if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
  }
  return false;
}

// ------------------------------------------------------------ nav graph ----

const NAV_POINTS = [
  // hallway spine
  [-24, 0], [-18, 0], [-14, 0], [-10, 0], [-4, 0], [0, 0], [4, 0], [10, 0], [14, 0], [18, 0],
  // doorway centers
  [-14, -2], [0, -2], [14, -2], [-14, 2], [0, 2], [14, 2],
  [-7, -8], [7, -8], [-7, 8], [7, 8],
  // room interiors
  [-14, -8], [-17, -5], [-11, -11],       // library
  [0, -8], [-4, -5], [4, -11],            // foyer
  [14, -8], [17, -5], [11, -11],          // dining
  [-14, 8], [-17, 11], [-11, 5],          // study
  [0, 8], [4, 5], [-4, 11],               // kitchen
  [14, 8], [11, 11], [17, 5],             // conservatory
];

export function buildNavGraph(wallAABBs) {
  const nodes = NAV_POINTS.map(([x, z]) => ({ x, z, edges: [] }));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 12) continue;
      if (losClear(a.x, a.z, b.x, b.z, wallAABBs, 0.55)) {
        a.edges.push({ to: j, cost: d });
        b.edges.push({ to: i, cost: d });
      }
    }
  }

  function nearestVisible(x, z) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bestD && losClear(x, z, n.x, n.z, wallAABBs, 0.45)) {
        best = i; bestD = d;
      }
    }
    if (best === -1) { // fall back to plain nearest
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i].x - x, nodes[i].z - z);
        if (d < bestD) { best = i; bestD = d; }
      }
    }
    return best;
  }

  // A* between graph nodes; returns list of [x,z] waypoints.
  function findPath(fromX, fromZ, toX, toZ) {
    const start = nearestVisible(fromX, fromZ);
    const goal = nearestVisible(toX, toZ);
    if (start === -1 || goal === -1) return [[toX, toZ]];
    const open = new Set([start]);
    const came = new Map();
    const g = new Map([[start, 0]]);
    const f = new Map([[start, 0]]);
    while (open.size) {
      let cur = -1, curF = Infinity;
      for (const n of open) { const fn = f.get(n) ?? Infinity; if (fn < curF) { curF = fn; cur = n; } }
      if (cur === goal) break;
      open.delete(cur);
      for (const e of nodes[cur].edges) {
        const ng = (g.get(cur) ?? Infinity) + e.cost;
        if (ng < (g.get(e.to) ?? Infinity)) {
          came.set(e.to, cur);
          g.set(e.to, ng);
          const h = Math.hypot(nodes[e.to].x - nodes[goal].x, nodes[e.to].z - nodes[goal].z);
          f.set(e.to, ng + h);
          open.add(e.to);
        }
      }
    }
    const path = [];
    let cur = goal;
    while (cur !== undefined) {
      path.unshift([nodes[cur].x, nodes[cur].z]);
      cur = came.get(cur);
    }
    path.push([toX, toZ]);
    return path;
  }

  return { nodes, findPath };
}
