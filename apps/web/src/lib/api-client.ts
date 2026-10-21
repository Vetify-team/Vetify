import type {
  AccessLogPage,
  Alert,
  ApiError,
  Clinic,
  Consultation,
  CreateConsultation,
  CreateDeworming,
  CreateExam,
  CreateFeedingEntry,
  CreatePet,
  CreateTreatment,
  CreateVaccination,
  CreateWeightEntry,
  Deworming,
  ErrorCode,
  Exam,
  FeedingEntry,
  GrantPermission,
  LinkCode,
  LinkCodePreview,
  LogIn,
  MedicalRecord,
  RecordQuery,
  Permission,
  PermissionWithClinic,
  Pet,
  Session,
  SignUp,
  Treatment,
  UpdatePet,
  User,
  Vaccination,
  VaccinationStatus,
  WeightEntry,
} from "@vetify/types";

/**
 * HTTP client for the Vetify API. The only place in the front end that calls
 * `fetch`: no component talks to the network on its own.
 *
 * Security model:
 * - The refresh token lives in an HttpOnly cookie set by the API; scripts can
 *   never read it, so an XSS cannot steal the session.
 * - The access token lives only in memory and is lost on reload; the session
 *   is restored by calling `refresh`, which sends the cookie.
 * - The API is reached through the web's own origin (`/api`, proxied by
 *   Next), so the cookie is first-party and SameSite=Strict works.
 *
 * It imports nothing from `next/*`, so it could be reused from apps/mobile.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "NETWORK_ERROR",
    message: string,
    readonly errors?: ApiError["errors"],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Public endpoints (login, register, refresh, logout). */
  anonymous?: boolean;
  /** Stable for this intended write, including network and authentication retries. */
  idempotencyKey?: string;
}

export class ApiClient {
  private session: Session | null = null;
  private refreshing: Promise<Session | null> | null = null;
  private readonly listeners = new Set<(session: Session | null) => void>();

  constructor(private readonly base: string = BASE) {}

