import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendOrderSelection } from "app/commons/orders/OrderSelection";
import { SettingsRepository } from "../settings/SettingsRepository.server";
import { handleStartOrdersJob } from "./handleStartOrdersJob.server";
import { startBackgroundJob } from "./startBackgroundJob.server";

vi.mock("app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(async () => ({
      admin: {},
      session: { shop: "timoce.myshopify.com" },
    })),
  },
}));
vi.mock("../settings/SettingsRepository.server", () => ({
  SettingsRepository: { get: vi.fn() },
}));
vi.mock("../packs/PackRepository.server", () => ({
  PackRepository: {
    getOrThrow: vi.fn(async () => ({})),
    getOrderIds: vi.fn(async () => ["gid://shopify/Order/1"]),
  },
}));
vi.mock("./createJobAdmin.server", () => ({ createJobAdmin: vi.fn() }));
vi.mock("./startBackgroundJob.server", () => ({
  startBackgroundJob: vi.fn(() => ({ isStarted: true, jobId: "job-1" })),
}));

const DEFINITION = {
  job: "print-labels" as const,
  title: "Print labels",
  buildArtifact: vi.fn(),
};

function jobRequest(packId?: string): Request {
  const formData = new FormData();
  appendOrderSelection(formData, {
    mode: "ids",
    orderIds: ["gid://shopify/Order/1"],
    ...(packId ? { packId } : {}),
  });
  return new Request("https://app.test/app/orders-dashboard/print-labels", {
    method: "POST",
    body: formData,
  });
}

describe("handleStartOrdersJob with jobs only in packs", () => {
  beforeEach(() => {
    vi.mocked(startBackgroundJob).mockClear();
    vi.mocked(SettingsRepository.get).mockResolvedValue({
      jobsOnlyInPacks: true,
    } as Awaited<ReturnType<typeof SettingsRepository.get>>);
  });

  it("refuses a job started from the Orders page", async () => {
    const response = await handleStartOrdersJob(jobRequest(), DEFINITION);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error:
        "Add tracking and print labels only run from a pack. Open the pack on the Packs page.",
    });
    expect(startBackgroundJob).not.toHaveBeenCalled();
  });

  it("starts a job picked inside a pack", async () => {
    const response = await handleStartOrdersJob(
      jobRequest("pack-1"),
      DEFINITION,
    );

    expect(response.status).toBe(202);
    expect(startBackgroundJob).toHaveBeenCalledOnce();
  });

  it("starts a job from the Orders page while the setting is off", async () => {
    vi.mocked(SettingsRepository.get).mockResolvedValue({
      jobsOnlyInPacks: false,
    } as Awaited<ReturnType<typeof SettingsRepository.get>>);

    const response = await handleStartOrdersJob(jobRequest(), DEFINITION);
    expect(response.status).toBe(202);
  });
});
