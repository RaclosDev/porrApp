import { POKER_SOUND_HITS } from '../pokerSound';

type Pt = [number, number];

/** Postura de cada fotograma: manos, cabeza, visera y ojos. */
interface Pose {
  L: Pt;
  R: Pt;
  tilt: number;
  dy: number;
  visor: number;
  visorDy: number;
  wink: number;
  blink: number;
}

/** Lo que una acción puede tocar del dibujo, aparte de la postura. */
interface Draw {
  show(name: string, transform?: string, opacity?: number): void;
  attr(name: string, attribute: string, value: string): void;
}

interface Action {
  dur: number;
  /** Segundo de la acción en el que arranca el sonido del aviso. */
  audioAt?: number;
  frame(t: number, p: Pose, d: Draw): void;
}

const SHOULDER: { L: Pt; R: Pt } = { L: [76, 126], R: [124, 126] };
const REST: { L: Pt; R: Pt } = { L: [40, 158], R: [160, 158] };
/** Manos en las esquinas de arriba de un cartel que sujeta delante (lo pinta quien lo contiene). */
const HOLD: { L: Pt; R: Pt } = { L: [38, 148], R: [162, 148] };
/** Tiempo en que una acción nueva enlaza con la postura anterior, sin saltos. */
const BLEND = 0.3;
/** Sin hacer nada este rato durante el descanso, se queda dormido. */
const DOZE_AFTER = 0.6;

function arm([sx, sy]: Pt, [hx, hy]: Pt, side: number, bend = 13) {
  const mx = (sx + hx) / 2;
  const my = (sy + hy) / 2;
  const dx = hx - sx;
  const dy = hy - sy;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (nx * side < 0) {
    nx = -nx;
    ny = -ny;
  }
  return `M${sx} ${sy} Q${mx + nx * bend} ${my + ny * bend} ${hx} ${hy}`;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const back = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Valor en el instante t de una lista de claves [tiempo, valor], con suavizado. */
function track<T extends number | Pt>(keys: [number, T][], t: number, fn = ease): T {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const k = fn(clamp01((t - t0) / (t1 - t0 || 1)));
      return (
        typeof v0 === 'number' ? lerp(v0, v1 as number, k) : lerpPt(v0 as Pt, v1 as Pt, k)
      ) as T;
    }
  }
  return keys[keys.length - 1][1];
}

const wobble = (dt: number, amp: number, freq = 14, decay = 3.5) =>
  dt < 0 ? 0 : amp * Math.sin(dt * freq) * Math.exp(-dt * decay);
const kick = (dt: number, amp: number, decay = 9) => (dt < 0 ? 0 : amp * Math.exp(-dt * decay));
const rot = ([x, y]: Pt, deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
};
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const pop = (k: number) => back(clamp01(k));

/** Instantes de la acción en que suena cada golpe del aviso. */
const hitsAt = (audioAt: number, hits: number[]) => hits.map((h) => audioAt + h);

// ---------- Acciones al azar ----------
const barajar: Action = {
  dur: 2.7,
  frame(t, p, d) {
    p.L = track<Pt>(
      [
        [0, REST.L],
        [0.4, [84, 150]],
        [2.25, [84, 150]],
        [2.7, REST.L],
      ],
      t,
    );
    p.R = track<Pt>(
      [
        [0, REST.R],
        [0.4, [116, 150]],
        [2.25, [116, 150]],
        [2.7, REST.R],
      ],
      t,
    );
    const bob = t > 0.4 && t < 2.2 ? Math.sin(t * 18) * 1.2 : 0;
    p.L = add(p.L, [0, bob]);
    p.R = add(p.R, [0, -bob]);
    p.tilt = Math.sin(t * 4) * 2;
    if (t <= 0.3 || t >= 2.4) return;
    for (let i = 0; i < 7; i++) {
      const k = clamp01((t - 0.55 - i * 0.2) / 0.4);
      const x = lerp(p.R[0] - 4, p.L[0] + 4, ease(k));
      const y = lerp(p.R[1] - 10, p.L[1] - 10, k) - Math.sin(k * Math.PI) * 30 - i * 0.6;
      d.show(`p-sh${i}`, `translate(${x} ${y}) rotate(${lerp(25, -25, k)})`);
    }
  },
};

