// The Blackwood Case — entry point. Wires renderer, house, player, monsters,
// HUD and audio into the menu → playing → caught/win state machine.
import * as THREE from 'three';
import { PointerLockControls } from '../lib/PointerLockControls.js';
import { buildHouse, buildNavGraph, roomAt, ROOMS } from './house.js';
import { furnishRooms } from './rooms.js';
import { Player } from './player.js';
import { Monster, MONSTER_DEFS } from './monster.js';
import { HUD } from './hud.js';
import { GameAudio } from './audio.js';

const app = document.getElementById('app');

// ------------------------------------------------------------- renderer ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050409);
scene.fog = new THREE.FogExp2(0x050409, 0.038);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 60);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// base light: near-darkness with a cold moon tint
scene.add(new THREE.AmbientLight(0x3a3558, 2.2));
const hemi = new THREE.HemisphereLight(0x4a4470, 0x1a1622, 1.2);
scene.add(hemi);

// the detective's flashlight, aimed wherever the camera looks
const flashlight = new THREE.SpotLight(0xfff2d0, 40, 16, 0.46, 0.55, 1.6);
camera.add(flashlight);
flashlight.position.set(0.12, -0.18, 0.05);
const flashTarget = new THREE.Object3D();
camera.add(flashTarget);
flashTarget.position.set(0, -0.12, -6);
flashlight.target = flashTarget;
scene.add(camera);

// --------------------------------------------------------------- world ----
const { wallAABBs } = buildHouse(scene);
const rooms = furnishRooms(scene);
const nav = buildNavGraph(wallAABBs);
const occluders = [...wallAABBs, ...rooms.occluders];

const player = new Player(camera, [...wallAABBs, ...rooms.furnitureAABBs]);
const controls = new PointerLockControls(camera, renderer.domElement);

const monsters = MONSTER_DEFS.map((def) => new Monster(def, scene, nav, wallAABBs, occluders));

const hud = new HUD();
const audio = new GameAudio();

// ---------------------------------------------------------------- state ----
const overlays = {
  menu: document.getElementById('menu-overlay'),
  pause: document.getElementById('pause-overlay'),
  caught: document.getElementById('caught-overlay'),
  win: document.getElementById('win-overlay'),
};
function showOverlay(name) {
  for (const [k, el] of Object.entries(overlays)) el.classList.toggle('hidden', k !== name);
}

const game = {
  state: 'menu',       // menu | playing | paused | caught | win
  hasKey: false,
  noteRead: false,
  stepEmitted: 0,
  debugNoPointerLock: false,
};

function setState(s) {
  game.state = s;
  player.enabled = s === 'playing';
  if (s === 'playing') { hud.show(); showOverlay(null); }
  else if (s === 'menu') showOverlay('menu');
  else if (s === 'paused') showOverlay('pause');
  else if (s === 'caught') { hud.hide(); showOverlay('caught'); }
  else if (s === 'win') { hud.hide(); showOverlay('win'); }
}

document.getElementById('btn-start').addEventListener('click', () => {
  audio.init();
  controls.lock();
  setState('playing');
  hud.toast('Find the key to the basement. Quietly.', 6);
});
document.getElementById('btn-resume').addEventListener('click', () => {
  controls.lock();
  setState('playing');
});
document.getElementById('btn-retry').addEventListener('click', () => location.reload());
document.getElementById('btn-again').addEventListener('click', () => location.reload());

controls.addEventListener('unlock', () => {
  if (game.state === 'playing' && !game.debugNoPointerLock) setState('paused');
});

// ---------------------------------------------------------- interaction ----
function nearestInteractable() {
  const px = player.pos.x, pz = player.pos.z;
  const list = [];
  if (!game.noteRead) list.push(['note', rooms.interactables.note]);
  if (!game.hasKey) list.push(['key', rooms.interactables.key]);
  list.push(['door', rooms.interactables.door]);
  for (const [id, it] of list) {
    if (Math.hypot(it.pos.x - px, it.pos.z - pz) < it.radius) return id;
  }
  return null;
}

