import React, { memo, useEffect, useReducer, useRef, JSX } from "react";
import "./App.css";
import { initAudio } from "./audio";
import {
  Boom,
  CELLS,
  createState,
  State,
  startGame,
  T,
  Tank,
  update,
  W,
} from "./game";

const KEYS: Record<string, number> = {
  ArrowUp: 0,
  KeyW: 0,
  ArrowRight: 1,
  KeyD: 1,
  ArrowDown: 2,
  KeyS: 2,
  ArrowLeft: 3,
  KeyA: 3,
};
const FIRE = new Set(["Space", "KeyJ", "KeyK"]);

const Defs = () => (
  <defs>
    <pattern id="brick" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#b8481f" />
      <path d="M0 0H8M0 4H8M2 0V4M6 4V8" stroke="#2a0e05" strokeWidth=".7" />
    </pattern>
    <pattern id="steel" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#8c8c8c" />
      <rect x="1" y="1" width="6" height="6" fill="#e2e2e2" />
      <rect x="2.5" y="2.5" width="3" height="3" fill="#777" />
    </pattern>
    <pattern id="water" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#2150d8" />
      <path
        d="M0 3Q2 1 4 3T8 3M0 7Q2 5 4 7T8 7"
        stroke="#9db8ff"
        strokeWidth=".7"
        fill="none"
      />
    </pattern>
    <pattern id="forest" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#1b7a26" />
      <circle cx="2" cy="2" r="1.5" fill="#46c04f" />
      <circle cx="6" cy="6" r="1.5" fill="#46c04f" />
      <circle cx="6" cy="2" r="1" fill="#0f4d17" />
      <circle cx="2" cy="6" r="1" fill="#0f4d17" />
    </pattern>
  </defs>
);

const FILL: Record<number, string> = {
  1: "brick",
  2: "steel",
  3: "water",
  4: "forest",
};

// Terrain only re-renders when `ver` changes (a brick was destroyed).
const Terrain = memo(function Terrain({
  grid,
  ver,
  forest,
}: {
  grid: number[][];
  ver: number;
  forest: boolean;
}) {
  const out: JSX.Element[] = [];
  grid.forEach((row, y) =>
    row.forEach((c, x) => {
      if (FILL[c] && (c === 4) === forest)
        out.push(
          <rect
            key={y * CELLS + x}
            x={x * T}
            y={y * T}
            width={T}
            height={T}
            fill={`url(#${FILL[c]})`}
          />,
        );
    }),
  );
  return <g data-ver={ver}>{out}</g>;
});

const COLORS = [
  ["#f2c400", "#8a6a00"],
  ["#c9c9c9", "#6a6a6a"],
  ["#eeeeee", "#8f8f8f"],
  ["#3aa94a", "#14561d"],
];

const TankG = ({ t, tick }: { t: Tank; tick: number }) => {
  if (t.spawn > 0)
    return (
      <circle
        cx={t.x + 8}
        cy={t.y + 8}
        r={3 + (t.spawn % 16) / 2}
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
      />
    );
  const [c, d] = t.player
    ? COLORS[0]
    : t.kind === 2 && t.hp > 1
      ? COLORS[3]
      : COLORS[t.kind + 1 > 2 ? 2 : t.kind + 1];
  const off = (t.x + t.y) % 2;
  return (
    <g
      transform={`translate(${t.x} ${t.y}) rotate(${t.dir * 90} 8 8)`}
      opacity={t.inv > 0 && tick % 8 < 4 ? 0.4 : 1}
    >
      <rect x="1" y="1" width="3.5" height="14" fill={d} />
      <rect x="11.5" y="1" width="3.5" height="14" fill={d} />
      <line
        x1="2.75"
        x2="2.75"
        y1="1"
        y2="15"
        stroke="#000"
        strokeWidth="3.5"
        strokeDasharray="1 1"
        strokeDashoffset={off}
        opacity=".5"
      />
      <line
        x1="13.25"
        x2="13.25"
        y1="1"
        y2="15"
        stroke="#000"
        strokeWidth="3.5"
        strokeDasharray="1 1"
        strokeDashoffset={off}
        opacity=".5"
      />
      <rect x="4.5" y="3" width="7" height="10" fill={c} />
      <rect
        x="6.5"
        y="-1"
        width="3"
        height="8"
        fill={c}
        stroke={d}
        strokeWidth=".5"
      />
      <circle cx="8" cy="8.5" r="2.6" fill={d} />
    </g>
  );
};

const Eagle = ({ dead }: { dead: boolean }) => (
  <g transform="translate(96 192)">
    <rect width="16" height="16" fill="#111" />
    {dead ? (
      <path d="M2 14L6 8L8 11L11 5L14 14Z" fill="#666" />
    ) : (
      <path
        d="M8 1L11 5L15 4L12 9L13 14H3L4 9L1 4L5 5Z"
        fill="#d8d8d8"
        stroke="#888"
        strokeWidth=".6"
      />
    )}
  </g>
);