const repartir: Action = {
  dur: 1.9,
  frame(t, p, d) {
    p.R = track<Pt>(
      [
        [0, REST.R],
        [0.4, [112, 168]],
        [0.75, [134, 138]],
        [0.85, [118, 150]],
        [1.3, [118, 150]],
        [1.9, REST.R],
      ],
      t,
    );
    p.tilt = track(
      [
        [0, 0],
        [0.8, -3],
        [1.4, 3],
        [1.9, 0],
      ],
      t,
    );
    if (t > 0.35 && t < 0.82)
      d.show('p-card', `translate(${p.R[0] - 2} ${p.R[1] - 14}) rotate(-10)`);
    if (t >= 0.82 && t < 1.45) {
      const k = (t - 0.82) / 0.6;
      d.show(
        'p-fly',
        `translate(${lerp(132, 92, k)} ${lerp(124, 150, k)}) rotate(${k * 380}) scale(${lerp(1, 6, k * k)})`,
        1 - k * k,
      );
    }
    p.wink = track(
      [
        [0.8, 0],
        [0.95, 1],
        [1.35, 1],
        [1.5, 0],
      ],
      t,
    );
  },
};

const saludar: Action = {
  dur: 2.1,
  frame(t, p) {
    p.R = track<Pt>(
      [
        [0, REST.R],
        [0.45, [142, 66]],
        [1.45, [142, 66]],
        [2.1, REST.R],
      ],
      t,
    );
    p.visor = track(
      [
        [0.4, 0],
        [0.7, -16],
        [1.3, -16],
        [1.6, 0],
      ],
      t,
      back,
    );
    p.visorDy = track(
      [
        [0.4, 0],
        [0.7, -7],
        [1.3, -7],
        [1.6, 0],
      ],
      t,
    );
    p.tilt = track(
      [
        [0, 0],
        [0.6, -5],
        [1.4, -5],
        [2.0, 0],
      ],
      t,
    );
    p.wink = track(
      [
        [0.55, 0],
        [0.7, 1],
        [1.25, 1],
        [1.4, 0],
      ],
      t,
    );
  },
};

const ficha: Action = {
  dur: 2.5,
  frame(t, p, d) {
    p.R = track<Pt>(
      [
        [0, REST.R],
        [0.3, [170, 168]],
        [0.75, [152, 92]],
        [1.8, [152, 92]],
        [2.3, [170, 168]],
        [2.5, REST.R],
      ],
      t,
    );
    p.tilt = track(
      [
        [0.6, 0],
        [0.9, 6],
        [1.6, 6],
        [2.0, 0],
      ],
      t,
    );
    p.wink = track(
      [
        [0.75, 0],
        [0.9, 1],
        [1.5, 1],
        [1.65, 0],
      ],
      t,
    );
    const c: Pt = [p.R[0] - 2, p.R[1] - 22];
    if (t > 0.3 && t < 2.3) {
      const spin = Math.cos(t * 9);
      d.show(
        'p-chip',
        `translate(${c[0]} ${c[1]}) scale(${Math.abs(spin) < 0.15 ? 0.15 : spin} 1)`,
      );
    }
    if (t > 0.8 && t < 1.8) {
      d.show('p-sparks');
      const sparks: Pt[] = [
        [-15, -8],
        [13, -14],
        [16, 9],
      ];
      sparks.forEach(([dx, dy], i) => {
        const s = Math.max(0, Math.sin((t - 0.8) * 7 + i * 2));
        d.show(`k${i}`, `translate(${c[0] + dx} ${c[1] + dy}) scale(${s})`);
      });
    }
  },
};

const guino: Action = {
  dur: 1.3,
  frame(t, p, d) {
    p.tilt = track(
      [
        [0, 0],
        [0.25, 7],
        [1.0, 7],
        [1.3, 0],
      ],
      t,
    );
    p.wink = track(
      [
        [0.15, 0],
        [0.3, 1],
        [0.9, 1],
        [1.05, 0],
      ],
      t,
    );
    if (t > 0.3 && t < 0.9) {
      d.show('p-sparks');
      d.show('k0', `translate(128 70) scale(${Math.sin(((t - 0.3) / 0.6) * Math.PI) * 1.1})`);
    }
  },
};

