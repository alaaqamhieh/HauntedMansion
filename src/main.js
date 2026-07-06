// The Blackwood Case — entry point. Wires renderer, house, player, monsters,
// HUD and audio into the menu → playing → caught/win state machine, and runs
// the story (diary pages, portraits, two endings) and the storm.
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
const ambient = new THREE.AmbientLight(0x3a3558, 2.2);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0x4a4470, 0x1a1622, 1.2);
scene.add(hemi);

// the detective's flashlight, aimed wherever the camera looks
const flashlight = new THREE.SpotLight(0xfff2d0, 40, 16, 0.46, 0.55, 1.6);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.camera.near = 0.3;
flashlight.shadow.camera.far = 18;
flashlight.shadow.bias = -0.002;
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

// shadow flags for furniture: big opaque pieces cast, everything opaque receives
rooms.group.traverse((o) => {
  if (!o.isMesh || o.material?.transparent) return;
  o.receiveShadow = true;
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  if ((o.geometry.boundingSphere?.radius ?? 0) > 0.45) o.castShadow = true;
});

const hud = new HUD();
const audio = new GameAudio();

const player = new Player(
  camera,
  [...wallAABBs, ...rooms.furnitureAABBs],
  rooms.creakBoards,
  () => { audio.creak(); hintOnce('creak', 'A floorboard shrieks under your weight. Watch for the dark, warped boards.'); }
);
const controls = new PointerLockControls(camera, renderer.domElement);

const monsters = MONSTER_DEFS.map((def) => new Monster(def, scene, nav, wallAABBs, occluders));

// ----------------------------------------------------------------- story ----
const DIARY_PAGES = [
  `Page 1 — housemaid's letter: "His Lordship brought something back from the wreck of the Persephone. He keeps it below stairs, and at night... he reads to it."`,
  `Page 2 — tucked behind the portrait: "They painted Edmund a hero of the Navy. What he salvaged from the Persephone was never cargo. God forgive us for keeping it. — E."`,
  `Page 3 — Lady Eleanor's diary: "At dinner the walls knocked back. Thomas laughed and clapped. He says the house is learning to speak."`,
  `Page 4 — kitchen ledger, last entry: "Cook has gone, wages unclaimed. The pantry empties itself by morning. Graves only says: feed it, and it stays quiet below."`,
  `Page 5 — Lord Edmund's hand: "Oct. 30th. The seal weakens. If we cannot hold it, no one must EVER open that door. I have hidden the key where only family would think to look."`,
  `Page 6 — unsigned, water-stained: "The storm is here and it is OUT. Edmund was wrong. It never wanted the house. If you are reading this — we never left. We are still here."`,
];
const TOTAL_PAGES = DIARY_PAGES.length;

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
  pagesFound: 0,
  pageTaken: new Array(TOTAL_PAGES).fill(false),
  lordExamined: false,
  stepEmitted: 0,
  hide: null,          // { w, pursuer } while inside a wardrobe
  lastDetected: 0,
  nextLightning: 7,
  strikeT: -10,
  flashPattern: [0, 0.22, 0.55],
  currentPrompt: null,
  hints: {},
  debugNoPointerLock: false,
};

function hintOnce(id, text) {
  if (game.hints[id]) return;
  game.hints[id] = true;
  hud.toast(text, 6);
}

function setState(s) {
  game.state = s;
  player.enabled = s === 'playing';
  if (s === 'playing') { hud.show(); showOverlay(null); }
  else if (s === 'menu') showOverlay('menu');
  else if (s === 'paused') showOverlay('pause');
  else if (s === 'caught') { hud.hide(); showOverlay('caught'); }
  else if (s === 'win') { hud.hide(); showOverlay('win'); }
}

// Pointer lock can be unavailable (sandboxed iframes, some embeds). Fall back
// to drag-to-look so the game stays playable anywhere.
let dragLook = false;
function enableDragLook() {
  if (dragLook) return;
  dragLook = true;
  game.debugNoPointerLock = true;
  let dragging = false;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  renderer.domElement.addEventListener('mousedown', () => { dragging = true; });
  addEventListener('mouseup', () => { dragging = false; });
  addEventListener('mousemove', (e) => {
    if (!dragging || game.state !== 'playing') return;
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= e.movementX * 0.0025;
    euler.x = Math.max(-1.4, Math.min(1.4, euler.x - e.movementY * 0.0025));
    camera.quaternion.setFromEuler(euler);
  });
  hud.toast('Pointer lock unavailable — hold the mouse button and drag to look around.', 7);
}

