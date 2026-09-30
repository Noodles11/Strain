import { CREATURE_SIZE, drawCreature } from './creatures';
import { drawCloneBack } from './clone';
import { INK } from './palette';
import type { BattleState } from '../core/battle';
import type { Traits } from '../core/traits';
import { theme, type Theme } from './theme';
import { cardFx, enemyFx, FxLayer, type Anchor } from './attackfx';
import { EERIE, flicker, Lighting, withAlpha as withAlphaHex, type Light } from './light';
import { PlaceView, type FightAt } from './placeview';
import type { RunState } from '../core/run';

export interface FoeAnim {
  flash: number;
  lunge: number;
  dead: number;
  gone: boolean;
}

/** Game Boy battle grammar: foe far right, clone near left seen from behind, both on one floor. */
export class BattleView {
  foes = new Map<number, FoeAnim>();
  player = { flash: 0, lunge: 0, heal: 0 };
  shake = 0;
  intro = 0;
  target = -1;
  hit: { uid: number; x: number; y: number; w: number; h: number }[] = [];
  fx = new FxLayer();
  place = new PlaceView();
  /** Entry transition: 0 top-down over the map, 1 settled behind the clone. */
  cam = 1;
  private now = 0;
  private anchors = new Map<number, Anchor>();
  private me: Anchor = { x: 0, y: 0, h: 1 };
  /** Where the clone's attacks leave from: its right shoulder. */
  private hand: Anchor = { x: 0, y: 0, h: 1 };
  /** The enemy a dragged card is hovering over, highlighted. */
  dropTarget = -1;
  /** Short words and numbers that pop over a fighter and fade: damage, plating, statuses. */
  private floats: { who: 'p' | number; text: string; color: string; t0: number; big: boolean; slot: number }[] = [];

  /** Pop a word or number over the clone ('p') or an enemy; it rises and fades. */
  float(who: 'p' | number, text: string, color: string, big = false) {
    const live = this.floats.filter((f) => f.who === who && this.now - f.t0 < 0.5).length;
    this.floats.push({ who, text, color, t0: this.now, big, slot: live });
  }

  reset() {
    this.foes.clear();
    this.player = { flash: 0, lunge: 0, heal: 0 };
    this.shake = 0;
    this.intro = 0;
    this.target = -1;
    this.dropTarget = -1;
    this.floats = [];
    this.cam = 0;
    this.fx.clear();
  }

  /** Animate a played card; returns how long to wait before its hit lands (ms). */
  playCard(id: string, target: number | undefined, hits: number) {
    const kind = cardFx(id);
    const self = kind === 'shield' || kind === 'heal' || kind === 'spark' || kind === 'swirl';
    const to = self ? [this.me] : kind === 'pellets' ? [...this.anchors.values()] : [this.anchors.get(target ?? -1) ?? [...this.anchors.values()][0]].filter(Boolean) as Anchor[];
    if (to.length) this.fx.add(kind, this.now, this.hand, to, hits);
    return kind;
  }

  /** Animate an enemy attack on the clone. */
  strike(uid: number, id: string, hits: number) {
    const kind = enemyFx(id);
    const from = this.anchors.get(uid);
    if (from) this.fx.add(kind, this.now, { ...from, y: from.y - from.h * 0.15 }, [this.me], hits);
    return kind;
  }

  anim(uid: number): FoeAnim {
    let a = this.foes.get(uid);
    if (!a) { a = { flash: 0, lunge: 0, dead: 0, gone: false }; this.foes.set(uid, a); }
    return a;
  }

  update(dt: number) {
    this.intro = Math.min(1, this.intro + dt * 1.6);
    this.cam = Math.min(1, this.cam + dt / 1.2);
    for (const a of this.foes.values()) {
      a.flash = Math.max(0, a.flash - dt * 2.5);
      a.lunge = Math.max(0, a.lunge - dt * 3);
      if (a.dead > 0 && !a.gone) { a.dead = Math.min(1, a.dead + dt * 1.8); if (a.dead >= 1) a.gone = true; }
    }
    this.player.flash = Math.max(0, this.player.flash - dt * 2.5);
    this.player.lunge = Math.max(0, this.player.lunge - dt * 3);
    this.player.heal = Math.max(0, this.player.heal - dt * 1.5);
    this.shake = Math.max(0, this.shake - dt * 3);
  }