// ---------- Propina ----------
const gracias: Action = {
  dur: 2.9,
  frame(t, p, d) {
    const sy = track(
      [
        [0, 230],
        [0.6, 140],
        [2.25, 140],
        [2.65, 230],
      ],
      t,
      back,
    );
    const bob = t > 0.6 && t < 2.2 ? Math.abs(Math.sin((t - 0.6) * 6)) * -5 : 0;
    d.show('p-sign', `translate(100 ${sy + bob})`);
    if (t > 0.6 && t < 2.25) {
      p.L = [36, sy + bob + 1];
      p.R = [164, sy + bob + 1];
    } else {
      p.L = track<Pt>(
        [
          [0, REST.L],
          [0.25, REST.L],
          [0.6, [36, 141]],
          [2.25, [36, 141]],
          [2.9, REST.L],
        ],
        t,
      );
      p.R = track<Pt>(
        [
          [0, REST.R],
          [0.25, REST.R],
          [0.6, [164, 141]],
          [2.25, [164, 141]],
          [2.9, REST.R],
        ],
        t,
      );
    }
    p.dy += bob * 0.4;
    p.blink = Math.max(
      p.blink,
      track(
        [
          [0.6, 0],
          [0.75, 0.75],
          [2.0, 0.75],
          [2.2, 0],
        ],
        t,
      ),
    );
  },
};

// ---------- Avisos de la TV: cada golpe de sonido cae en audioAt + golpe ----------
/** Suben las ciegas: baja una campana y tira de la cuerda en cada ding. */
const campana: Action = {
  dur: 3.4,
  audioAt: 0.8,
  frame(t, p, d) {
    const hits = hitsAt(0.8, POKER_SOUND_HITS.level);
    const last = hits[hits.length - 1];
    const keys: [number, Pt][] = [
      [0, REST.R],
      [0.55, [150, 76]],
    ];
    hits.forEach((h) => keys.push([h - 0.12, [150, 76]], [h, [150, 94]]));
    keys.push([last + 0.3, [150, 80]], [last + 0.9, [150, 80]], [last + 1.5, REST.R]);
    p.R = track(keys, t);
    p.tilt = track(
      [
        [0, 0],
        [0.5, 5],
        [2.4, 5],
        [2.9, 0],
      ],
      t,
    );
    p.L = add(REST.L, [0, hits.reduce((s, h) => s + kick(t - h, -3), 0)]);
    if (hits.some((h) => t > h && t < h + 0.15)) p.blink = 1;
    const drop = track(
      [
        [0, -70],
        [0.45, 0],
        [2.8, 0],
        [3.3, -80],
      ],
      t,
      back,
    );
    const angle = hits.reduce((s, h) => s + wobble(t - h, 16), 0);
    d.show('p-bell', `translate(0 ${drop})`);
    d.attr('p-bellbody', 'transform', `rotate(${angle} 150 12)`);
    const end = add(rot([0, 32], angle), [150, 12 + drop]);
    if (t < 3.0) {
      d.show('p-rope');
      d.attr('p-rope', 'd', `M${end[0]} ${end[1]} L${p.R[0]} ${p.R[1] - 6}`);
    }
    hits.forEach((h, i) => {
      const k = (t - h) / 0.4;
      if (k >= 0 && k < 1) {
        d.show(
          'p-ding',
          `translate(${178 - i * 2} ${28 + i * 6}) rotate(${12 - i * 6}) scale(${pop(k * 2.5)})`,
          1 - k * k,
        );
      }
    });
  },
};