function interact() {
  const id = nearestInteractable();
  if (!id) return;
  if (id === 'note') {
    game.noteRead = true;
    audio.pickup();
    hud.toast(`Diary, Oct. 3rd — "They walk the halls now. I couldn't risk carrying it any longer. I hid the basement key ${rooms.keySpot.desc}."`, 9);
    hud.setObjective(`Find the key ${rooms.keySpot.desc.toLowerCase()}. Then reach the basement door in the west cellar corridor.`);
  } else if (id === 'key') {
    game.hasKey = true;
    audio.pickup();
    rooms.keyGroup.visible = false;
    hud.keyObtained();
    hud.toast('You take the basement key. Its metal is cold as a grave.', 6);
    hud.setObjective('Reach the basement door — far west, down the cellar corridor.');
  } else if (id === 'door') {
    if (game.hasKey) {
      audio.doorCreak();
      setState('win');
    } else {
      audio.doorCreak();
      hud.toast('Locked tight. There must be a key somewhere in the manor…', 5);
      if (!game.noteRead) hud.setObjective('Find the basement key. A note in the LIBRARY might help.');
    }
  }
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && game.state === 'playing') interact();
});

// ------------------------------------------------------------ game loop ----
const clock = new THREE.Clock();
let elapsed = 0;

function onSpotted() {
  audio.sting();
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  for (const f of rooms.flickers) f(elapsed, dt);

  if (game.state === 'playing') {
    player.update(dt);

    // footsteps
    const stride = player.mode === 'run' ? 2.2 : player.mode === 'sneak' ? 1.1 : 1.7;
    if (player.stepDistance - game.stepEmitted > stride) {
      game.stepEmitted = player.stepDistance;
      audio.footstep(player.mode);
    }

    // monsters
    let nearest = Infinity;
    let safeNoise = 100;
    let awareness = 0;
    let worstState = 'patrol';
    let anyChasing = false;
    const rank = { patrol: 0, search: 1, investigate: 2, chase: 3 };
    for (const m of monsters) {
      const dist = m.update(dt, player, onSpotted);
      nearest = Math.min(nearest, dist);
      safeNoise = Math.min(safeNoise, m.safeNoiseAt(player.pos.x, player.pos.z));
      awareness = Math.max(awareness, m.suspicion);
      if (rank[m.state] > rank[worstState]) worstState = m.state;
      if (m.state === 'chase') anyChasing = true;
      if (dist < 1.05) {
        hud.flash();
        audio.caught();
        document.getElementById('caught-text').textContent =
          `${m.def.name} caught you in the ${ROOMS[roomAt(player.pos.x, player.pos.z) ?? 'hallway'].name.toLowerCase()}. The manor keeps its secrets.`;
        setState('caught');
        if (controls.isLocked) controls.unlock();
      }
    }

    hud.updateNoise(player.noise, safeNoise);
    hud.updateAwareness(awareness, worstState, anyChasing);
    hud.setPrompt(
      { note: 'Read the note', key: 'Take the basement key', door: game.hasKey ? 'Unlock the basement door' : 'Try the door' }[nearestInteractable()] ?? null
    );
    audio.updateHeartbeat(dt, nearest, anyChasing);
  }

  renderer.render(scene, camera);
}

// ------------------------------------------------------------ debug hook ----
// Used by automated tests (Playwright) — lets the game run without pointer lock.
window.__game = {
  state: () => game.state,
  start(noPointerLock = true) {
    game.debugNoPointerLock = noPointerLock;
    setState('playing');
  },
  teleport: (x, z, yaw) => player.teleport(x, z, yaw),
  playerPos: () => ({ x: player.pos.x, z: player.pos.z }),
  setKeys: (k) => Object.assign(player.keys, k),
  noise: () => player.noise,
  monsters: () => monsters.map((m) => ({
    name: m.def.name, state: m.state, x: m.pos.x, z: m.pos.y,
    suspicion: m.suspicion, sees: m.seesPlayer,
  })),
  grantKey: () => { game.hasKey = true; rooms.keyGroup.visible = false; hud.keyObtained(); },
  keySpot: () => rooms.keySpot,
  interact,
  roomAt,
};

// -------------------------------------------------------------- startup ----
document.getElementById('loading').classList.add('hidden');
setState('menu');
tick();