function tryLock() {
  try {
    const p = renderer.domElement.requestPointerLock?.();
    if (p?.catch) p.catch(() => enableDragLook());
    setTimeout(() => {
      if (!controls.isLocked && !dragLook) enableDragLook();
    }, 600);
  } catch {
    enableDragLook();
  }
}

document.getElementById('btn-start').addEventListener('click', () => {
  audio.init();
  tryLock();
  setState('playing');
  hud.setObjective('Find out what became of the Blackwoods. A note in the LIBRARY may be a lead — and the basement holds the answer.');
  hud.toast('The door slams shut behind you. Thunder rolls over the manor.', 6);
});
document.getElementById('btn-resume').addEventListener('click', () => {
  if (!dragLook) tryLock();
  setState('playing');
});
document.getElementById('btn-retry').addEventListener('click', () => location.reload());
document.getElementById('btn-again').addEventListener('click', () => location.reload());

controls.addEventListener('unlock', () => {
  if (game.state === 'playing' && !game.debugNoPointerLock) setState('paused');
});

// ---------------------------------------------------------- interaction ----
function nearestInteractable() {
  if (game.hide) return { id: 'exit-wardrobe', label: 'Step out of the wardrobe' };
  const px = player.pos.x, pz = player.pos.z;
  const near = (it) => Math.hypot(it.pos.x - px, it.pos.z - pz) < it.radius;

  for (const p of rooms.pageItems) {
    if (!p.taken && near(p)) return { id: 'page', page: p, label: 'Take the diary page' };
  }
  for (const w of rooms.wardrobes) {
    if (near(w)) return { id: 'wardrobe', wardrobe: w, label: w.label };
  }
  const it = rooms.interactables;
  if (!game.lordExamined && near(it.portraitLord)) return { id: 'lord', label: it.portraitLord.label };
  if (near(it.portraitCousins)) return { id: 'cousins', label: it.portraitCousins.label };
  if (!game.noteRead && near(it.note)) return { id: 'note', label: it.note.label };
  if (!game.hasKey && near(it.key)) return { id: 'key', label: it.key.label };
  if (near(it.door)) return { id: 'door', label: game.hasKey ? 'Unlock the basement door' : 'Try the basement door' };
  return null;
}

function takePage(idx) {
  if (game.pageTaken[idx]) return;
  game.pageTaken[idx] = true;
  game.pagesFound++;
  audio.page();
  hud.setPages(game.pagesFound, TOTAL_PAGES);
  hud.toast(DIARY_PAGES[idx], 9);
  if (game.pagesFound === TOTAL_PAGES) {
    hud.toast(`${DIARY_PAGES[5]}  — You have every page. Now you know the whole story.`, 10);
  }
}

function enterWardrobe(w) {
  // Granny-rule: hiding only works if nothing watched you do it
  const pursuer = monsters.find((m) => m.seesPlayer ||
    (m.state === 'chase' && Math.hypot(m.pos.x - player.pos.x, m.pos.y - player.pos.z) < 8));
  game.hide = { w, pursuer: pursuer ?? null, prev: { x: w.exitAt.x, z: w.exitAt.z } };
  if (pursuer) pursuer.target.set(w.center.x, w.center.z);
  player.hidden = true;
  player.teleport(w.hideAt.x, w.hideAt.z, w.lookYaw);
  document.getElementById('hide-overlay').style.display = 'block';
  hintOnce('hide', 'Hidden. They cannot see you in here — unless one watched you climb in.');
}

function exitWardrobe() {
  const { w } = game.hide;
  game.hide = null;
  player.hidden = false;
  player.teleport(w.exitAt.x, w.exitAt.z);
  document.getElementById('hide-overlay').style.display = 'none';
}