/** Recompra: saca el revólver y dispara con cada bala del sonido. */
const revolver: Action = {
  dur: 2.9,
  audioAt: 0.7,
  frame(t, p, d) {
    const hits = hitsAt(0.7, POKER_SOUND_HITS.rebuy);
    const last = hits[hits.length - 1];
    const recoil = hits.reduce((s, h) => s + kick(t - h, 1), 0);
    p.R = add(
      track<Pt>(
        [
          [0, REST.R],
          [0.5, [146, 104]],
          [2.2, [146, 104]],
          [2.8, REST.R],
        ],
        t,
      ),
      [recoil * 3, recoil * -7],
    );
    // La otra mano se tapa la oreja.
    p.L = track<Pt>(
      [
        [0, REST.L],
        [0.45, [54, 80]],
        [2.0, [54, 80]],
        [2.6, REST.L],
      ],
      t,
    );
    p.tilt = track(
      [
        [0, 0],
        [0.5, -4],
        [2.1, -4],
        [2.6, 0],
      ],
      t,
    );
    p.wink = track(
      [
        [0.55, 0],
        [0.65, 1],
        [last + 0.4, 1],
        [last + 0.55, 0],
      ],
      t,
    );
    const angle = -38 - recoil * 22;
    if (t < 2.7) d.show('p-gun', `translate(${p.R[0]} ${p.R[1]}) rotate(${angle})`);
    d.attr(
      'p-flash',
      'visibility',
      hits.some((h) => t >= h && t < h + 0.09) ? 'visible' : 'hidden',
    );
    const muzzle = add(p.R, rot([46, -7], angle));
    hits.forEach((h, i) => {
      const k = (t - h) / 0.45;
      if (k >= 0 && k < 1) {
        d.show(
          'p-bang',
          `translate(${muzzle[0] - 6 + i * 4} ${muzzle[1] - 12 - i * 8}) rotate(${-10 + i * 14}) scale(${pop(k * 3)})`,
          1 - k * k,
        );
      }
    });
    if (t > hits[0] && t < last + 1.2) {
      d.show('p-smoke');
      [0, 1, 2].forEach((i) => {
        const k = clamp01((t - hits[0] - i * 0.12) / 1.3);
        d.show(
          `s${i}`,
          // Nubecitas de humo que suben, crecen y se deshacen; cada una algo mayor y girada.
          `translate(${muzzle[0] + k * 8 + i * 3} ${muzzle[1] - k * 26 - i * 3}) rotate(${(i - 1) * 25 + k * 30}) scale(${(0.5 + k) * (0.6 + i * 0.25)})`,
          1 - k,
        );
      });
    }
  },
};

/** Alguien queda eliminado: junta las manos, cierra los ojos y agacha la cabeza con cada nota. */
const eliminado: Action = {
  dur: 3.6,
  audioAt: 0.6,
  frame(t, p) {
    const hits = hitsAt(0.6, POKER_SOUND_HITS.out);
    const last = hits[hits.length - 1];
    p.L = track<Pt>(
      [
        [0, REST.L],
        [0.5, [92, 142]],
        [3.0, [92, 142]],
        [3.5, REST.L],
      ],
      t,
    );
    p.R = track<Pt>(
      [
        [0, REST.R],
        [0.5, [108, 142]],
        [3.0, [108, 142]],
        [3.5, REST.R],
      ],
      t,
    );
    // Cada nota lo hunde un poco más; en la larga, un suspiro que se balancea.
    const sink = hits.reduce((s, h) => s + (t >= h ? 1.6 : 0) + kick(t - h, 1.5), 0);
    const rise = clamp01((t - 3.0) / 0.5);
    p.dy = sink * (1 - ease(rise));
    p.tilt = (wobble(t - last, 4, 6, 1.2) + (t > hits[0] ? 3 : 0)) * (1 - ease(rise));
    p.visor = 4 * (1 - ease(rise)) * clamp01((t - hits[0]) / 0.3);
    p.blink = track(
      [
        [0.4, 0],
        [0.55, 1],
        [3.0, 1],
        [3.2, 0],
      ],
      t,
    );
  },
};

