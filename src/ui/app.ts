import { aliveFoes, canFlee, cardBonus, currentIntent, fleeChance, intentNumbers, playable, resolved, type BattleEv } from '../core/battle';
import { ENEMIES } from '../core/enemies';
import { LOGS } from '../core/events';
import { IMPLANTS } from '../core/implants';
import { planetDepth, PLANETS } from '../core/planets';
import { foeInfo, playerInfo } from './unitinfo';
import { canRaise, loadMeta, markLanded, newMeta, raise, RUN_KEY, saveMeta, settleRun, type Meta } from '../core/meta';
import {
  actionsAt, bDiscard, bEnd, bFlee, bPick, bPlay, canExcise, chartOptions, goHome, here, land, describeAt, doAction, excise, exciseCost, isInteractable, migrateRun,
  lootTake, maxHp, mend, mendRate, mobsTick, mobAt, newRun, pathTo, rewardPick, runTraits, step, stormIn,
  takeEvents, travel, travelPoints, type RunState,
} from '../core/run';
import {
  energyPerTurn, handSize, maxIntegrity, SEQUENCE_CAP, sequenceCost, TRAIT_INFO, TRAITS,
  type Trait,
} from '../core/traits';
import { BattleView } from '../render/battleview';
import { fxLead } from '../render/attackfx';
import { INK } from '../render/palette';
import { Print } from '../render/print';
import { WorldView } from '../render/worldview';
import { idx, T_GATE, T_HAZARD, T_WALL } from '../world/gen';
import { cardDetail, cardHtml, esc } from './cardview';
import { icon } from './icons';

type Sheet =
  | { kind: 'action'; x: number; y: number }
  | { kind: 'map' }
  | { kind: 'deck'; tab: 'tac' | 'exp' }
  | { kind: 'menu' }
  | { kind: 'surgery'; tab: 'tac' | 'exp' }
  | null;

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    s.getItem('x');
    return s;
  } catch {
    return null;
  }
}

const cloneName = (n: number) => `CLONE-${String(n).padStart(4, '0')}`;
const chartName = (id: string) => PLANETS[id]?.name ?? id;

export class App {
  private store = storage();
  private meta: Meta;
  private run: RunState | null = null;
  private layout: 'hub' | 'explore' | 'battle' | '' = '';

  private scene!: HTMLDivElement;
  private src = document.createElement('canvas');
  private ctx = this.src.getContext('2d')!;
  private glCanvas: HTMLCanvasElement | null = null;
  private print: Print | null = null;
  private printOn = true;
  private dpr = 1;
  private sw = 0;
  private sh = 0;

  private wv = new WorldView();
  private bv = new BattleView();
  private drawX = 0;
  private drawY = 0;
  private walk: { path: [number, number][]; then?: () => void } | null = null;
  private walkT = 0;

  private queue: BattleEv[] = [];
  private qTimer = 0;
  private dispP = 0;
  private dispFoe = new Map<number, number>();
  private hidden = new Set<number>();
  private lines: string[] = [];
  private pendingLead = 0;
  private introUntil = 0;
  /** Foes whose move is still playing out: they keep showing the intent they are acting on. */
  private pendingAct = new Set<number>();
  private shownIntent = new Map<number, string>();
  private sheet: Sheet = null;
  private msgTimer = 0;
  private lastMsgCount = 0;
  private last = 0;

  constructor(private root: HTMLElement) {
    this.meta = loadMeta(this.store);
    this.bindLongPress();
    try { this.printOn = this.store?.getItem('strain.print') !== 'off'; } catch { /* default on */ }
    try {
      const raw = this.store?.getItem(RUN_KEY);
      if (raw) {
        const r = JSON.parse(raw) as RunState;
        if (r.v === 1) this.run = migrateRun(r);
      }
    } catch { this.run = null; }
    this.showHub();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.key(e));
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------------------------------------------------------------- card details

