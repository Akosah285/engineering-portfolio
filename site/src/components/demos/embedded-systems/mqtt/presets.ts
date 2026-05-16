import type { Qos, Subscription } from "./algorithm";

export type ScenarioSlug =
  | "qos0-fire-forget"
  | "qos1-with-ack"
  | "qos2-handshake"
  | "no-match";

export interface Scenario {
  slug: ScenarioSlug;
  name: string;
  topic: string;
  payload: string;
  publishQos: Qos;
  subscription: Subscription;
  messageId: number;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    slug: "qos0-fire-forget",
    name: "QoS 0 fire-forget",
    topic: "sensors/temp",
    payload: "22.5",
    publishQos: 0,
    subscription: { filter: "sensors/+", qos: 0 },
    messageId: 1,
  },
  {
    slug: "qos1-with-ack",
    name: "QoS 1 ack",
    topic: "alerts/door",
    payload: "OPEN",
    publishQos: 1,
    subscription: { filter: "alerts/#", qos: 1 },
    messageId: 2,
  },
  {
    slug: "qos2-handshake",
    name: "QoS 2 handshake",
    topic: "cmd/reboot",
    payload: "now",
    publishQos: 2,
    subscription: { filter: "cmd/reboot", qos: 2 },
    messageId: 3,
  },
  {
    slug: "no-match",
    name: "No match",
    topic: "lights/kitchen",
    payload: "ON",
    publishQos: 1,
    subscription: { filter: "sensors/+", qos: 1 },
    messageId: 4,
  },
] as const;

export const SCENARIO_SLUGS = SCENARIOS.map((s) => s.slug) as readonly ScenarioSlug[];

export function getScenario(slug: ScenarioSlug): Scenario {
  const found = SCENARIOS.find((s) => s.slug === slug);
  if (!found) throw new Error(`unknown scenario: ${slug}`);
  return found;
}
