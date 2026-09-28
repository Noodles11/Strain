/** Per-planet colours: a four-tone ramp plus an accent, like a Game Boy Color palette. */
export interface Theme {
  floor: string;
  floorLine: string;
  wallTop: string;
  wallEdge: string;
  wallFace: string;
  wallLip: string;
  hazard: string;
  hazardFleck: string;
  debris: string;
  skyTop: string;
  skyLow: string;
  groundTop: string;
  groundLow: string;
  groundLine: string;
  ledge: string;
  ledgeTop: string;
  accent: string;
  crystals: boolean;
  /** Floor drawn as one continuous surface, no tile grid. */
  solidFloor: boolean;
  /** Decorative snow drifts on the floor. */
  snow: boolean;
}

export const THEMES: Record<string, Theme> = {
  derelict: {
    floor: '#2b2d31', floorLine: '#393c42', wallTop: '#5e5a50', wallEdge: '#8c8574', wallFace: '#17191c', wallLip: '#5c584e',
    hazard: '#5fae68', hazardFleck: '#b6f0a8', debris: '#4a3024',
    skyTop: '#121417', skyLow: '#2a2c30', groundTop: '#34363a', groundLow: '#1b1d20', groundLine: '#43464b',
    ledge: '#3d3a33', ledgeTop: '#57534a', accent: '#e3a33b', crystals: false,
    solidFloor: false, snow: false,
  },
  kessra: {
    floor: '#1f4c52', floorLine: '#2b5f66', wallTop: '#566d7a', wallEdge: '#9fd2e4', wallFace: '#0c141d', wallLip: '#3d6378',
    hazard: '#8fd0e6', hazardFleck: '#e8fbff', debris: '#6fa3c0',
    skyTop: '#070d15', skyLow: '#1a2c3e', groundTop: '#243a4c', groundLow: '#0e1721', groundLine: '#335068',
    ledge: '#28404f', ledgeTop: '#3f6376', accent: '#b06fe0', crystals: true,
    solidFloor: true, snow: true,
  },
};

export const SNOW = '#d6e8ea';
export const SNOW_SHADE = '#94b8bd';

/**
 * Snow drifts on a floor tile, purely decorative and the same on the map and in battle:
 * offsets within the tile (0..1) and radius in tiles. About one tile in five gets a drift.
 */
export function snowAt(x: number, y: number): { ox: number; oy: number; r: number }[] {
  const h = (n: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  if (h(0) > 0.2) return [];
  const out = [];
  const n = 1 + Math.floor(h(1) * 3);
  for (let k = 0; k < n; k++) out.push({ ox: 0.25 + h(2 + k) * 0.5, oy: 0.25 + h(5 + k) * 0.5, r: 0.12 + h(8 + k) * 0.14 });
  return out;
}

export function theme(planet: string): Theme {
  return THEMES[planet] ?? THEMES.derelict;
}
