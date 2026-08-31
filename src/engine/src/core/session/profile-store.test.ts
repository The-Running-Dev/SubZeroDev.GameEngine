import { describe, it, expect } from "vitest";
import { createInMemoryProfileStore } from "./profile-store.js";
import type { AchievementRecord, TerminalRecord } from "./types.js";

describe("createInMemoryProfileStore", () => {
  it("a missing profile loads empty with formatVersion 2 and a profile_missing warning", async () => {
    const store = createInMemoryProfileStore();
    const { profile, warnings } = await store.load("no-such-profile");
    expect(profile).toEqual({ formatVersion: 2, profileId: "no-such-profile", achievements: [], terminals: [] });
    expect(warnings).toEqual([{ code: "profile_missing", profileId: "no-such-profile" }]);
  });

  it("a corrupt profile loads empty with a profile_corrupt warning", async () => {
    const store = createInMemoryProfileStore({ raw: new Map([["p1", { totally: "the wrong shape" }]]) });
    const { profile, warnings } = await store.load("p1");
    expect(profile).toEqual({ formatVersion: 2, profileId: "p1", achievements: [], terminals: [] });
    expect(warnings).toEqual([{ code: "profile_corrupt", profileId: "p1" }]);
  });

  it("a well-formed seeded profile loads with no warnings", async () => {
    const seeded = {
      formatVersion: 2,
      profileId: "p1",
      achievements: [{ campaignId: "c1", achievementId: "a1" }],
      terminals: [{ campaignId: "c1", terminalId: "t1" }],
    };
    const store = createInMemoryProfileStore({ raw: new Map([["p1", seeded]]) });
    const { profile, warnings } = await store.load("p1");
    expect(profile).toEqual(seeded);
    expect(warnings).toEqual([]);
  });

  it("a version-1 profile migrates forward on load: formatVersion 2, terminals empty, no warning", async () => {
    const v1 = { formatVersion: 1, profileId: "p1", achievements: [{ campaignId: "c1", achievementId: "a1" }] };
    const store = createInMemoryProfileStore({ raw: new Map([["p1", v1]]) });
    const { profile, warnings } = await store.load("p1");
    expect(profile).toEqual({
      formatVersion: 2,
      profileId: "p1",
      achievements: [{ campaignId: "c1", achievementId: "a1" }],
      terminals: [],
    });
    expect(warnings).toEqual([]);
  });

  it("save then load round-trips the profile, terminals included", async () => {
    const store = createInMemoryProfileStore();
    const profile = {
      formatVersion: 2 as const,
      profileId: "p1",
      achievements: [{ campaignId: "c1", achievementId: "a1" }],
      terminals: [{ campaignId: "c1", terminalId: "t1" }],
    };
    const saveResult = await store.save(profile);
    expect(saveResult).toEqual({ ok: true, warnings: [] });

    const { profile: loaded } = await store.load("p1");
    expect(loaded).toEqual(profile);
  });

  it("copies the seeded map at construction — later external mutation has no effect", async () => {
    const raw = new Map<string, unknown>();
    const store = createInMemoryProfileStore({ raw });
    raw.set("p1", { formatVersion: 2, profileId: "p1", achievements: [], terminals: [] });
    const { warnings } = await store.load("p1");
    expect(warnings).toEqual([{ code: "profile_missing", profileId: "p1" }]);
  });

  it("onSave returning false simulates a write failure: no write, profile_write_failed warning", async () => {
    const store = createInMemoryProfileStore({ onSave: () => false });
    const profile = { formatVersion: 2 as const, profileId: "p1", achievements: [], terminals: [] };
    const saveResult = await store.save(profile);
    expect(saveResult).toEqual({ ok: false, warnings: [{ code: "profile_write_failed", profileId: "p1" }] });

    const { warnings: loadWarnings } = await store.load("p1");
    expect(loadWarnings).toEqual([{ code: "profile_missing", profileId: "p1" }]);
  });

  it("onSave can target a specific call by inspecting the profile passed in", async () => {
    const store = createInMemoryProfileStore({ onSave: (profile) => profile.profileId !== "blocked" });
    expect((await store.save({ formatVersion: 2, profileId: "ok", achievements: [], terminals: [] })).ok).toBe(true);
    expect((await store.save({ formatVersion: 2, profileId: "blocked", achievements: [], terminals: [] })).ok).toBe(false);
  });

  it("a stored entry whose internal profileId doesn't match its key is treated as corrupt", async () => {
    // Filed under "p1", but its own profileId claims "p2" — accepting this as-is would
    // mean a later save() (which always writes under profile.profileId) silently
    // redirects to "p2" instead of the profile that was actually requested.
    const store = createInMemoryProfileStore({
      raw: new Map([["p1", { formatVersion: 2, profileId: "p2", achievements: [], terminals: [] }]]),
    });
    const { profile, warnings } = await store.load("p1");
    expect(profile).toEqual({ formatVersion: 2, profileId: "p1", achievements: [], terminals: [] });
    expect(warnings).toEqual([{ code: "profile_corrupt", profileId: "p1" }]);
  });

  it("a formatVersion 2 entry with a malformed terminals array is treated as corrupt", async () => {
    const store = createInMemoryProfileStore({
      raw: new Map([["p1", { formatVersion: 2, profileId: "p1", achievements: [], terminals: [{ campaignId: "c1" }] }]]),
    });
    const { profile, warnings } = await store.load("p1");
    expect(profile).toEqual({ formatVersion: 2, profileId: "p1", achievements: [], terminals: [] });
    expect(warnings).toEqual([{ code: "profile_corrupt", profileId: "p1" }]);
  });

  it("load returns a clone — mutating the returned profile never affects what's persisted", async () => {
    const store = createInMemoryProfileStore();
    await store.save({
      formatVersion: 2,
      profileId: "p1",
      achievements: [{ campaignId: "c1", achievementId: "a1" }],
      terminals: [],
    });

    const { profile: first } = await store.load("p1");
    // `achievements` is typed readonly — cast to prove the *runtime* array isn't shared,
    // not just that the type checker would stop a well-behaved caller.
    (first.achievements as AchievementRecord[]).push({ campaignId: "c1", achievementId: "a2" });

    const { profile: second } = await store.load("p1");
    expect(second.achievements).toEqual([{ campaignId: "c1", achievementId: "a1" }]);
  });

  it("save stores a clone — mutating the caller's object after save() never affects what's persisted", async () => {
    const store = createInMemoryProfileStore();
    const profile = {
      formatVersion: 2 as const,
      profileId: "p1",
      achievements: [{ campaignId: "c1", achievementId: "a1" }],
      terminals: [{ campaignId: "c1", terminalId: "t1" }] as TerminalRecord[],
    };
    await store.save(profile);
    profile.achievements.push({ campaignId: "c1", achievementId: "a2" });
    profile.terminals.push({ campaignId: "c1", terminalId: "t2" });

    const { profile: loaded } = await store.load("p1");
    expect(loaded.achievements).toEqual([{ campaignId: "c1", achievementId: "a1" }]);
    expect(loaded.terminals).toEqual([{ campaignId: "c1", terminalId: "t1" }]);
  });
});
