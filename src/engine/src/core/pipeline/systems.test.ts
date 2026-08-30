/**
 * The shared substrate's own semantics (`20-contract.md` §20, W97.3).
 *
 * Each of §20's five rules is a separate claim, and each is asserted here against a
 * deliberately hostile list rather than against either kind's real one — the two kinds'
 * behaviour-preservation is W97.5's job, in `campaigns/pipeline-equivalence.test.ts`. What
 * this file proves is that the substrate itself cannot be the thing that broke them.
 *
 * The "emits nothing" rule is asserted structurally: `runSystems` takes no emitter, no RNG
 * and no clock parameter, so the only way an event can reach a stream is a system emitting
 * it. That is a property of the signature, so the test here is that a list whose entries emit
 * nothing produces nothing — a substrate that had grown its own emission would fail it.
 */

import { describe, expect, it } from "vitest";
import { runSystems, type SystemEntry } from "./systems.js";

interface CountFrame {
  readonly trail: readonly string[];
  readonly value: number;
  readonly terminal: boolean;
}

const START: CountFrame = { trail: [], value: 0, terminal: false };

function step(id: string, delta: number): SystemEntry<CountFrame> {
  return { id, run: (frame) => ({ ...frame, trail: [...frame.trail, id], value: frame.value + delta }) };
}

describe("the ordered system pipeline (20-contract.md §20)", () => {
  it("applies the caller's order verbatim", () => {
    const result = runSystems(START, [step("a", 1), step("b", 10), step("c", 100)]);
    expect(result.trail).toEqual(["a", "b", "c"]);
    expect(result.value).toBe(111);
  });

  it("does not sort, and a list in non-alphabetical order stays in it", () => {
    expect(runSystems(START, [step("c", 1), step("a", 2), step("b", 4)]).trail).toEqual(["c", "a", "b"]);
  });

  it("does not deduplicate — the same id twice runs twice", () => {
    const result = runSystems(START, [step("a", 1), step("a", 1), step("a", 1)]);
    expect(result.trail).toEqual(["a", "a", "a"]);
    expect(result.value).toBe(3);
  });

  it("runs every entry even after one marks the frame terminal", () => {
    const terminate: SystemEntry<CountFrame> = { id: "terminate", run: (frame) => ({ ...frame, trail: [...frame.trail, "terminate"], terminal: true }) };
    const result = runSystems(START, [step("a", 1), terminate, step("b", 1), step("c", 1)]);
    // §20: a terminal result is a value carried in the frame, never a control-flow signal.
    expect(result.terminal).toBe(true);
    expect(result.trail).toEqual(["a", "terminate", "b", "c"]);
    expect(result.value).toBe(3);
  });

  it("threads each returned frame to the next entry, and nothing else", () => {
    const seen: CountFrame[] = [];
    const observe = (id: string): SystemEntry<CountFrame> => ({
      id,
      run: (frame) => {
        seen.push(frame);
        return { ...frame, trail: [...frame.trail, id], value: frame.value + 1 };
      },
    });
    const result = runSystems(START, [observe("a"), observe("b"), observe("c")]);
    expect(seen[0]).toBe(START);
    expect(seen[1]?.value).toBe(1);
    expect(seen[2]?.value).toBe(2);
    expect(result.value).toBe(3);
    // No entry observed a frame from anything but its immediate predecessor.
    expect(seen.map((frame) => frame.trail)).toEqual([[], ["a"], ["a", "b"]]);
  });

  it("returns the initial frame unchanged for an empty list", () => {
    expect(runSystems(START, [])).toBe(START);
  });

  it("never catches — a throwing system propagates, with no substitute frame", () => {
    const boom: SystemEntry<CountFrame> = { id: "boom", run: () => { throw new Error("system defect"); } };
    let reachedAfter = false;
    const after: SystemEntry<CountFrame> = { id: "after", run: (frame) => { reachedAfter = true; return frame; } };
    expect(() => runSystems(START, [step("a", 1), boom, after])).toThrow("system defect");
    // No partial commit: the throw is not converted into a frame, and nothing downstream ran.
    expect(reachedAfter).toBe(false);
  });

  it("does not mutate the caller's list", () => {
    const systems = [step("a", 1), step("b", 1)];
    const copy = [...systems];
    runSystems(START, systems);
    expect(systems).toEqual(copy);
  });

  it("reads no field of the frame — an opaque frame type passes through untouched", () => {
    const symbol = Symbol("opaque");
    const frames = [{ [symbol]: 1 }, { [symbol]: 2 }];
    const swap: SystemEntry<object> = { id: "swap", run: () => frames[1]! };
    expect(runSystems(frames[0]!, [swap])).toBe(frames[1]);
  });

  it("emits nothing of its own: a list of silent entries produces an empty stream", () => {
    const emitted: string[] = [];
    // §20's emission rule in the shape both kinds actually use it: where a kind wants a
    // per-system trace event, the entry's own run closes over system and emission together.
    const silent = step("silent", 1);
    const traced: SystemEntry<CountFrame> = { id: "traced", run: (frame) => { const next = step("traced", 1).run(frame); emitted.push("system.ran:traced"); return next; } };

    runSystems(START, [silent, silent]);
    expect(emitted).toEqual([]);

    runSystems(START, [traced, silent, traced]);
    expect(emitted).toEqual(["system.ran:traced", "system.ran:traced"]);
  });
});
