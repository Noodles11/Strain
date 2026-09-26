import { aliveFoes, canFlee, cardBonus, currentIntent, fleeChance, intentNumbers, playable, resolved, type BattleEv } from '../core/battle';
import { CARDS } from '../core/cards';
import { ENEMIES } from '../core/enemies';
import { LOGS } from '../core/events';
import { IMPLANTS } from '../core/implants';
import { canRaise, loadMeta, newMeta, raise, RUN_KEY, saveMeta, settleRun, type Meta } from '../core/meta';
import {
  actionsAt, bEnd, bFlee, bPick, bPlay, canExcise, describeAt, doAction, eatValue, excise, exciseCost, expCard, expUsable, isInteractable, isSelfCard, migrateRun,
  lootChoose, lootDone, maxHp, mobAt, newRun, pathTo, playExp, renderValue, rewardPick, runTraits, step, stormIn,
  takeEvents, travel, travelPoints, type RunState,
} from '../core/run';
import {
  energyPerTurn, exploreHandSize, handSize, maxIntegrity, maxOxygen, SEQUENCE_CAP, sequenceCost, TRAIT_INFO, TRAITS,
  type Trait,
} from '../core/traits';
import { BattleView } from '../render/battleview';
import { INK } from '../render/palette';
import { Print } from '../render/print';
import { WorldView } from '../render/worldview';
import { idx, T_GATE, T_HAZARD, T_WALL } from '../world/gen';
import { cardDetail, cardHtml, esc } from './cardview';

