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
}

export const THEMES: Record<string, Theme> = {
  derelict: {
    floor: '#2b2d31', floorLine: '#393c42', wallTop: '#5e5a50', wallEdge: '#8c8574', wallFace: '#17191c', wallLip: '#5c584e',
    hazard: '#5fae68', hazardFleck: '#b6f0a8', debris: '#4a3024',
    skyTop: '#121417', skyLow: '#2a2c30', groundTop: '#34363a', groundLow: '#1b1d20', groundLine: '#43464b',
    ledge: '#3d3a33', ledgeTop: '#57534a', accent: '#e3a33b', crystals: false,
  },
  kessra: {
    floor: '#1c2733', floorLine: '#2a3a4b', wallTop: '#566d7a', wallEdge: '#9fd2e4', wallFace: '#0c141d', wallLip: '#3d6378',
    hazard: '#8fd0e6', hazardFleck: '#e8fbff', debris: '#6fa3c0',
    skyTop: '#070d15', skyLow: '#1a2c3e', groundTop: '#243a4c', groundLow: '#0e1721', groundLine: '#335068',
    ledge: '#28404f', ledgeTop: '#3f6376', accent: '#b06fe0', crystals: true,
  },
};

export function theme(planet: string): Theme {
  return THEMES[planet] ?? THEMES.derelict;
}
