import type {
  Game,
  InitApi,
  UpdateApi,
  RenderApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as K from "./constants";

export const BACKGROUND = "#0b3230";
export type Screen = "title" | "howto" | "playing" | "won";
export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type PileKind = "stock" | "waste" | "foundation" | "tableau";
export interface CardState {
  readonly id: number;
  readonly suit: Suit;
  readonly rank: number;
  readonly faceUp: boolean;
}
export interface DragState {
  readonly cards: readonly CardState[];
  readonly fromPile: "waste" | "foundation" | "tableau";
  readonly fromIndex: number;
  readonly x: number;
  readonly y: number;
}
export interface DropTargetState {
  readonly pile: "foundation" | "tableau";
  readonly index: number;
}
export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}
export interface PressState {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}
export interface FlyerState {
  readonly id: number;
  readonly suit: Suit;
  readonly rank: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}
export interface CascadeState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly stock: readonly CardState[];
  readonly waste: readonly CardState[];
  readonly wasteSets: readonly number[];
  readonly foundations: readonly (readonly CardState[])[];
  readonly tableau: readonly (readonly CardState[])[];
  readonly drag: DragState | null;
  readonly dropTarget: DropTargetState | null;
  readonly pointer: PointerState;
  readonly lastPress: PressState | null;
  readonly autoFlip: boolean;
  readonly winDetect: boolean;
  readonly launching: boolean;
  readonly trailPainting: boolean;
  readonly launchClock: number;
  readonly launched: number;
  readonly flyers: readonly FlyerState[];
  readonly cascadeDone: boolean;
  readonly trailStamps: number;
  readonly nextId: number;
  readonly simTime: number;
  readonly muted: boolean;
  readonly pendingCues?: readonly K.CueName[];
  readonly trail?: readonly { card: CardState; x: number; y: number }[];
}
type S = DeepReadonly<CascadeState>;
type Pile = readonly CardState[];
type Color = "red" | "black";
type Address = { pile: PileKind; index: number };
type Rect = { x: number; y: number; w: number; h: number };
const color = (s: Suit): Color =>
  s === "hearts" || s === "diamonds" ? "red" : "black";
const card = (c: DeepReadonly<CardState>) => ({
  id: c.id,
  suit: c.suit,
  rank: c.rank,
  faceUp: c.faceUp,
});
const blank = (): CascadeState => ({
  screen: "title",
  menuIndex: 0,
  titleIndex: 0,
  stock: [],
  waste: [],
  wasteSets: [],
  foundations: Array.from({ length: K.FOUNDATION_COUNT }, () => []),
  tableau: Array.from({ length: K.TABLEAU_COLUMNS }, () => []),
  drag: null,
  dropTarget: null,
  pointer: { x: 0, y: 0, down: false },
  lastPress: null,
  autoFlip: true,
  winDetect: true,
  launching: true,
  trailPainting: true,
  launchClock: 0,
  launched: 0,
  flyers: [],
  cascadeDone: false,
  trailStamps: 0,
  nextId: 1,
  simTime: 0,
  muted: false,
  pendingCues: [],
  trail: [],
});
const cue = (s: S, c: K.CueName): CascadeState => ({
  ...s,
  pendingCues: [...(s.pendingCues || []), c],
});
const valid = (pile: PileKind, index: number) => {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    (pile === "foundation" && index >= K.FOUNDATION_COUNT) ||
    (pile === "tableau" && index >= K.TABLEAU_COLUMNS) ||
    ((pile === "stock" || pile === "waste") && index !== 0)
  )
    throw new RangeError("Invalid pile/index");
};
const pileOf = (s: S, a: Address): Pile => {
  valid(a.pile, a.index);
  return a.pile === "stock"
    ? s.stock
    : a.pile === "waste"
      ? s.waste
      : a.pile === "foundation"
        ? s.foundations[a.index]
        : s.tableau[a.index];
};
const put = (s: S, a: Address, p: Pile): CascadeState =>
  a.pile === "stock"
    ? { ...s, stock: p.map(card) }
    : a.pile === "waste"
      ? { ...s, waste: p.map(card) }
      : a.pile === "foundation"
        ? {
            ...s,
            foundations: s.foundations.map((v, i) =>
              i === a.index ? p.map(card) : v.map(card),
            ),
          }
        : {
            ...s,
            tableau: s.tableau.map((v, i) =>
              i === a.index ? p.map(card) : v.map(card),
            ),
          };