  /** Holding any card anywhere (hands, deck, rewards, terminals, surgery) opens its details on top of everything. */
  private bindLongPress() {
    let timer = 0;
    let start: { x: number; y: number } | null = null;
    const cancel = () => { clearTimeout(timer); start = null; };
    this.root.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.card[data-id]');
      if (!el || el.closest('.detail-layer')) return;
      start = { x: e.clientX, y: e.clientY };
      timer = window.setTimeout(() => {
        longPressed = true;
        window.setTimeout(() => { longPressed = false; }, 600);
        this.showDetail(el.dataset.id!, el.dataset.donor === '1');
      }, 450);
    });
    this.root.addEventListener('pointermove', (e) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) cancel(); });
    this.root.addEventListener('pointerup', cancel);
    this.root.addEventListener('pointercancel', cancel);
    // the release of a long press must not pick a reward, buy a card or cut one
    this.root.addEventListener('click', (e) => { if (longPressed) { e.stopPropagation(); e.preventDefault(); } }, true);
    this.root.addEventListener('contextmenu', (e) => { if ((e.target as HTMLElement).closest('.card')) e.preventDefault(); });
  }

  private showDetail(id: string, donor: boolean) {
    this.root.querySelector('.detail-layer')?.remove();
    const t = this.run ? runTraits(this.run) : this.meta.seq;
    const layer = document.createElement('div');
    layer.className = 'detail-layer sheet-wrap';
    layer.innerHTML = `<div class="sheet frame">${cardDetail(id, t, donor)}<button class="btn" data-close>Close</button></div>`;
    layer.addEventListener('click', (e) => {
      if (e.target === layer || (e.target as HTMLElement).closest('[data-close]')) layer.remove();
    });
    this.root.appendChild(layer);
  }

  /** A details popup over everything (enemy or clone in battle). */
  private showInfo(html: string) {
    this.root.querySelector('.detail-layer')?.remove();
    const layer = document.createElement('div');
    layer.className = 'detail-layer sheet-wrap';
    layer.innerHTML = `<div class="sheet frame info">${html}<button class="btn" data-close>Close</button></div>`;
    layer.addEventListener('click', (e) => {
      if (e.target === layer || (e.target as HTMLElement).closest('[data-close]')) layer.remove();
    });
    this.root.appendChild(layer);
  }

  // ---------------------------------------------------------------- save

  private saveRun() {
    if (!this.run) return;
    try { this.store?.setItem(RUN_KEY, JSON.stringify(this.run)); } catch { /* keep playing */ }
  }

  private clearRun() {
    this.run = null;
    try { this.store?.removeItem(RUN_KEY); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- hub

  private showHub() {
    this.layout = 'hub';
    this.sheet = null;
    const m = this.meta;
    const t = m.seq;
    const rows = TRAITS.map((k) => {
      const info = TRAIT_INFO[k];
      const cost = sequenceCost(t[k]);
      const pips = Array.from({ length: SEQUENCE_CAP }, (_, i) => `<i class="${i < t[k] ? 'on' : ''}"></i>`).join('');
      const btn = t[k] >= SEQUENCE_CAP ? '<button class="btn small" disabled>MAX</button>'
        : `<button class="btn small ${canRaise(m, k) ? 'primary' : ''}" data-raise="${k}" ${canRaise(m, k) ? '' : 'disabled'}>+ ${cost}</button>`;
      return `<div class="trait t-${k}"><div class="g">${info.glyph}</div>
        <div class="n">${info.name} <em>${t[k]}</em></div>
        ${btn}<div class="d"><span class="lv">${pips}</span>${info.battle} · ${info.explore}</div></div>`;
    }).join('');
    const last = m.lastOutcome === 'none' ? 'The printer hums. No one has walked out of it yet.'
      : m.lastOutcome === 'dead' ? `${cloneName(m.clone - 1)} failed. Its sequence paid <b>${m.lastEarned}</b> Codons.`
        : `${cloneName(m.clone - 1)} came back. <b>${m.lastEarned}</b> Codons.`;
    const hasRun = !!this.run && this.run.mode !== 'dead' && this.run.mode !== 'won';
    this.root.innerHTML = `<div class="screen">
      <h1 class="title">STRAIN<small>The Printer · sequence bay</small></h1>
      <div class="sub">${last}</div>
      <div class="codons">${m.codons} <small>Codons</small></div>
      <div class="traits">${rows}</div>
      <div class="derived">
        <span class="chip">Integrity ${maxIntegrity(t)}</span><span class="chip">Energy ${energyPerTurn(t)}</span>
        <span class="chip">Hand ${handSize(t)}</span>
      </div>
      ${hasRun
        ? `<div class="row"><button class="btn primary" data-go="continue">Continue ${cloneName(this.run!.clone)}</button></div>
           <div class="row"><button class="btn danger" data-go="abandon">Abandon that print</button></div>`
        : this.launchRows(m)}
      <div class="sub">Runs ${m.runs} · Cleared ${m.wins} · Codons earned ${m.totalCodons}</div>
      <details class="codex"><summary>Codex · ${m.logs.length}/${Object.keys(LOGS).length} logs</summary>
        ${Object.entries(LOGS).map(([id, l]) => m.logs.includes(id) ? `<p><b>${esc(l.title)}</b><br>${esc(l.text)}</p>` : '<p class="sub">— not found —</p>').join('')}</details>
      <div class="row"><button class="btn small danger" data-go="wipe">Erase all progress</button></div>
    </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-raise]').forEach((b) => b.addEventListener('click', () => {
      if (raise(this.meta, b.dataset.raise as Trait)) { saveMeta(this.store, this.meta); this.showHub(); }
    }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => {
      const go = b.dataset.go;
      if (go === 'launch') {
        this.run = newRun(this.meta, (Math.random() * 2 ** 31) >>> 0, b.dataset.dest ?? 'derelict');
        this.saveRun();
        this.enterRun();
      } else if (go === 'continue') this.enterRun();
      else if (go === 'abandon') {
        if (!confirm('Abandon this clone? Its Codons are still banked.')) return;
        this.endRun('dead');
      } else if (go === 'wipe') {
        if (!confirm('Erase every Codon and sequence level?')) return;
        this.meta = newMeta();
        saveMeta(this.store, this.meta);
        this.clearRun();
        this.showHub();
      }
    }));
  }

  /** Print buttons: the Derelict, plus every planet a clone has already reached. */
  private launchRows(m: Meta): string {
    const dests = ['derelict', ...m.landed.filter((id) => id !== 'derelict' && PLANETS[id])];
    if (dests.length === 1) return `<div class="row"><button class="btn primary" data-go="launch" data-dest="derelict">Print ${cloneName(m.clone)}</button></div>`;
    return `<div class="sub">Print ${cloneName(m.clone)} and fly to:</div>
      <div class="row">${dests.map((id) => `<button class="btn ${id === 'derelict' ? 'primary' : ''}" data-go="launch" data-dest="${id}">${esc(chartName(id))} <small>· tier ${planetDepth(id)}</small></button>`).join('')}</div>`;
  }

  /** A vat purchase is permanent at once: write the sequence and the bank back to the meta. */
  private syncBank() {
    const r = this.run;
    if (!r) return;
    this.meta.codons = Math.max(0, this.meta.codons - r.bankSpent);
    r.bankSpent = 0;
    r.bank = this.meta.codons;
    for (const k of TRAITS) this.meta.seq[k] = Math.max(this.meta.seq[k], r.seq[k]);
    saveMeta(this.store, this.meta);
  }

  private endRun(outcome: 'dead' | 'won') {
    if (!this.run) return;
    this.syncBank();
    settleRun(this.meta, this.run.codons, outcome, this.run.logs, this.run.revealed, this.run.visited, this.run.slain);
    saveMeta(this.store, this.meta);
    this.clearRun();
    this.showHub();
  }

  // ---------------------------------------------------------------- run layout

  private enterRun() {
    // the Printer may have spent banked Codons since this print left
    this.run!.bank = this.meta.codons;
    this.layout = '';
    this.sheet = null;
    this.lines = [];
    this.lastMsgCount = this.run!.msgs.length;
    this.drawX = this.run!.x;
    this.drawY = this.run!.y;
    this.wv.snap();
    // resuming mid-fight: show the saved HP straight away, not the empty display from before the load
    const b = this.run!.battle;
    if (b) {
      this.queue = [];
      this.pendingAct.clear();
      this.hidden.clear();
      this.dispP = b.player.hp;
      this.dispFoe.clear();
      for (const f of b.foes) this.dispFoe.set(f.uid, f.hp);
    }
    this.syncLayout();
  }

  private syncLayout() {
    const r = this.run;
    if (!r) return;
    const want = r.battle ? 'battle' : 'explore';
    if (want === this.layout) { this.refresh(); return; }
    this.layout = want;
    if (want === 'battle') {
      this.root.innerHTML = `<div class="scene" style="height:54%"><canvas class="c2"></canvas><div class="plates"></div><div class="unit me"></div></div>
        <div class="battle-ui"><div class="textbox frame"></div><div class="hand"></div>
        <div class="controls"><div class="energy"></div><div class="piles"></div><div class="grow"></div>
        <button class="btn small" data-b="flee">Flee</button><button class="btn primary" data-b="end">End turn</button></div></div>
        <div class="overlay"></div>`;
    } else {
      this.root.innerHTML = `<div class="scene full"><canvas class="c2"></canvas>
        <div class="hud"></div>
        <canvas class="mini" data-d="map" title="Map"></canvas>
        <button class="pause-btn" data-d="menu" aria-label="Pause"><i></i><i></i></button></div>
        <div class="overlay"></div>`;
    }
    this.scene = this.root.querySelector('.scene')!;
    this.setupCanvas();
    this.bindLayout();
    this.resize();
    this.refresh();
  }

  private setupCanvas() {
    const c2 = this.scene.querySelector<HTMLCanvasElement>('canvas.c2')!;
    this.glCanvas = null;
    this.print = null;
    if (this.printOn) {
      const gl = document.createElement('canvas');
      const p = Print.create(gl);
      if (p) {
        gl.className = 'c2';
        c2.replaceWith(gl);
        this.glCanvas = gl;
        this.print = p;
      }
    }
    if (!this.print) {
      this.src = c2;
      this.ctx = c2.getContext('2d')!;
    } else {
      this.src = document.createElement('canvas');
      this.ctx = this.src.getContext('2d')!;
    }
  }

  private resize() {
    if (!this.scene || this.layout === 'hub') return;
    const rect = this.scene.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.sw = rect.width;
    this.sh = rect.height;
    for (const c of [this.src, this.glCanvas]) {
      if (!c) continue;
      c.width = Math.round(rect.width * this.dpr);
      c.height = Math.round(rect.height * this.dpr);
    }
    this.wv.resize(rect.width, rect.height);
  }

  private bindLayout() {
    const canvas = this.glCanvas ?? this.src;
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (this.layout === 'explore') this.tapWorld(px, py);
      else this.tapBattle(px, py);
    });
    this.root.querySelectorAll<HTMLElement>('[data-d]').forEach((b) => b.addEventListener('click', () => {
      const d = b.dataset.d;
      this.walk = null;
      this.sheet = d === 'map' ? { kind: 'map' } : d === 'deck' ? { kind: 'deck', tab: 'tac' } : { kind: 'menu' };
      this.refresh();
    }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-b]').forEach((b) => b.addEventListener('click', () => {
      if (this.busy() || !this.run) return;
      this.play(b.dataset.b === 'end' ? bEnd(this.run) : bFlee(this.run));
    }));
    this.root.querySelector('.textbox')?.addEventListener('click', () => this.skip());
  }

  // ---------------------------------------------------------------- frame

  private frame(now: number) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    const t = now / 1000;
    const r = this.run;
    if (r && this.layout !== 'hub' && this.layout !== '' && this.sw > 0) {
      this.tickWalk(dt);
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      let strength = 0;
      if (this.layout === 'battle' && r.battle) {
        this.bv.update(dt);
        this.bv.draw(ctx, r.battle, runTraits(r), this.sw, this.sh, t, r.planet, r.fight?.at ? { run: r, at: r.fight.at } : undefined);
        strength = (1 - this.bv.cam) * 0.8;
      } else {
        const k = 1 - Math.exp(-dt * 16);
        this.drawX += (r.x - this.drawX) * k;
        this.drawY += (r.y - this.drawY) * k;
        const moving = Math.abs(r.x - this.drawX) + Math.abs(r.y - this.drawY) > 0.05;
        this.worldClock(r, dt);
        this.wv.draw(ctx, r, t, dt, this.drawX, this.drawY, moving || !!this.walk, this.walk?.path ?? []);
      }
      if (this.print && this.glCanvas) this.print.render(this.src, this.dpr, t, strength);
    }
    requestAnimationFrame((q) => this.frame(q));
  }

  // ---------------------------------------------------------------- explore

  private clock = 0;
  private clockSaved = 0;

  /** Mobs live in real time: while you stand and look, they keep wandering and hunting. */
  private worldClock(r: RunState, dt: number) {
    if (r.mode !== 'explore' || this.sheet || this.walk || r.notice || this.layout !== 'explore') { this.clock = 0; return; }
    if (this.root.querySelector('.detail-layer')) return;
    this.clock += dt;
    if (this.clock < 0.8) return;
    this.clock = 0;
    const moved = mobsTick(r);
    if ((r.mode as string) === 'battle') { this.saveRun(); this.afterAction(); return; }
    if (moved && performance.now() - this.clockSaved > 3000) { this.clockSaved = performance.now(); this.saveRun(); }
  }

  private tapWorld(px: number, py: number) {
    const r = this.run;
    if (!r || r.mode !== 'explore' || this.sheet) return;
    let [x, y] = this.wv.tileAt(px, py);
    // a tap on a wall's raised top means the tile below it
    if (r.world.tiles[idx(r.world, x, y)] === T_WALL && y + 1 < r.world.h && r.world.tiles[idx(r.world, x, y + 1)] !== T_WALL) {
      const [, fy] = this.wv.tileAt(px, py + this.wv.T * 0.42);
      if (fy === y + 1) y += 1;
    }
    if (x < 0 || y < 0 || x >= r.world.w || y >= r.world.h) return;
    const isShip = x === r.world.ship.x && y === r.world.ship.y;
    const adj = Math.abs(x - r.x) + Math.abs(y - r.y);
    if ((isInteractable(r, x, y) && !isShip) || (isShip && adj <= 1)) {
      if (adj <= 1) { this.sheet = { kind: 'action', x, y }; this.refresh(); return; }
      const path = pathTo(r, x, y);
      if (path.length) this.walk = { path, then: () => { this.sheet = { kind: 'action', x, y }; this.refresh(); } };
      return;
    }
    const mob = mobAt(r, x, y);
    if (mob && adj === 1) { this.doStep(x - r.x, y - r.y); return; }
    const path = pathTo(r, x, y);
    if (path.length) this.walk = { path };
    else if (mob) {
      const p = pathTo(r, x, y);
      if (p.length) this.walk = { path: p };
    }
  }

  private tickWalk(dt: number) {
    const r = this.run;
    if (!r || !this.walk) return;
    this.walkT -= dt;
    if (this.walkT > 0) return;
    this.walkT = 0.11;
    const next = this.walk.path.shift();
    if (!next) {
      const then = this.walk.then;
      this.walk = null;
      then?.();
      return;
    }
    const moved = this.doStep(next[0] - r.x, next[1] - r.y);
    if (!moved || r.mode !== 'explore') this.walk = null;
    else if (!this.walk.path.length) {
      const then = this.walk.then;
      this.walk = null;
      then?.();
    }
  }

  private doStep(dx: number, dy: number): boolean {
    const r = this.run!;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
    const moved = step(r, dx, dy);
    this.afterAction();
    return moved;
  }

  private key(e: KeyboardEvent) {
    const r = this.run;
    if (!r || this.layout !== 'explore' || r.mode !== 'explore' || this.sheet) {
      if (e.key === 'Escape' && this.sheet) { this.sheet = null; this.refresh(); }
      return;
    }
    const dir: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    };
    const d = dir[e.key];
    if (d) {
      e.preventDefault();
      this.walk = null;
      const [nx, ny] = [r.x + d[0], r.y + d[1]];
      if (isInteractable(r, nx, ny)) { this.sheet = { kind: 'action', x: nx, y: ny }; this.refresh(); return; }
      this.doStep(d[0], d[1]);
    }
  }

  /** Called after anything changes the run. */
  private afterAction() {
    const r = this.run;
    if (!r) return;
    this.saveRun();
    if (r.mode === 'battle' && this.layout !== 'battle') {
      this.walk = null;
      this.sheet = null;
      this.bv.reset();
      this.lines = [];
      this.syncLayout();
      // let the camera swing down from the map into the fight before anything happens
      const ev = takeEvents();
      this.prime(ev);
      this.introUntil = performance.now() + 1100;
      window.setTimeout(() => { this.introUntil = 0; this.play(ev, true); }, 1100);
      this.refresh();
      return;
    }
    this.refresh();
  }

  // ---------------------------------------------------------------- battle

  private busy(): boolean {
    return this.queue.length > 0 || this.qTimer !== 0 || this.introUntil > performance.now();
  }

  /** Rewind shown HP to what it was before these events play. */
  private prime(ev: BattleEv[], fresh = true) {
    const b = this.run?.battle;
    if (!b) return;
    if (fresh) {
      this.dispP = b.player.hp;
      for (const f of b.foes) this.dispFoe.set(f.uid, f.hp);
    }
    for (let i = ev.length - 1; i >= 0; i--) {
      const e = ev[i];
      if (e.k === 'hitFoe') this.dispFoe.set(e.uid, (this.dispFoe.get(e.uid) ?? 0) + e.n);
      if (e.k === 'healFoe') this.dispFoe.set(e.uid, (this.dispFoe.get(e.uid) ?? 0) - e.n);
      if (e.k === 'hitPlayer') this.dispP += e.n;
      if (e.k === 'heal') this.dispP -= e.n;
      if (e.k === 'summon') this.hidden.add(e.uid);
    }
  }

  private play(ev: BattleEv[], primed = false) {
    if (!this.run?.battle) { this.syncLayout(); return; }
    if (!primed) this.prime(ev, !this.busy());
    for (const e of ev) if (e.k === 'act') this.pendingAct.add(e.uid);
    this.queue.push(...ev);
    this.saveRun();
    if (!this.qTimer) this.next();
  }

  /** A foe's next move, with its attack already cut down by your plating (4×2 into 5 plate reads 0×2). */
  private intentHtml(b: NonNullable<RunState['battle']>, f: NonNullable<RunState['battle']>['foes'][number]): string {
    if (f.sick) return 'SUMMONED';
    const def = ENEMIES[f.id];
    if (f.asleep && def.sleeps) {
      const left = def.sleeps.wakeAfter - (f.slept ?? 0);
      return `ASLEEP · wakes in ${left}`;
    }
    if (def.countdown) {
      const left = def.countdown.at - (f.heat ?? 0);
      if (left <= 1) {
        let d = def.countdown.blast + 2 * f.tier;
        if (f.weak > 0) d = Math.floor(d * 0.75);
        if (b.player.expose > 0) d = Math.floor(d * 1.5);
        return `<span class="atk">BLAST&nbsp;${icon('dmg')}${d}</span> through plating`;
      }
    }
    const n = intentNumbers(b, f);
    const parts: string[] = [];
    if (def.countdown) parts.push(`BLOWS IN ${def.countdown.at - (f.heat ?? 0)}`);
    if (def.fleesAfter) parts.push(`FLEES IN ${def.fleesAfter - (f.acted ?? 0)}`);
    if (n.healAlly) parts.push(`${icon('heal')}${n.healAlly} ally`);
    if (currentIntent(f, b).attack !== undefined) {
      const hit = n.pierce ? n.attack : Math.max(0, n.attack - b.player.plate);
      const cut = hit < n.attack ? ` <s>${n.attack}</s>` : '';
      parts.push(`<span class="atk">${icon('dmg')}${hit}${n.hits > 1 ? `×${n.hits}` : ''}${cut}${n.pierce ? '<small>&nbsp;pierce</small>' : ''}${n.drain ? icon('drain') : ''}</span>`);
    }
    if (n.plate) parts.push(`${icon('plate')}${n.plate}`);
    if (n.strength) parts.push(`${icon('empower')}${n.strength}`);
    if (n.weak) parts.push(`${icon('weak')}${n.weak}`);
    if (n.expose) parts.push(`${icon('expose')}${n.expose}`);
    if (n.rot) parts.push(`${icon('rot')}${n.rot}`);
    if (n.summon) parts.push('SUMMON');
    if (n.ally) parts.push(`${icon('all')}${icon('empower')}${n.ally}`);
    return parts.join(' ') || esc(n.label);
  }

  /** Show one battle event. Returns how long it holds the queue (ms), if not the default. */
  private apply(e: BattleEv): number | undefined {
    switch (e.k) {
      case 'card': return fxLead(this.bv.playCard(e.id, e.target, e.hits), e.hits);
      case 'strike': {
        const f = this.run?.battle?.foes.find((q) => q.uid === e.uid);
        return f ? fxLead(this.bv.strike(e.uid, f.id, e.hits), e.hits) : undefined;
      }
      case 'text': this.lines.push(e.s); if (this.lines.length > 2) this.lines.shift(); break;
      case 'hitFoe':
        this.dispFoe.set(e.uid, (this.dispFoe.get(e.uid) ?? 0) - e.n); this.bv.anim(e.uid).flash = 1;
        this.bv.float(e.uid, e.n > 0 ? `-${e.n}` : 'BLOCKED', e.n > 0 ? '#ff6a55' : '#d8cfb8', e.n > 0);
        break;
      case 'hitPlayer':
        this.dispP -= e.n; this.bv.player.flash = e.n > 0 ? 1 : 0.3; this.bv.shake = e.n > 0 ? Math.min(1, 0.3 + e.n / 20) : 0;
        this.bv.float('p', e.n > 0 ? `-${e.n}` : 'BLOCKED', e.n > 0 ? '#ff6a55' : '#9fd2e4', e.n > 0);
        break;
      case 'healFoe': this.dispFoe.set(e.uid, (this.dispFoe.get(e.uid) ?? 0) + e.n); if (e.n > 0) this.bv.float(e.uid, `+${e.n}`, '#9fd08a', true); break;
      case 'plate': if (e.n) this.bv.float(e.who, `+${e.n} PLATE`, '#9fd2e4'); break;
      case 'status': if (e.s) this.bv.float(e.who, e.s, e.s.startsWith('ROT') ? '#c4d86a' : '#c79ae8'); break;
      case 'float': this.bv.float(e.who, e.s, INK.sodium); break;
      case 'act': this.bv.anim(e.uid).lunge = 1; this.actedSoon(e.uid); if (e.label) this.bv.float(e.uid, e.label, INK.sodium); break;
      case 'die': this.bv.anim(e.uid).dead = 0.01; break;
      case 'heal': this.dispP += e.n; this.bv.player.heal = 1; if (e.n > 0) this.bv.float('p', `+${e.n}`, '#9fd08a', true); break;
      case 'summon': this.hidden.delete(e.uid); break;
      default: break;
    }
    return undefined;
  }

  private next() {
    const e = this.queue.shift();
    if (!e) { this.qTimer = 0; this.finishQueue(); return; }
    const lead = this.apply(e);
    this.refreshBattle();
    // a text line right after an animation shares its time instead of waiting twice
    const after = this.queue[0];
    const delay = lead !== undefined ? (after?.k === 'text' ? 0 : lead) : e.k === 'text' ? Math.max(520, this.pendingLead) : e.k === 'act' ? 160 : 90;
    this.pendingLead = lead !== undefined && after?.k === 'text' ? lead : 0;
    this.qTimer = window.setTimeout(() => this.next(), delay);
  }

  private skip() {
    if (!this.busy()) return;
    clearTimeout(this.qTimer);
    while (this.queue.length) this.apply(this.queue.shift()!);
    this.qTimer = 0;
    this.finishQueue();
  }

  /** Once a foe's attack has landed, its plate can move on to its next intent. */
  private actedSoon(uid: number) {
    window.setTimeout(() => { this.pendingAct.delete(uid); if (this.layout === 'battle') this.refreshBattle(); }, 700);
  }

  private finishQueue() {
    this.pendingAct.clear();
    const r = this.run;
    if (!r) return;
    this.hidden.clear();
    if (r.battle) {
      this.dispP = r.battle.player.hp;
      for (const f of r.battle.foes) this.dispFoe.set(f.uid, f.hp);
    }
    if (!r.battle) { this.syncLayout(); return; }
    this.refresh();
  }

  /** The enemy under a screen point: its plate, or its body in the scene. */
  private foeAt(px: number, py: number): number | undefined {
    const el = document.elementFromPoint(px, py) as HTMLElement | null;
    const plate = el?.closest<HTMLElement>('.plates [data-f]');
    if (plate) return Number(plate.dataset.f);
    const cv = this.root.querySelector<HTMLElement>('.scene canvas');
    if (!cv) return undefined;
    const rc = cv.getBoundingClientRect();
    const x = px - rc.left;
    const y = py - rc.top;
    const h = this.bv.hit.find((q) => x >= q.x - 10 && x <= q.x + q.w + 10 && y >= q.y - 10 && y <= q.y + q.h + 10);
    return h?.uid;
  }

  /**
   * A card in hand can be dragged up onto an enemy (its plate or its body) to play it at that
   * enemy, dragged up anywhere over the scene to play it at the current target, or swiped down
   * to throw it away. A plain tap still plays it.
   */
  private dragCard(el: HTMLElement, uid: number) {
    let start: { x: number; y: number; id: number } | null = null;
    let mode: 'none' | 'up' | 'down' = 'none';
    let ghost: HTMLElement | null = null;
    let over: number | undefined;
    const mark = (u: number | undefined) => {
      over = u;
      this.bv.dropTarget = u ?? -1;
      this.root.querySelectorAll<HTMLElement>('.plates [data-f]').forEach((p) => p.classList.toggle('drop', Number(p.dataset.f) === u));
    };
    const clear = () => {
      ghost?.remove();
      ghost = null;
      el.style.transform = '';
      el.style.opacity = '';
      mark(undefined);
      mode = 'none';
      start = null;
    };
    el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY, id: e.pointerId }; mode = 'none'; el.style.transition = 'none'; });
    el.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (mode === 'none') {
        if (dy < -12 && -dy > Math.abs(dx) * 0.6 && !this.busy() && !this.run?.battle?.pending) {
          mode = 'up';
          el.setPointerCapture?.(e.pointerId);
          const card = el.querySelector<HTMLElement>('.card');
          if (card) {
            const rc = card.getBoundingClientRect();
            ghost = card.cloneNode(true) as HTMLElement;
            ghost.classList.add('drag-ghost');
            ghost.style.width = `${rc.width}px`;
            ghost.style.height = `${rc.height}px`;
            document.body.appendChild(ghost);
            el.style.opacity = '0.25';
          }
        } else if (dy > 8 && dy > Math.abs(dx)) {
          mode = 'down';
          el.setPointerCapture?.(e.pointerId);
        }
      }
      if (mode === 'up' && ghost) {
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
        const u = this.foeAt(e.clientX, e.clientY);
        const alive = this.run?.battle?.foes.find((f) => f.uid === u && f.alive);
        mark(alive ? u : undefined);
        ghost.classList.toggle('on-target', !!alive);
      } else if (mode === 'down') {
        el.style.transform = `translateY(${dy}px) rotate(${dx * 0.05}deg)`;
        el.style.opacity = String(Math.max(0.25, 1 - dy / 160));
      }
    });
    el.addEventListener('pointerup', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (mode === 'up') {
        const target = over;
        const hand = this.root.querySelector<HTMLElement>('.hand')?.getBoundingClientRect();
        const aboveHand = !hand || e.clientY < hand.top - 10;
        clear();
        if (target !== undefined) { this.bv.target = target; this.tapCard(uid); }
        else if (aboveHand) this.tapCard(uid);
        return;
      }
      if (mode === 'down' && dy > 60 && dy > Math.abs(dx) * 1.2) {
        el.style.transition = 'transform 0.12s, opacity 0.12s';
        el.style.transform = 'translateY(220px)';
        el.style.opacity = '0';
        start = null;
        mode = 'none';
        window.setTimeout(() => this.discardCard(uid), 120);
        return;
      }
      el.style.transition = 'transform 0.15s, opacity 0.15s';
      clear();
    });
    el.addEventListener('pointercancel', clear);
  }

  private discardCard(uid: number) {
    const r = this.run;
    if (!r?.battle || this.busy() || r.battle.phase !== 'player') { this.refresh(); return; }
    this.play(bDiscard(r, uid));
    this.saveRun();
    this.refresh();
  }

  private tapBattle(px: number, py: number) {
    const r = this.run;
    if (!r?.battle) return;
    const h = this.bv.hit.find((q) => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
    if (h) { this.bv.target = h.uid; this.refreshBattle(); }
  }

  private target(): number | undefined {
    const b = this.run?.battle;
    if (!b) return undefined;
    const alive = aliveFoes(b);
    return (alive.find((f) => f.uid === this.bv.target) ?? alive[0])?.uid;
  }

  private tapCard(uid: number) {
    const r = this.run;
    const b = r?.battle;
    if (!r || !b || this.busy()) return;
    if (b.pending) {
      if (uid === b.pending.uid) return;
      this.play(bPick(r, uid, this.target()));
      return;
    }
    const c = b.hand.find((q) => q.uid === uid);
    if (!c) return;
    const ok = playable(b, c);
    if (!ok.ok) { if (ok.why) this.bv.float('p', ok.why.toUpperCase(), '#d8cfb8'); return; }
    this.bv.player.lunge = 1;
    this.play(bPlay(r, uid, this.target()));
  }

  // ---------------------------------------------------------------- DOM

  private refresh() {
    if (this.layout === 'battle') this.refreshBattle();
    else if (this.layout === 'explore') this.refreshExplore();
    this.refreshOverlay();
  }

  /** One continuous bar. The second argument stays for call sites that used to pass a segment count. */
  private bar(cur: number, max: number, _segs = 0): string {
    const f = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    const cls = f < 0.25 ? 'crit' : f < 0.5 ? 'lo' : '';
    return `<div class="bar"><i class="${cls}" style="width:${(f * 100).toFixed(1)}%"></i></div>`;
  }

  private refreshExplore() {
    const r = this.run!;
    const t = runTraits(r);
    const mh = maxHp(r);
    const storm = stormIn(r);
    const hud = this.root.querySelector('.hud');
    if (!hud) return;
    const newMsg = r.msgs.length !== this.lastMsgCount;
    this.lastMsgCount = r.msgs.length;
    const msg = r.msgs[r.msgs.length - 1] ?? '';
    hud.innerHTML = `<div class="hud-row"><span class="stat">${esc(here(r).name.replace('The ', '').toUpperCase())} ${r.landing}</span>${this.bar(r.hp, mh, 16)}<span class="stat">${Math.max(0, r.hp)}/${mh}</span></div>
      <div class="hud-row"><span class="chip">◆ ${r.biomass} bio</span><span class="chip" style="color:var(--sodium)">${r.codons} cod</span>
      ${r.storm ? '<span class="chip warn">STORM</span>' : storm < 200 ? `<span class="chip warn">storm ${storm}</span>` : ''}</div>
      ${msg ? `<div class="msg ${newMsg ? '' : 'fade'}">${esc(msg)}</div>` : ''}`;
    // the minimap rides under the HP bar at the right edge; tapping it opens the full map
    const mini = this.root.querySelector<HTMLCanvasElement>('canvas.mini');
    if (mini) {
      const row = hud.querySelector('.hud-row')?.getBoundingClientRect();
      const sc = this.root.querySelector('.scene')?.getBoundingClientRect();
      if (row && sc) mini.style.top = `${row.bottom - sc.top + 8}px`;
      this.drawMinimap(mini, r, 13);
    }
    if (newMsg) {
      clearTimeout(this.msgTimer);
      this.msgTimer = window.setTimeout(() => this.root.querySelector('.msg')?.classList.add('fade'), 3200);
    }
    void t;
  }

  private refreshBattle() {
    const r = this.run;
    const b = r?.battle;
    if (!r || !b) return;
    const t = runTraits(r);
    const quiet = !this.busy();
    const tgt = this.target();
    const plates = this.root.querySelector('.plates');
    if (plates) {
      plates.classList.toggle('many', b.foes.filter((f) => f.alive).length > 1);
      plates.innerHTML = b.foes.filter((f) => !this.hidden.has(f.uid)).map((f) => {
        const a = this.bv.anim(f.uid);
        const gone = !f.alive && a.dead > 0;
        const hp = Math.max(0, this.dispFoe.get(f.uid) ?? f.hp);
        const def = ENEMIES[f.id];
        let intent = '';
        if (f.alive && (b.phase === 'player' || this.pendingAct.has(f.uid))) {
          if (this.pendingAct.has(f.uid)) intent = this.shownIntent.get(f.uid) ?? '';
          else {
            intent = this.intentHtml(b, f);
            this.shownIntent.set(f.uid, intent);
          }
        }
        const tabs = [
          f.plate ? `${icon('plate')}${f.plate}` : '',
          f.strength ? `${icon('empower')}${f.strength}` : '',
          f.weak ? `${icon('weak')}${f.weak}` : '',
          f.expose ? `${icon('expose')}${f.expose}` : '',
          f.tag ? `${icon('tag')}${f.tag}` : '',
          f.rot ? `${icon('rot')}${f.rot}` : '',
        ].filter(Boolean);
        return `<div class="unit ${gone ? 'gone' : ''}" data-f="${f.uid}">
          <div class="plate ${f.uid === tgt && aliveFoes(b).length > 1 ? 'tgt' : ''}">
          <div class="top"><span class="nm">${def.rank === 'boss' ? '☠ ' : def.rank === 'elite' ? '✦ ' : ''}${f.form === 'faint' ? '<i class="form faint">FAINT</i> ' : f.form === 'hulking' ? '<i class="form hulk">HULKING</i> ' : ''}${esc(def.name)}${f.vet ? `<i class="form vet" title="Veteran: +${f.vet} attack">+${f.vet}</i>` : ''}</span><span class="hpn">${hp}<small>/${f.maxHp}</small></span></div>
          ${this.bar(hp, f.maxHp)}<div class="row2"><span class="intent">${intent || '&nbsp;'}</span></div></div>
          ${tabs.length ? `<div class="tab">${tabs.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}</div>`;
      }).join('');
      // tapping a plate aims at that enemy and opens its details
      plates.querySelectorAll<HTMLElement>('[data-f]').forEach((el) => el.addEventListener('click', () => {
        const f = b.foes.find((q) => q.uid === Number(el.dataset.f));
        if (!f) return;
        if (f.alive) this.bv.target = f.uid;
        this.refreshBattle();
        this.showInfo(foeInfo(b, f));
      }));
    }
    const me = this.root.querySelector<HTMLElement>('.unit.me');
    if (me) {
      me.style.top = `${this.sh * 0.68}px`;
      const p = b.player;
      const hp = Math.max(0, this.dispP);
      const tabs = [
        p.plate ? `${icon('plate')}${p.plate}` : '',
        p.keep ? `${icon('plate')}${p.keep}<small>↻</small>` : '',
        p.weak ? `${icon('weak')}${p.weak}` : '',
        p.expose ? `${icon('expose')}${p.expose}` : '',
        p.rot ? `${icon('rot')}${p.rot}` : '',
        b.empower ? `${icon('empower')}${b.empower}` : '',
        b.triage ? `${icon('triage')}${b.triage}` : '',
        ...TRAITS.filter((k) => b.surge[k]).map((k) => `<b class="${k}">${TRAIT_INFO[k].short}${b.surge[k] > 0 ? '+' : ''}${b.surge[k]}</b>`),
      ].filter(Boolean);
      me.innerHTML = `${tabs.length ? `<div class="tab">${tabs.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}
        <div class="plate"><div class="top"><span class="nm">${cloneName(r.clone)}</span><span class="hpn">${hp}<small>/${p.maxHp}</small></span></div>
        ${this.bar(hp, p.maxHp)}<div class="row2"><span class="st">${icon('bio')}${b.biomass}</span></div></div>`;
      if (!me.dataset.bound) {
        me.dataset.bound = '1';
        me.addEventListener('click', () => { const rr = this.run; if (rr?.battle) this.showInfo(playerInfo(rr, rr.battle, cloneName(rr.clone))); });
      }
    }
    const tb = this.root.querySelector<HTMLElement>('.textbox');
    // the log box is gone: everything shows as pop-ups; it only returns to ask you to pick a card
    if (tb) tb.style.display = b.pending ? '' : 'none';
    if (tb) {
      const pend = b.pending ? [b.pending.kind === 'donor' ? 'Choose a card to feed.' : 'Choose a card to eat.'] : [];
      const lines = pend.length && quiet ? pend : this.lines;
      tb.innerHTML = `${lines.map(esc).join('<br>')}${this.busy() ? '<span class="more">▼</span>' : ''}`;
    }
    const hand = this.root.querySelector<HTMLElement>('.hand');
    if (hand) {
      hand.classList.toggle('busy', !quiet || b.phase !== 'player');
      hand.innerHTML = b.hand.map((c) => {
        const ok = playable(b, c).ok;
        const bonus = cardBonus(b, c);
        const pick = !!b.pending && c.uid !== b.pending.uid;
        const tt = { ...t };
        for (const k of TRAITS) tt[k] += b.surge[k];
        return `<div data-c="${c.uid}">${cardHtml(c.id, tt, {
          donor: c.donor, dmgBonus: bonus.dmg + b.empower, plateBonus: bonus.plate, off: !ok && !pick, fleeting: c.fleeting, extraClass: pick ? 'pick' : '',
        })}</div>`;
      }).join('');
      hand.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => {
        const uid = Number(el.dataset.c);
        press(el, () => this.tapCard(uid));
        this.dragCard(el, uid);
      });
    }
    const en = this.root.querySelector('.energy');
    if (en) {
      const max = Math.max(b.energy, energyPerTurn(t));
      en.innerHTML = `${Array.from({ length: max }, (_, i) => `<b class="${i < b.energy ? 'on' : ''}"></b>`).join('')}`;
    }
    const piles = this.root.querySelector('.piles');
    if (piles) piles.textContent = `draw ${b.draw.length} · disc ${b.discard.length} · swipe ↓ to discard`;
    const fleeB = this.root.querySelector<HTMLButtonElement>('[data-b="flee"]');
    if (fleeB) {
      fleeB.disabled = !quiet || !canFlee(b);
      fleeB.textContent = canFlee(b) ? `Flee ${Math.round(fleeChance(b) * 100)}%` : 'Flee';
    }
    const endB = this.root.querySelector<HTMLButtonElement>('[data-b="end"]');
    if (endB) endB.disabled = !quiet || b.phase !== 'player' || !!b.pending;
    void resolved;
  }

  // ---------------------------------------------------------------- overlays

  private refreshOverlay() {
    const o = this.root.querySelector<HTMLElement>('.overlay');
    if (!o) return;
    const r = this.run;
    if (!r) { o.innerHTML = ''; return; }
    const t = runTraits(r);
    const quiet = !this.busy();
    let html = '';
    if (quiet && r.mode === 'dead') {
      html = `<div class="screen"><div class="big-msg">PRINT<br>FAILED</div>
        <p class="sub">${cloneName(r.clone)} died on ${esc(here(r).name)} (landing ${r.landing}) after ${r.stats.fights} fights and ${r.stats.steps} steps.</p>
        <div class="codons">+${r.codons} <small>Codons banked</small></div>
        <p class="sub">The sequence remembers. The next print starts stronger if you spend them.</p>
        <button class="btn primary" data-o="hub">Back to the Printer</button></div>`;
    } else if (r.mode === 'won') {
      const lost = chartOptions(r).filter((o) => o.state === 'lost').map((o) => o.name);
      html = `<div class="screen"><div class="big-msg">${r.landing} WORLD${r.landing > 1 ? 'S' : ''}<br>CLEARED</div>
        <p class="sub">${cloneName(r.clone)} came home from ${r.visited.map((id) => esc(chartName(id))).join(' → ')}. ${r.stats.fights} fights, ${r.stats.ambushed} ambushes survived.</p>
        <div class="codons">+${r.codons} <small>Codons banked</small></div>
        ${r.revealed.length ? `<p class="sub">New on the star chart: ${r.revealed.map((id) => esc(chartName(id))).join(', ')}.</p>` : ''}
        ${lost.length ? `<p class="sub">Still no signal from ${lost.map(esc).join(' or ')}. Their coordinates arrive in a later build.</p>` : ''}
        <button class="btn primary" data-o="hub-won">Back to the Printer</button></div>`;
    } else if (r.mode === 'chart') {
      const rows = chartOptions(r).map((o) => {
        const tag = o.state === 'open' ? `Landing ${r.landing + 1} · tier ${r.landing + 1}` : o.state === 'visited' ? 'Cleared this run' : o.state === 'lost' ? 'Signal lost' : 'Unknown signal';
        return `<div class="planet ${o.state}"><div class="pn">${o.state === 'unknown' ? '???' : esc(o.name)}</div><div class="pp">${o.state === 'unknown' ? 'A faint signal. Beat a world boss to fix its position.' : esc(o.pitch)}</div>
          <div class="row"><span class="chip">${tag}</span>${o.state === 'open' ? `<button class="btn primary small" data-land="${o.id}">Set course</button>` : ''}</div></div>`;
      }).join('');
      html = `<div class="screen"><h1 class="title">STAR CHART<small>${esc(here(r).name)} cleared · ${r.codons} Codons so far</small></h1>
        <p class="sub">Each landing is one tier harder, whichever world you pick. The ship patches you up: +30% integrity.</p>
        ${rows}<button class="btn" data-o="home">Go home now and bank everything</button></div>`;
    } else if (quiet && r.mode === 'loot' && r.reward) {
      // the after-fight summary: what the fight paid, and maybe a card
      const rw = r.reward;
      const rows = (rw.corpses ?? []).map((c) => `<div class="corpse"><span class="nm">${esc(ENEMIES[c.id].name)}${c.tagged ? ' <small>⌖ tagged ×2</small>' : ''}</span><span class="bio">+${c.bio} ◆</span></div>`).join('');
      const cards = rw.options.length
        ? `<h3>Spoils · take one</h3><div class="cards3">${rw.options.map((id, i) => `<div data-lootpick="${i}">${cardHtml(id, t)}</div>`).join('')}</div>
           <button class="btn" data-lootpick="-1">Leave them</button>`
        : '<button class="btn primary" data-lootpick="-1">Continue</button>';
      html = `<div class="sheet-wrap"><div class="sheet frame summary"><div class="sum-title">${esc(rw.title)}</div>
        <div class="sum-tiles">
          <div class="tile cod"><b>+${rw.codons}</b><span>Codons</span><small>Growth: sequence your genome at the Printer or a vat. ${r.codons} this run.</small></div>
          <div class="tile bio"><b>+${rw.biomass}</b><span>Biomass</span><small>Currency: splices, printed cards, mending at vats. ◆${r.biomass} held.</small></div>
        </div>
        ${rows ? `<h3>Rendered</h3>${rows}` : ''}
        ${cards}</div></div>`;
    } else if (r.mode === 'reward' && r.reward) {
      const rw = r.reward;
      html = `<div class="sheet-wrap"><div class="sheet frame"><h2>${esc(rw.title)}</h2>
        <p>${rw.biomass ? `+${rw.biomass} biomass. ` : ''}${rw.codons ? `+${rw.codons} Codons. ` : ''}Take one ${rw.deck === 'tac' ? 'tactical' : 'exploration'} card, or none.</p>
        <div class="cards3">${rw.options.map((id, i) => `<div data-pick="${i}">${cardHtml(id, t)}</div>`).join('')}</div>
        <button class="btn" data-pick="-1">Take nothing</button></div></div>`;
    } else if (r.notice) {
      html = `<div class="sheet-wrap"><div class="sheet frame"><h2>${esc(r.notice.title)}</h2><p>${esc(r.notice.text)}</p>
        <button class="btn primary" data-o="notice">Go on</button></div></div>`;
    } else if (this.sheet) {
      html = this.sheetHtml(this.sheet, r);
    }
    o.innerHTML = html;
    o.querySelectorAll<HTMLElement>('[data-lootpick]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.lootpick);
      lootTake(r, i >= 0 ? i : undefined);
      this.afterLoot();
    }));
    o.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      rewardPick(r, Number(b.dataset.pick));
      this.saveRun();
      this.syncLayout();
    }));
    o.querySelectorAll<HTMLElement>('[data-cut]').forEach((b) => b.addEventListener('click', () => {
      const s = this.sheet;
      if (s?.kind !== 'surgery') return;
      excise(r, s.tab, Number(b.dataset.cut));
      this.saveRun();
      this.refresh();
    }));
    o.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const s = this.sheet;
      if (s?.kind !== 'action') return;
      if (b.dataset.act === 'surgery') { this.sheet = { kind: 'surgery', tab: 'tac' }; this.refresh(); return; }
      const id = b.dataset.act!;
      const keep = id.startsWith('splice:') || id.startsWith('buy:') || id.startsWith('seq:');
      this.sheet = keep ? s : null;
      doAction(r, s.x, s.y, id);
      if (id.startsWith('seq:')) this.syncBank();
      if (r.mode === 'battle') { this.afterAction(); return; }
      this.saveRun();
      this.refresh();
    }));
    o.querySelectorAll<HTMLElement>('[data-travel]').forEach((b) => b.addEventListener('click', () => {
      const [x, y] = b.dataset.travel!.split(',').map(Number);
      if (travel(r, x, y)) { this.drawX = x; this.drawY = y; this.wv.snap(); }
      this.sheet = null;
      this.saveRun();
      this.refresh();
    }));
    o.querySelectorAll<HTMLElement>('[data-land]').forEach((b) => b.addEventListener('click', () => {
      if (!land(r, b.dataset.land!)) return;
      // reaching a planet unlocks it for every later print, even if this clone dies here
      if (markLanded(this.meta, r.planet)) saveMeta(this.store, this.meta);
      this.drawX = r.x;
      this.drawY = r.y;
      this.wv.snap();
      this.saveRun();
      this.layout = '';
      this.syncLayout();
    }));
    o.querySelectorAll<HTMLElement>('[data-d]').forEach((b) => b.addEventListener('click', () => {
      const d = b.dataset.d;
      this.sheet = d === 'map' ? { kind: 'map' } : d === 'deck' ? { kind: 'deck', tab: 'tac' } : { kind: 'menu' };
      this.refresh();
    }));
    o.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      const tab = b.dataset.tab as 'tac' | 'exp';
      this.sheet = this.sheet?.kind === 'surgery' ? { kind: 'surgery', tab } : { kind: 'deck', tab };
      this.refresh();
    }));
    o.querySelectorAll<HTMLElement>('[data-o]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.o;
      if (k === 'close') { this.sheet = null; this.refresh(); }
      else if (k === 'notice') { r.notice = undefined; this.saveRun(); this.refresh(); }
      else if (k === 'hub') this.endRun('dead');
      else if (k === 'hub-won') this.endRun('won');
      else if (k === 'home') { goHome(r); this.saveRun(); this.refresh(); }
      else if (k === 'print') {
        this.printOn = !this.printOn;
        try { this.store?.setItem('strain.print', this.printOn ? 'on' : 'off'); } catch { /* ignore */ }
        this.sheet = null;
        this.layout = '';
        this.syncLayout();
      } else if (k === 'suspend') { this.saveRun(); this.showHub(); }
      else if (k === 'mend10' || k === 'mendfull') { mend(r, k === 'mend10' ? 10 : 'full'); this.saveRun(); this.refresh(); }
      else if (k === 'abandon') { if (confirm('Abandon this clone? Codons earned so far are banked.')) this.endRun('dead'); }
    }));
    o.querySelectorAll<HTMLElement>('.sheet-wrap').forEach((w) => w.addEventListener('click', (e) => {
      if (e.target === w && this.sheet) { this.sheet = null; this.refresh(); }
    }));
    const mm = o.querySelector<HTMLCanvasElement>('canvas.minimap');
    if (mm) this.drawMinimap(mm, r);
  }

  private afterLoot() {
    this.saveRun();
    this.syncLayout();
    this.refresh();
  }

  private sheetHtml(s: NonNullable<Sheet>, r: RunState): string {
    const t = runTraits(r);
    const wrap = (inner: string) => `<div class="sheet-wrap"><div class="sheet frame">${inner}<button class="btn" data-o="close">Close</button></div></div>`;
    switch (s.kind) {
      case 'action': {
        const d = describeAt(r, s.x, s.y);
        const acts = actionsAt(r, s.x, s.y);
        if (!d) return '';
        const cards = acts.filter((a) => a.card);
        const plain = acts.filter((a) => !a.card);
        const grid = cards.length ? `<div class="cards3">${cards.map((a) => `<div data-act="${a.id}" class="${a.ok ? '' : 'nobuy'}">${cardHtml(a.card!, t, { off: !a.ok })}<div class="why">${esc(a.detail)}</div></div>`).join('')}</div>` : '';
        return wrap(`<h2>${esc(d.title)}</h2><p>${esc(d.text)}</p><p class="why">${acts.some((q) => q.id.startsWith('seq:')) ? `${r.codons + r.bank} Codons (${r.codons} on you + ${r.bank} banked)` : `◆ ${r.biomass} biomass`}</p>${grid}<div class="acts">${plain.map((a) => `<button class="btn act" data-act="${a.id}" ${a.ok ? '' : 'disabled'}>${esc(a.label)} <small>${esc(a.detail)}</small></button>`).join('') || (grid ? '' : '<p>Nothing to do here.</p>')}</div>`);
      }
      case 'map': {
        const pts = travelPoints(r).map((p) => `<button class="btn small" data-travel="${p.x},${p.y}">${esc(p.label)}</button>`).join('');
        return wrap(`<h2>${esc(here(r).name)} · map</h2><canvas class="minimap"></canvas><p>Fast travel (not while hunted):</p><div class="row">${pts}</div>`);
      }
      case 'deck': {
        const list = r.tac;
        return wrap(`<h2>Deck · ${r.tac.length} cards</h2>
          <p>Every number reads your traits: ${TRAITS.map((k) => `<b class="${k}">${TRAIT_INFO[k].short} ${t[k]}${r.somatic[k] ? `<sup>+${r.somatic[k]}</sup>` : ''}</b>`).join(' ')}</p>
          ${this.implantList(r)}
          <div class="grid">${list.map((c) => cardHtml(c.id, t)).join('')}</div>`);
      }
      case 'surgery': {
        const list = r.tac;
        return wrap(`<h2>Surgery bay</h2><p>Tap a card to cut it out for ${exciseCost(r)} biomass (◆ ${r.biomass}). The deck keeps at least 5 cards.</p>
          <div class="grid">${list.map((c) => `<div data-cut="${c.uid}" class="${canExcise(r, 'tac', c.uid) ? '' : 'nobuy'}">${cardHtml(c.id, t, { off: !canExcise(r, 'tac', c.uid) })}</div>`).join('')}</div>`);
      }
      case 'menu': {
        // the pause menu doubles as the clone's profile: health and mending, deck, map, genome, implants, options
        const mh = maxHp(r);
        const missing = mh - r.hp;
        const rate = mendRate(r);
        const small = Math.min(10, missing);
        const mendBtns = missing > 0
          ? `<button class="btn act" data-o="mend10" ${r.biomass >= 1 ? '' : 'disabled'}>Mend ${small} <small>${Math.ceil(small / rate)} biomass</small></button>
             ${missing > 10 ? `<button class="btn act" data-o="mendfull" ${r.biomass >= 1 ? '' : 'disabled'}>Mend fully (${missing}) <small>${Math.ceil(missing / rate)} biomass${r.biomass * rate < missing ? ' · as far as it goes' : ''}</small></button>` : ''}`
          : '<p class="why">Whole. Nothing to mend.</p>';
        const genome = TRAITS.map((k) => `<div class="gene t-${k}"><b>${TRAIT_INFO[k].glyph}</b><span>${TRAIT_INFO[k].name}</span><em>${t[k]}</em><small>${r.seq[k]} seq${r.somatic[k] ? ` · +${r.somatic[k]} spliced` : ''}</small></div>`).join('');
        return wrap(`<h2>Paused · ${cloneName(r.clone)}</h2>
          <div class="pause-hp">${this.bar(r.hp, mh)}<span>${Math.max(0, r.hp)}/${mh} integrity</span></div>
          <p class="why">◆ ${r.biomass} biomass · ${r.codons} Codons this run · mending ${rate} integrity per biomass</p>
          <div class="acts">${mendBtns}</div>
          <div class="row pause-nav"><button class="btn" data-d="deck">Deck (${r.tac.length})</button><button class="btn" data-d="map">Map</button></div>
          <h3>Genome</h3><div class="genes">${genome}</div>
          <h3>Implants</h3>${this.implantList(r)}
          <p class="why">Steps ${r.steps} · fights ${r.stats.fights} · kills ${r.stats.kills} · ambushed ${r.stats.ambushed}</p>
          <div class="acts"><button class="btn" data-o="print">Print effect: ${this.printOn ? 'on' : 'off'}</button>
          <button class="btn" data-o="suspend">Back to the Printer (keep this run)</button>
          <button class="btn danger" data-o="abandon">Abandon this clone</button></div>`);
      }
    }
  }

  private implantList(r: RunState): string {
    if (!r.implants.length) return '<p class="why">No implants yet.</p>';
    return `<div class="implants">${r.implants.map((id) => `<div class="imp"><b>${IMPLANTS[id].glyph}</b> <span><b>${esc(IMPLANTS[id].name)}</b> · ${esc(IMPLANTS[id].text)}</span></div>`).join('')}</div>`;
  }

  /** The map in miniature: the whole map, or with `crop` a window that many tiles across around the clone. */
  private drawMinimap(c: HTMLCanvasElement, r: RunState, crop = 0) {
    const w = r.world;
    const s = crop ? 5 : 6;
    c.width = (crop || w.w) * s;
    c.height = (crop || w.h) * s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = INK.void;
    ctx.fillRect(0, 0, c.width, c.height);
    if (crop) ctx.translate(-(r.x - Math.floor(crop / 2)) * s, -(r.y - Math.floor(crop / 2)) * s);
    for (let y = 0; y < w.h; y++) {
      for (let x = 0; x < w.w; x++) {
        const i = idx(w, x, y);
        if (!w.seen[i]) continue;
        const tile = w.tiles[i];
        ctx.fillStyle = tile === T_WALL ? '#6d685c' : tile === T_HAZARD ? '#3e7a45' : tile === T_GATE ? INK.sodium : '#2b2d31';
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    const dot = (x: number, y: number, col: string, big = 1) => { ctx.fillStyle = col; ctx.fillRect(x * s - big, y * s - big, s + 2 * big, s + 2 * big); };
    for (const p of w.pois) {
      if (p.hidden || !w.seen[idx(w, p.x, p.y)]) continue;
      if (p.kind === 'vent' && !p.used) dot(p.x, p.y, INK.bone);
      if (p.kind === 'cache' && !p.used) dot(p.x, p.y, INK.boneDim);
      if (p.kind === 'nest' && !p.used) dot(p.x, p.y, INK.flesh);
      if (p.kind === 'pod' || p.kind === 'terminal' || p.kind === 'surgery' || p.kind === 'vat') dot(p.x, p.y, INK.cryo, 1);
      if (p.kind === 'event' && !p.used) dot(p.x, p.y, INK.signal, 1);
    }
    for (const m of w.mobs) if (m.alive && (m.kind === 'boss' || m.kind === 'elite') && w.seen[idx(w, m.x, m.y)]) dot(m.x, m.y, m.kind === 'boss' ? INK.flesh : INK.signal, 2);
    for (const b of r.beacons) dot(b.x, b.y, INK.sodium);
    dot(w.ship.x, w.ship.y, INK.toxin, 2);
    dot(r.x, r.y, '#ffffff', 2);
  }
}

/** Set while a long press is being released, so that release doesn't also count as a tap. */
let longPressed = false;

/** Tap handler that ignores the release of a long press (long presses open card details, see App). */
function press(el: HTMLElement, tap: () => void) {
  let start: { x: number; y: number } | null = null;
  el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', (e) => {
    if (!longPressed && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 14) tap();
    start = null;
  });
}