/** Falta 1 minuto: saca el reloj de bolsillo y le da un toque en cada pitido. */
const aviso: Action = {
  dur: 2.6,
  audioAt: 0.75,
  frame(t, p, d) {
    const hits = hitsAt(0.75, POKER_SOUND_HITS.warning);
    const last = hits[hits.length - 1];
    p.R = track<Pt>(
      [
        [0, REST.R],
        [0.5, [152, 124]],
        [2.0, [152, 124]],
        [2.6, REST.R],
      ],
      t,
    );
    const tap: [number, Pt][] = [
      [0, REST.L],
      [0.45, [116, 110]],
    ];
    hits.forEach((h) => tap.push([h - 0.1, [118, 104]], [h, [134, 96]], [h + 0.1, [120, 102]]));
    tap.push([2.0, [116, 110]], [2.5, REST.L]);
    p.L = track(tap, t);
    p.tilt = track(
      [
        [0, 0],
        [0.5, 7],
        [2.0, 7],
        [2.4, 0],
      ],
      t,
    );
    p.wink = track(
      [
        [0.5, 0],
        [0.65, 1],
        [1.8, 1],
        [1.95, 0],
      ],
      t,
    );
    if (t < 2.45) {
      const shake = hits.reduce((s, h) => s + wobble(t - h, 6, 30, 8), 0);
      const c: Pt = [p.R[0] - 4, p.R[1] - 28];
      d.show('p-watch', `translate(${c[0]} ${c[1]}) rotate(${shake})`);
      d.attr('p-watchhand', 'transform', `rotate(${t > hits[0] ? 330 : 300})`);
      d.show('p-chain');
      d.attr(
        'p-chain',
        'd',
        `M94 150 Q${(94 + c[0]) / 2} ${Math.max(150, c[1]) + 26} ${c[0]} ${c[1] + 11}`,
      );
    }
    if (t > hits[0] && t < last + 0.9) {
      d.show(
        'p-min',
        `translate(152 66) rotate(-8) scale(${pop((t - hits[0]) / 0.25)})`,
        1 - clamp01((t - last - 0.5) / 0.4),
      );
    }
  },
};

/** Descanso: se toma un café; cada nota del carillón suelta una nube de vapor. */
const pausa: Action = {
  dur: 3.3,
  audioAt: 0.8,
  frame(t, p, d) {
    const hits = hitsAt(0.8, POKER_SOUND_HITS.break);
    const last = hits[hits.length - 1];
    p.R = track<Pt>(
      [
        [0, REST.R],
        [0.55, [132, 118]],
        [last + 0.3, [132, 118]],
        [last + 0.55, [118, 108]],
        [last + 1.0, [118, 108]],
        [3.3, REST.R],
      ],
      t,
    );
    p.L = track<Pt>(
      [
        [0, REST.L],
        [0.6, [92, 152]],
        [2.8, [92, 152]],
        [3.3, REST.L],
      ],
      t,
    );
    p.tilt = track(
      [
        [0, 0],
        [0.6, -3],
        [last + 0.4, -3],
        [last + 0.6, 6],
        [3.0, 6],
        [3.3, 0],
      ],
      t,
    );
    p.blink = Math.max(
      p.blink,
      track(
        [
          [0.6, 0],
          [0.8, 0.85],
          [3.0, 0.85],
          [3.2, 0],
        ],
        t,
      ),
    );
    if (t < 3.15)
      d.show('p-cup', `translate(${p.R[0] - 3} ${p.R[1] - 17}) rotate(${p.R[0] < 125 ? -14 : 0})`);
    const cup: Pt = [p.R[0] - 3, p.R[1] - 29];
    d.show('p-steam');
    hits.forEach((h, i) => {
      const k = (t - h) / 1.1;
      if (k >= 0 && k < 1) {
        d.show(
          `v${i}`,
          `translate(${cup[0] - 4 + i * 4 + Math.sin(k * 6) * 2} ${cup[1] - k * 22}) scale(${0.6 + k * 0.5})`,
          1 - k,
        );
      }
    });
    if (t > hits[0] && t < 3.0) {
      d.show(
        'p-break',
        `translate(100 32) scale(${pop((t - hits[0]) / 0.3)})`,
        1 - clamp01((t - 2.7) / 0.3),
      );
    }
  },
};

