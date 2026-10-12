import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const handoff = readFileSync(new URL("../docs/AI-HANDOFF-RULES.md", import.meta.url), "utf8");
const builder = readFileSync(new URL("../scripts/opt_fresh_arrivals.py", import.meta.url), "utf8");
const verifier = readFileSync(new URL("../scripts/verify_opt_fresh_arrivals.py", import.meta.url), "utf8");

test("opt fresh arrivals remain a mandatory first virtual group", () => {
  for (const source of [agents, handoff]) {
    assert.match(source, /group-fresh-arrivals/);
    assert.match(source, /10[\s\u00a0]*000/);
    assert.match(source, /14/);
  }
  assert.match(builder, /GROUP_ID = "group-fresh-arrivals"/);
  assert.match(builder, /LARGE_RECEIPT_USD = 10_000\.0/);
  assert.match(builder, /LARGE_CLUSTER_GAP_DAYS = 14/);
  assert.match(builder, /merge_receipt_document_sets/);
  assert.match(builder, /action="append"/);
  assert.match(verifier, /Fresh arrivals is not the first group/);
  assert.match(verifier, /Base 1C groups or their order changed/);
  assert.match(verifier, /Fresh-arrivals audit is stale/);
  assert.match(verifier, /Sequential 1C report snapshots were not merged/);
});