const decSet = (sets: readonly number[]): number[] => {
  const out = [...sets];
  for (let i = out.length - 1; i >= 0; i--)
    if (out[i] > 0) {
      out[i]--;
      if (out[i] === 0) out.splice(i, 1);
      break;
    }
  return out;
};
const layout = (p: Pile): number[] => {
  const faces = p.slice(0, -1).filter((c) => c.faceUp).length,
    downs = p.length - 1 - faces;
  const step = faces
    ? Math.max(
        K.FACE_UP_OFFSET_MIN,
        Math.min(
          K.FACE_UP_OFFSET,
          (K.COLUMN_BOTTOM_LIMIT -
            K.TABLEAU_Y -
            K.CARD_H -
            downs * K.FACE_DOWN_OFFSET) /
            faces,
        ),
      )
    : K.FACE_UP_OFFSET;
  const ys = [K.TABLEAU_Y];
  for (let i = 1; i < p.length; i++)
    ys.push(ys[i - 1] + (p[i - 1].faceUp ? step : K.FACE_DOWN_OFFSET));
  return ys;
};
const rect = (s: S, a: Address): Rect => {
  if (a.pile === "stock")
    return { x: K.STOCK_X, y: K.TOP_ROW_Y, w: K.CARD_W, h: K.CARD_H };
  if (a.pile === "waste")
    return { x: K.WASTE_X, y: K.TOP_ROW_Y, w: K.CARD_W, h: K.CARD_H };
  if (a.pile === "foundation")
    return {
      x: K.FOUNDATION_X[a.index],
      y: K.TOP_ROW_Y,
      w: K.CARD_W,
      h: K.CARD_H,
    };
  const p = pileOf(s, a),
    ys = layout(p);
  return {
    x: K.COLUMN_X[a.index],
    y: K.TABLEAU_Y,
    w: K.CARD_W,
    h: p.length ? ys[ys.length - 1] + K.CARD_H - K.TABLEAU_Y : K.CARD_H,
  };
};
const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const addresses: Address[] = [
  { pile: "stock", index: 0 },
  { pile: "waste", index: 0 },
  ...Array.from({ length: K.FOUNDATION_COUNT }, (_, index): Address => ({
    pile: "foundation",
    index,
  })),
  ...Array.from({ length: K.TABLEAU_COLUMNS }, (_, index): Address => ({
    pile: "tableau",
    index,
  })),
];
const at = (s: S, x: number, y: number): Address | null =>
  addresses.find((a) => contains(rect(s, a), x, y)) || null;
const runValid = (cards: Pile) =>
  cards.length > 0 &&
  cards.every(
    (c, i) =>
      c.faceUp &&
      (i === 0 ||
        (cards[i - 1].rank === c.rank + 1 &&
          color(cards[i - 1].suit) !== color(c.suit))),
  );
const accepts = (s: S, cards: Pile, to: Address) => {
  if (!runValid(cards)) return false;
  const p = pileOf(s, to),
    lead = cards[0];
  if (to.pile === "foundation")
    return (
      cards.length === 1 &&
      (!p.length
        ? lead.rank === K.RANK_MIN
        : p[p.length - 1].suit === lead.suit &&
          p[p.length - 1].rank + 1 === lead.rank)
    );
  if (to.pile === "tableau")
    return !p.length
      ? lead.rank === K.RANK_MAX
      : p[p.length - 1].faceUp &&
          p[p.length - 1].rank === lead.rank + 1 &&
          color(p[p.length - 1].suit) !== color(lead.suit);
  return false;
};
const win = (s: S) =>
  s.foundations.every((p) => p.length === K.RANK_MAX) &&
  s.foundations.reduce((n, p) => n + p.length, 0) === K.DECK_SIZE;
