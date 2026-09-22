import { parse } from "./parse.js";

// AGENTS.md §Phase 2 acceptance: 3 mock emails (booking, complication→high, spam)
const cases: Array<{ name: string; text: string; expectIntent: string; expectUrgency: string }> = [
  {
    name: "booking",
    text: "Hi, I'd like to book a cleaning next week. Are you available Tuesday? Thanks!",
    expectIntent: "booking_request",
    expectUrgency: "low",
  },
  {
    name: "complication",
    text: "Hi, my tooth hurts badly after extraction yesterday, bleeding won't stop",
    expectIntent: "post_op_complication",
    expectUrgency: "high",
  },
  {
    name: "spam",
    text: "Congratulations WINNER! Click here to claim your free crypto lottery inheritance now!",
    expectIntent: "spam",
    expectUrgency: "low",
  },
];

let failed = 0;
for (const c of cases) {
  const out = parse(c.text, "test@example.com");
  const ok = out.intent === c.expectIntent && out.urgency === c.expectUrgency;
  console.log(`${ok ? "PASS" : "FAIL"} [${c.name}] intent=${out.intent} urgency=${out.urgency} action=${out.suggested_action}`);
  console.log(`  summary: ${out.summary}`);
  if (!ok) {
    console.log(`  expected intent=${c.expectIntent} urgency=${c.expectUrgency}`);
    failed++;
  }
}
if (failed > 0) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("All 3 mock cases passed.");