const BoomG = ({ b }: { b: Boom }) => {
  const k = b.t / b.max;
  return (
    <g opacity={1 - k * 0.5}>
      <circle
        cx={b.x}
        cy={b.y}
        r={2 + k * (b.max > 10 ? 14 : 6)}
        fill="#ff9a1f"
      />
      <circle
        cx={b.x}
        cy={b.y}
        r={1 + k * (b.max > 10 ? 8 : 3)}
        fill="#fff3a0"
      />
    </g>
  );
};

const Msg = ({
  y,
  children,
  size = 12,
}: {
  y: number;
  children: React.ReactNode;
  size?: number;
}) => (
  <text
    x={W / 2}
    y={y}
    textAnchor="middle"
    fill="#fff"
    fontSize={size}
    fontFamily="'Press Start 2P', monospace"
  >
    {children}
  </text>
);

export default function App() {
  const S = useRef<State>(createState());
  const [, force] = useReducer((n: number) => n + 1, 0);
  const s = S.current;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      initAudio();
      const st = S.current;
      if (e.code in KEYS || FIRE.has(e.code)) e.preventDefault();
      if (e.code in KEYS) {
        const h = st.input.held.filter((k) => k !== KEYS[e.code]);
        st.input.held = [...h, KEYS[e.code]];
      } else if (FIRE.has(e.code)) st.input.fire = true;
      else if (
        e.code === "Enter" &&
        (st.phase === "menu" || st.phase === "over")
      )
        startGame(st);
      else if (e.code === "KeyP")
        st.phase =
          st.phase === "play"
            ? "pause"
            : st.phase === "pause"
              ? "play"
              : st.phase;
    };
    const up = (e: KeyboardEvent) => {
      const st = S.current;
      if (e.code in KEYS)
        st.input.held = st.input.held.filter((k) => k !== KEYS[e.code]);
      else if (FIRE.has(e.code)) st.input.fire = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    let raf = 0,
      last = performance.now(),
      acc = 0;
    const loop = (now: number) => {
      acc += Math.min(now - last, 100);
      last = now;
      while (acc >= 1000 / 60) {
        update(S.current);
        acc -= 1000 / 60;
      }
      force();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const playing = s.phase !== "menu";
  return (
    <div className="app">
      <svg
        viewBox={`0 0 ${W + 32} ${W}`}
        className="screen"
        shapeRendering="crispEdges"
      >
        <Defs />
        <rect width={W + 32} height={W} fill="#636363" />
        <rect width={W} height={W} fill="#000" />
        {playing && (
          <>
            <Terrain grid={s.grid} ver={s.ver} forest={false} />
            <Eagle dead={s.baseDead} />
            {s.tanks.map((t) => (
              <TankG key={t.id} t={t} tick={s.t} />
            ))}
            {s.bullets.map((b, i) => (
              <rect
                key={i}
                x={b.x - 1.5}
                y={b.y - 1.5}
                width="3"
                height="3"
                fill="#ddd"
              />
            ))}
            <Terrain grid={s.grid} ver={s.ver} forest />
            {s.booms.map((b, i) => (
              <BoomG key={i} b={b} />
            ))}
            {/* HUD */}
            {Array.from({ length: s.toSpawn }, (_, i) => (
              <rect
                key={i}
                x={W + 8 + (i % 2) * 9}
                y={8 + Math.floor(i / 2) * 9}
                width="7"
                height="7"
                fill="#222"
                stroke="#bbb"
                strokeWidth=".8"
              />
            ))}
            <text
              x={W + 4}
              y={130}
              fill="#000"
              fontSize="7"
              fontFamily="'Press Start 2P', monospace"
            >
              IP
            </text>
            <text
              x={W + 4}
              y={142}
              fill="#000"
              fontSize="8"
              fontFamily="'Press Start 2P', monospace"
            >
              ♥{Math.max(s.lives, 0)}
            </text>
            <text
              x={W + 4}
              y={170}
              fill="#000"
              fontSize="7"
              fontFamily="'Press Start 2P', monospace"
            >
              ST
            </text>
            <text
              x={W + 4}
              y={182}
              fill="#000"
              fontSize="8"
              fontFamily="'Press Start 2P', monospace"
            >
              {s.level}
            </text>
            <text
              x={W + 4}
              y={202}
              fill="#000"
              fontSize="5"
              fontFamily="'Press Start 2P', monospace"
            >
              {s.score}
            </text>
          </>
        )}
        {s.phase === "menu" && (
          <>
            <Msg y={70} size={18}>
              TANKS
            </Msg>
            <Msg y={100} size={7}>
              ARROWS / WASD MOVE
            </Msg>
            <Msg y={114} size={7}>
              SPACE FIRE P PAUSE
            </Msg>
            <Msg y={150} size={8}>
              PRESS ENTER
            </Msg>
          </>
        )}
        {s.phase === "pause" && <Msg y={W / 2}>PAUSED</Msg>}
        {s.phase === "clear" && <Msg y={W / 2}>STAGE CLEAR</Msg>}
        {s.phase === "over" && (
          <>
            <Msg y={W / 2 - 6} size={14}>
              GAME OVER
            </Msg>
            <Msg y={W / 2 + 14} size={7}>
              ENTER TO RETRY
            </Msg>
          </>
        )}
      </svg>
    </div>
  );
}
