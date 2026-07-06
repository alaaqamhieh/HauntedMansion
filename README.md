# The Blackwood Case 🗝

A 3D first-person stealth game in the browser. You are a detective searching
Blackwood Manor for the key to its locked basement — while the things that
haunt its halls hunt you by sound and sight.

## How to play

- **W A S D** or **Arrow keys** — move, **mouse** — look
- **Enter**, **E**, or **mouse click** — interact (when a prompt is shown)
- Hold **SHIFT** or **C** to sneak (quiet), hold **SPACE** to run (loud)
- **F** — flashlight on/off: light helps you see but makes you visible farther;
  darkness hides you
- Hide inside **wardrobes** — but if something watched you climb in, it knows
- Avoid the dark, warped **creaky floorboards**: they scream underfoot
- Collect the **6 diary pages** to learn what really happened — find them all
  before opening the basement for the true ending
- The **noise bar** at the bottom shows how much sound you're making. The red
  tick is the loudest you can be right now without the nearest monster hearing
  you — when a monster is close, even walking is too loud. Sneak.
- Monsters also **see**: stay out of their vision cone or break line of sight
  behind walls and tall furniture. Their eye color tells you their state —
  pale (patrolling), amber (investigating a sound), orange (searching),
  red (chasing you).
- Find the **note in the library** to learn where the basement key is hidden
  (its hiding place is randomized every run), grab the key, and reach the
  **basement door** at the end of the west cellar corridor.

## The manor

Eight distinct areas: the Grand Foyer, Library, Dining Room, Kitchen, Study,
Conservatory, the Hallway spine and the Cellar Corridor — each with its own
palette, lighting and furniture. Three ghosts patrol different wings.

## Run locally

Any static file server works — no build step, no dependencies to install
(Three.js is vendored in `lib/`):

```sh
python3 -m http.server 8000
# or: npx serve
```

Then open http://localhost:8000 in a browser.

## Tech

- [Three.js](https://threejs.org/) (vendored, ES modules + import map)
- Procedural everything: canvas-generated textures, primitive-built furniture,
  WebAudio-synthesized sound (ambient drone, footsteps, heartbeat, stingers)
- Monster AI: waypoint patrols, hearing with distance falloff, wall-occluded
  vision cones, and A* pathfinding over a nav graph for chases through doorways
