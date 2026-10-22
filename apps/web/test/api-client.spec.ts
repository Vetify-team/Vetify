import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/lib/api-client";

afterEach(() => vi.unstubAllGlobals());

describe("browser write retries", () => {
  it("reuses the operation key after a lost response and a proxy error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Connection lost after commit"))
      .mockResolvedValueOnce(Response.json({ id: "original" }))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(Response.json({ id: "second" }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient("/api/v1");
    await expect(
      client.recordEntry("pet", "weightEntries", { weightKg: 10 }),
    ).resolves.toEqual({
      id: "original",
    });
    await expect(
      client.recordEntry("pet", "weightEntries", { weightKg: 11 }),
    ).resolves.toEqual({
      id: "second",
    });
    const keys = fetchMock.mock.calls.map(
      ([, options]) => options.headers["Idempotency-Key"],
    );
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).toBe(keys[3]);
    expect(keys[0]).not.toBe(keys[2]);
  });

  it("preserves an explicit intent key across manual retries", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => Response.json({ id: "original" }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient("/api/v1");
    await client.createPet(
      { name: "Pet", species: "dog", neutered: false },
      "same-intent-operation-key",
    );
    await client.createPet(
      { name: "Pet", species: "dog", neutered: false },
      "same-intent-operation-key",
    );
    expect(
      fetchMock.mock.calls.map(([, options]) => options.headers["Idempotency-Key"]),
    ).toEqual(["same-intent-operation-key", "same-intent-operation-key"]);
  });

  it("never automatically retries refresh or non-keyed requests", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Connection lost"));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient("/api/v1");
    await expect(client.refresh()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(
      client.grantPermission("pet", { code: "ABCDEFGH", scope: "full" }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a conflict and keeps the key through an access-token refresh", async () => {
    const session = { accessToken: "expired", user: { id: "owner" } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(session))
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ ...session, accessToken: "renewed" }))
      .mockResolvedValueOnce(Response.json({ id: "original" }))
      .mockResolvedValueOnce(
        Response.json({ code: "IDEMPOTENCY_CONFLICT" }, { status: 409 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient("/api/v1");
    await client.login({ email: "test@example.test", password: "password" });
    await client.recordEntry("pet", "weightEntries", { weightKg: 10 });
    const before = fetchMock.mock.calls[1][1];
    const after = fetchMock.mock.calls[3][1];
    expect(before.headers["Idempotency-Key"]).toBe(after.headers["Idempotency-Key"]);
    expect(after.headers.Authorization).toBe("Bearer renewed");
    await expect(
      client.recordEntry("pet", "weightEntries", { weightKg: 11 }),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe("record entries", () => {
  it("posts each section to its existing endpoint", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ id: "entry" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient("/api/v1");
    const sections = [
      ["consultations", "consultations"],
      ["vaccinations", "vaccinations"],
      ["dewormings", "dewormings"],
      ["treatments", "treatments"],
      ["exams", "exams"],
      ["weightEntries", "weights"],
      ["feedingEntries", "feedings"],
    ] as const;
    for (const [section] of sections) {
      await client.recordEntry("pet", section, {} as never);
    }
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
      sections.map(([, path]) => `/api/v1/pets/pet/${path}`),
    );
  });
});
