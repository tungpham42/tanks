import { sfx } from "./audio";

export const T = 8; // cell size (a tank is 2x2 cells)
export const CELLS = 26;
export const W = CELLS * T; // 208
export type Dir = 0 | 1 | 2 | 3; // up right down left
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

// . empty  B brick  S steel  W water  F forest  E eagle (base) — one char = 2x2 cells
const LEVELS = [
  [
    ".............",
    ".BB.BB.BB.BB.",
    ".BB.BB.BB.BB.",
    ".BB.BBSBB.BB.",
    ".BB.......BB.",
    "SS.BB.W.BB.SS",
    "...BB.W.BB...",
    ".BB..FFF..BB.",
    ".BB.BB.BB.BB.",
    ".BB.BB.BB.BB.",
    ".....WWW.....",
    "..BB.BBB.BB..",
    ".....BEB.....",
  ],
  [
    ".............",
    ".S.B.B.B.B.S.",
    ".S.B.B.B.B.S.",
    "...B.BSB.B...",
    "BB.........BB",
    "...WW.S.WW...",
    "FF.WW...WW.FF",
    "FF.BB...BB.FF",
    "...BB.S.BB...",
    ".BB.......BB.",
    ".BB.BBBBB.BB.",
    "..S.BBBBB.S..",
    ".....BEB.....",
  ],
];

export interface Tank {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  player: boolean;
  kind: number;
  hp: number;
  cd: number;
  spawn: number;
  inv: number;
  turn: number;
}
export interface Bullet {
  x: number;
  y: number;
  dir: Dir;
  player: boolean;
  owner: number;
  sp: number;
  dead?: boolean;
}
export interface Boom {
  x: number;
  y: number;
  t: number;
  max: number;
}
export type Phase = "menu" | "play" | "pause" | "over" | "clear";
export interface State {
  phase: Phase;
  grid: number[][];
  tanks: Tank[];
  bullets: Bullet[];
  booms: Boom[];
  level: number;
  lives: number;
  score: number;
  toSpawn: number;
  spawned: number;
  spawnT: number;
  t: number;
  timer: number;
  ver: number;
  baseDead: boolean;
  nextId: number;
  input: { held: number[]; fire: boolean };
}

// grid values: 0 empty, 1 brick, 2 steel, 3 water, 4 forest, 6 base
const CODE: Record<string, number> = { ".": 0, B: 1, S: 2, W: 3, F: 4, E: 6 };
const SOLID = new Set([1, 2, 3, 6]);

export function createState(): State {
  return {
    phase: "menu",
    grid: [],
    tanks: [],
    bullets: [],
    booms: [],
    level: 1,
    lives: 3,
    score: 0,
    toSpawn: 0,
    spawned: 0,
    spawnT: 0,
    t: 0,
    timer: 0,
    ver: 0,
    baseDead: false,
    nextId: 1,
    input: { held: [], fire: false },
  };
}

export function startGame(s: State) {
  s.score = 0;
  s.lives = 3;
  startLevel(s, 1);
  sfx.start();
}

function startLevel(s: State, n: number) {
  const map = LEVELS[(n - 1) % LEVELS.length];
  s.grid = Array.from({ length: CELLS }, () => Array(CELLS).fill(0));
  map.forEach((row, ty) =>
    row.split("").forEach((ch, tx) => {
      for (let i = 0; i < 4; i++)
        s.grid[ty * 2 + (i >> 1)][tx * 2 + (i & 1)] = CODE[ch];
    }),
  );
  s.level = n;
  s.phase = "play";
  s.bullets = [];
  s.booms = [];
  s.baseDead = false;
  s.toSpawn = 20;
  s.spawned = 0;
  s.spawnT = 60;
  s.ver++;
  s.tanks = [
    {
      id: 0,
      x: 64,
      y: 192,
      dir: 0,
      player: true,
      kind: 0,
      hp: 1,
      cd: 0,
      spawn: 0,
      inv: 150,
      turn: 0,
    },
  ];
}

function blocked(s: State, x: number, y: number, self: Tank) {
  if (x < 0 || y < 0 || x > W - 16 || y > W - 16) return true;
  for (let cy = Math.floor(y / T); cy <= Math.floor((y + 15) / T); cy++)
    for (let cx = Math.floor(x / T); cx <= Math.floor((x + 15) / T); cx++)
      if (SOLID.has(s.grid[cy][cx])) return true;
  return s.tanks.some(
    (o) =>
      o !== self &&
      o.spawn <= 0 &&
      Math.abs(o.x - x) < 16 &&
      Math.abs(o.y - y) < 16,
  );
}

function move(s: State, t: Tank, d: Dir) {
  if (d !== t.dir) {
    // snap to the 8px grid on turn so corridors are easy to enter
    const sx = d % 2 === 0 ? Math.round(t.x / T) * T : t.x;
    const sy = d % 2 === 1 ? Math.round(t.y / T) * T : t.y;
    t.dir = d;
    if (!blocked(s, sx, sy, t)) {
      t.x = sx;
      t.y = sy;
    }
  }
  const nx = t.x + DX[d],
    ny = t.y + DY[d];
  if (blocked(s, nx, ny, t)) return false;
  t.x = nx;
  t.y = ny;
  return true;
}

function fire(s: State, t: Tank) {
  s.bullets.push({
    x: t.x + 8 + DX[t.dir] * 8,
    y: t.y + 8 + DY[t.dir] * 8,
    dir: t.dir,
    player: t.player,
    owner: t.id,
    sp: t.player || t.kind === 1 ? 3 : 2,
  });
  if (t.player) sfx.shoot();
}

