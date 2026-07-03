// The things that haunt the manor. Each drifts along a patrol route, hears
// the player's noise (scaled by distance), sees with a wall-occluded vision
// cone, and chases through doorways using the nav graph.
import * as THREE from 'three';
import { losClear } from './house.js';

const STATE_COLORS = {
  patrol: 0xb8c4d8,      // pale
  investigate: 0xe8c53c, // amber
  chase: 0xff2a1a,       // red
  search: 0xe8863c,      // orange
};

export const MONSTER_DEFS = [
  {
    name: 'The Widow', tint: 0x8a94b8, speed: 2.1, chaseSpeed: 3.9,
    hearRange: 13, viewRange: 11, viewAngle: THREE.MathUtils.degToRad(32),
    // north wing: library -> foyer -> dining
    waypoints: [[-14, -8], [-7, -8], [0, -8], [0, -4], [7, -8], [14, -8], [14, -2], [0, -2], [-14, -2]],
  },
  {
    name: 'The Butler', tint: 0x6b8a6b, speed: 1.8, chaseSpeed: 3.7,
    hearRange: 15, viewRange: 12, viewAngle: THREE.MathUtils.degToRad(30),
    // endless rounds of the hallway, past the cellar corridor
    waypoints: [[-24, 0], [-14, 0], [-4, 0], [4, 0], [14, 0], [18, 0], [4, 0], [-10, 0], [-18, 0]],
  },
  {
    name: 'The Child', tint: 0xb87a8a, speed: 2.4, chaseSpeed: 4.1,
    hearRange: 12, viewRange: 9, viewAngle: THREE.MathUtils.degToRad(36),
    // south wing: study -> kitchen -> conservatory
    waypoints: [[-14, 8], [-11, 5], [-7, 8], [0, 8], [4, 5], [7, 8], [14, 8], [14, 2], [0, 2], [-14, 2]],
  },
];

function buildGhostMesh(tint) {
  const g = new THREE.Group();
  const shroud = new THREE.MeshStandardMaterial({
    color: 0x11131a, roughness: 1, transparent: true, opacity: 0.92,
    emissive: tint, emissiveIntensity: 0.06,
  });
  // tattered body: stack of squashed spheres tapering down
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.9, 10, 4, true), shroud);
  body.position.y = 1.05;
  g.add(body);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), shroud);
  shoulders.position.y = 1.85; shoulders.scale.y = 0.8;
  g.add(shoulders);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), shroud);
  head.position.y = 2.25;
  g.add(head);
  // glowing eyes — color reflects the AI state
  const eyeMat = new THREE.MeshBasicMaterial({ color: STATE_COLORS.patrol });
  for (const ex of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
    eye.position.set(ex, 2.28, -0.22);
    g.add(eye);
  }
  // faint aura so it can be seen coming in the dark
  const aura = new THREE.PointLight(tint, 4.5, 7, 1.6);
  aura.position.y = 1.8;
  g.add(aura);
  return { group: g, eyeMat, aura, body };
}

export class Monster {
  constructor(def, scene, nav, wallAABBs, occluders) {
    this.def = def;
    this.nav = nav;
    this.walls = wallAABBs;
    this.occluders = occluders; // walls + tall furniture (sight blockers)
    const { group, eyeMat, aura, body } = buildGhostMesh(def.tint);
    this.mesh = group;
    this.eyeMat = eyeMat;
    this.aura = aura;
    this.body = body;
    this.pos = new THREE.Vector2(def.waypoints[0][0], def.waypoints[0][1]);
    this.heading = 0;
    this.state = 'patrol';
    this.wpIndex = 0;
    this.path = null;        // active chase/investigate path: array of [x,z]
    this.pathAge = 0;
    this.target = new THREE.Vector2();
    this.searchTimer = 0;
    this.suspicion = 0;      // 0..1, fills while the player is in view
    this.seesPlayer = false;
    this.t = Math.random() * 10;
    scene.add(group);
    this._syncMesh();
  }

  _syncMesh() {
    this.mesh.position.set(this.pos.x, 0, this.pos.y);
    this.mesh.rotation.y = this.heading;
  }

  // does this monster currently see the player?
  _checkVision(px, pz, playerNoise) {
    const dx = px - this.pos.x, dz = pz - this.pos.y;
    const dist = Math.hypot(dx, dz);
    if (dist > this.def.viewRange) return false;
    // facing check: mesh faces -Z when heading = 0 (eyes at z = -0.22),
    // so world facing = (-sin(heading), -cos(heading))
    const fx = -Math.sin(this.heading), fz = -Math.cos(this.heading);
    const dot = (dx * fx + dz * fz) / (dist || 1);
    const halfAngle = dist < 1.6 ? Math.PI : this.def.viewAngle; // point-blank = seen
    if (dot < Math.cos(halfAngle)) return false;
    return losClear(this.pos.x, this.pos.y, px, pz, this.occluders);
  }

  // how loudly does it hear the player right now? (0..100 effective)
  _heardLevel(px, pz, noise) {
    const dist = Math.hypot(px - this.pos.x, pz - this.pos.y);
    if (dist > this.def.hearRange) return 0;
    const falloff = 1 - dist / this.def.hearRange;
    return noise * falloff;
  }

  // maximum noise the player could make right now without alerting us (for HUD)
  safeNoiseAt(px, pz) {
    const dist = Math.hypot(px - this.pos.x, pz - this.pos.y);
    if (dist > this.def.hearRange) return 100;
    const falloff = 1 - dist / this.def.hearRange;
    return Math.min(100, 24 / Math.max(falloff, 0.01));
  }