/** Add-on: teclea en la caja registradora y el cajón se abre de golpe con el ¡CHING! */
const caja: Action = {
  dur: 2.9,
  audioAt: 0.8,
  frame(t, p, d) {
    const ching = 0.8 + POKER_SOUND_HITS.addOn[0];
    const keys: [number, Pt][] = [
      [0, REST.L],
      [0.5, [33, 138]],
    ];
    [0.55, 0.75, 0.95].forEach((h, i) =>
      keys.push(
        [h, [24 + i * 9, 140]],
        [h + 0.08, [24 + i * 9, 148]],
        [h + 0.16, [24 + i * 9, 140]],
      ),
    );
    keys.push(
      [ching + 0.12, [56, 136]],
      [ching + 0.17, [56, 152]],
      [ching + 0.6, [56, 150]],
      [2.9, REST.L],
    );
    p.L = track(keys, t);
    p.tilt = track(
      [
        [0, 0],
        [0.5, -6],
        [ching, -6],
        [ching + 0.2, 4],
        [2.4, 4],
        [2.9, 0],
      ],
      t,
    );
    p.wink = track(
      [
        [ching, 0],
        [ching + 0.1, 1],
        [ching + 0.9, 1],
        [ching + 1.05, 0],
      ],
      t,
    );
    p.R = track<Pt>(
      [
        [0, REST.R],
        [ching, REST.R],
        [ching + 0.25, [150, 128]],
        [ching + 1.0, [150, 128]],
        [2.9, REST.R],
      ],
      t,
    );
    const rise = track(
      [
        [0, 60],
        [0.4, 0],
        [2.4, 0],
        [2.85, 60],
      ],
      t,
      back,
    );
    d.show('p-register', `translate(0 ${rise})`);
    const open = t > ching ? Math.min(1, (t - ching) / 0.08) * 8 + kick(t - ching, -2) : 0;
    d.attr('p-drawer', 'transform', `translate(0 ${open})`);
    if (t > ching && t < ching + 1.2) {
      const k = t - ching;
      d.show('p-coins');
      const coins: Pt[] = [
        [-26, -50],
        [-8, -62],
        [12, -56],
        [28, -44],
      ];
      coins.forEach(([vx, vy], i) => {
        d.show(
          `c${i}`,
          `translate(${38 + vx * k * 2.2} ${165 + vy * k * 2.2 + 140 * k * k}) scale(${0.55 + i * 0.05} ${0.55 * Math.abs(Math.cos(k * 12 + i))})`,
          1 - clamp01((k - 0.9) / 0.3),
        );
      });
      d.show(
        'p-ching',
        `translate(46 112) rotate(-10) scale(${pop(k / 0.25)})`,
        1 - clamp01((k - 0.9) / 0.3),
      );
    }
  },
};

/** Se acaba el descanso: se despierta de un respingo. */
const despertar: Action = {
  dur: 1.4,
  frame(t, p, d) {
    const k = 1 - ease(clamp01(t / 0.25));
    p.L = track<Pt>(
      [
        [0, [86, 162]],
        [0.25, [52, 120]],
        [0.8, [52, 120]],
        [1.4, REST.L],
      ],
      t,
    );
    p.R = track<Pt>(
      [
        [0, [114, 162]],
        [0.25, [148, 120]],
        [0.8, [148, 120]],
        [1.4, REST.R],
      ],
      t,
    );
    p.tilt = k * 13;
    p.dy =
      k * 8 +
      track(
        [
          [0, 0],
          [0.18, -9],
          [0.45, 0],
        ],
        t,
        back,
      );
    p.visor = track(
      [
        [0, 9],
        [0.2, -14],
        [0.6, -14],
        [0.9, 0],
      ],
      t,
      back,
    );
    p.visorDy = track(
      [
        [0, 3],
        [0.2, -12],
        [0.6, -12],
        [0.9, 0],
      ],
      t,
      back,
    );
    p.blink = t < 0.12 ? 1 : 0;
    if (t > 0.12 && t < 1.1) {
      d.show(
        'p-wake',
        `translate(146 46) rotate(10) scale(${pop((t - 0.12) / 0.2)})`,
        1 - clamp01((t - 0.8) / 0.3),
      );
    }
  },
};

