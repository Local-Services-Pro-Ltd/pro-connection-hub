import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { AREA_POSTCODE_PREFIXES } from "../../src/lib/postcode-gate";

// The newest migration defining area_slugs_for_postcode is what production runs.
function sqlPrefixMap(): Record<string, string[]> {
  const dir = "drizzle/migrations";
  const file = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
    .find((f) => readFileSync(`${dir}/${f}`, "utf8").includes("area_slugs_for_postcode"));
  assert.ok(file, "no migration defines area_slugs_for_postcode");
  const sql = readFileSync(`${dir}/${file}`, "utf8");
  const block = sql.split("-- area-prefix-map:start")[1]?.split("-- area-prefix-map:end")[0];
  assert.ok(block, "prefix map markers missing");
  const map: Record<string, string[]> = {};
  for (const m of block.matchAll(/'([a-z]+)',\s*ARRAY\[([^\]]*)\]/g)) {
    map[m[1]] = [...m[2].matchAll(/'([A-Z]+)'/g)].map((x) => x[1]);
  }
  return map;
}

test("SQL area prefix map matches postcode-gate.ts exactly", () => {
  const sql = sqlPrefixMap();
  assert.deepEqual(Object.keys(sql).sort(), Object.keys(AREA_POSTCODE_PREFIXES).sort());
  for (const [slug, prefixes] of Object.entries(AREA_POSTCODE_PREFIXES)) {
    assert.deepEqual([...sql[slug]].sort(), [...prefixes].sort(), slug);
  }
});
