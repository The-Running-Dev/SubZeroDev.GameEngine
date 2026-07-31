import { describe, it, expect } from "vitest";
import { requireNode, type Node } from "./nodes.js";

const nodes: Record<string, Node> = {
  start: { id: "start", kind: "choice", textKey: "t", choices: [] },
};

describe("requireNode", () => {
  it("returns the node for a declared id", () => {
    expect(requireNode(nodes, "start")).toBe(nodes.start);
  });

  it("throws for an id absent from the node map", () => {
    expect(() => requireNode(nodes, "nowhere")).toThrow();
  });

  it("throws for an id colliding with an inherited Object.prototype member, not returning it", () => {
    expect(() => requireNode(nodes, "toString")).toThrow();
  });

  it("returns a node genuinely declared under a prototype-colliding id", () => {
    const withProtoId: Record<string, Node> = JSON.parse(
      '{"toString":{"id":"toString","kind":"ending","textKey":"t","endingId":"e1"}}',
    ) as Record<string, Node>;
    const node = requireNode(withProtoId, "toString");
    expect(node.id).toBe("toString");
  });
});