function interact() {
  const found = nearestInteractable();
  if (!found) return;
  if (found.id === 'exit-wardrobe') { exitWardrobe(); return; }
  if (found.id === 'page') { takePage(found.page.id); found.page.taken = true; found.page.mesh.visible = false; return; }
  if (found.id === 'wardrobe') { enterWardrobe(found.wardrobe); return; }
  if (found.id === 'lord') {
    game.lordExamined = true;
    audio.pickup();
    hud.toast('Lord Edmund Blackwood, Captain of the Persephone — painted the year before the wreck. Something crackles behind the frame… a hidden diary page.', 8);
    setTimeout(() => takePage(1), 1200);
    return;
  }
  if (found.id === 'cousins') {
    hud.toast('“The Blackwood Cousins, as they wished to be remembered.” The brass plaque insists they were guardians of realms beyond. The painter has clearly been paid extremely well.', 8);
    return;
  }
  if (found.id === 'note') {
    game.noteRead = true;
    audio.pickup();
    hud.toast(`Solicitor's note: "The basement key was never recovered. Eleanor's diary hints it is ${rooms.keySpot.desc}. Collect any diary pages you find — the family's story matters."`, 9);
    hud.setObjective(`Find the key ${rooms.keySpot.desc.toLowerCase()}. Then reach the basement door in the west cellar corridor. (Diary pages tell the full story.)`);
    return;
  }
  if (found.id === 'key') {
    game.hasKey = true;
    audio.pickup();
    rooms.keyGroup.visible = false;
    hud.keyObtained();
    hud.toast('You take the basement key. Its metal is cold as a grave.', 6);
    hud.setObjective('Reach the basement door — far west, down the cellar corridor. Mr. Graves patrols that hallway…');
    return;
  }
  if (found.id === 'door') {
    audio.doorCreak();
    if (game.hasKey) {
      const winText = document.getElementById('win-text');
      const winPages = document.getElementById('win-pages');
      const winTitle = document.getElementById('win-title');
      if (game.pagesFound >= TOTAL_PAGES) {
        winTitle.textContent = 'THE WHOLE TRUTH';
        winText.textContent = 'The key turns, and you finally understand what waits below: not a monster wearing a house — a family, kept. The thing from the Persephone never wanted Blackwood Manor. It wanted them. You strike a match, breathe once, and go down to set the Blackwoods free.';
        winPages.textContent = `All ${TOTAL_PAGES} diary pages found — true ending.`;
      } else {
        winText.textContent = 'The key turns. The basement door groans open, and cold air rises from the dark below. Whatever the Blackwoods sealed down there, you are about to meet it — though much of their story remains unread upstairs.';
        winPages.textContent = `${game.pagesFound} of ${TOTAL_PAGES} diary pages found — find them all for the whole truth.`;
      }
      setState('win');
    } else {
      hud.toast('Locked tight. There must be a key somewhere in the manor…', 5);
      if (!game.noteRead) hud.setObjective('Find the basement key. A note in the LIBRARY might help.');
    }
  }
}

addEventListener('keydown', (e) => {
  if (game.state !== 'playing') return;
  if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') interact();
  if (e.code === 'KeyF') {
    player.flashlightOn = !player.flashlightOn;
    flashlight.visible = player.flashlightOn;
    hintOnce('torch', player.flashlightOn
      ? 'Flashlight ON — you can see, and be seen, from farther away.'
      : 'Flashlight OFF — darkness hides you, if you can bear it.');
  }
});
// easiest interact of all: click while a prompt is up
renderer.domElement.addEventListener('mousedown', () => {
  if (game.state === 'playing' && game.currentPrompt) interact();
});

// ------------------------------------------------------------ game loop ----
const clock = new THREE.Clock();
let elapsed = 0;

function onSpotted() {
  audio.sting();
}