const ACTIONS = {
  barajar,
  repartir,
  saludar,
  ficha,
  guino,
  gracias,
  campana,
  revolver,
  aviso,
  pausa,
  caja,
  despertar,
  eliminado,
};
export type CrupierAction = keyof typeof ACTIONS;
const RANDOM: CrupierAction[] = ['barajar', 'repartir', 'saludar', 'ficha', 'guino'];

/** Dormido: brazos en la mesa, cabeza caída, respiración lenta y zetas que suben. */
function sleepPose(s: number, now: number, p: Pose, d: Draw, still: boolean) {
  const k = still ? 1 : ease(clamp01(s / 0.9));
  const breath = still ? 0 : Math.sin(now * 1.4);
  p.L = lerpPt(REST.L, [86, 162], k);
  p.R = lerpPt(REST.R, [114, 162], k);
  p.tilt = k * (13 + breath * 1.5);
  p.dy = k * (8 + breath * 1.6);
  p.visor = k * 9;
  p.visorDy = k * 3;
  p.blink = Math.max(p.blink, k);
  if (k < 1 && !still) return;
  d.show('p-zzz');
  [0, 1, 2].forEach((i) => {
    const f = still ? 0.2 + i * 0.3 : ((s - 0.9) / 2.7 + i / 3) % 1;
    d.show(
      `z${i}`,
      `translate(${132 + f * 34 + Math.sin(f * 7) * 4} ${78 - f * 58}) rotate(${-12 + f * 20}) scale(${0.6 + f * 0.9})`,
      Math.sin(f * Math.PI),
    );
  });
}

const PROPS =
  '.props > *, .fx > *, .p-sign, .k0, .k1, .k2, .s0, .s1, .s2, .v0, .v1, .v2, .c0, .c1, .c2, .c3, .z0, .z1, .z2';

/** Anima el SVG del crupier: reposo, acciones al azar, avisos al compás del sonido y siesta. */
export class CrupierEngine implements Draw {
  private readonly cache = new Map<string, SVGElement>();
  private readonly eyes: SVGElement[];
  private readonly props: SVGElement[];
  private action: { def: Action; start: number; begun: boolean } | null = null;
  private sleeping: number | null = null;
  private wantSleep = false;
  private wakeAt = 0;
  private idleSince: number;
  private nextAt: number;
  private blinkAt: number;
  private last: Pose | null = null;
  private blendFrom: Pose | null = null;
  private blendAt = 0;

  constructor(
    private readonly svg: SVGSVGElement,
    now: number,
    /** Hace acciones al azar mientras no pasa nada. */
    public auto = true,
    /** Sin movimiento (prefers-reduced-motion): solo posturas quietas. */
    private readonly still = false,
  ) {
    this.eyes = Array.from(svg.querySelectorAll<SVGElement>('.face ellipse')).slice(0, 2);
    this.props = Array.from(svg.querySelectorAll<SVGElement>(PROPS));
    this.idleSince = now;
    this.nextAt = now + 1.5;
    this.blinkAt = now + 2.5;
  }

  private q(name: string) {
    let node = this.cache.get(name);
    if (!node) {
      node = this.svg.querySelector<SVGElement>(`.${name}`) ?? undefined;
      if (!node) throw new Error(`Falta .${name} en el crupier`);
      this.cache.set(name, node);
    }
    return node;
  }

  show(name: string, transform?: string, opacity = 1) {
    const node = this.q(name);
    node.style.display = '';
    if (transform) node.setAttribute('transform', transform);
    node.setAttribute('opacity', String(Math.max(0, opacity)));
  }

  attr(name: string, attribute: string, value: string) {
    this.q(name).setAttribute(attribute, value);
  }

  /** Lanza una acción; con `audioStart`, alinea su golpe de sonido con ese instante (en segundos). */
  play(name: CrupierAction, now: number, audioStart?: number) {
    const def = ACTIONS[name];
    const start = audioStart === undefined ? now : Math.max(now, audioStart - (def.audioAt ?? 0));
    this.action = { def, start, begun: false };
  }

