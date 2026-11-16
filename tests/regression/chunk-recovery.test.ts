import { describe, expect, test } from "bun:test";
import {
  installChunkErrorRecovery,
  isDynamicImportError,
  recoverFromDynamicImportError,
  reloadForStaleChunk,
} from "../../src/lib/chunk-recovery";

class FakeWindow extends EventTarget {
  readonly values = new Map<string, string>();
  reloads = 0;
  storageThrows = false;

  readonly sessionStorage = {
    getItem: (key: string) => {
      if (this.storageThrows) throw new Error("Storage unavailable");
      return this.values.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (this.storageThrows) throw new Error("Storage unavailable");
      this.values.set(key, value);
    },
  };

  readonly location = {
    reload: () => {
      this.reloads += 1;
    },
  };
}

function browser() {
  return new FakeWindow() as FakeWindow & Window;
}

describe("stale chunk recovery", () => {
  test("recognises browser and bundler dynamic-import failures", () => {
    expect(
      isDynamicImportError(
        new Error("Failed to fetch dynamically imported module: /assets/join-old.js"),
      ),
    ).toBe(true);
    expect(isDynamicImportError(new Error("Importing a module script failed."))).toBe(true);
    expect(isDynamicImportError(new Error("Unable to preload CSS for /assets/join-old.css"))).toBe(
      true,
    );
    expect(isDynamicImportError(new Error("Database unavailable"))).toBe(false);
  });

  test("a Vite preload failure reloads once and is consumed", () => {
    const target = browser();
    const remove = installChunkErrorRecovery(target);
    const event = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(event);
    expect(target.reloads).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    remove();
  });

  test("a repeated failure within 30 seconds reaches the existing error page", () => {
    const target = browser();
    const remove = installChunkErrorRecovery(target);
    target.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    const repeated = new Event("vite:preloadError", { cancelable: true });
    target.dispatchEvent(repeated);
    expect(target.reloads).toBe(1);
    expect(repeated.defaultPrevented).toBe(false);
    remove();
  });

  test("another recovery is allowed after 30 seconds", () => {
    const target = browser();
    expect(reloadForStaleChunk(target, 100_000)).toBe(true);
    expect(reloadForStaleChunk(target, 129_999)).toBe(false);
    expect(reloadForStaleChunk(target, 130_000)).toBe(true);
    expect(target.reloads).toBe(2);
  });

  test("router lazy-import failures use the same guard", () => {
    const target = browser();
    const error = new Error("Failed to fetch dynamically imported module");
    expect(recoverFromDynamicImportError(error, target)).toBe(true);
    expect(recoverFromDynamicImportError(error, target)).toBe(false);
    expect(target.reloads).toBe(1);
  });

  test("blocked sessionStorage never causes a reload loop", () => {
    const target = browser();
    target.storageThrows = true;
    expect(reloadForStaleChunk(target)).toBe(false);
    expect(reloadForStaleChunk(target)).toBe(false);
    expect(target.reloads).toBe(0);
  });
});
