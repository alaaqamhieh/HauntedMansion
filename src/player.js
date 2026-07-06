// First-person movement: sneak / walk / run, circle-vs-AABB collision and
// the noise level that feeds the stealth system. Also tracks the flashlight
// state (Thief-style light stealth) and the hidden-in-wardrobe state.
import * as THREE from 'three';

export const EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.35;

const SPEED = { sneak: 1.6, walk: 3.2, run: 5.6 };
const NOISE = { sneak: 12, walk: 45, run: 90 };

export class Player {
  constructor(camera, colliders, creakBoards = [], onCreak = null) {
    this.camera = camera;
    this.colliders = colliders; // walls + furniture AABBs
    this.creakBoards = creakBoards;
    this.onCreak = onCreak;
    this.pos = new THREE.Vector3(0, EYE_HEIGHT, -6.5); // foyer spawn
    this.keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
    this.noise = 0;          // 0..100, decays when still
    this.moving = false;
    this.mode = 'walk';
    this.stepDistance = 0;   // accumulates for footstep sounds
    this.enabled = false;
    this.hidden = false;     // inside a wardrobe: invisible + immobile
    this.flashlightOn = true;
    this._onBoard = false;
    camera.position.copy(this.pos);
    camera.rotation.set(0, Math.PI, 0); // face the foyer doorway (south)

    addEventListener('keydown', (e) => this._key(e, true));
    addEventListener('keyup', (e) => this._key(e, false));
  }

  _key(e, down) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.keys.w = down; e.preventDefault(); break;
      case 'KeyA': case 'ArrowLeft': this.keys.a = down; e.preventDefault(); break;
      case 'KeyS': case 'ArrowDown': this.keys.s = down; e.preventDefault(); break;
      case 'KeyD': case 'ArrowRight': this.keys.d = down; e.preventDefault(); break;
      case 'ShiftLeft': case 'ShiftRight': case 'KeyC': this.keys.shift = down; break;
      case 'Space': this.keys.space = down; e.preventDefault(); break;
    }
  }

  _collides(x, z) {
    for (const b of this.colliders) {
      if (x > b.minX - PLAYER_RADIUS && x < b.maxX + PLAYER_RADIUS &&
          z > b.minZ - PLAYER_RADIUS && z < b.maxZ + PLAYER_RADIUS) return true;
    }
    return false;
  }

  _overCreakBoard() {
    for (const b of this.creakBoards) {
      if (this.pos.x > b.minX && this.pos.x < b.maxX &&
          this.pos.z > b.minZ && this.pos.z < b.maxZ) return true;
    }
    return false;
  }

  update(dt) {
    if (this.hidden) { // crouched in a wardrobe: silent and still
      this.moving = false;
      this.noise = Math.max(0, this.noise - 60 * dt);
      return;
    }

    const k = this.keys;
    let fwd = (k.w ? 1 : 0) - (k.s ? 1 : 0);
    let strafe = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    this.moving = this.enabled && (fwd !== 0 || strafe !== 0);

    this.mode = k.shift ? 'sneak' : (k.space ? 'run' : 'walk');
    const speed = SPEED[this.mode];

    if (this.moving) {
      // camera-relative movement on the XZ plane
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      dir.y = 0; dir.normalize();
      const right = new THREE.Vector3(dir.z, 0, -dir.x).negate();
      const move = new THREE.Vector3()
        .addScaledVector(dir, fwd)
        .addScaledVector(right, strafe);
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);

      // axis-separated resolution => wall sliding
      let nx = this.pos.x + move.x;
      if (!this._collides(nx, this.pos.z)) this.pos.x = nx;
      let nz = this.pos.z + move.z;
      if (!this._collides(this.pos.x, nz)) this.pos.z = nz;

      this.stepDistance += speed * dt;

      // noise rises quickly toward the target for the current gait
      const target = NOISE[this.mode];
      this.noise += (target - this.noise) * Math.min(1, dt * 6);

      // creaky floorboards betray you (worse when moving fast)
      const onBoard = this._overCreakBoard();
      if (onBoard && !this._onBoard) {
        const spike = this.mode === 'sneak' ? 48 : 100;
        this.noise = Math.max(this.noise, spike);
        this.onCreak?.(this.mode);
      }
      this._onBoard = onBoard;
    } else {
      this.noise += (0 - this.noise) * Math.min(1, dt * 3.5);
      if (this.noise < 0.5) this.noise = 0;
      this._onBoard = this._overCreakBoard();
    }

    // subtle head-bob
    const bobAmp = this.moving ? (this.mode === 'run' ? 0.05 : this.mode === 'sneak' ? 0.015 : 0.03) : 0;
    this._bobT = (this._bobT || 0) + dt * speed * 2.2;
    const bob = Math.sin(this._bobT) * bobAmp;
    const crouch = this.mode === 'sneak' ? -0.25 : 0;

    this.camera.position.set(this.pos.x, EYE_HEIGHT + bob + crouch, this.pos.z);
  }

  teleport(x, z, yaw = null) {
    this.pos.set(x, EYE_HEIGHT, z);
    this.camera.position.copy(this.pos);
    if (yaw !== null) this.camera.rotation.set(0, yaw, 0, 'YXZ');
  }
}