  draw(ctx: CanvasRenderingContext2D, b: BattleState, traits: Traits, W: number, H: number, t: number, planet = 'derelict', place?: { run: RunState; at: FightAt }) {
    const th = theme(planet);
    this.now = t;
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(t * 90) * this.shake * 8, Math.cos(t * 70) * this.shake * 4);
    // fighters fade in as the camera settles behind the clone
    const show = place ? Math.max(0, Math.min(1, (this.cam - 0.55) / 0.35)) : 1;
    if (place) {
      ctx.fillStyle = th.skyTop;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      const sky = Math.max(0, Math.min(1, (this.cam - 0.45) / 0.45));
      if (sky > 0) {
        ctx.save();
        ctx.globalAlpha = sky;
        this.drawBackdrop(ctx, W, H, t, th);
        ctx.restore();
      }
      // pan the view so the whole enemy group fits between the clone and the screen edge
      this.place.pan = 0;
      this.place.setCamera(place.at, W, H, 1, place.run.world);
      const n = b.foes.filter((f) => f.alive || !this.anim(f.uid).gone).length;
      const spots: [number, number][] = [[1, 0], ...this.place.backSlots(place.run.world, place.at).slice(0, Math.max(0, n - 1))];
      const xs = spots.map(([a, sd]) => this.place.ground(place.at, a, sd)?.x).filter((x): x is number => x !== undefined);
      if (xs.length) {
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        let pan = 0;
        if (hi > W * 0.88) pan = W * 0.88 - hi;
        if (lo + pan < W * 0.38) pan = (W * 0.38 - lo + pan) / 2 + pan / 2;
        this.place.pan = pan;
      }
      this.place.draw(ctx, place.run, place.at, W, H, t, th, this.cam);
      this.mist(ctx, W, H, t, planet);
    } else this.drawBackdrop(ctx, W, H, t, th);

    const ease = (x: number) => 1 - (1 - x) ** 3;
    const k = place ? 1 : ease(this.intro);
    // without a map (tests, old saves) fall back to the fixed layout
    const fixed = { x: W * 0.71 + (1 - k) * W * 0.6, y: H * 0.63 };
    const px = W * 0.24 - (1 - k) * W * 0.6;
    const py = H * 1.07;

