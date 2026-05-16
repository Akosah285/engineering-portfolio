// MQTT message flow — topic matching, QoS handshake, retained messages.
// Reference: OASIS MQTT 3.1.1 spec, §3 (Control Packets) and §4.3 (QoS levels).
//
// Topic level separator: "/"
// Single-level wildcard: "+"
// Multi-level wildcard:  "#" (only at end)
//
// QoS levels:
//   0 — at most once: publisher → broker → subscriber (fire-and-forget)
//   1 — at least once: PUBLISH + PUBACK
//   2 — exactly once: PUBLISH + PUBREC + PUBREL + PUBCOMP

export type Qos = 0 | 1 | 2;

export interface PublishEvent {
  kind: "PUBLISH" | "PUBACK" | "PUBREC" | "PUBREL" | "PUBCOMP";
  from: "publisher" | "broker" | "subscriber";
  to: "publisher" | "broker" | "subscriber";
  topic: string;
  payload?: string;
  qos: Qos;
  messageId?: number;
}

export interface Subscription {
  filter: string;
  qos: Qos;
}

const SEP = "/";

function validateTopic(topic: string): void {
  if (topic.length === 0) {
    throw new RangeError("topic: must not be empty");
  }
  if (topic.includes("+") || topic.includes("#")) {
    throw new RangeError("topic (publish target): wildcards not allowed");
  }
}

function validateFilter(filter: string): void {
  if (filter.length === 0) {
    throw new RangeError("filter: must not be empty");
  }
  const parts = filter.split(SEP);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (p === "#" && i !== parts.length - 1) {
      throw new RangeError("filter: '#' must be the final level");
    }
    if (p.includes("#") && p !== "#") {
      throw new RangeError("filter: '#' cannot mix with other characters in a level");
    }
    if (p.includes("+") && p !== "+") {
      throw new RangeError("filter: '+' cannot mix with other characters in a level");
    }
  }
}

export function topicMatches(filter: string, topic: string): boolean {
  validateFilter(filter);
  validateTopic(topic);
  const fparts = filter.split(SEP);
  const tparts = topic.split(SEP);
  for (let i = 0; i < fparts.length; i++) {
    const f = fparts[i]!;
    if (f === "#") return true;
    const t = tparts[i];
    if (t === undefined) return false;
    if (f === "+") continue;
    if (f !== t) return false;
  }
  return fparts.length === tparts.length;
}

// Build the per-subscriber event sequence for a single publish.
export function publishFlow(args: {
  topic: string;
  payload: string;
  publishQos: Qos;
  subscription: Subscription;
  messageId: number;
}): PublishEvent[] {
  validateTopic(args.topic);
  validateFilter(args.subscription.filter);
  if (!topicMatches(args.subscription.filter, args.topic)) {
    return [];
  }
  // Effective QoS is min(publish QoS, subscription QoS) per MQTT spec.
  const qos = Math.min(args.publishQos, args.subscription.qos) as Qos;
  const events: PublishEvent[] = [];
  const base = {
    topic: args.topic,
    payload: args.payload,
    qos,
    messageId: args.messageId,
  };

  // Publisher → Broker
  events.push({
    kind: "PUBLISH",
    from: "publisher",
    to: "broker",
    ...base,
  });
  if (qos === 1) {
    events.push({ kind: "PUBACK", from: "broker", to: "publisher", ...base });
  } else if (qos === 2) {
    events.push({ kind: "PUBREC", from: "broker", to: "publisher", ...base });
    events.push({ kind: "PUBREL", from: "publisher", to: "broker", ...base });
    events.push({ kind: "PUBCOMP", from: "broker", to: "publisher", ...base });
  }

  // Broker → Subscriber (mirrored)
  events.push({ kind: "PUBLISH", from: "broker", to: "subscriber", ...base });
  if (qos === 1) {
    events.push({ kind: "PUBACK", from: "subscriber", to: "broker", ...base });
  } else if (qos === 2) {
    events.push({ kind: "PUBREC", from: "subscriber", to: "broker", ...base });
    events.push({ kind: "PUBREL", from: "broker", to: "subscriber", ...base });
    events.push({ kind: "PUBCOMP", from: "subscriber", to: "broker", ...base });
  }
  return events;
}

// Retained-message store: last publish to a topic is held; new subscribers
// receive it immediately on subscribe.
export interface RetainedStore {
  set(topic: string, payload: string): void;
  get(topic: string): string | undefined;
  matchSubscribe(filter: string): Array<{ topic: string; payload: string }>;
  clear(topic: string): void;
}

export function createRetainedStore(): RetainedStore {
  const store = new Map<string, string>();
  return {
    set(topic, payload) {
      validateTopic(topic);
      store.set(topic, payload);
    },
    get(topic) {
      validateTopic(topic);
      return store.get(topic);
    },
    matchSubscribe(filter) {
      validateFilter(filter);
      const out: Array<{ topic: string; payload: string }> = [];
      for (const [topic, payload] of store.entries()) {
        if (topicMatches(filter, topic)) {
          out.push({ topic, payload });
        }
      }
      return out;
    },
    clear(topic) {
      validateTopic(topic);
      store.delete(topic);
    },
  };
}
