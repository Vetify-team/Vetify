import { afterEach, describe, expect, it, vi } from "vitest";
import { checkFile, uploadFile } from "../src/lib/upload";

afterEach(() => vi.unstubAllGlobals());

const MB = 1024 * 1024;
const fileOf = (type: string, size: number, name = "x") =>
  new File([new Uint8Array(size)], name, { type });

describe("checkFile", () => {
  it("accepts the purpose's types within its size", () => {
    expect(checkFile(fileOf("image/png", 1000), "pet_photo")).toBeNull();
    expect(checkFile(fileOf("application/pdf", 1000), "exam_file")).toBeNull();
  });

  it("explains the wrong type, the size limit and empty files in Spanish", () => {
    expect(checkFile(fileOf("application/pdf", 1000), "pet_photo")).toMatch(
      /^Ese tipo de archivo no se permite\. Usá JPG, PNG, WEBP o HEIC, hasta 5 MB\./,
    );
    expect(checkFile(fileOf("image/svg+xml", 10), "exam_file")).toMatch(/no se permite/);
    expect(checkFile(fileOf("image/png", 5 * MB + 1), "pet_photo")).toBe(
      "El archivo pesa más de 5 MB.",
    );
    expect(checkFile(fileOf("application/pdf", 10 * MB + 1), "exam_file")).toBe(
      "El archivo pesa más de 10 MB.",
    );
    expect(checkFile(fileOf("image/png", 0), "pet_photo")).toBe("El archivo está vacío.");
  });
});

/** Minimal XMLHttpRequest that answers like the storage service. */
function fakeXhr(status: number, responseText: string) {
  const sent: { url?: string; body?: FormData } = {};
  class FakeXhr {
    status = status;
    responseText = responseText;
    upload: { onprogress?: (e: ProgressEvent) => void } = {};
    onload?: () => void;
    onerror?: () => void;
    open(_method: string, url: string) {
      sent.url = url;
    }
    send(body: FormData) {
      sent.body = body;
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 1,
        total: 2,
      } as ProgressEvent);
      this.onload?.();
    }
  }
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  return sent;
}

const ticket = {
  url: "https://api.cloudinary.com/v1_1/demo/image/upload",
  fields: { api_key: "k", signature: "s", public_id: "pets/p/photo/f", timestamp: "1" },
  fileId: "pets/p/photo/f",
  maxBytes: 5 * MB,
  expiresAt: "2026-11-11T00:00:00.000Z",
};

describe("uploadFile", () => {
  it("posts the signed fields and the file, reports progress and returns the id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(ticket, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const sent = fakeXhr(200, "{}");
    const progress: number[] = [];
    const file = fileOf("image/png", 1000, "michi.png");

    await expect(
      uploadFile("p", "pet_photo", file, (p) => progress.push(p)),
    ).resolves.toBe("pets/p/photo/f");

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/v1/pets/p/uploads");
    expect(JSON.parse(init.body as string)).toEqual({
      purpose: "pet_photo",
      contentType: "image/png",
      size: 1000,
    });
    expect(sent.url).toBe(ticket.url);
    expect(sent.body?.get("signature")).toBe("s");
    expect(sent.body?.get("public_id")).toBe("pets/p/photo/f");
    expect((sent.body?.get("file") as File).name).toBe("michi.png");
    expect(progress).toEqual([50, 100]);
  });

  it("does not ask for a signature for a file it already knows is wrong", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      uploadFile("p", "pet_photo", fileOf("text/html", 10), () => {}),
    ).rejects.toThrow(/no se permite/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("words API and storage rejections in Spanish", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { code: "BAD_REQUEST", message: "x", reason: "FILE_TOO_LARGE" },
            { status: 400 },
          ),
        ),
    );
    await expect(
      uploadFile("p", "pet_photo", fileOf("image/png", 10), () => {}),
    ).rejects.toThrow("El archivo es demasiado grande.");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(ticket, { status: 201 })),
    );
    fakeXhr(400, '{"error":{"message":"Image file format pdf not allowed"}}');
    await expect(
      uploadFile("p", "pet_photo", fileOf("image/png", 10), () => {}),
    ).rejects.toThrow(/no se permite/);
  });
});
