import { describe, it, expect } from "vitest";
import {
  resolveOrFallback,
  renderScene,
  renderView,
  renderCampaignList,
  renderMessages,
  renderChanges,
  renderErrors,
  renderWarnings,
  renderActionResult,
  renderSaveHandle,
} from "./render.js";
import type { Scene } from "../../core/kernel/types.js";
import type { StringTable } from "../../core/localization/types.js";
import type { PlayerView } from "../../core/projection/types.js";
import type { OutcomeMessage, StateChange } from "../../core/kernel/reasons.js";
import type { ValidationError, ValidationWarning } from "../../core/validation/types.js";
import type { CampaignSummary, SaveHandle, SessionActionResult } from "../../core/session/types.js";

const strings: StringTable = {
  "choice.wait.label": "Wait",
  "choice.go_home.label": "Go home",
  "choice.go_home.fail": "The paperwork isn't old enough yet.",
  "core.reason.unknown_action": "That action isn't recognized.",
  "core.reason.action_not_available": "This action isn't available right now.",
  "outcome.greeting": "Welcome, {name}.",
};

describe("resolveOrFallback", () => {
  it("resolves a registered key", () => {
    expect(resolveOrFallback(strings, "choice.wait.label")).toBe("Wait");
  });

  it("falls back to the raw key for an unregistered one, never throws", () => {
    expect(resolveOrFallback(strings, "totally.made.up.key")).toBe("totally.made.up.key");
  });
});

describe("renderScene", () => {
  it("uses the already-rendered scene.body.text verbatim, not a re-resolved textKey", () => {
    const scene: Scene = {
      gameId: "g1",
      status: "active",
      body: { textKey: "node.municipality.text", text: "The office opened at 08:00." },
      actions: [{ id: "wait", labelKey: "choice.wait.label", available: true }],
      view: { gameId: "g1", status: "active", kindView: {} },
    };
    const text = renderScene(scene, strings);
    expect(text).toContain("The office opened at 08:00.");
    expect(text).toContain("[wait] Wait");
  });

  it("renders a gated action as unavailable with its resolved reason", () => {
    const scene: Scene = {
      gameId: "g1",
      status: "active",
      body: { textKey: "t", text: "Room 6." },
      actions: [
        { id: "go_home", labelKey: "choice.go_home.label", available: false, reasonKey: "choice.go_home.fail" },
      ],
      view: { gameId: "g1", status: "active", kindView: {} },
    };
    const text = renderScene(scene, strings);
    expect(text).toContain("[go_home] Go home (The paperwork isn't old enough yet.)");
  });

  it("renders a placeholder when there are no actions, rather than an empty line", () => {
    const scene: Scene = {
      gameId: "g1",
      status: "ended",
      body: { textKey: "t", text: "The end." },
      actions: [],
      view: { gameId: "g1", status: "ended", kindView: {} },
    };
    expect(renderScene(scene, strings)).toContain("(no actions available)");
  });

  it("falls back to a real reason code, not a literal, when an unavailable action has no reasonKey", () => {
    const scene: Scene = {
      gameId: "g1",
      status: "active",
      body: { textKey: "t", text: "Room 6." },
      actions: [{ id: "go_home", labelKey: "choice.go_home.label", available: false }],
      view: { gameId: "g1", status: "active", kindView: {} },
    };
    const text = renderScene(scene, strings);
    expect(text).toContain("[go_home] Go home (This action isn't available right now.)");
  });
});

describe("renderView", () => {
  it("renders kindView as opaque JSON, never destructured", () => {
    const view: PlayerView = { gameId: "g1", status: "active", kindView: { turn: 3, stats: [] } };
    const text = renderView(view);
    expect(text).toContain("g1");
    expect(text).toContain('"turn": 3');
  });

  it("renders a placeholder instead of throwing when kindView isn't JSON-serializable", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    const view: PlayerView = { gameId: "g1", status: "active", kindView: cyclic };
    expect(() => renderView(view)).not.toThrow();
    expect(renderView(view)).toContain("(kindView could not be rendered)");
  });
});

describe("renderCampaignList", () => {
  it("renders the raw titleKey — no session exists yet to resolve it through", () => {
    const campaigns: CampaignSummary[] = [{ campaignId: "bulgaria-bureaucracy", kindId: "story-graph", titleKey: "bureaucracy.campaign.title" }];
    const text = renderCampaignList(campaigns);
    expect(text).toContain("[bulgaria-bureaucracy] bureaucracy.campaign.title (story-graph)");
  });

  it("renders a placeholder for an empty list", () => {
    expect(renderCampaignList([])).toBe("(no campaigns available)");
  });
});