    const shown = b.foes.filter((f) => f.alive || !this.anim(f.uid).gone);
    const alive = b.foes.filter((f) => f.alive);
    const front = alive.find((f) => f.uid === this.target) ?? alive[0] ?? shown[0];
    const back = shown.filter((f) => f !== front);
    // further away = higher on the floor and smaller: one tile ahead for the front foe, two for the back row
    const slots: [number, number][] = place ? this.place.backSlots(place.run.world, place.at) : [[2, -0.8], [2, 0.8]];
    const frontPx = place ? this.place.ground(place.at, 1, 0)?.px ?? 1 : 1;
    const eer = EERIE[planet] ?? EERIE.derelict;
    this.rim = place ? eer.eerie : null;
    let spot: Light | null = null;
    this.hit = [];
    this.anchors.clear();
    const drawFoe = (f: (typeof shown)[number], ahead: number, side: number) => {
      const a = this.anim(f.uid);
      const size = CREATURE_SIZE[f.id] ?? 1;
      let x: number;
      let y: number;
      let sc: number;
      if (place) {
        const g = this.place.ground(place.at, ahead, side);
        if (!g) return;
        x = g.x;
        y = g.y;
        sc = g.px / frontPx;
      } else {
        x = fixed.x + side * W * 0.25;
        y = fixed.y - (ahead - 1) * H * 0.07;
        sc = ahead > 1 ? 0.7 : 1;
      }
      // true to scale: a Hull Tick stands about half as tall as a person-sized Copy
      const u = H * 0.26 * sc * (size > 1.5 ? 0.85 : 1);
      const h0 = size * u;
      ctx.save();
      ctx.globalAlpha = show;
      if (f.uid === this.dropTarget && f.alive) {
        // the drop target: a pulsing amber ring on the floor and a halo behind it
        const pulse = 0.75 + 0.25 * Math.sin(t * 10);
        ctx.save();
        ctx.strokeStyle = `rgba(227,163,59,${pulse})`;
        ctx.lineWidth = Math.max(2, u * 0.035);
        ctx.beginPath();
        ctx.ellipse(x, y, u * 0.7, u * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
        const g = ctx.createRadialGradient(x, y - h0 * 0.5, 0, x, y - h0 * 0.5, h0 * 0.9);
        g.addColorStop(0, `rgba(227,163,59,${0.3 * pulse})`);
        g.addColorStop(1, 'rgba(227,163,59,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y - h0 * 0.5, h0 * 0.9, h0 * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      this.shadow(ctx, x, y, u * 0.55, a.dead);
      this.anchors.set(f.uid, { x: x - a.lunge * W * 0.06, y: y - h0 * 0.5, h: Math.max(h0, H * 0.18) });
      const blink = a.flash > 0 && Math.floor(a.flash * 12) % 2 === 0;
      if (a.dead > 0) ctx.globalAlpha = show * (1 - a.dead);
      if (!blink) {
        // drawn on its own layer so hit flashes tint only the creature, not the scene behind it
        const lx = x - a.lunge * W * 0.06;
        const ly = y + a.lunge * H * 0.03;
        this.sprite(ctx, lx - u * 2, ly - u * 2.3, u * 4, u * 2.6, (c) => drawCreature(c, f.id, lx, ly, u, {
          t: t + f.uid, boil: Math.floor(t * 8) * 3, flash: a.flash, lunge: a.lunge, dead: a.dead, seed: (f.uid % 97) / 97, dim: 0,
          state: f.asleep ? 1 : f.heat !== undefined ? f.heat / 4 : 0,
        }), place ? { foot: [lx, ly], height: h0, haze: sc < 0.9 ? Math.min(0.45, (1 - sc) * 0.9) : 0, hazeColor: th.skyTop } : undefined);
      }
      ctx.restore();
      if (f.alive) this.hit.push({ uid: f.uid, x: x - u * 0.6, y: y - h0, w: u * 1.2, h: h0 });
      if (f === front) spot = { x, y: y - h0 * 0.8, r: Math.max(W * 0.5, h0 * 2.2), power: 0.9 };
      if (f.alive && f === front && alive.length > 1 && show > 0.9) {
        ctx.fillStyle = INK.sodium;
        ctx.beginPath();
        ctx.moveTo(x, y - h0 - H * 0.02);
        ctx.lineTo(x - 7, y - h0 - H * 0.02 - 10);
        ctx.lineTo(x + 7, y - h0 - H * 0.02 - 10);
        ctx.closePath();
        ctx.fill();
      }
    };
    back.forEach((f, i) => drawFoe(f, slots[i % 2][0], slots[i % 2][1]));
    if (front) drawFoe(front, 1, 0);

    const cu = H * 0.4;
    const cx = px + this.player.lunge * W * 0.05 - (1 - show) * W * 0.25;
    ctx.save();
    ctx.globalAlpha = show;
    this.shadow(ctx, cx, py - H * 0.005, cu * 0.45, 0);
    this.sprite(ctx, cx - cu * 1.1, py - cu * 1.45, cu * 2.2, cu * 1.5, (c) => drawCloneBack(c, cx, py, cu, traits, {
      t, flash: this.player.flash, lunge: this.player.lunge, heal: this.player.heal, boil: Math.floor(t * 8) * 3,
    }));
    ctx.restore();
    this.me = { x: px, y: py - cu * 0.55, h: cu * 0.8 };
    this.hand = { x: px + cu * 0.3, y: py - cu * 0.7, h: cu * 0.3 };
    this.rim = null;
    if (place && this.cam > 0.3) {
      // comic lighting: a spot on the enemies, the clone's own glow, lamps on the walls, and something wrong down the corridor
      const k2 = Math.min(1, (this.cam - 0.3) / 0.6);
      const far = this.place.project(place.at.x + 0.5 + place.at.fx * 8, place.at.y + 0.5 + place.at.fy * 8, 0.9);
      const lights: Light[] = [...this.place.lights];
      if (spot) lights.push(spot);
      lights.push({ x: px, y: py - cu * 0.6, r: W * 0.62, power: 0.95 });
      if (far) lights.push({ x: far.x, y: far.y, r: W * 0.45, color: eer.eerie, power: 0.55 * flicker(t, 7) });
      this.lighting.apply(ctx, W, H, lights, { dark: eer.dark * k2, tint: eer.tint, dots: 0.3 * k2, glow: 0.45 * k2 });
    }
    this.fx.draw(ctx, t);
    this.drawFloats(ctx, W);
    ctx.restore();
  }

  /** Comic pop-up lettering: fat, ink-outlined, rising and fading over about a second. */
  private drawFloats(ctx: CanvasRenderingContext2D, W: number) {
    const life = 1.15;
    this.floats = this.floats.filter((f) => this.now - f.t0 < life);
    for (const f of this.floats) {
      const a = f.who === 'p' ? this.me : this.anchors.get(f.who);
      if (!a) continue;
      const k = (this.now - f.t0) / life;
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.2 ? 1.15 - ((k - 0.12) / 0.08) * 0.15 : 1;
      const size = Math.round((f.big ? 0.085 : 0.06) * W * pop);
      const x = a.x + (f.slot % 2 ? 1 : -1) * Math.min(f.slot, 3) * W * 0.05;
      const y = a.y - a.h * 0.55 - k * W * 0.12 - f.slot * size * 0.9;
      ctx.save();
      ctx.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
      ctx.font = `700 ${size}px "Bebas Neue", "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, size * 0.18);
      ctx.strokeStyle = '#0b0c0e';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
      ctx.restore();
    }
  }

  private scratch: HTMLCanvasElement | null = null;
  private lighting = new Lighting();
  /** Rim-light colour for sprites this frame (the planet's eerie light), or none. */
  private rim: string | null = null;

  private silhouette: HTMLCanvasElement | null = null;

  /**
   * Draw into a scratch layer the size of the box, then onto the scene. With `depth`, the figure
   * gets comic volume: a cast shadow laid on the floor, hard cel shading (lit top, dark underside),
   * and a haze of the far dark on the ones further back.
   */
  private sprite(ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, draw: (c: CanvasRenderingContext2D) => void,
    depth?: { foot: [number, number]; height: number; haze: number; hazeColor: string }) {
    const sc = ctx.getTransform().a || 1;
    const cw = Math.max(1, Math.ceil(bw * sc));
    const ch = Math.max(1, Math.ceil(bh * sc));
    if (typeof document === 'undefined') return;
    const cv = (this.scratch ??= document.createElement('canvas'));
    if (cv.width < cw || cv.height < ch) { cv.width = Math.max(cv.width, cw); cv.height = Math.max(cv.height, ch); }
    const c = cv.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cw, ch);
    c.setTransform(sc, 0, 0, sc, -bx * sc, -by * sc);
    c.globalAlpha = 1;
    draw(c);
    if (depth) {
      const [fx0, fy0] = depth.foot;
      const hh = depth.height;
      // a solid black copy of the figure, laid down on the floor toward the camera, as its cast shadow
      const sil = (this.silhouette ??= document.createElement('canvas'));
      if (sil.width < cv.width || sil.height < cv.height) { sil.width = cv.width; sil.height = cv.height; }
      const s2 = sil.getContext('2d')!;
      s2.setTransform(1, 0, 0, 1, 0, 0);
      s2.globalCompositeOperation = 'source-over';
      s2.clearRect(0, 0, cw, ch);
      s2.drawImage(cv, 0, 0, cw, ch, 0, 0, cw, ch);
      s2.globalCompositeOperation = 'source-in';
      s2.fillStyle = '#000';
      s2.fillRect(0, 0, cw, ch);
      ctx.save();
      ctx.globalAlpha *= 0.42;
      ctx.transform(1, 0, 0.55, -0.32, fx0, fy0);
      ctx.drawImage(sil, 0, 0, cw, ch, bx - fx0, by - fy0, bw, bh);
      ctx.restore();
      // cel shading: a lit band on top, a hard step into shadow on the lower half, darkest at the feet
      c.save();
      c.globalCompositeOperation = 'source-atop';
      const g = c.createLinearGradient(0, fy0 - hh, 0, fy0);
      g.addColorStop(0, 'rgba(255,244,220,0.14)');
      g.addColorStop(0.3, 'rgba(255,244,220,0.04)');
      g.addColorStop(0.52, 'rgba(0,0,0,0)');
      g.addColorStop(0.56, 'rgba(0,0,0,0.26)');
      g.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = g;
      c.fillRect(bx, by, bw, bh);
      // the side away from the spotlight falls off
      const g2 = c.createLinearGradient(fx0 - hh * 0.6, 0, fx0 + hh * 0.6, 0);
      g2.addColorStop(0, 'rgba(0,0,0,0.3)');
      g2.addColorStop(0.45, 'rgba(0,0,0,0)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g2;
      c.fillRect(bx, by, bw, bh);
      if (depth.haze > 0) {
        c.globalAlpha = depth.haze;
        c.fillStyle = depth.hazeColor;
        c.fillRect(bx, by, bw, bh);
      }
      c.restore();
    }
    if (this.rim) {
      // an inked outline, then a thin rim of the planet's eerie light along the top edge
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 5 * sc;
      ctx.drawImage(cv, 0, 0, cw, ch, bx, by, bw, bh);
      ctx.shadowColor = withAlphaHex(this.rim, 0.5);
      ctx.shadowBlur = 4 * sc;
      ctx.shadowOffsetY = -1.5 * sc;
      ctx.drawImage(cv, 0, 0, cw, ch, bx, by, bw, bh);
      ctx.restore();
    }
    ctx.drawImage(cv, 0, 0, cw, ch, bx, by, bw, bh);
  }

  /** Low mist rolling along the floor at the far end, in the planet's colour. */
  private mist(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, planet: string) {
    const col = planet === 'mireth' ? '150,190,120' : planet === 'kessra' ? '170,220,235' : '180,170,150';
    const k = Math.max(0, Math.min(1, (this.cam - 0.5) / 0.4));
    if (k <= 0) return;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const y = H * (0.5 + i * 0.07) + Math.sin(t * 0.3 + i * 2) * H * 0.01;
      const g = ctx.createLinearGradient(0, y - H * 0.05, 0, y + H * 0.05);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(0.5, `rgba(${col},${0.1 * k})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      const dx = Math.sin(t * 0.15 + i) * W * 0.1;
      ctx.fillRect(-W * 0.2 + dx, y - H * 0.05, W * 1.4, H * 0.1);
    }
    ctx.restore();
  }

  /** A soft contact shadow on the floor, no platform. */
  private shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, fade: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(0,0,0,${0.8 * (1 - fade)})`);
    g.addColorStop(0.6, `rgba(0,0,0,${0.55 * (1 - fade)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.22);
    ctx.translate(-x, -y);
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, th: Theme) {
    const hz = H * 0.52;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, th.skyTop);
    sky.addColorStop(1, th.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, W + 40, hz + 20);
    if (th.crystals) {
      // crystal spires against the cave dark, two layers
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer ? th.wallTop : th.ledge;
        ctx.globalAlpha = layer ? 0.9 : 0.7;
        for (let i = 0; i < 9; i++) {
          const x = ((i + 0.5 + layer * 0.4) / 9) * W;
          const h = hz * (0.35 + 0.35 * (Math.sin(i * 12.9 + layer * 4) * 0.5 + 0.5)) * (layer ? 0.7 : 1);
          ctx.beginPath();
          ctx.moveTo(x - W * 0.035, hz);
          ctx.lineTo(x + Math.sin(i) * W * 0.01, hz - h);
          ctx.lineTo(x + W * 0.035, hz);
          ctx.closePath();
          ctx.fill();
        }
        // stalactites
        for (let i = 0; i < 8; i++) {
          const x = ((i + 0.2 + layer * 0.5) / 8) * W;
          const h = hz * 0.18 * (Math.sin(i * 7.3 + layer) * 0.5 + 0.8);
          ctx.beginPath();
          ctx.moveTo(x - W * 0.025, 0);
          ctx.lineTo(x, h);
          ctx.lineTo(x + W * 0.025, 0);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // drifting motes
      ctx.fillStyle = th.wallEdge;
      for (let i = 0; i < 14; i++) {
        const x = ((i * 97 + t * 8) % W);
        const y = (hz * (0.2 + 0.7 * ((i * 53) % 100) / 100) + Math.sin(t + i) * 6);
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + i);
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    } else {
      // bulkhead ribs
      ctx.strokeStyle = '#3a3c41';
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const x = (i + 0.5) * (W / 7);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (x - W / 2) * 0.08, hz);
        ctx.stroke();
      }
    }
    // one warning lamp
    ctx.fillStyle = th.accent;
    ctx.globalAlpha = 0.5 + 0.5 * Math.max(0, Math.sin(t * 2.2));
    ctx.fillRect(W * 0.12, H * 0.1, W * 0.05, H * 0.02);
    ctx.globalAlpha = 1;
    // floor
    const fl = ctx.createLinearGradient(0, hz, 0, H);
    fl.addColorStop(0, th.groundTop);
    fl.addColorStop(1, th.groundLow);
    ctx.fillStyle = fl;
    ctx.fillRect(-20, hz, W + 40, H - hz + 20);
    ctx.strokeStyle = th.groundLine;
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * W * 0.06, hz);
      ctx.lineTo(W / 2 + i * W * 0.3, H);
      ctx.stroke();
    }
    for (let j = 1; j < 6; j++) {
      const y = hz + (H - hz) * (j / 6) ** 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.fillStyle = INK.boneDim;
    ctx.fillRect(0, hz - 1, W, 2);
  }
}
