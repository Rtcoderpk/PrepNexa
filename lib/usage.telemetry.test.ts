import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Lifted mocks so we can assert which client path is used.
const sessionClient = vi.hoisted(() => ({
  from: vi.fn(),
}));
const adminClient = vi.hoisted(() => ({
  from: vi.fn(),
}));
const insertMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const serviceRolePresent = vi.hoisted(() => ({ value: false }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => sessionClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (!serviceRolePresent.value) throw new Error("Missing service-role key");
    return adminClient;
  },
}));

async function loadUsage() {
  return import("@/lib/usage");
}

describe("telemetry session-client fallback (no service-role key)", () => {
  beforeEach(() => {
    vi.resetModules();
    serviceRolePresent.value = false;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    sessionClient.from.mockClear();
    adminClient.from.mockClear();
    insertMock.mockClear().mockResolvedValue({ error: null });
    sessionClient.from.mockReturnValue({ insert: insertMock });
    adminClient.from.mockReturnValue({ insert: insertMock });
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    serviceRolePresent.value = false;
  });

  it("uses the session client when SUPABASE_SERVICE_ROLE_KEY is absent", async () => {
    const { logAiUsage } = await loadUsage();
    await logAiUsage({ task: "interview_question", provider: "groq" });
    expect(sessionClient.from).toHaveBeenCalledWith("ai_usage_logs");
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it("persists token fields when supplied (nullable telemetry)", async () => {
    const { logAiUsage } = await loadUsage();
    await logAiUsage({
      task: "interview_question",
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
    });
    const insertArg = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.prompt_tokens).toBe(100);
    expect(insertArg.completion_tokens).toBe(40);
    expect(insertArg.total_tokens).toBe(140);
  });

  it("persists null token fields when usage is absent (request still succeeds)", async () => {
    const { logAiUsage } = await loadUsage();
    await logAiUsage({ task: "interview_question" });
    const insertArg = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.prompt_tokens).toBeNull();
    expect(insertArg.completion_tokens).toBeNull();
    expect(insertArg.total_tokens).toBeNull();
  });

  it("does not throw when telemetry insert fails (non-critical accounting)", async () => {
    const { logAiUsage } = await loadUsage();
    insertMock.mockRejectedValue(new Error("db down"));
    await expect(
      logAiUsage({ task: "interview_question" }),
    ).resolves.toBeUndefined();
  });
});

describe("telemetry with service-role key present", () => {
  beforeEach(async () => {
    serviceRolePresent.value = true;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-role";
    vi.resetModules();
    sessionClient.from.mockClear();
    adminClient.from.mockClear();
    insertMock.mockClear().mockResolvedValue({ error: null });
    sessionClient.from.mockReturnValue({ insert: insertMock });
    adminClient.from.mockReturnValue({ insert: insertMock });
    // Re-import so the getEnv snapshot / client resolution is fresh.
    await vi.dynamicImportSettled();
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    serviceRolePresent.value = false;
  });

  it("prefers the admin client when a service-role key exists", async () => {
    // tryGetAdmin is read per-call; re-import the module fresh.
    const { logAiUsage } = await import("@/lib/usage");
    await logAiUsage({ task: "resume_analysis" });
    expect(adminClient.from).toHaveBeenCalled();
  });
});