  /** Durante el descanso duerme; al acabar, se despierta de un respingo. */
  setAsleep(asleep: boolean, now: number) {
    this.wantSleep = asleep;
    if (!asleep) this.wakeAt = now + 0.35;
  }

  /** Sujeta un cartel con las dos manos y no hace gestos al azar. */
  holding = false;

  get isSleeping() {
    return this.sleeping !== null;
  }

  frame(now: number) {
    const p: Pose = {
      L: REST.L,
      R: REST.R,
      tilt: 0,
      dy: this.still ? 0 : Math.sin(now * 2.2) * 0.9,
      visor: 0,
      visorDy: 0,
      wink: 0,
      blink: 0,
    };
    if (now > this.blinkAt) this.blinkAt = now + 2.5 + Math.random() * 3;
    if (!this.still && this.blinkAt - now < 0.13) p.blink = 1;
    this.props.forEach((node) => {
      node.style.display = 'none';
    });

    const action = this.action;
    if (action && now >= action.start) {
      if (!action.begun) {
        action.begun = true;
        this.sleeping = null;
        this.blend(now);
      }
      const t = now - action.start;
      if (t > action.def.dur) {
        this.action = null;
        this.idleSince = now;
        this.nextAt = now + 2 + Math.random() * 3;
        this.blend(now);
      } else if (!this.still) action.def.frame(t, p, this);
    }

    if (!this.action || !this.action.begun) this.idle(now, p);

    if (this.blendFrom && now - this.blendAt < BLEND) {
      const k = ease((now - this.blendAt) / BLEND);
      const from = this.blendFrom;
      p.L = lerpPt(from.L, p.L, k);
      p.R = lerpPt(from.R, p.R, k);
      p.tilt = lerp(from.tilt, p.tilt, k);
      p.dy = lerp(from.dy, p.dy, k);
      p.visor = lerp(from.visor, p.visor, k);
      p.visorDy = lerp(from.visorDy, p.visorDy, k);
    }
    this.last = p;
    this.apply(p);
  }

  private idle(now: number, p: Pose) {
    const pending = this.action !== null;
    if (this.holding) {
      p.L = HOLD.L;
      p.R = HOLD.R;
      return;
    }
    if (this.sleeping !== null) {
      if (!this.wantSleep && now >= this.wakeAt && !pending) this.play('despertar', now);
      sleepPose(now - this.sleeping, now, p, this, this.still);
    } else if (
      this.wantSleep &&
      !pending &&
      now - this.idleSince >= (this.still ? 0 : DOZE_AFTER)
    ) {
      this.sleeping = now;
      sleepPose(0, now, p, this, this.still);
    } else if (this.auto && !this.still && !pending && !this.wantSleep && now > this.nextAt) {
      this.play(RANDOM[Math.floor(Math.random() * RANDOM.length)], now);
    }
  }

  private blend(now: number) {
    this.blendFrom = this.last;
    this.blendAt = now;
  }

  private apply(p: Pose) {
    this.q('armL').setAttribute('d', arm(SHOULDER.L, p.L, -1));
    this.q('armR').setAttribute('d', arm(SHOULDER.R, p.R, 1));
    this.q('gloveL').setAttribute('transform', `translate(${p.L[0]} ${p.L[1]})`);
    this.q('gloveR').setAttribute('transform', `translate(${p.R[0]} ${p.R[1]}) scale(-1 1)`);
    this.q('head').setAttribute('transform', `translate(0 ${p.dy}) rotate(${p.tilt} 100 110)`);
    this.q('body').setAttribute('transform', `translate(0 ${p.dy * 0.35})`);
    this.q('visor').setAttribute('transform', `translate(0 ${p.visorDy}) rotate(${p.visor} 64 66)`);
    const squash = (a: number) =>
      `translate(0 88) scale(1 ${1 - 0.88 * clamp01(a)}) translate(0 -88)`;
    this.eyes[0]?.setAttribute('transform', squash(p.blink));
    this.eyes[1]?.setAttribute('transform', squash(Math.max(p.blink, p.wink)));
  }
}
