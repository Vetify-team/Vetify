import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearTourPending,
  isTourPending,
  markTourPending,
  subscribeTourPending,
  tourPendingKey,
  tourSteps,
} from "../src/lib/tour";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("tour pending mark", () => {
  it("is set per user and cleared on demand, notifying subscribers", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("window", new EventTarget());
    const changes = vi.fn();
    const unsubscribe = subscribeTourPending(changes);

    markTourPending("u1");
    expect(localStorage.getItem(tourPendingKey("u1"))).toBe("1");
    expect(isTourPending("u1")).toBe(true);
    expect(isTourPending("u2")).toBe(false);
    clearTourPending("u1");
    expect(isTourPending("u1")).toBe(false);
    expect(changes).toHaveBeenCalledTimes(2);

    unsubscribe();
    markTourPending("u1");
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it("skips the tour when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => markTourPending("u1")).not.toThrow();
    expect(isTourPending("u1")).toBe(false);
  });
});

describe("tour steps", () => {
  it("points the owner at their pet or at the empty state", () => {
    expect(tourSteps("owner", { petName: "Luna" })[0]).toMatchObject({
      target: "pet-list",
      title: "El expediente de Luna",
    });
    expect(tourSteps("owner", { petName: null })[0].target).toBe("pet-empty");
    expect(tourSteps("clinic", { petName: null }).map((s) => s.target)).toEqual([
      "clinic-status",
      "nav-pacientes",
      "nav-vencidos",
      "nav-codigo",
    ]);
  });
});
