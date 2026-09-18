import { test } from "node:test";
import assert from "node:assert/strict";
import { googleReturnUrl, safeAuthDestination, usesLovableAuth } from "../../src/lib/auth-redirect";
import { isLiveArea, liveAreaFor, liveAreasFor } from "../../src/lib/postcode-gate";

test("self-hosted domains bypass the Lovable-only OAuth proxy", () => {
  for (const host of ["pro-connection-hub.pages.dev", "tradesmanfinder.org", "www.tradesmanfinder.org"])
    assert.equal(usesLovableAuth(host), false);
  assert.equal(usesLovableAuth("example.lovable.app"), true);
  assert.equal(usesLovableAuth("example.lovableproject.com"), true);
  assert.equal(usesLovableAuth("lovable.app.evil.example"), false);
});

test("OAuth returns to the same host and preserves an internal destination", () => {
  const url = new URL(googleReturnUrl("https://pro-connection-hub.pages.dev", "/dashboard?tab=plan"));
  assert.equal(url.origin, "https://pro-connection-hub.pages.dev");
  assert.equal(url.pathname, "/signin");
  assert.equal(url.searchParams.get("redirect"), "/dashboard?tab=plan");
  for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "/\nevil.example", null])
    assert.equal(safeAuthDestination(bad), "/account");
});

test("all eight launched regions accept representative postcodes", () => {
  const samples = {
    london: "SE18 7JH", kent: "ME14 1XQ", surrey: "GU1 1AA",
    berkshire: "RG1 1AA", manchester: "M1 1AE", birmingham: "B1 1AA",
    bristol: "BS1 1AA", leeds: "LS1 1AA",
  };
  const areas = Object.keys(samples).map(slug => ({slug, status:"live"}));
  for (const [slug, postcode] of Object.entries(samples)) {
    assert.equal(isLiveArea(postcode, areas), true, postcode);
    assert.equal(liveAreaFor(postcode, areas), slug);
  }
  assert.equal(isLiveArea("CF10 1AA", areas), false);
  assert.equal(isLiveArea("", areas), false);
  assert.equal(isLiveArea("M1 1AE", []), false);
  assert.equal(isLiveArea("M1 1AE", [{slug:"manchester",status:"coming_soon"}]), false);
});

test("overlapping postcode coverage respects live status and input normalisation", () => {
  const areas = [{slug:"london",status:"live"}, {slug:"surrey",status:"live"}];
  assert.deepEqual(liveAreasFor("cr0 1aa", areas), ["london","surrey"]);
  assert.equal(isLiveArea("LS1 1AA", [{slug:"london",status:"live"}]), false);
});