describe("renderMessages", () => {
  it("resolves and interpolates a visible message, skips a non-visible one", () => {
    const messages: OutcomeMessage[] = [
      { key: "outcome.greeting", params: { name: "Ben" }, visible: true },
      { key: "outcome.greeting", params: { name: "Hidden" }, visible: false },
    ];
    expect(renderMessages(messages, strings)).toBe("Welcome, Ben.");
  });

  it("leaves an unmatched placeholder as-is rather than throwing", () => {
    const messages: OutcomeMessage[] = [{ key: "outcome.greeting", visible: true }];
    expect(renderMessages(messages, strings)).toBe("Welcome, {name}.");
  });
});

describe("renderChanges", () => {
  it("renders only visible changes, plainly", () => {
    const changes: StateChange[] = [
      { path: "var.office_visits", op: "increment", value: 1, previous: 0, reason: "consequence_applied", visible: true },
      { path: "var.secret", op: "set", value: true, reason: "consequence_applied", visible: false },
    ];
    const text = renderChanges(changes);
    expect(text).toBe("  var.office_visits increment (0 -> 1)");
  });
});

describe("renderErrors / renderWarnings", () => {
  it("resolves a registered error code", () => {
    const errors: ValidationError[] = [{ code: "unknown_action", messageKey: "core.reason.unknown_action" }];
    expect(renderErrors(errors, strings)).toBe("That action isn't recognized.");
  });

  it("falls back to the raw code for an unregistered error, never crashes", () => {
    const errors: ValidationError[] = [{ code: "totally_new_code", messageKey: "totally.new.code" }];
    expect(renderErrors(errors, strings)).toBe("totally.new.code");
  });

  it("renders a warning prefixed and resolved", () => {
    const warnings: ValidationWarning[] = [{ code: "profile_missing", messageKey: "core.reason.unknown_action" }];
    expect(renderWarnings(warnings, strings)).toBe("Warning: That action isn't recognized.");
  });
});

describe("renderActionResult", () => {
  it("renders messages, changes, and the new scene on success, in that order", () => {
    const result: SessionActionResult = {
      ok: true,
      scene: {
        gameId: "g1",
        status: "active",
        body: { textKey: "t", text: "Room 6." },
        actions: [],
        view: { gameId: "g1", status: "active", kindView: {} },
      },
      errors: [],
      warnings: [],
      changes: [{ path: "var.office_visits", op: "increment", value: 1, previous: 0, reason: "x", visible: true }],
      messages: [{ key: "outcome.greeting", params: { name: "Ben" }, visible: true }],
    };
    const text = renderActionResult(result, strings);
    const messageIndex = text.indexOf("Welcome, Ben.");
    const changeIndex = text.indexOf("var.office_visits");
    const sceneIndex = text.indexOf("Room 6.");
    expect(messageIndex).toBeGreaterThanOrEqual(0);
    expect(changeIndex).toBeGreaterThan(messageIndex);
    expect(sceneIndex).toBeGreaterThan(changeIndex);
  });

  it("renders resolved errors on rejection, never a client literal", () => {
    const result: SessionActionResult = {
      ok: false,
      errors: [{ code: "unknown_action", messageKey: "core.reason.unknown_action" }],
      warnings: [],
      changes: [],
      messages: [],
    };
    expect(renderActionResult(result, strings)).toBe("That action isn't recognized.");
  });

  it("still renders messages and changes on success even when scene is absent", () => {
    // SessionActionResult.scene is optional in the type even though the real store
    // always sets it on ok:true — branching on `ok && scene` would misrender this as a
    // rejection and silently drop the message/changes below.
    const result: SessionActionResult = {
      ok: true,
      errors: [],
      warnings: [],
      changes: [{ path: "var.office_visits", op: "increment", value: 1, previous: 0, reason: "x", visible: true }],
      messages: [{ key: "outcome.greeting", params: { name: "Ben" }, visible: true }],
    };
    const text = renderActionResult(result, strings);
    expect(text).toContain("Welcome, Ben.");
    expect(text).toContain("var.office_visits");
  });
});

describe("renderSaveHandle", () => {
  it("renders the save id and the action sequence it was taken at", () => {
    const handle: SaveHandle = { saveId: "s1", savedAtSeq: 4 };
    expect(renderSaveHandle(handle)).toBe('Saved as "s1" at action 4.');
  });
});