const afterMove = (s: S, from: Address, to: Address): CascadeState => {
  let out: CascadeState = { ...s };
  if (from.pile === "tableau" && out.autoFlip) {
    const p = out.tableau[from.index];
    if (p.length && !p[p.length - 1].faceUp) {
      out = put(out, from, [
        ...p.slice(0, -1).map(card),
        { ...p[p.length - 1], faceUp: true },
      ]);
      out = cue(out, K.CUES.flip);
    }
  }
  if (to.pile === "foundation") out = cue(out, K.CUES.home);
  if (out.winDetect && win(out)) {
    out = {
      ...out,
      screen: "won",
      launchClock: K.LAUNCH_INTERVAL,
      launched: 0,
      cascadeDone: false,
      drag: null,
      dropTarget: null,
    };
    out = cue(out, K.CUES.win);
  }
  return out;
};
const move = (
  s: S,
  from: Address,
  row: number,
  to: Address,
): [CascadeState, boolean] => {
  const p = pileOf(s, from),
    target = pileOf(s, to);
  if (!Number.isInteger(row) || row < 0 || row >= p.length)
    throw new RangeError("Invalid fromRow");
  if (
    from.pile === "stock" ||
    (from.pile === "waste" && (!s.wasteSets.length || row !== p.length - 1)) ||
    (from.pile === "foundation" && row !== p.length - 1) ||
    (from.pile === to.pile && from.index === to.index) ||
    !accepts(s, p.slice(row), to)
  )
    return [{ ...s }, false];
  let out = put(s, from, p.slice(0, row));
  out = put(out, to, [...target, ...p.slice(row)]);
  if (from.pile === "waste") out = { ...out, wasteSets: decSet(s.wasteSets) };
  out = afterMove(out, from, to);
  return [out, true];
};
const deal = (s: S): CascadeState => {
  const deck: CardState[] = [];
  let id = s.nextId;
  for (const suit of K.SUITS)
    for (let rank = K.RANK_MIN; rank <= K.RANK_MAX; rank++)
      deck.push({ id: id++, suit, rank, faceUp: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  let pos = 0;
  const tableau = Array.from({ length: K.TABLEAU_COLUMNS }, (_, i) =>
    Array.from({ length: i + 1 }, (_, j) => ({
      ...deck[pos++],
      faceUp: j === i,
    })),
  );
  return cue(
    {
      ...s,
      stock: deck.slice(pos),
      waste: [],
      wasteSets: [],
      foundations: Array.from({ length: K.FOUNDATION_COUNT }, () => []),
      tableau,
      drag: null,
      dropTarget: null,
      launchClock: 0,
      launched: 0,
      flyers: [],
      cascadeDone: false,
      trailStamps: 0,
      trail: [],
      nextId: id,
    },
    K.CUES.deal,
  );
};
const turnStock = (s: S): CascadeState => {
  if (s.stock.length) {
    const take = s.stock
      .slice(-K.TURN_COUNT)
      .reverse()
      .map((c) => ({ ...c, faceUp: true }));
    return cue(
      {
        ...s,
        stock: s.stock.slice(0, -take.length).map(card),
        waste: [...s.waste.map(card), ...take],
        wasteSets: [...s.wasteSets, take.length],
      },
      K.CUES.turn,
    );
  }
  if (s.waste.length)
    return cue(
      {
        ...s,
        stock: s.waste
          .slice()
          .reverse()
          .map((c) => ({ ...c, faceUp: false })),
        waste: [],
        wasteSets: [],
      },
      K.CUES.recycle,
    );
  return { ...s };
};
const autoMove = (s: S, a: Address): [CascadeState, boolean] => {
  const p = pileOf(s, a);
  if (
    (a.pile !== "waste" && a.pile !== "tableau") ||
    !p.length ||
    !p[p.length - 1].faceUp ||
    (a.pile === "waste" && !s.wasteSets.length)
  )
    return [{ ...s }, false];
  const c = p[p.length - 1];
  const i = s.foundations.findIndex(
    (f) =>
      f.length &&
      f[f.length - 1].suit === c.suit &&
      f[f.length - 1].rank + 1 === c.rank,
  );
  const empty = s.foundations.findIndex((f) => !f.length);
  const index = i >= 0 ? i : c.rank === K.RANK_MIN ? empty : -1;
  return index >= 0
    ? move(s, a, p.length - 1, { pile: "foundation", index })
    : [{ ...s }, false];
};
const menuRect = (screen: Screen, index: number): Rect | null => {
  const rs: Record<Exclude<Screen, "won">, Rect[]> = {
    title: [
      { x: 490, y: 410, w: 300, h: 58 },
      { x: 490, y: 483, w: 300, h: 58 },
    ],
    howto: [{ x: 490, y: 574, w: 300, h: 54 }],
    playing: [
      { x: 214, y: 683, w: 135, h: 30 },
      { x: 361, y: 683, w: 100, h: 30 },
      { x: 473, y: 683, w: 115, h: 30 },
    ],
  };
  return screen === "won" ? null : rs[screen][index] || null;
};
const hoverMenu = (s: S, x: number, y: number) => {
  const count =
    s.screen === "title"
      ? 2
      : s.screen === "howto"
        ? 1
        : s.screen === "playing"
          ? 3
          : 0;
  for (let i = 0; i < count; i++) {
    const r = menuRect(s.screen, i);
    if (r && contains(r, x, y)) return i;
  }
  return null;
};
const activate = (s: S, index: number): CascadeState => {
  if (s.screen === "title")
    return index === 0
      ? { ...deal({ ...s, titleIndex: 0 }), screen: "playing", menuIndex: 0 }
      : { ...s, screen: "howto", titleIndex: 1, menuIndex: 0 };
  if (s.screen === "howto")
    return { ...s, screen: "title", menuIndex: s.titleIndex };
  if (s.screen === "playing") {
    if (index === 0) return { ...deal(s), menuIndex: 0 };
    if (index === 1) return { ...s, screen: "title", menuIndex: s.titleIndex };
    return { ...s, muted: !s.muted };
  }
  return { ...s };
};
const grabbed = (
  s: S,
  x: number,
  y: number,
): { a: Address; row: number; px: number; py: number } | null => {
  for (let i = K.TABLEAU_COLUMNS - 1; i >= 0; i--) {
    const p = s.tableau[i],
      ys = layout(p);
    for (let j = p.length - 1; j >= 0; j--)
      if (
        contains({ x: K.COLUMN_X[i], y: ys[j], w: K.CARD_W, h: K.CARD_H }, x, y)
      )
        return p[j].faceUp
          ? {
              a: { pile: "tableau", index: i },
              row: j,
              px: K.COLUMN_X[i],
              py: ys[j],
            }
          : null;
  }
  for (let i = K.FOUNDATION_COUNT - 1; i >= 0; i--)
    if (
      s.foundations[i].length &&
      contains(rect(s, { pile: "foundation", index: i }), x, y)
    )
      return {
        a: { pile: "foundation", index: i },
        row: s.foundations[i].length - 1,
        px: K.FOUNDATION_X[i],
        py: K.TOP_ROW_Y,
      };
  if (s.wasteSets.length && s.waste.length) {
    const visible = Math.min(
      K.TURN_COUNT,
      s.wasteSets[s.wasteSets.length - 1],
      s.waste.length,
    );
    for (let j = visible - 1; j >= 0; j--)
      if (
        contains(
          {
            x: K.WASTE_X + j * K.WASTE_FAN,
            y: K.TOP_ROW_Y,
            w: K.CARD_W,
            h: K.CARD_H,
          },
          x,
          y,
        )
      )
        return j === visible - 1
          ? {
              a: { pile: "waste", index: 0 },
              row: s.waste.length - 1,
              px: K.WASTE_X + j * K.WASTE_FAN,
              py: K.TOP_ROW_Y,
            }
          : null;
  }
  return null;
};
const targetFor = (s: S, drag: DragState): DropTargetState | null => {
  const a = at(s, drag.x + K.CARD_W / 2, drag.y + K.CARD_H / 2);
  if (
    !a ||
    a.pile === "stock" ||
    a.pile === "waste" ||
    (a.pile === drag.fromPile && a.index === drag.fromIndex) ||
    !accepts(s, drag.cards, a)
  )
    return null;
  return { pile: a.pile, index: a.index };
};
const pointerDown = (s: S, x: number, y: number): CascadeState => {
  let out: CascadeState = {
    ...s,
    pointer: { x, y, down: true },
    lastPress: { x, y, at: s.simTime },
  };
  if (s.screen === "won")
    return { ...deal(out), screen: "playing", menuIndex: 0, lastPress: null };
  if (s.screen !== "playing") {
    const h = hoverMenu(s, x, y);
    return h === null ? out : { ...out, menuIndex: h };
  }
  const h = hoverMenu(s, x, y);
  if (h !== null) return { ...out, menuIndex: h };
  const g = grabbed(s, x, y);
  if (!g) return out;
  const prev = s.lastPress;
  const dbl =
    prev &&
    s.simTime - prev.at <= K.DOUBLE_CLICK_WINDOW &&
    Math.hypot(x - prev.x, y - prev.y) <= K.DOUBLE_CLICK_SLOP &&
    (g.a.pile === "waste" ||
      (g.a.pile === "tableau" && g.row === s.tableau[g.a.index].length - 1));
  if (dbl) {
    const [next] = autoMove(out, g.a);
    return next;
  }
  const p = pileOf(s, g.a),
    cards = p.slice(g.row).map(card);
  out = put(out, g.a, p.slice(0, g.row));
  const drag: DragState = {
    cards,
    fromPile: g.a.pile as DragState["fromPile"],
    fromIndex: g.a.index,
    x: g.px,
    y: g.py,
  };
  out = { ...out, drag };
  return cue(out, K.CUES.lift);
};
const pointerMove = (s: S, x: number, y: number): CascadeState => {
  let out: CascadeState = { ...s, pointer: { ...s.pointer, x, y } };
  const h = hoverMenu(out, x, y);
  if (h !== null) out = { ...out, menuIndex: h };
  if (out.drag) {
    const dx = x - s.pointer.x,
      dy = y - s.pointer.y;
    const drag = { ...out.drag, x: out.drag.x + dx, y: out.drag.y + dy };
    out = { ...out, drag, dropTarget: targetFor(out, drag) };
  }
  return out;
};
const pointerUp = (s: S, x: number, y: number): CascadeState => {
  let out = pointerMove(s, x, y);
  out = { ...out, pointer: { x, y, down: false } };
  const press = s.lastPress;
  if (!press) return out;
  if (s.screen === "won") return out;
  const h = hoverMenu(s, x, y),
    ph = hoverMenu(s, press.x, press.y);
  if (h !== null && h === ph)
    return activate({ ...out, drag: null, dropTarget: null, menuIndex: h }, h);
  const click = Math.hypot(x - press.x, y - press.y) <= K.DRAG_THRESHOLD;
  if (out.drag) {
    const d = out.drag,
      from = { pile: d.fromPile, index: d.fromIndex };
    const original = pileOf(out, from);
    const proposed = click ? null : targetFor(out, d);
    if (proposed) {
      out = put(out, proposed, [...pileOf(out, proposed), ...d.cards]);
      if (from.pile === "waste")
        out = { ...out, wasteSets: decSet(out.wasteSets) };
      out = afterMove(out, from, proposed);
      out = cue(out, K.CUES.drop);
    } else {
      out = put(out, from, [...original, ...d.cards]);
      if (!click) out = cue(out, K.CUES.reject);
    }
    out = { ...out, drag: null, dropTarget: null };
  }
  if (
    click &&
    s.screen === "playing" &&
    contains(rect(s, { pile: "stock", index: 0 }), press.x, press.y)
  )
    out = turnStock(out);
  return out;
};
const drawLaunchVx = () => {
  const m =
    K.LAUNCH_VX_MIN + Math.random() * (K.LAUNCH_VX_MAX - K.LAUNCH_VX_MIN);
  return Math.random() < 0.5 ? -m : m;
};
const step = (s: S, dt: number): CascadeState => {
  let out: CascadeState = { ...s, simTime: s.simTime + dt };
  if (out.screen !== "won") return out;
  const trail = [...(out.trail || [])];
  let stamps = out.trailStamps;
  const flyers: FlyerState[] = [];
  for (const f of out.flyers) {
    let vy = f.vy + K.GRAVITY * dt;
    const x = f.x + f.vx * dt;
    let y = f.y + vy * dt;
    if (y >= K.FLOOR_Y && vy > 0) {
      vy = -vy * K.BOUNCE_DAMP;
      y = K.FLOOR_Y;
    }
    if (out.trailPainting) {
      trail.push({
        card: { id: f.id, suit: f.suit, rank: f.rank, faceUp: true },
        x,
        y,
      });
      stamps++;
    }
    if (x + K.CARD_W >= 0 && x <= K.STAGE_W) flyers.push({ ...f, x, y, vy });
  }
  out = { ...out, flyers, trail, trailStamps: stamps };
  if (out.launching) {
    let clock = out.launchClock + dt;
    while (clock >= K.LAUNCH_INTERVAL && out.launched < K.DECK_SIZE) {
      const index = out.launched % K.FOUNDATION_COUNT;
      let source = index;
      for (
        let j = 0;
        j < K.FOUNDATION_COUNT && !out.foundations[source].length;
        j++
      )
        source = (source + 1) % K.FOUNDATION_COUNT;
      const p = out.foundations[source];
      if (!p.length) break;
      const top = p[p.length - 1];
      out = put(out, { pile: "foundation", index: source }, p.slice(0, -1));
      out = {
        ...out,
        flyers: [
          ...out.flyers,
          {
            id: top.id,
            suit: top.suit,
            rank: top.rank,
            x: K.FOUNDATION_X[source],
            y: K.TOP_ROW_Y,
            vx: drawLaunchVx(),
            vy: K.LAUNCH_VY,
          },
        ],
        launched: out.launched + 1,
      };
      out = cue(out, K.CUES.launch);
      clock -= K.LAUNCH_INTERVAL;
    }
    out = { ...out, launchClock: clock };
  }
  if (out.launched === K.DECK_SIZE && !out.flyers.length)
    out = { ...out, cascadeDone: true };
  return out;
};
export interface CascadeDebugApi {
  readonly version: number;
  reset(s: S): CascadeState;
  snapshot(s: S): ReturnType<typeof snapshot>;
  reconcile(s: S): CascadeState;
  menuItemRect(s: S, index: number): Rect | null;
  setScreen(s: S, screen: Screen): CascadeState;
  setMenuIndex(s: S, index: number): CascadeState;
  setTitleIndex(s: S, index: number): CascadeState;
  addCard(
    s: S,
    pile: PileKind,
    index: number,
    suit: Suit,
    rank: number,
    faceUp: boolean,
  ): CascadeState;
  removeCard(s: S, id: number): CascadeState;
  setCardFaceUp(s: S, id: number, faceUp: boolean): CascadeState;
  clearPile(s: S, pile: PileKind, index: number): CascadeState;
  clearTable(s: S): CascadeState;
  addWasteSet(s: S, count: number): CascadeState;
  clearWasteSets(s: S): CascadeState;
  deal(s: S): CascadeState;
  turnStock(s: S): CascadeState;
  move(
    s: S,
    fromPile: PileKind,
    fromIndex: number,
    fromRow: number,
    toPile: PileKind,
    toIndex: number,
  ): [CascadeState, boolean];
  autoMove(s: S, pile: PileKind, index: number): [CascadeState, boolean];
  pointerDown(s: S, x: number, y: number): CascadeState;
  pointerMove(s: S, x: number, y: number): CascadeState;
  pointerUp(s: S, x: number, y: number): CascadeState;
  setAutoFlip(s: S, enabled: boolean): CascadeState;
  setWinDetect(s: S, enabled: boolean): CascadeState;
  setLaunching(s: S, enabled: boolean): CascadeState;
  setTrailPainting(s: S, enabled: boolean): CascadeState;
  addFlyer(
    s: S,
    suit: Suit,
    rank: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): CascadeState;
  setFlyerPosition(s: S, id: number, x: number, y: number): CascadeState;
  setFlyerVelocity(s: S, id: number, vx: number, vy: number): CascadeState;
  removeFlyer(s: S, id: number): CascadeState;
  clearFlyers(s: S): CascadeState;
  setLaunchClock(s: S, seconds: number): CascadeState;
  clearTrail(s: S): CascadeState;
  drawLaunchVx(s: S): number;
}
const findCard = (s: S, id: number): { a: Address; row: number } | null => {
  for (const a of addresses) {
    const row = pileOf(s, a).findIndex((c) => c.id === id);
    if (row >= 0) return { a, row };
  }
  return null;
};
const mustCard = (s: S, id: number) => {
  const hit = findCard(s, id);
  if (!hit) throw new RangeError("Unknown card id");
  return hit;
};
const mustFlyer = (s: S, id: number) => {
  if (!s.flyers.some((f) => f.id === id))
    throw new RangeError("Unknown flyer id");
};
const ensureCount = (n: number) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("Invalid count");
};
const summary = (c: DeepReadonly<CardState>) => ({
  ...card(c),
  color: color(c.suit),
});
const snapshot = (s: S) => ({
  version: K.CASCADE_DEBUG_VERSION,
  screen: s.screen,
  menuIndex: s.menuIndex,
  titleIndex: s.titleIndex,
  dealMode: K.DEAL_MODE,
  turnCount: K.TURN_COUNT,
  dealModeLabel: K.DEAL_MODE_LABEL,
  muted: s.muted,
  autoFlip: s.autoFlip,
  winDetect: s.winDetect,
  launching: s.launching,
  trailPainting: s.trailPainting,
  stock: s.stock.map(summary),
  waste: s.waste.map(summary),
  wasteSets: [...s.wasteSets],
  wasteVisibleCount: s.wasteSets[s.wasteSets.length - 1] || 0,
  foundations: s.foundations.map((p) => p.map(summary)),
  tableau: s.tableau.map((p) => p.map(summary)),
  drag: s.drag ? { ...s.drag, cards: s.drag.cards.map(summary) } : null,
  dropTarget: s.drag ? targetFor(s, s.drag) : null,
  pointer: { ...s.pointer },
  lastPress: s.lastPress ? { ...s.lastPress } : null,
  launchClock: s.launchClock,
  launched: s.launched,
  flyers: s.flyers.map((f) => ({ ...f })),
  cascadeDone: s.cascadeDone,
  trailStamps: s.trailStamps,
  simTime: s.simTime,
});
const debug: CascadeDebugApi = {
  version: K.CASCADE_DEBUG_VERSION,
  reset: (s) => ({ ...blank(), muted: s.muted }),
  snapshot,
  reconcile: (s) => ({
    ...s,
    dropTarget: s.drag ? targetFor(s, s.drag) : null,
  }),
  menuItemRect: (s, i) => menuRect(s.screen, i),
  setScreen: (s, screen) => ({ ...s, screen }),
  setMenuIndex: (s, menuIndex) => ({ ...s, menuIndex }),
  setTitleIndex: (s, titleIndex) => ({ ...s, titleIndex }),
  addCard: (s, pile, index, suit, rank, faceUp) => {
    if (
      !K.SUITS.includes(suit) ||
      !Number.isInteger(rank) ||
      rank < K.RANK_MIN ||
      rank > K.RANK_MAX
    )
      throw new RangeError("Invalid card");
    const a = { pile, index },
      p = pileOf(s, a);
    return {
      ...put(s, a, [...p, { id: s.nextId, suit, rank, faceUp }]),
      nextId: s.nextId + 1,
    };
  },
  removeCard: (s, id) => {
    const { a, row } = mustCard(s, id),
      p = pileOf(s, a);
    let out = put(s, a, [...p.slice(0, row), ...p.slice(row + 1)]);
    if (a.pile === "waste") out = { ...out, wasteSets: decSet(s.wasteSets) };
    return out;
  },
  setCardFaceUp: (s, id, faceUp) => {
    const { a, row } = mustCard(s, id);
    return put(
      s,
      a,
      pileOf(s, a).map((c, i) => (i === row ? { ...c, faceUp } : c)),
    );
  },
  clearPile: (s, pile, index) => {
    const a = { pile, index };
    pileOf(s, a);
    const out = put(s, a, []);
    return pile === "waste" ? { ...out, wasteSets: [] } : out;
  },
  clearTable: (s) => ({
    ...s,
    stock: [],
    waste: [],
    wasteSets: [],
    foundations: s.foundations.map(() => []),
    tableau: s.tableau.map(() => []),
    drag: null,
    dropTarget: null,
  }),
  addWasteSet: (s, count) => {
    ensureCount(count);
    return { ...s, wasteSets: [...s.wasteSets, count] };
  },
  clearWasteSets: (s) => ({ ...s, wasteSets: [] }),
  deal,
  turnStock,
  move: (s, fromPile, fromIndex, fromRow, toPile, toIndex) =>
    move(s, { pile: fromPile, index: fromIndex }, fromRow, {
      pile: toPile,
      index: toIndex,
    }),
  autoMove: (s, pile, index) => autoMove(s, { pile, index }),
  pointerDown,
  pointerMove,
  pointerUp,
  setAutoFlip: (s, autoFlip) => ({ ...s, autoFlip }),
  setWinDetect: (s, winDetect) => ({ ...s, winDetect }),
  setLaunching: (s, launching) => ({ ...s, launching }),
  setTrailPainting: (s, trailPainting) => ({ ...s, trailPainting }),
  addFlyer: (s, suit, rank, x, y, vx, vy) => {
    if (
      !K.SUITS.includes(suit) ||
      !Number.isInteger(rank) ||
      rank < 1 ||
      rank > 13
    )
      throw new RangeError("Invalid flyer");
    return {
      ...s,
      flyers: [...s.flyers, { id: s.nextId, suit, rank, x, y, vx, vy }],
      nextId: s.nextId + 1,
    };
  },
  setFlyerPosition: (s, id, x, y) => {
    mustFlyer(s, id);
    return {
      ...s,
      flyers: s.flyers.map((f) => (f.id === id ? { ...f, x, y } : f)),
    };
  },
  setFlyerVelocity: (s, id, vx, vy) => {
    mustFlyer(s, id);
    return {
      ...s,
      flyers: s.flyers.map((f) => (f.id === id ? { ...f, vx, vy } : f)),
    };
  },
  removeFlyer: (s, id) => {
    mustFlyer(s, id);
    return { ...s, flyers: s.flyers.filter((f) => f.id !== id) };
  },
  clearFlyers: (s) => ({ ...s, flyers: [] }),
  setLaunchClock: (s, launchClock) => ({ ...s, launchClock }),
  clearTrail: (s) => ({ ...s, trail: [], trailStamps: 0 }),
  drawLaunchVx: () => drawLaunchVx(),
};

const suitMark: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};
const rankMark = (n: number) =>
  n === 1 ? "A" : n === 11 ? "J" : n === 12 ? "Q" : n === 13 ? "K" : String(n);