  _moveToward(tx, tz, speed, dt) {
    const dx = tx - this.pos.x, dz = tz - this.pos.y;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return true;
    const step = Math.min(speed * dt, dist);
    let nx = this.pos.x + (dx / dist) * step;
    let nz = this.pos.y + (dz / dist) * step;
    // ghosts drift through furniture but respect walls (axis-separated slide)
    const r = 0.45;
    const hits = (x, z) => {
      for (const b of this.walls) {
        if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
      }
      return false;
    };
    if (!hits(nx, this.pos.y)) this.pos.x = nx;
    if (!hits(this.pos.x, nz)) this.pos.y = nz;
    // face movement direction (mesh faces -Z at heading 0 => heading = atan2(-dx, -dz))
    const targetHeading = Math.atan2(-dx, -dz);
    let dh = targetHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += dh * Math.min(1, dt * 6);
    return dist < 0.35;
  }

  _followPath(speed, dt) {
    if (!this.path || this.path.length === 0) return true;
    const [tx, tz] = this.path[0];
    if (this._moveToward(tx, tz, speed, dt)) this.path.shift();
    return this.path.length === 0;
  }

  _routeTo(x, z) {
    // straight line if clear, otherwise nav-graph path through doorways
    if (losClear(this.pos.x, this.pos.y, x, z, this.walls, 0.5)) {
      this.path = [[x, z]];
    } else {
      this.path = this.nav.findPath(this.pos.x, this.pos.y, x, z);
      // drop leading waypoints that are behind us
      while (this.path.length > 1) {
        const [ax, az] = this.path[0];
        if (Math.hypot(ax - this.pos.x, az - this.pos.y) < 0.6) this.path.shift();
        else break;
      }
    }
    this.pathAge = 0;
  }

  update(dt, player, onSpotted) {
    this.t += dt;
    const px = player.pos.x, pz = player.pos.z;
    const dist = Math.hypot(px - this.pos.x, pz - this.pos.y);

    this.seesPlayer = this._checkVision(px, pz, player.noise);
    const heard = this._heardLevel(px, pz, player.noise);

    // suspicion builds while seen (faster when close), decays otherwise
    if (this.seesPlayer) {
      const rate = dist < 4 ? 4.0 : dist < 7 ? 1.8 : 1.1;
      this.suspicion = Math.min(1, this.suspicion + rate * dt);
    } else {
      this.suspicion = Math.max(0, this.suspicion - 0.5 * dt);
    }

    const wasChasing = this.state === 'chase';

    // --- state transitions -------------------------------------------------
    if (this.suspicion >= 1 || (this.seesPlayer && this.state === 'chase') || heard > 55) {
      if (!wasChasing) onSpotted?.(this);
      this.state = 'chase';
      this.target.set(px, pz);
    } else if (this.state === 'chase') {
      // lost sight: head to last known position, then search
      if (Math.hypot(this.target.x - this.pos.x, this.target.y - this.pos.y) < 0.6) {
        this.state = 'search';
        this.searchTimer = 3.5;
      }
    } else if (heard > 24 && this.state !== 'investigate') {
      this.state = 'investigate';
      this.target.set(px, pz);
      this._routeTo(px, pz);
    } else if (this.state === 'investigate' && heard > 24) {
      this.target.set(px, pz); // keep tracking the sound
      this.pathAge += dt;
      if (this.pathAge > 0.7) this._routeTo(px, pz);
    }

    // --- state behaviour ---------------------------------------------------
    let speed = this.def.speed;
    if (this.state === 'chase') {
      speed = this.def.chaseSpeed;
      if (this.seesPlayer || heard > 20) this.target.set(px, pz);
      this.pathAge += dt;
      if (!this.path || this.pathAge > 0.5) this._routeTo(this.target.x, this.target.y);
      this._followPath(speed, dt);
    } else if (this.state === 'investigate') {
      if (!this.path) this._routeTo(this.target.x, this.target.y);
      if (this._followPath(speed * 1.25, dt)) {
        this.state = 'search';
        this.searchTimer = 2.5;
      }
    } else if (this.state === 'search') {
      this.searchTimer -= dt;
      this.heading += dt * 1.6 * Math.sin(this.t * 1.3); // look around
      if (this.searchTimer <= 0) {
        this.state = 'patrol';
        this.path = null;
        // resume patrol from the nearest waypoint
        let best = 0, bestD = Infinity;
        this.def.waypoints.forEach(([wx, wz], i) => {
          const d = Math.hypot(wx - this.pos.x, wz - this.pos.y);
          if (d < bestD) { bestD = d; best = i; }
        });
        this.wpIndex = best;
        this._routeTo(...this.def.waypoints[this.wpIndex]);
      }
    } else { // patrol
      const [wx, wz] = this.def.waypoints[this.wpIndex];
      if (!this.path) this._routeTo(wx, wz);
      if (this._followPath(speed, dt)) {
        this.wpIndex = (this.wpIndex + 1) % this.def.waypoints.length;
        this._routeTo(...this.def.waypoints[this.wpIndex]);
      }
    }

    // --- presentation ------------------------------------------------------
    const color = STATE_COLORS[this.state];
    this.eyeMat.color.setHex(color);
    this.aura.color.setHex(this.state === 'chase' ? 0xff2a1a : this.def.tint);
    this.aura.intensity = this.state === 'chase' ? 10 : 4.5 + 1.2 * Math.sin(this.t * 2.1);
    this.body.rotation.y = 0.1 * Math.sin(this.t * 0.9);
    this._syncMesh();
    this.mesh.position.y += 0.12 * Math.sin(this.t * 1.7); // ghostly hover

    return dist; // caller uses distance for heartbeat / catch check
  }
}