const boom = (s: State, x: number, y: number, big: boolean) =>
  s.booms.push({ x, y, t: 0, max: big ? 22 : 8 });

function hit(s: State, t: Tank) {
  if (t.player) {
    if (t.inv > 0) return;
    boom(s, t.x + 8, t.y + 8, true);
    sfx.explode();
    if (--s.lives <= 0) {
      s.phase = "over";
      sfx.engine(false);
      sfx.over();
    } else {
      t.x = 64;
      t.y = 192;
      t.dir = 0;
      t.inv = 150;
    }
  } else if (--t.hp <= 0) {
    s.tanks = s.tanks.filter((o) => o !== t);
    s.score += [100, 200, 400][t.kind];
    boom(s, t.x + 8, t.y + 8, true);
    sfx.explode();
  } else sfx.steel();
}

export function update(s: State) {
  if (s.phase === "clear") {
    if (--s.timer <= 0) startLevel(s, s.level + 1);
    return;
  }
  if (s.phase !== "play") {
    sfx.engine(false);
    return;
  }
  s.t++;

  // player
  const p = s.tanks[0];
  if (p.inv > 0) p.inv--;
  const d = s.input.held[s.input.held.length - 1];
  sfx.engine(d !== undefined && move(s, p, d as Dir));
  if (s.input.fire && !s.bullets.some((b) => b.owner === p.id)) fire(s, p);

  // enemy spawning
  if (--s.spawnT <= 0) {
    s.spawnT = 150;
    const sx = [0, 96, 192][s.spawned % 3];
    if (
      s.toSpawn > 0 &&
      s.tanks.length < 5 &&
      !s.tanks.some((o) => Math.abs(o.x - sx) < 16 && o.y < 16)
    ) {
      const n = s.spawned++;
      const kind = n % 4 === 3 ? 2 : n % 3 === 2 ? 1 : 0;
      s.tanks.push({
        id: s.nextId++,
        x: sx,
        y: 0,
        dir: 2,
        player: false,
        kind,
        hp: kind === 2 ? 4 : 1,
        cd: 30,
        spawn: 40,
        inv: 0,
        turn: 60,
      });
      s.toSpawn--;
    }
  }

  // enemy AI
  for (const e of s.tanks.slice(1)) {
    if (e.spawn > 0) {
      e.spawn--;
      continue;
    }
    if (e.cd > 0) e.cd--;
    if (e.kind === 1 || s.t % 2 === 0) {
      if (--e.turn <= 0 || !move(s, e, e.dir)) {
        e.dir = (
          Math.random() < 0.5 ? 2 : Math.floor(Math.random() * 4)
        ) as Dir;
        e.turn = 40 + Math.floor(Math.random() * 100);
      }
    }
    if (
      e.cd <= 0 &&
      Math.random() < 0.03 &&
      !s.bullets.some((b) => b.owner === e.id)
    ) {
      fire(s, e);
      e.cd = 30;
    }
  }

  // bullets
  for (const b of s.bullets) {
    if (b.dead) continue;
    b.x += DX[b.dir] * b.sp;
    b.y += DY[b.dir] * b.sp;
    if (b.x < 0 || b.y < 0 || b.x >= W || b.y >= W) {
      b.dead = true;
      boom(s, b.x, b.y, false);
      if (b.player) sfx.steel();
      continue;
    }
    const px = DY[b.dir] !== 0 ? 4 : 0,
      py = DX[b.dir] !== 0 ? 4 : 0;
    const fx = b.x + DX[b.dir] * 2,
      fy = b.y + DY[b.dir] * 2;
    for (const [qx, qy] of [
      [fx - px, fy - py],
      [fx + px, fy + py],
    ]) {
      const cx = Math.floor(qx / T),
        cy = Math.floor(qy / T);
      if (cx < 0 || cy < 0 || cx >= CELLS || cy >= CELLS) continue;
      const c = s.grid[cy][cx];
      if (c === 1) {
        s.grid[cy][cx] = 0;
        s.ver++;
        b.dead = true;
        sfx.brick();
      } else if (c === 2) {
        b.dead = true;
        if (b.player) sfx.steel();
      } else if (c === 6 && !s.baseDead) {
        b.dead = true;
        s.baseDead = true;
        s.phase = "over";
        s.ver++;
        boom(s, 104, 200, true);
        sfx.engine(false);
        sfx.explode();
        sfx.over();
      }
    }
    if (b.dead) {
      boom(s, b.x, b.y, false);
      continue;
    }
    for (const o of s.bullets)
      if (
        o !== b &&
        !o.dead &&
        o.player !== b.player &&
        Math.abs(o.x - b.x) < 4 &&
        Math.abs(o.y - b.y) < 4
      ) {
        o.dead = b.dead = true;
      }
    if (b.dead) continue;
    for (const t of s.tanks) {
      if (t.player === b.player || t.spawn > 0) continue;
      if (b.x >= t.x && b.x < t.x + 16 && b.y >= t.y && b.y < t.y + 16) {
        b.dead = true;
        hit(s, t);
        break;
      }
    }
  }
  s.bullets = s.bullets.filter((b) => !b.dead);
  s.booms = s.booms.filter((b) => ++b.t < b.max);

  if (s.phase === "play" && s.toSpawn === 0 && s.tanks.length === 1) {
    s.phase = "clear";
    s.timer = 200;
    sfx.engine(false);
    sfx.clear();
  }
}
