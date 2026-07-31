import { describe, it, expect } from "vitest";
import { createInMemoryProfileStore } from "./profile-store.js";

describe("createInMemoryProfileStore", () => {
  it("a missing profile loads empty with formatVersion 1 and a profile_missing warning", async () => {
    const store = createInMemoryProfileStore();
    const { profile, warnings } = await store.load("no-such-profile");
    expect(profile).toEqual({ formatVersion: 1, profileId: "no-such-profile", achievements: [] });
    expect(warnings).toEqual([{ code: "profile_missing", profileId: "no-such-profile" }]);
  });

  it("a corrupt profile loads empty with a profile_corrupt warning", async () => {
    const store = createInMemoryProfileStore({ raw: new Map([["p1", { totally: "the wrong shape" }]]) });
    const { profile, warnings } = await store.load("p1");
    expect(profile).toEqual({ formatVersion: 1, profileId: "p1", achievements: [] });
    expect(warnings).toEqual([{ code: "profile_corrupt", profileId: "p1" }]);
  });

  it("a well-formed seeded profile loads with no warnings", async () => {
    const seeded = { formatVersion: 1, profileId: "p1", achievements: [{ campaignId: "c1", achievementId: "a1" }] };
    const store = createInMemoryProfileStore({ raw: new Map([["p1", seeded]]) });
    const { profile, warnings } = await store.load("p1");
    expect(profile).toEqual(seeded);
    expect(warnings).toEqual([]);
  });

  it("save then load round-trips the profile", async () => {
    const store = createInMemoryProfileStore();
    const profile = { formatVersion: 1 as const, profileId: "p1", achievements: [{ campaignId: "c1", achievementId: "a1" }] };
    const saveResult = await store.save(profile);
    expect(saveResult).toEqual({ ok: true, warnings: [] });

    const { profile: loaded } = await store.load("p1");
    expect(loaded).toEqual(profile);
  });

  it("copies the seeded map at construction — later external mutation has no effect", async () => {
    const raw = new Map<string, unknown>();
    const store = createInMemoryProfileStore({ raw });
    raw.set("p1", { formatVersion: 1, profileId: "p1", achievements: [] });
    const { warnings } = await store.load("p1");
    expect(warnings).toEqual([{ code: "profile_missing", profileId: "p1" }]);
  });

  it("onSave returning false simulates a write failure: no write, profile_write_failed warning", async () => {
    const store = createInMemoryProfileStore({ onSave: () => false });
    const profile = { formatVersion: 1 as const, profileId: "p1", achievements: [] };
    const saveResult = await store.save(profile);
    expect(saveResult).toEqual({ ok: false, warnings: [{ code: "profile_write_failed", profileId: "p1" }] });

    const { warnings: loadWarnings } = await store.load("p1");
    expect(loadWarnings).toEqual([{ code: "profile_missing", profileId: "p1" }]);
  });

  it("onSave can target a specific call by inspecting the profile passed in", async () => {
    const store = createInMemoryProfileStore({ onSave: (profile) => profile.profileId !== "blocked" });
    expect((await store.save({ formatVersion: 1, profileId: "ok", achievements: [] })).ok).toBe(true);
    expect((await store.save({ formatVersion: 1, profileId: "blocked", achievements: [] })).ok).toBe(false);
  });
});
