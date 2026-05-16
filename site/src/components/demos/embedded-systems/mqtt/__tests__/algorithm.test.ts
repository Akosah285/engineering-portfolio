import { describe, expect, it } from "vitest";
import {
  createRetainedStore,
  publishFlow,
  topicMatches,
  type Subscription,
} from "../algorithm";

describe("topicMatches — exact", () => {
  it("matches identical topics", () => {
    expect(topicMatches("home/kitchen/temp", "home/kitchen/temp")).toBe(true);
  });

  it("rejects different topics", () => {
    expect(topicMatches("home/kitchen/temp", "home/bedroom/temp")).toBe(false);
  });

  it("rejects different topic lengths", () => {
    expect(topicMatches("home/kitchen", "home/kitchen/temp")).toBe(false);
  });
});

describe("topicMatches — single-level (+)", () => {
  it("matches one segment", () => {
    expect(topicMatches("home/+/temp", "home/kitchen/temp")).toBe(true);
    expect(topicMatches("home/+/temp", "home/bedroom/temp")).toBe(true);
  });

  it("does not span levels", () => {
    expect(topicMatches("home/+/temp", "home/kitchen/cabinet/temp")).toBe(false);
  });

  it("can match leading or trailing segments", () => {
    expect(topicMatches("+/kitchen/temp", "home/kitchen/temp")).toBe(true);
    expect(topicMatches("home/kitchen/+", "home/kitchen/temp")).toBe(true);
  });
});

describe("topicMatches — multi-level (#)", () => {
  it("matches everything below (including the parent per MQTT 3.1.1 §4.7.1.2)", () => {
    expect(topicMatches("home/#", "home/kitchen/temp")).toBe(true);
    expect(topicMatches("home/#", "home/kitchen/cabinet/temp")).toBe(true);
    expect(topicMatches("home/#", "home")).toBe(true);
  });

  it("# at root matches everything", () => {
    expect(topicMatches("#", "any/topic/here")).toBe(true);
    expect(topicMatches("#", "x")).toBe(true);
  });

  it("rejects # not at end", () => {
    expect(() => topicMatches("home/#/temp", "home/x/temp")).toThrow(RangeError);
  });

  it("rejects mixed wildcards", () => {
    expect(() => topicMatches("home/k+/temp", "home/kit/temp")).toThrow(RangeError);
    expect(() => topicMatches("home/#x", "home/x")).toThrow(RangeError);
  });
});

describe("topicMatches validation", () => {
  it("rejects empty topic", () => {
    expect(() => topicMatches("home/temp", "")).toThrow(RangeError);
  });

  it("rejects empty filter", () => {
    expect(() => topicMatches("", "home/temp")).toThrow(RangeError);
  });

  it("rejects wildcards in publish topic", () => {
    expect(() => topicMatches("home/+", "home/+")).toThrow(RangeError);
    expect(() => topicMatches("home/+", "home/#")).toThrow(RangeError);
  });
});

describe("publishFlow QoS 0", () => {
  const sub: Subscription = { filter: "home/+/temp", qos: 0 };

  it("emits exactly 2 PUBLISH events (no ack)", () => {
    const ev = publishFlow({
      topic: "home/kitchen/temp",
      payload: "22.5",
      publishQos: 0,
      subscription: sub,
      messageId: 1,
    });
    expect(ev.length).toBe(2);
    expect(ev[0]!.kind).toBe("PUBLISH");
    expect(ev[1]!.kind).toBe("PUBLISH");
  });

  it("returns [] when topic does not match subscription", () => {
    const ev = publishFlow({
      topic: "office/lobby/temp",
      payload: "20",
      publishQos: 0,
      subscription: sub,
      messageId: 1,
    });
    expect(ev).toEqual([]);
  });
});

describe("publishFlow QoS 1", () => {
  it("emits PUBLISH + PUBACK on both legs (4 events)", () => {
    const ev = publishFlow({
      topic: "home/kitchen/temp",
      payload: "22.5",
      publishQos: 1,
      subscription: { filter: "home/#", qos: 1 },
      messageId: 7,
    });
    expect(ev.length).toBe(4);
    expect(ev.map((e) => e.kind)).toEqual([
      "PUBLISH",
      "PUBACK",
      "PUBLISH",
      "PUBACK",
    ]);
  });
});

describe("publishFlow QoS 2", () => {
  it("emits full 4-step handshake on both legs (8 events)", () => {
    const ev = publishFlow({
      topic: "home/kitchen/temp",
      payload: "22.5",
      publishQos: 2,
      subscription: { filter: "home/#", qos: 2 },
      messageId: 99,
    });
    expect(ev.length).toBe(8);
    expect(ev.map((e) => e.kind)).toEqual([
      "PUBLISH",
      "PUBREC",
      "PUBREL",
      "PUBCOMP",
      "PUBLISH",
      "PUBREC",
      "PUBREL",
      "PUBCOMP",
    ]);
  });
});

describe("publishFlow effective QoS", () => {
  it("downgrades to subscription QoS when lower", () => {
    const ev = publishFlow({
      topic: "home/temp",
      payload: "20",
      publishQos: 2,
      subscription: { filter: "home/temp", qos: 0 },
      messageId: 1,
    });
    expect(ev.length).toBe(2);
    for (const e of ev) expect(e.qos).toBe(0);
  });

  it("downgrades to publisher QoS when lower", () => {
    const ev = publishFlow({
      topic: "home/temp",
      payload: "20",
      publishQos: 1,
      subscription: { filter: "home/temp", qos: 2 },
      messageId: 1,
    });
    expect(ev.length).toBe(4);
    for (const e of ev) expect(e.qos).toBe(1);
  });
});

describe("retained store", () => {
  it("stores and retrieves by exact topic", () => {
    const s = createRetainedStore();
    s.set("home/kitchen/temp", "22.5");
    expect(s.get("home/kitchen/temp")).toBe("22.5");
  });

  it("returns undefined for unknown topic", () => {
    const s = createRetainedStore();
    expect(s.get("nope")).toBeUndefined();
  });

  it("matchSubscribe returns all retained topics matching a filter", () => {
    const s = createRetainedStore();
    s.set("home/kitchen/temp", "22.5");
    s.set("home/bedroom/temp", "19.8");
    s.set("office/lobby/temp", "21.0");
    const matches = s.matchSubscribe("home/+/temp");
    expect(matches.length).toBe(2);
  });

  it("clear removes a topic", () => {
    const s = createRetainedStore();
    s.set("home/temp", "20");
    s.clear("home/temp");
    expect(s.get("home/temp")).toBeUndefined();
  });

  it("# filter returns everything", () => {
    const s = createRetainedStore();
    s.set("a", "1");
    s.set("b/c", "2");
    expect(s.matchSubscribe("#").length).toBe(2);
  });
});