function caught(byMonster, custom = null) {
  hud.flash();
  audio.caught();
  document.getElementById('caught-text').textContent = custom ??
    `${byMonster.def.name} caught you in the ${ROOMS[roomAt(player.pos.x, player.pos.z) ?? 'hallway'].name.toLowerCase()}. The manor keeps its secrets.`;
  if (game.hide) { document.getElementById('hide-overlay').style.display = 'none'; }
  setState('caught');
  if (controls.isLocked) controls.unlock();
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  for (const f of rooms.flickers) f(elapsed, dt);

  // ------- storm: lightning + thunder (runs in every state, it's weather)
  if (elapsed > game.nextLightning) {
    game.strikeT = elapsed;
    game.nextLightning = elapsed + 18 + Math.random() * 26;
    game.flashPattern = [0, 0.18 + Math.random() * 0.2, 0.5 + Math.random() * 0.35];
    audio.thunder(0.5 + Math.random() * 1.6);
  }
  const sinceStrike = elapsed - game.strikeT;
  let lit = false;
  for (const ft of game.flashPattern) {
    if (sinceStrike >= ft && sinceStrike < ft + 0.09) { lit = true; break; }
  }
  ambient.intensity = lit ? 7 : 2.2;
  hemi.intensity = lit ? 9 : 1.2;
  for (const gm of rooms.windowGlassMats) gm.emissiveIntensity = lit ? 3.2 : 0.35;

  if (game.state === 'playing') {
    player.update(dt);

    // footsteps
    if (!player.hidden) {
      const stride = player.mode === 'run' ? 2.2 : player.mode === 'sneak' ? 1.1 : 1.7;
      if (player.stepDistance - game.stepEmitted > stride) {
        game.stepEmitted = player.stepDistance;
        audio.footstep(player.mode);
      }
    }

    // monsters
    let nearest = Infinity;
    let safeNoise = 100;
    let awareness = 0;
    let worstState = 'patrol';
    let anyChasing = false;
    const rank = { patrol: 0, search: 1, investigate: 2, chase: 3 };
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const whisperData = [];
    for (const m of monsters) {
      const dist = game.freezeMonsters
        ? Math.hypot(m.pos.x - player.pos.x, m.pos.y - player.pos.z)
        : m.update(dt, player, onSpotted);
      nearest = Math.min(nearest, dist);
      safeNoise = Math.min(safeNoise, m.safeNoiseAt(player.pos.x, player.pos.z));
      awareness = Math.max(awareness, m.suspicion);
      if (rank[m.state] > rank[worstState]) worstState = m.state;
      if (m.state === 'chase') anyChasing = true;
      if (m.seesPlayer || m.state === 'chase' || m._heardLevel(player.pos.x, player.pos.z, player.noise) > 15) {
        game.lastDetected = elapsed;
      }
      // stereo whisper cue: pan by which side of your view it is on
      const tox = m.pos.x - player.pos.x, toz = m.pos.y - player.pos.z;
      const len = Math.hypot(tox, toz) || 1;
      const pan = Math.max(-1, Math.min(1, (tox / len) * -camDir.z + (toz / len) * camDir.x));
      whisperData.push({ dist, pan });
      // touching you = caught, unless you're tucked in a wardrobe
      if (!player.hidden && dist < 1.05) caught(m);
    }
    audio.updateWhispers(whisperData);

    // hidden: a pursuer that watched you hide will rip the doors open
    if (game.hide?.pursuer) {
      const p = game.hide.pursuer;
      if (p.state === 'chase') {
        const dw = Math.hypot(p.pos.x - game.hide.w.center.x, p.pos.y - game.hide.w.center.z);
        if (dw < 1.5) caught(p, `${p.def.name} saw you hide. The wardrobe doors splinter open, and cold hands find you in the dark.`);
      } else {
        game.hide.pursuer = null; // it lost interest — you're safe in here
      }
    }

    // tension keeper: too quiet for too long? something comes looking.
    if (elapsed - game.lastDetected > 75) {
      game.lastDetected = elapsed;
      let nearestM = monsters[0], best = Infinity;
      for (const m of monsters) {
        const d = Math.hypot(m.pos.x - player.pos.x, m.pos.y - player.pos.z);
        if (d < best) { best = d; nearestM = m; }
      }
      const room = roomAt(player.pos.x, player.pos.z);
      if (room) {
        const r = ROOMS[room];
        nearestM.nudgeToward((r.x[0] + r.x[1]) / 2, (r.z[0] + r.z[1]) / 2);
      }
    }

    hud.updateNoise(player.noise, safeNoise);
    hud.updateAwareness(awareness, worstState, anyChasing);
    const found = nearestInteractable();
    game.currentPrompt = found;
    hud.setPrompt(found ? `${found.label} <span style="opacity:.55">(or click)</span>` : null);
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
  setNoise: (n) => { player.noise = n; },
  monsters: () => monsters.map((m) => ({
    name: m.def.name, state: m.state, x: m.pos.x, z: m.pos.y,
    suspicion: m.suspicion, sees: m.seesPlayer,
  })),
  grantKey: () => { game.hasKey = true; rooms.keyGroup.visible = false; hud.keyObtained(); },
  freeze: (on) => { game.freezeMonsters = !!on; },
  keySpot: () => rooms.keySpot,
  pages: () => game.pagesFound,
  pageItems: () => rooms.pageItems.map((p) => ({ id: p.id, x: p.pos.x, z: p.pos.z, taken: p.taken })),
  wardrobes: () => rooms.wardrobes.map((w) => ({ x: w.pos.x, z: w.pos.z })),
  hidden: () => player.hidden,
  flashlight: (on) => {
    if (on !== undefined) { player.flashlightOn = on; flashlight.visible = on; }
    return player.flashlightOn;
  },
  interact,
  roomAt,
};

// -------------------------------------------------------------- startup ----
document.getElementById('loading').classList.add('hidden');
setState('menu');
tick();