type Sheet =
  | { kind: 'action'; x: number; y: number }
  | { kind: 'card'; id: string; donor?: boolean }
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
  private sheet: Sheet = null;
  private msgTimer = 0;
  private lastMsgCount = 0;
  private last = 0;

  constructor(private root: HTMLElement) {
    this.meta = loadMeta(this.store);
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
        <span class="chip">Hand ${handSize(t)}</span><span class="chip">O₂ ${maxOxygen(t)}</span><span class="chip">Survey hand ${exploreHandSize(t)}</span>
      </div>
      ${hasRun
        ? `<div class="row"><button class="btn primary" data-go="continue">Continue ${cloneName(this.run!.clone)}</button></div>
           <div class="row"><button class="btn danger" data-go="abandon">Abandon that print</button></div>`
        : `<div class="row"><button class="btn primary" data-go="launch">Print ${cloneName(m.clone)}</button></div>`}
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
        this.run = newRun(this.meta, (Math.random() * 2 ** 31) >>> 0);
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

  private endRun(outcome: 'dead' | 'won') {
    if (!this.run) return;
    settleRun(this.meta, this.run.codons, outcome, this.run.logs);
    saveMeta(this.store, this.meta);
    this.clearRun();
    this.showHub();
  }

  // ---------------------------------------------------------------- run layout

  private enterRun() {
    this.layout = '';
    this.sheet = null;
    this.lines = [];
    this.lastMsgCount = this.run!.msgs.length;
    this.drawX = this.run!.x;
    this.drawY = this.run!.y;
    this.wv.snap();
    this.syncLayout();
  }

  private syncLayout() {
    const r = this.run;
    if (!r) return;
    const want = r.battle ? 'battle' : 'explore';
    if (want === this.layout) { this.refresh(); return; }
    this.layout = want;
    if (want === 'battle') {
      this.root.innerHTML = `<div class="scene" style="height:54%"><canvas class="c2"></canvas><div class="plates"></div><div class="plate me"></div></div>
        <div class="battle-ui"><div class="textbox frame"></div><div class="hand"></div>
        <div class="controls"><div class="energy"></div><div class="piles"></div><div class="grow"></div>
        <button class="btn small" data-b="flee">Flee</button><button class="btn primary" data-b="end">End turn</button></div></div>
        <div class="overlay"></div>`;
    } else {
      this.root.innerHTML = `<div class="scene full"><canvas class="c2"></canvas>
        <div class="hud"></div><div class="dock"><div class="exp-hand"></div><div class="dock-btns">
        <button class="btn small" data-d="map">Map</button><button class="btn small" data-d="deck">Deck</button><button class="btn small" data-d="menu">Menu</button></div></div></div>
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
    this.root.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => b.addEventListener('click', () => {
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
        this.bv.draw(ctx, r.battle, runTraits(r), this.sw, this.sh, t);
        strength = (1 - this.bv.intro) * 1.2;
      } else {
        const k = 1 - Math.exp(-dt * 16);
        this.drawX += (r.x - this.drawX) * k;
        this.drawY += (r.y - this.drawY) * k;
        const moving = Math.abs(r.x - this.drawX) + Math.abs(r.y - this.drawY) > 0.05;
        this.wv.draw(ctx, r, t, dt, this.drawX, this.drawY, moving || !!this.walk, this.walk?.path ?? []);
      }
      if (this.print && this.glCanvas) this.print.render(this.src, this.dpr, t, strength);
    }
    requestAnimationFrame((q) => this.frame(q));
  }

  // ---------------------------------------------------------------- explore

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
      this.play(takeEvents());
      return;
    }
    this.refresh();
  }

  // ---------------------------------------------------------------- battle

  private busy(): boolean {
    return this.queue.length > 0 || this.qTimer !== 0;
  }

  private play(ev: BattleEv[]) {
    const b = this.run?.battle;
    if (!b) { this.syncLayout(); return; }
    if (!this.busy()) {
      this.dispP = b.player.hp;
      for (const f of b.foes) this.dispFoe.set(f.uid, f.hp);
    }
    for (let i = ev.length - 1; i >= 0; i--) {
      const e = ev[i];
      if (e.k === 'hitFoe') this.dispFoe.set(e.uid, (this.dispFoe.get(e.uid) ?? 0) + e.n);
      if (e.k === 'hitPlayer') this.dispP += e.n;
      if (e.k === 'heal') this.dispP -= e.n;
      if (e.k === 'summon') this.hidden.add(e.uid);
    }
    this.queue.push(...ev);
    this.saveRun();
    if (!this.qTimer) this.next();
  }

  private apply(e: BattleEv) {
    switch (e.k) {
      case 'text': this.lines.push(e.s); if (this.lines.length > 2) this.lines.shift(); break;
      case 'hitFoe': this.dispFoe.set(e.uid, (this.dispFoe.get(e.uid) ?? 0) - e.n); this.bv.anim(e.uid).flash = 1; break;
      case 'hitPlayer': this.dispP -= e.n; this.bv.player.flash = e.n > 0 ? 1 : 0.3; this.bv.shake = e.n > 0 ? Math.min(1, 0.3 + e.n / 20) : 0; break;
      case 'act': this.bv.anim(e.uid).lunge = 1; break;
      case 'die': this.bv.anim(e.uid).dead = 0.01; break;
      case 'heal': this.dispP += e.n; this.bv.player.heal = 1; break;
      case 'summon': this.hidden.delete(e.uid); break;
      default: break;
    }
  }

  private next() {
    const e = this.queue.shift();
    if (!e) { this.qTimer = 0; this.finishQueue(); return; }
    this.apply(e);
    this.refreshBattle();
    const delay = e.k === 'text' ? 520 : e.k === 'act' ? 160 : 90;
    this.qTimer = window.setTimeout(() => this.next(), delay);
  }

  private skip() {
    if (!this.busy()) return;
    clearTimeout(this.qTimer);
    while (this.queue.length) this.apply(this.queue.shift()!);
    this.qTimer = 0;
    this.finishQueue();
  }

  private finishQueue() {
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
    if (!ok.ok) { if (ok.why) { this.lines = [ok.why]; this.refreshBattle(); } return; }
    this.bv.player.lunge = 1;
    this.play(bPlay(r, uid, this.target()));
  }

  // ---------------------------------------------------------------- DOM

  private refresh() {
    if (this.layout === 'battle') this.refreshBattle();
    else if (this.layout === 'explore') this.refreshExplore();
    this.refreshOverlay();
  }

  private bar(cur: number, max: number, segs = 20): string {
    const on = max > 0 ? Math.ceil((Math.max(0, cur) / max) * segs) : 0;
    const cls = cur / max < 0.25 ? 'crit' : cur / max < 0.5 ? 'lo' : '';
    return `<div class="bar">${Array.from({ length: segs }, (_, i) => `<i class="${i < on ? cls : 'off'}"></i>`).join('')}</div>`;
  }

  private refreshExplore() {
    const r = this.run!;
    const t = runTraits(r);
    const mh = maxHp(r);
    const mo = maxOxygen(t);
    const storm = stormIn(r);
    const hud = this.root.querySelector('.hud');
    if (!hud) return;
    const newMsg = r.msgs.length !== this.lastMsgCount;
    this.lastMsgCount = r.msgs.length;
    const msg = r.msgs[r.msgs.length - 1] ?? '';
    hud.innerHTML = `<div class="hud-row"><span class="stat">${cloneName(r.clone)}</span>${this.bar(r.hp, mh, 16)}<span class="stat">${Math.max(0, r.hp)}/${mh}</span></div>
      <div class="hud-row"><span class="stat" style="color:var(--foc)">O₂</span><span class="pips">${Array.from({ length: mo }, (_, i) => `<b class="${i < r.oxygen ? 'on' : ''}"></b>`).join('')}</span>
      <span class="chip">◆ ${r.biomass} bio</span><span class="chip" style="color:var(--sodium)">${r.codons} cod</span>
      ${r.storm ? '<span class="chip warn">STORM</span>' : storm < 200 ? `<span class="chip warn">storm ${storm}</span>` : ''}
      ${r.sealSteps ? `<span class="chip">seal ${r.sealSteps}</span>` : ''}${r.stalk ? '<span class="chip">stalking</span>' : ''}</div>
      ${msg ? `<div class="msg ${newMsg ? '' : 'fade'}">${esc(msg)}</div>` : ''}`;
    if (newMsg) {
      clearTimeout(this.msgTimer);
      this.msgTimer = window.setTimeout(() => this.root.querySelector('.msg')?.classList.add('fade'), 3200);
    }
    const handEl = this.root.querySelector('.exp-hand')!;
    handEl.innerHTML = r.expHand.map((u) => {
      const c = expCard(r, u)!;
      const ok = expUsable(r, u).ok;
      return `<div data-u="${u}">${cardHtml(c.id, t, { off: !ok })}</div>`;
    }).join('');
    handEl.querySelectorAll<HTMLElement>('[data-u]').forEach((el) => {
      const u = Number(el.dataset.u);
      el.style.flex = '1';
      el.style.minWidth = '0';
      press(el, () => this.tapExp(u), () => { this.sheet = { kind: 'card', id: expCard(r, u)!.id }; this.refresh(); });
    });
  }

  private tapExp(uid: number) {
    const r = this.run!;
    const c = expCard(r, uid);
    if (!c || this.sheet) return;
    if (!isSelfCard(c.id)) {
      r.msgs.push(`${CARDS[c.id].name}: walk up to a ${CARDS[c.id].act === 'pry' ? 'cache' : CARDS[c.id].act === 'cut' ? 'pile of debris or a nest' : 'sealed door'} and tap it.`);
      this.refresh();
      return;
    }
    if (!expUsable(r, uid).ok) return;
    playExp(r, uid);
    this.afterAction();
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
        if (f.alive && quiet && b.phase === 'player') {
          const n = intentNumbers(b, f);
          const parts: string[] = [];
          if (currentIntent(f).attack !== undefined) parts.push(`ATK ${n.attack}${n.hits > 1 ? `×${n.hits}` : ''}`);
          if (n.plate) parts.push(`PLATE ${n.plate}`);
          if (n.strength) parts.push(`STR+${n.strength}`);
          if (n.weak) parts.push(`weak ${n.weak}`);
          if (n.expose) parts.push(`expose ${n.expose}`);
          if (n.summon) parts.push('summon');
          intent = parts.join(' ') || n.label;
        }
        const st = [f.plate ? `⬢${f.plate}` : '', f.strength ? `▲${f.strength}` : '', f.weak ? `weak ${f.weak}` : '', f.expose ? `exp ${f.expose}` : '', f.tag ? `tag ${f.tag}` : ''].filter(Boolean).join(' ');
        return `<div class="plate ${f.uid === tgt && aliveFoes(b).length > 1 ? 'tgt' : ''} ${gone ? 'gone' : ''}" data-f="${f.uid}">
          <div class="top"><span class="nm">${def.rank === 'boss' ? '☠ ' : def.rank === 'elite' ? '✦ ' : ''}${esc(def.name)}</span><span class="hpn">${hp}/${f.maxHp}</span></div>
          ${this.bar(hp, f.maxHp, 16)}<div class="row2"><span class="intent">${intent}</span><span class="st">${st}</span></div></div>`;
      }).join('');
      plates.querySelectorAll<HTMLElement>('[data-f]').forEach((el) => el.addEventListener('click', () => {
        this.bv.target = Number(el.dataset.f);
        this.refreshBattle();
      }));
    }
    const me = this.root.querySelector<HTMLElement>('.plate.me');
    if (me) {
      me.style.top = `${this.sh * 0.6}px`;
      const p = b.player;
      const hp = Math.max(0, this.dispP);
      const st = [p.plate ? `⬢${p.plate}` : '', p.weak ? `weak ${p.weak}` : '', p.expose ? `exp ${p.expose}` : '',
        ...TRAITS.filter((k) => b.surge[k]).map((k) => `${TRAIT_INFO[k].short}${b.surge[k] > 0 ? '+' : ''}${b.surge[k]}`)].filter(Boolean).join(' ');
      me.innerHTML = `<div class="top"><span class="nm">${cloneName(r.clone)}</span><span class="hpn">${hp}/${p.maxHp}</span></div>
        ${this.bar(hp, p.maxHp, 16)}<div class="row2"><span class="st">${st || '&nbsp;'}</span><span class="st">◆${b.biomass}</span></div>`;
    }
    const tb = this.root.querySelector('.textbox');
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
        return `<div data-c="${c.uid}" style="flex:1;min-width:0">${cardHtml(c.id, tt, {
          donor: c.donor, dmgBonus: bonus.dmg + b.empower, plateBonus: bonus.plate, off: !ok && !pick, fleeting: c.fleeting, extraClass: pick ? 'pick' : '',
        })}</div>`;
      }).join('');
      hand.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => {
        const uid = Number(el.dataset.c);
        const c = b.hand.find((q) => q.uid === uid)!;
        press(el, () => this.tapCard(uid), () => { this.sheet = { kind: 'card', id: c.id, donor: c.donor }; this.refresh(); });
      });
    }
    const en = this.root.querySelector('.energy');
    if (en) {
      const max = Math.max(b.energy, energyPerTurn(t));
      en.innerHTML = `${Array.from({ length: max }, (_, i) => `<b class="${i < b.energy ? 'on' : ''}"></b>`).join('')}`;
    }
    const piles = this.root.querySelector('.piles');
    if (piles) piles.textContent = `draw ${b.draw.length} · disc ${b.discard.length}`;
    const fleeB = this.root.querySelector<HTMLButtonElement>('[data-b="flee"]');
    if (fleeB) {
      fleeB.disabled = !quiet || !canFlee(b) || r.oxygen < 2;
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
        <p class="sub">${cloneName(r.clone)} died on the derelict after ${r.stats.fights} fights and ${r.steps} steps.</p>
        <div class="codons">+${r.codons} <small>Codons banked</small></div>
        <p class="sub">The sequence remembers. The next print starts stronger if you spend them.</p>
        <button class="btn primary" data-o="hub">Back to the Printer</button></div>`;
    } else if (r.mode === 'won') {
      html = `<div class="screen"><div class="big-msg">DERELICT<br>CLEARED</div>
        <p class="sub">${cloneName(r.clone)} lifted off. The First is dead. ${r.stats.fights} fights, ${r.stats.ambushed} ambushes survived.</p>
        <div class="codons">+${r.codons} <small>Codons banked</small></div>
        <p class="sub">The star chart shows three faint signals: Kessra, Mireth, Orun. Their coordinates arrive in a later build.</p>
        <button class="btn primary" data-o="hub-won">Back to the Printer</button></div>`;
    } else if (quiet && r.mode === 'loot' && r.loot) {
      const rows = r.loot.map((c, i) => `<div class="corpse"><span class="nm">${esc(ENEMIES[c.id].name)}${c.tagged ? ' ⌖' : ''}</span>
        ${c.done ? `<span class="chip">${c.done === 'eat' ? 'eaten' : 'rendered'}</span>`
          : `<button class="btn" data-eat="${i}">Eat +${eatValue(r, c)}</button><button class="btn" data-ren="${i}">Render +${renderValue(r, c)}◆</button>`}</div>`).join('');
      html = `<div class="sheet-wrap"><div class="sheet frame"><h2>Corpses</h2>
        <p>Eat to mend integrity (${Math.max(0, r.hp)}/${maxHp(r)}). Render for biomass (◆${r.biomass}).${r.reward?.codons ? ` +${r.reward.codons} Codons.` : ''}</p>
        ${rows}<button class="btn" data-o="lootdone">Leave the rest</button></div></div>`;
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
    o.querySelectorAll<HTMLElement>('[data-eat]').forEach((b) => b.addEventListener('click', () => { lootChoose(r, Number(b.dataset.eat), 'eat'); this.afterLoot(); }));
    o.querySelectorAll<HTMLElement>('[data-ren]').forEach((b) => b.addEventListener('click', () => { lootChoose(r, Number(b.dataset.ren), 'render'); this.afterLoot(); }));
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
      const keep = id.startsWith('splice:') || id.startsWith('buy:');
      this.sheet = keep ? s : null;
      doAction(r, s.x, s.y, id);
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
      else if (k === 'lootdone') { lootDone(r); this.saveRun(); this.syncLayout(); }
      else if (k === 'print') {
        this.printOn = !this.printOn;
        try { this.store?.setItem('strain.print', this.printOn ? 'on' : 'off'); } catch { /* ignore */ }
        this.sheet = null;
        this.layout = '';
        this.syncLayout();
      } else if (k === 'suspend') { this.saveRun(); this.showHub(); }
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
      case 'card': return wrap(cardDetail(s.id, t, s.donor));
      case 'action': {
        const d = describeAt(r, s.x, s.y);
        const acts = actionsAt(r, s.x, s.y);
        if (!d) return '';
        const cards = acts.filter((a) => a.card);
        const plain = acts.filter((a) => !a.card);
        const grid = cards.length ? `<div class="cards3">${cards.map((a) => `<div data-act="${a.id}" class="${a.ok ? '' : 'nobuy'}">${cardHtml(a.card!, t, { off: !a.ok })}<div class="why">${esc(a.detail)}</div></div>`).join('')}</div>` : '';
        return wrap(`<h2>${esc(d.title)}</h2><p>${esc(d.text)}</p><p class="why">◆ ${r.biomass} biomass</p>${grid}<div class="acts">${plain.map((a) => `<button class="btn act" data-act="${a.id}" ${a.ok ? '' : 'disabled'}>${esc(a.label)} <small>${esc(a.detail)}</small></button>`).join('') || (grid ? '' : '<p>Nothing to do here.</p>')}</div>`);
      }
      case 'map': {
        const pts = travelPoints(r).map((p) => `<button class="btn small" data-travel="${p.x},${p.y}">${esc(p.label)}</button>`).join('');
        return wrap(`<h2>Derelict · map</h2><canvas class="minimap"></canvas><p>Fast travel (not while hunted):</p><div class="row">${pts}</div>`);
      }
      case 'deck': {
        const list = s.tab === 'tac' ? r.tac : r.exp;
        return wrap(`<h2>Deck</h2><div class="tabs"><button class="btn small ${s.tab === 'tac' ? 'on' : ''}" data-tab="tac">Tactical ${r.tac.length}</button>
          <button class="btn small ${s.tab === 'exp' ? 'on' : ''}" data-tab="exp">Exploration ${r.exp.length}</button></div>
          <p>Every number reads your traits: ${TRAITS.map((k) => `<b class="${k}">${TRAIT_INFO[k].short} ${t[k]}${r.somatic[k] ? `<sup>+${r.somatic[k]}</sup>` : ''}</b>`).join(' ')}</p>
          ${this.implantList(r)}
          <div class="grid">${list.map((c) => cardHtml(c.id, t)).join('')}</div>`);
      }
      case 'surgery': {
        const list = s.tab === 'tac' ? r.tac : r.exp;
        return wrap(`<h2>Surgery bay</h2><p>Tap a card to cut it out for ${exciseCost(r)} biomass (◆ ${r.biomass}). Decks keep at least ${s.tab === 'tac' ? 5 : 3} cards.</p>
          <div class="tabs"><button class="btn small ${s.tab === 'tac' ? 'on' : ''}" data-tab="tac">Tactical ${r.tac.length}</button>
          <button class="btn small ${s.tab === 'exp' ? 'on' : ''}" data-tab="exp">Exploration ${r.exp.length}</button></div>
          <div class="grid">${list.map((c) => `<div data-cut="${c.uid}" class="${canExcise(r, s.tab, c.uid) ? '' : 'nobuy'}">${cardHtml(c.id, t, { off: !canExcise(r, s.tab, c.uid) })}</div>`).join('')}</div>`);
      }
      case 'menu':
        return wrap(`<h2>${cloneName(r.clone)}</h2><p>Steps ${r.steps} · fights ${r.stats.fights} · kills ${r.stats.kills} · ambushed ${r.stats.ambushed}</p>${this.implantList(r)}
          <div class="acts"><button class="btn" data-o="print">Print effect: ${this.printOn ? 'on' : 'off'}</button>
          <button class="btn" data-o="suspend">Back to the Printer (keep this run)</button>
          <button class="btn danger" data-o="abandon">Abandon this clone</button></div>`);
    }
  }

  private implantList(r: RunState): string {
    if (!r.implants.length) return '<p class="why">No implants yet.</p>';
    return `<div class="implants">${r.implants.map((id) => `<div class="imp"><b>${IMPLANTS[id].glyph}</b> <span><b>${esc(IMPLANTS[id].name)}</b> · ${esc(IMPLANTS[id].text)}</span></div>`).join('')}</div>`;
  }

  private drawMinimap(c: HTMLCanvasElement, r: RunState) {
    const w = r.world;
    const s = 6;
    c.width = w.w * s;
    c.height = w.h * s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = INK.void;
    ctx.fillRect(0, 0, c.width, c.height);
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
      if (p.kind === 'pod' || p.kind === 'terminal' || p.kind === 'surgery') dot(p.x, p.y, INK.cryo, 1);
      if (p.kind === 'event' && !p.used) dot(p.x, p.y, INK.signal, 1);
    }
    for (const m of w.mobs) if (m.alive && (m.kind === 'boss' || m.kind === 'elite') && w.seen[idx(w, m.x, m.y)]) dot(m.x, m.y, m.kind === 'boss' ? INK.flesh : INK.signal, 2);
    for (const b of r.beacons) dot(b.x, b.y, INK.sodium);
    dot(w.ship.x, w.ship.y, INK.toxin, 2);
    dot(r.x, r.y, '#ffffff', 2);
  }
}

/** Tap, or hold for details. */
function press(el: HTMLElement, tap: () => void, hold: () => void) {
  let timer = 0;
  let held = false;
  let start: { x: number; y: number } | null = null;
  el.addEventListener('pointerdown', (e) => {
    held = false;
    start = { x: e.clientX, y: e.clientY };
    timer = window.setTimeout(() => { held = true; hold(); }, 420);
  });
  el.addEventListener('pointerup', (e) => {
    clearTimeout(timer);
    if (!held && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 14) tap();
    start = null;
  });
  el.addEventListener('pointerleave', () => clearTimeout(timer));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
