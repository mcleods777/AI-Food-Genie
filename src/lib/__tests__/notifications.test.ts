import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock web-push
const mockSendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

// Mock prisma
const mockPrismaFindMany = vi.fn();
const mockPrismaDelete = vi.fn();
const mockPrismaFindUnique = vi.fn();
const mockPrismaCreate = vi.fn();

vi.mock("../db", () => ({
  prisma: {
    pushSubscription: {
      findMany: (...args: unknown[]) => mockPrismaFindMany(...args),
      delete: (...args: unknown[]) => mockPrismaDelete(...args),
    },
    notificationPreference: {
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
      create: (...args: unknown[]) => mockPrismaCreate(...args),
    },
  },
}));

describe("sendPushNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set VAPID keys so the function doesn't skip
    process.env.VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY = "test-private-key";
  });

  it("sends to all subscriptions and returns count", async () => {
    mockPrismaFindMany.mockResolvedValue([
      { id: "1", endpoint: "https://push.example.com/1", keysP256dh: "key1", keysAuth: "auth1" },
      { id: "2", endpoint: "https://push.example.com/2", keysP256dh: "key2", keysAuth: "auth2" },
    ]);
    mockSendNotification.mockResolvedValue({});

    const { sendPushNotification } = await import("../notifications");
    const result = await sendPushNotification({ title: "Test", body: "Body" });

    expect(result.sent).toBe(2);
    expect(result.cleaned).toBe(0);
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it("returns zero when no subscriptions exist", async () => {
    mockPrismaFindMany.mockResolvedValue([]);

    const { sendPushNotification } = await import("../notifications");
    const result = await sendPushNotification({ title: "Test", body: "Body" });

    expect(result.sent).toBe(0);
    expect(result.cleaned).toBe(0);
  });

  it("cleans up stale subscriptions on HTTP 410", async () => {
    mockPrismaFindMany.mockResolvedValue([
      { id: "1", endpoint: "https://push.example.com/stale", keysP256dh: "key1", keysAuth: "auth1" },
    ]);
    mockSendNotification.mockRejectedValue({ statusCode: 410 });
    mockPrismaDelete.mockResolvedValue({});

    const { sendPushNotification } = await import("../notifications");
    const result = await sendPushNotification({ title: "Test", body: "Body" });

    expect(result.sent).toBe(0);
    expect(result.cleaned).toBe(1);
    expect(mockPrismaDelete).toHaveBeenCalledWith({ where: { id: "1" } });
  });

  it("cleans up on HTTP 404 as well", async () => {
    mockPrismaFindMany.mockResolvedValue([
      { id: "2", endpoint: "https://push.example.com/gone", keysP256dh: "key1", keysAuth: "auth1" },
    ]);
    mockSendNotification.mockRejectedValue({ statusCode: 404 });
    mockPrismaDelete.mockResolvedValue({});

    const { sendPushNotification } = await import("../notifications");
    const result = await sendPushNotification({ title: "Test", body: "Body" });

    expect(result.cleaned).toBe(1);
  });

  it("does not clean up on other errors", async () => {
    mockPrismaFindMany.mockResolvedValue([
      { id: "3", endpoint: "https://push.example.com/err", keysP256dh: "key1", keysAuth: "auth1" },
    ]);
    mockSendNotification.mockRejectedValue({ statusCode: 500 });

    const { sendPushNotification } = await import("../notifications");
    const result = await sendPushNotification({ title: "Test", body: "Body" });

    expect(result.sent).toBe(0);
    expect(result.cleaned).toBe(0);
    expect(mockPrismaDelete).not.toHaveBeenCalled();
  });

  it("skips when VAPID keys are not configured", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    // Re-import to pick up env change
    vi.resetModules();
    const { sendPushNotification } = await import("../notifications");
    const result = await sendPushNotification({ title: "Test", body: "Body" });

    expect(result.sent).toBe(0);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});

describe("notifyUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY = "test-private-key";
  });

  it("sends push when pushEnabled is true", async () => {
    mockPrismaFindUnique.mockResolvedValue({
      userId: "default",
      pushEnabled: true,
      smsEnabled: false,
    });
    mockPrismaFindMany.mockResolvedValue([
      { id: "1", endpoint: "https://push.example.com/1", keysP256dh: "key1", keysAuth: "auth1" },
    ]);
    mockSendNotification.mockResolvedValue({});

    const { notifyUser } = await import("../notifications");
    await notifyUser("Tonight: Pasta", "15 min · 3 ingredients.");

    expect(mockSendNotification).toHaveBeenCalledTimes(1);
  });

  it("skips push when pushEnabled is false", async () => {
    mockPrismaFindUnique.mockResolvedValue({
      userId: "default",
      pushEnabled: false,
      smsEnabled: false,
    });

    const { notifyUser } = await import("../notifications");
    await notifyUser("Tonight: Pasta", "15 min");

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("creates default preferences if none exist", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);
    mockPrismaCreate.mockResolvedValue({
      userId: "default",
      pushEnabled: false,
      smsEnabled: false,
    });

    const { notifyUser } = await import("../notifications");
    await notifyUser("Test", "Body");

    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: { userId: "default", pushEnabled: false },
    });
  });
});
