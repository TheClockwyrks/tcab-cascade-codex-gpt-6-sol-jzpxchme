import { describe, expect, it } from "vitest";
import { game, type CascadeDebugApi, type CascadeState } from "./game";
import type { InitApi } from "@clockwyrks/simple-2d";

function setup(): [CascadeState, CascadeDebugApi] {
  const api = {
    input: { register: () => undefined },
    audio: { define: () => undefined },
    diagnostics: { register: () => undefined },
  } as unknown as InitApi<CascadeState>;
  return game.initialize(api) as [CascadeState, CascadeDebugApi];
}

describe("Cascade rules", () => {
  it("deals one deck and turns draw-three sets in order", () => {
    const [initial, d] = setup();
    let s = initial;
    s = d.deal(s);
    expect(s.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.stock).toHaveLength(24);
    expect(
      new Set(
        [...s.stock, ...s.tableau.flat()].map((c) => `${c.suit}:${c.rank}`),
      ).size,
    ).toBe(52);
    const top = s.stock[s.stock.length - 1].id;
    s = d.turnStock(s);
    expect(s.waste).toHaveLength(3);
    expect(s.waste[0].id).toBe(top);
    expect(s.wasteSets).toEqual([3]);
    for (let i = 0; i < 7; i++) s = d.turnStock(s);
    expect(s.stock).toHaveLength(0);
    s = d.turnStock(s);
    expect(s.stock).toHaveLength(24);
    expect(s.wasteSets).toEqual([]);
    s = d.turnStock(s);
    expect(s.waste[0].id).toBe(top);
  });

  it("moves valid runs, flips an exposed card, and refuses bad targets", () => {
    const [initial, d] = setup();
    let s = initial;
    s = d.addCard(s, "tableau", 0, "spades", 9, false);
    s = d.addCard(s, "tableau", 0, "hearts", 8, true);
    s = d.addCard(s, "tableau", 0, "clubs", 7, true);
    s = d.addCard(s, "tableau", 1, "spades", 9, true);
    let ok: boolean;
    [s, ok] = d.move(s, "tableau", 0, 1, "tableau", 1);
    expect(ok).toBe(true);
    expect(s.tableau[0][0].faceUp).toBe(true);
    expect(s.tableau[1].map((c) => c.rank)).toEqual([9, 8, 7]);
    const before = d.snapshot(s);
    [s, ok] = d.move(s, "tableau", 1, 1, "foundation", 0);
    expect(ok).toBe(false);
    expect(d.snapshot(s).tableau).toEqual(before.tableau);
  });

  it("accepts aces into any foundation and enforces suit order", () => {
    const [initial, d] = setup();
    let s = initial;
    s = d.addCard(s, "tableau", 0, "diamonds", 1, true);
    let ok: boolean;
    [s, ok] = d.autoMove(s, "tableau", 0);
    expect(ok).toBe(true);
    expect(s.foundations[0][0].suit).toBe("diamonds");
    s = d.addCard(s, "tableau", 1, "hearts", 2, true);
    [s, ok] = d.move(s, "tableau", 1, 0, "foundation", 0);
    expect(ok).toBe(false);
    s = d.addCard(s, "tableau", 2, "diamonds", 2, true);
    [s, ok] = d.autoMove(s, "tableau", 2);
    expect(ok).toBe(true);
    expect(s.foundations[0]).toHaveLength(2);
  });

  it("runs the same pointer path through the debug surface", () => {
    const [initial, d] = setup();
    let s = initial;
    s = d.addCard(s, "tableau", 0, "hearts", 1, true);
    s = d.setScreen(s, "playing");
    s = d.pointerDown(s, 240, 200);
    expect(s.drag?.cards).toHaveLength(1);
    s = d.pointerMove(s, 600, 60);
    expect(s.dropTarget).toEqual({ pile: "foundation", index: 0 });
    s = d.pointerUp(s, 600, 60);
    expect(s.foundations[0]).toHaveLength(1);
    expect(s.drag).toBeNull();
  });
});

describe("victory cascade", () => {
  it("wins on the final move and launches without moving the new flyer that frame", () => {
    const [initial, d] = setup();
    let s = d.setScreen(initial, "playing");
    const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
    for (let i = 0; i < 4; i++)
      for (let rank = 1; rank <= (i === 3 ? 12 : 13); rank++)
        s = d.addCard(s, "foundation", i, suits[i], rank, true);
    s = d.addCard(s, "tableau", 0, "clubs", 13, true);
    const [won, accepted] = d.move(s, "tableau", 0, 0, "foundation", 3);
    expect(accepted).toBe(true);
    expect(won.screen).toBe("won");
    expect(won.launchClock).toBe(0.18);
    const api = {
      input: { pointerSamples: () => [], pressed: () => false },
      audio: {
        muted: () => false,
        setMuted: () => undefined,
        play: () => undefined,
      },
    } as unknown as Parameters<typeof game.update>[1];
    s = game.update(won, api, 0.016);
    expect(s.launched).toBe(1);
    expect(s.flyers[0].x).toBe(590);
    expect(s.flyers[0].y).toBe(24);
    s = d.setTrailPainting(s, false);
    s = game.update(s, api, 0.016);
    expect(s.flyers[0].x).not.toBe(590);
    expect(s.trailStamps).toBe(0);
  });
});