function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function drawCard(
  ctx: CanvasRenderingContext2D,
  c: DeepReadonly<CardState>,
  x: number,
  y: number,
  lift = false,
) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.32)";
  ctx.shadowBlur = lift ? 20 : 8;
  ctx.shadowOffsetY = lift ? 10 : 3;
  rounded(ctx, x, y, K.CARD_W, K.CARD_H, 8);
  ctx.fillStyle = c.faceUp ? "#fffaf0" : "#173f59";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2;
  ctx.strokeStyle = c.faceUp ? "#d9d2bd" : "#a9d4cb";
  ctx.stroke();
  if (c.faceUp) {
    const col = color(c.suit) === "red" ? "#b64b4a" : "#243b44";
    ctx.fillStyle = col;
    ctx.textAlign = "left";
    ctx.font = "bold 22px Georgia";
    ctx.fillText(rankMark(c.rank), x + 10, y + 25);
    ctx.font = "22px Georgia";
    ctx.fillText(suitMark[c.suit], x + 10, y + 49);
    ctx.textAlign = "center";
    ctx.font = "48px Georgia";
    ctx.fillText(suitMark[c.suit], x + K.CARD_W / 2, y + 91);
    ctx.font = "bold 17px Georgia";
    ctx.fillText(rankMark(c.rank), x + K.CARD_W / 2, y + 116);
  } else {
    ctx.strokeStyle = "#6caaad";
    ctx.lineWidth = 1.5;
    rounded(ctx, x + 6, y + 6, K.CARD_W - 12, K.CARD_H - 12, 4);
    ctx.stroke();
    ctx.save();
    rounded(ctx, x + 7, y + 7, K.CARD_W - 14, K.CARD_H - 14, 3);
    ctx.clip();
    for (let k = -3; k < 7; k++) {
      ctx.beginPath();
      ctx.moveTo(x + 12 + k * 20, y + 8);
      ctx.lineTo(x - 35 + k * 20, y + 132);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#d8b56e";
    ctx.textAlign = "center";
    ctx.font = "30px Georgia";
    ctx.fillText("✦", x + 50, y + 80);
  }
  ctx.restore();
}
function slot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  selected = false,
) {
  ctx.save();
  rounded(ctx, x, y, K.CARD_W, K.CARD_H, 8);
  ctx.fillStyle = selected ? "#287c6c" : "#12433f";
  ctx.fill();
  ctx.strokeStyle = selected ? "#f5ca7a" : "#518277";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#8bb8a6";
  ctx.font = "13px Arial";
  ctx.textAlign = "center";
  ctx.fillText(label, x + K.CARD_W / 2, y + K.CARD_H / 2 + 5);
  ctx.restore();
}
function textLine(
  ctx: CanvasRenderingContext2D,
  txt: string,
  x: number,
  y: number,
  size: number,
  color = "#f5e9ca",
  align: CanvasTextAlign = "center",
  family = "Georgia",
) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = `${size}px ${family}`;
  ctx.fillText(txt, x, y);
}
function button(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  selected: boolean,
) {
  rounded(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = selected ? "#eac57e" : "#24594f";
  ctx.fill();
  ctx.strokeStyle = selected ? "#f6e1a5" : "#5b9985";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  textLine(
    ctx,
    label,
    r.x + r.w / 2,
    r.y + r.h / 2 + 5,
    17,
    selected ? "#173d39" : "#e5e2ca",
    "center",
    "Arial",
  );
}
function drawTable(s: S, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, K.STAGE_W, K.STAGE_H);
  ctx.strokeStyle = "#295f53";
  ctx.lineWidth = 2;
  ctx.strokeRect(196, 8, 880, 660);
  textLine(ctx, "CASCADE", 68, 64, 29, "#e7c780", "left");
  textLine(ctx, K.DEAL_MODE_LABEL, 68, 89, 13, "#8bb8a6", "left", "Arial");
  for (const stamp of s.trail || [])
    drawCard(ctx, stamp.card, stamp.x, stamp.y);
  for (const a of addresses) {
    if (a.pile === "stock") {
      const p = s.stock;
      if (p.length) drawCard(ctx, p[p.length - 1], K.STOCK_X, K.TOP_ROW_Y);
      else slot(ctx, K.STOCK_X, K.TOP_ROW_Y, "↻");
      continue;
    }
    if (a.pile === "waste") {
      const visible = Math.min(
        K.TURN_COUNT,
        s.wasteSets[s.wasteSets.length - 1] || 0,
        s.waste.length,
      );
      if (!visible) slot(ctx, K.WASTE_X, K.TOP_ROW_Y, "WASTE");
      else
        for (let i = 0; i < visible; i++)
          drawCard(
            ctx,
            s.waste[s.waste.length - visible + i],
            K.WASTE_X + i * K.WASTE_FAN,
            K.TOP_ROW_Y,
          );
      continue;
    }
    const p = pileOf(s, a),
      r = rect(s, a),
      selected =
        s.dropTarget?.pile === a.pile && s.dropTarget.index === a.index;
    if (selected) {
      ctx.fillStyle = "rgba(246,205,112,.28)";
      rounded(ctx, r.x - 5, r.y - 5, r.w + 10, r.h + 10, 10);
      ctx.fill();
    }
    if (!p.length)
      slot(ctx, r.x, r.y, a.pile === "foundation" ? "ACE" : "KING", selected);
    else if (a.pile === "foundation") drawCard(ctx, p[p.length - 1], r.x, r.y);
    else {
      const ys = layout(p);
      p.forEach((c, i) => drawCard(ctx, c, r.x, ys[i]));
    }
  }
  for (const f of s.flyers) drawCard(ctx, { ...f, faceUp: true }, f.x, f.y);
  if (s.drag) {
    const ys = layout(s.drag.cards);
    s.drag.cards.forEach((c, i) =>
      drawCard(ctx, c, s.drag!.x, s.drag!.y + ys[i] - K.TABLEAU_Y, true),
    );
  }
}
function drawHud(s: S, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#092b2b";
  ctx.fillRect(0, K.HUD_Y, K.STAGE_W, K.HUD_H);
  ctx.strokeStyle = "#5a8b79";
  ctx.beginPath();
  ctx.moveTo(0, K.HUD_Y);
  ctx.lineTo(K.STAGE_W, K.HUD_Y);
  ctx.stroke();
  K.HUD_ITEMS.forEach((item, i) => {
    const r = menuRect("playing", i);
    if (r) button(ctx, r, item, i === s.menuIndex);
  });
  textLine(ctx, K.DEAL_MODE_LABEL, 1055, 706, 16, "#d9bd79", "right", "Arial");
}
function drawMenu(s: S, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, K.STAGE_W, K.STAGE_H);
  ctx.fillStyle = "#134a43";
  rounded(ctx, 344, 94, 592, 532, 20);
  ctx.fill();
  ctx.strokeStyle = "#62927e";
  ctx.lineWidth = 3;
  ctx.stroke();
  if (s.screen === "title") {
    textLine(ctx, K.TITLE_TEXT, 640, 247, 82, "#f0d194");
    textLine(ctx, K.TAGLINE_TEXT, 640, 290, 22, "#c2d4be", "center", "Arial");
    textLine(
      ctx,
      K.DEAL_MODE_LABEL,
      640,
      348,
      18,
      "#e3c184",
      "center",
      "Arial",
    );
    K.TITLE_ITEMS.forEach((item, i) => {
      const r = menuRect("title", i);
      if (r) button(ctx, r, item, i === s.menuIndex);
    });
  } else {
    textLine(ctx, "HOW TO PLAY", 640, 177, 49, "#f0d194");
    const lines = [
      "Build each foundation from ACE to KING.",
      "Columns build down, alternating red and black.",
      "Only a KING may fill an empty column.",
      "Tap STOCK to turn three cards to the waste.",
      "When it runs out, tap again to recycle.",
      "Drag cards or runs to move them.",
      "DOUBLE-CLICK a playable card to send it home.",
    ];
    lines.forEach((line, i) =>
      textLine(ctx, line, 640, 250 + i * 39, 21, "#e8e5d5", "center", "Arial"),
    );
    const r = menuRect("howto", 0);
    if (r) button(ctx, r, K.HOWTO_BACK_LABEL, true);
  }
}
export const game: Game<CascadeState, CascadeDebugApi> = {
  initialize(api: InitApi<CascadeState>) {
    for (const [name, keys] of Object.entries(K.MENU_BINDINGS))
      api.input.register(name, { keys: [...keys] });
    Object.values(K.CUES).forEach((name, i) =>
      api.audio.define(name, {
        wave: i % 3 === 0 ? "triangle" : "sine",
        freq: 260 + i * 70,
        freqTo: 180 + i * 55,
        gain: 0.13,
        durationMs: 70 + i * 8,
      }),
    );
    api.diagnostics.register("Screen", (s) => s.screen + " · " + K.DEAL_MODE);
    api.diagnostics.register(
      "Draw",
      (s) => `${s.stock.length} stock · ${s.waste.length} waste`,
    );
    api.diagnostics.register("Foundations", (s) =>
      s.foundations.map((p) => p.length).join(" / "),
    );
    api.diagnostics.register("Columns", (s) =>
      s.tableau.map((p) => p.length).join(" / "),
    );
    api.diagnostics.register("Hand", (s) =>
      s.drag ? s.drag.cards.length : "empty",
    );
    api.diagnostics.register(
      "Cascade",
      (s) => `${s.launched} launched · ${s.flyers.length} flying`,
    );
    return [blank(), debug];
  },
  update(state: S, api: UpdateApi, dt: number) {
    let out: CascadeState = step(state, dt);
    for (const sample of api.input.pointerSamples()) {
      if (!sample.primary || (sample.button && sample.button !== "primary"))
        continue;
      out =
        sample.type === "down"
          ? pointerDown(out, sample.x, sample.y)
          : sample.type === "up"
            ? pointerUp(out, sample.x, sample.y)
            : pointerMove(out, sample.x, sample.y);
    }
    if (out.screen !== "won") {
      const up = api.input.pressed(K.MENU_UP),
        down = api.input.pressed(K.MENU_DOWN),
        confirm = api.input.pressed(K.MENU_CONFIRM),
        back = api.input.pressed(K.MENU_BACK);
      const count =
        out.screen === "title" ? 2 : out.screen === "playing" ? 3 : 1;
      if (out.screen === "howto") {
        if (confirm || back) out = activate(out, 0);
      } else if (up || down)
        out = {
          ...out,
          menuIndex: (out.menuIndex + (up ? -1 : 1) + count) % count,
        };
      else if (confirm) out = activate(out, out.menuIndex);
    }
    if (out.muted !== api.audio.muted()) api.audio.setMuted(out.muted);
    for (const name of new Set(out.pendingCues || [])) api.audio.play(name);
    return { ...out, muted: api.audio.muted(), pendingCues: [] };
  },
  render(state: S, api: RenderApi) {
    const ctx = api.ctx;
    if (state.screen === "title" || state.screen === "howto")
      drawMenu(state, ctx);
    else {
      drawTable(state, ctx);
      if (state.screen === "playing") drawHud(state, ctx);
      else if (state.cascadeDone) {
        ctx.fillStyle = "rgba(5,32,30,.72)";
        rounded(ctx, 415, 283, 450, 150, 18);
        ctx.fill();
        textLine(ctx, K.WIN_TEXT, 640, 375, 61, "#f0d194");
        textLine(
          ctx,
          "TAP ANYWHERE TO PLAY AGAIN",
          640,
          413,
          16,
          "#f2e6cb",
          "center",
          "Arial",
        );
      }
    }
  },
};