  /** Notifies when the session starts, rotates or ends. Returns the unsubscribe. */
  subscribe(listener: (session: Session | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get currentSession(): Session | null {
    return this.session;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, anonymous, headers, idempotencyKey, ...rest } = options;

    const send = (token?: string) =>
      fetch(`${this.base}${path}`, {
        ...rest,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }).catch(() => {
        throw new ApiRequestError(0, "NETWORK_ERROR", "Network error");
      });

    const sendWithRetry = async (token?: string) => {
      try {
        const response = await send(token);
        if (!idempotencyKey || ![502, 503, 504].includes(response.status))
          return response;
      } catch (error) {
        if (!idempotencyKey) throw error;
      }
      // Only keyed writes are retried. Never retry a refresh token rotation.
      return send(token);
    };
    let response = await sendWithRetry(anonymous ? undefined : this.session?.accessToken);

    // A 401 with a session almost always means the access token expired:
    // refresh once and retry.
    if (response.status === 401 && !anonymous && this.session) {
      const renewed = await this.refresh();
      if (renewed) response = await sendWithRetry(renewed.accessToken);
    }

    if (!response.ok) throw await this.toError(response);
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  private async toError(response: Response): Promise<ApiRequestError> {
    try {
      const body = (await response.json()) as Partial<ApiError>;
      return new ApiRequestError(
        response.status,
        body.code ?? "INTERNAL_ERROR",
        body.message ?? "",
        body.errors,
      );
    } catch {
      return new ApiRequestError(
        response.status,
        "INTERNAL_ERROR",
        "Unexpected response",
      );
    }
  }

  private setSession(session: Session | null): void {
    this.session = session;
    for (const listener of this.listeners) listener(session);
  }

  /**
   * Rotates the refresh cookie and gets a new access token. Concurrent calls
   * share one request (two refreshes with the same cookie would look like a
   * replay to the API). Only a 401 ends the session: a 429 or a network error
   * keeps it, so a throttled refresh does not log everyone out.
   */
  refresh(): Promise<Session | null> {
    this.refreshing ??= (async () => {
      try {
        const session = await this.request<Session>("/auth/refresh", {
          method: "POST",
          anonymous: true,
        });
        this.setSession(session);
        return session;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401)
          this.setSession(null);
        return null;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** On page load: is there a session cookie? */
  restore(): Promise<Session | null> {
    return this.session ? Promise.resolve(this.session) : this.refresh();
  }

  // ---------- Auth ----------

  async register(data: SignUp): Promise<Session> {
    const session = await this.request<Session>("/auth/register", {
      method: "POST",
      body: data,
      anonymous: true,
    });
    this.setSession(session);
    return session;
  }

  async login(data: LogIn): Promise<Session> {
    const session = await this.request<Session>("/auth/login", {
      method: "POST",
      body: data,
      anonymous: true,
    });
    this.setSession(session);
    return session;
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>("/auth/logout", { method: "POST", anonymous: true });
    } finally {
      this.setSession(null);
      await clearRuntimeCaches();
    }
  }

  me(): Promise<User> {
    return this.request("/auth/me");
  }

  // ---------- Pets ----------

  pets(): Promise<Pet[]> {
    return this.request("/pets");
  }

  pet(id: string): Promise<Pet> {
    return this.request(`/pets/${id}`);
  }

  createPet(data: CreatePet, idempotencyKey: string = crypto.randomUUID()): Promise<Pet> {
    return this.request("/pets", { method: "POST", body: data, idempotencyKey });
  }

  updatePet(id: string, data: UpdatePet): Promise<Pet> {
    return this.request(`/pets/${id}`, { method: "PATCH", body: data });
  }

  // ---------- Record ----------

  record(petId: string, options?: RecordQuery): Promise<MedicalRecord> {
    const query = new URLSearchParams();
    if (options?.section) query.set("section", options.section);
    if (options?.cursor) query.set("cursor", options.cursor);
    if (options?.limit) query.set("limit", String(options.limit));
    return this.request(`/pets/${petId}/record${query.size ? `?${query}` : ""}`);
  }

  vaccinationStatus(petId: string): Promise<VaccinationStatus> {
    return this.request(`/pets/${petId}/vaccination-status`);
  }

  alerts(): Promise<Alert[]> {
    return this.request("/alerts");
  }

  recordConsultation(
    petId: string,
    data: CreateConsultation,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<Consultation> {
    return this.request(`/pets/${petId}/consultations`, {
      method: "POST",
      body: data,
      idempotencyKey,
    });
  }

  recordVaccination(
    petId: string,
    data: CreateVaccination,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<Vaccination> {
    return this.request(`/pets/${petId}/vaccinations`, {
      method: "POST",
      body: data,
      idempotencyKey,
    });
  }

  recordDeworming(
    petId: string,
    data: CreateDeworming,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<Deworming> {
    return this.request(`/pets/${petId}/dewormings`, {
      method: "POST",
      body: data,
      idempotencyKey,
    });
  }

  recordTreatment(
    petId: string,
    data: CreateTreatment,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<Treatment> {
    return this.request(`/pets/${petId}/treatments`, {
      method: "POST",
      body: data,
      idempotencyKey,
    });
  }

  recordExam(
    petId: string,
    data: CreateExam,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<Exam> {
    return this.request(`/pets/${petId}/exams`, {
      method: "POST",
      body: data,
      idempotencyKey,
    });
  }

  recordWeight(
    petId: string,
    data: CreateWeightEntry,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<WeightEntry> {
    return this.request(`/pets/${petId}/weights`, {
      method: "POST",
      body: data,
      idempotencyKey,
    });
  }

  recordFeeding(
    petId: string,
    data: CreateFeedingEntry,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<FeedingEntry> {
    return this.request(`/pets/${petId}/feedings`, {
      method: "POST",
      body: data,
      idempotencyKey,
    });
  }

  // ---------- Permissions ----------

  permissions(petId: string): Promise<PermissionWithClinic[]> {
    return this.request(`/pets/${petId}/permissions`);
  }

  grantPermission(petId: string, data: GrantPermission): Promise<PermissionWithClinic> {
    return this.request(`/pets/${petId}/permissions`, { method: "POST", body: data });
  }

  revokePermission(petId: string, permissionId: string): Promise<Permission> {
    return this.request(`/pets/${petId}/permissions/${permissionId}/revoke`, {
      method: "POST",
    });
  }

  restorePermission(petId: string, permissionId: string): Promise<Permission> {
    return this.request(`/pets/${petId}/permissions/${permissionId}/restore`, {
      method: "POST",
    });
  }

  accessLog(
    petId: string,
    options: { actor: "all" | "others"; cursor?: string },
  ): Promise<AccessLogPage> {
    const query = new URLSearchParams({ actor: options.actor, limit: "50" });
    if (options.cursor) query.set("cursor", options.cursor);
    return this.request(`/pets/${petId}/access-log?${query}`);
  }

  previewLinkCode(code: string): Promise<LinkCodePreview> {
    return this.request("/link-codes/preview", { method: "POST", body: { code } });
  }

  // ---------- Clinics and admin ----------

  myClinic(): Promise<Clinic> {
    return this.request("/clinics/mine");
  }

  issueLinkCode(): Promise<LinkCode> {
    return this.request("/clinics/mine/link-codes", { method: "POST" });
  }

  adminClinics(verified?: boolean): Promise<Clinic[]> {
    return this.request(
      `/admin/clinics${verified === undefined ? "" : `?verified=${verified}`}`,
    );
  }

  setClinicVerified(clinicId: string, verified: boolean): Promise<Clinic> {
    return this.request(
      `/admin/clinics/${clinicId}/${verified ? "verify" : "unverify"}`,
      { method: "POST" },
    );
  }
}

/**
 * Drops what the service worker cached at runtime when the session ends, so
 * the next person on a shared device finds nothing of the previous one. The
 * precache (the app shell) stays. API responses are never cached anyway.
 */
async function clearRuntimeCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const names = await caches.keys();
  await Promise.all(
    names.filter((name) => !name.includes("precache")).map((name) => caches.delete(name)),
  );
}

export const api = new ApiClient();
