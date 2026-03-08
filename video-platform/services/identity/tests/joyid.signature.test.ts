import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import type { JoyIDSignatureData } from "@video-platform/shared/types";

// 动态导入 server，避免端口占用；并设置随机端口
let app: any;
const API_PORT = 0;

vi.mock("@joyid/ckb", () => ({
  verifySignature: vi.fn(async () => true),
}));

// mock .bit 解析：返回固定地址，便于一致性测试
vi.mock("@video-platform/shared/web3/das", async (orig) => {
  const mod: any = await (orig as any)();
  return {
    ...mod,
    resolveBitDomain: vi.fn(async (domain: string) => ({ ckbAddress: `ckt1-${domain.replace(/\.bit$/, "")}-addr` })),
    reverseResolveAddress: vi.fn(async (addr: string) => ({ domain: null })),
  };
});

async function waitForServer() {
  const start = Date.now();
  while (!app?.server?.address()?.port) {
    await new Promise((r) => setTimeout(r, 50));
    if (Date.now() - start > 5000) throw new Error("Server not listening in time");
  }
}

async function getPort() {
  await waitForServer();
  const p = app?.server?.address()?.port;
  return p || 8080;
}

beforeAll(async () => {
  process.env.JWT_SECRET = "x".repeat(40);
  process.env.API_PORT = String(API_PORT);
  const m = await import("../src/server");
  app = (m as any).default;
  await waitForServer();
});

afterAll(async () => {
  if (app) await app.close();
});

async function postJSON(path: string, body: any) {
  const port = await getPort();
  const resp = await fetch(`http://localhost:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  try { return { ok: resp.ok, status: resp.status, json: JSON.parse(text) }; } catch { return { ok: resp.ok, status: resp.status, text }; }
}

async function getJSON(path: string) {
  const port = await getPort();
  const resp = await fetch(`http://localhost:${port}${path}`);
  const text = await resp.text();
  try { return { ok: resp.ok, status: resp.status, json: JSON.parse(text) }; } catch { return { ok: resp.ok, status: resp.status, text }; }
}

describe("JoyID real signature login", () => {
  it("should login successfully with signatureData", async () => {
    const nonce = await getJSON("/auth/joyid/nonce");
    expect(nonce.ok).toBe(true);
    const { nonceId, challenge } = nonce.json;

    const sig: JoyIDSignatureData = {
      challenge,
      message: "login",
      signature: "0xabc",
      pubkey: "0xpub",
      keyType: "secp256k1",
    };

    const bitDomain = "alice.bit";
    const address = `ckt1-${bitDomain.replace(/\.bit$/, "")}-addr`;

    const body = {
      bitDomain,
      address,
      deviceFingerprint: "dfp-123",
      signatureData: sig,
    };
    const resp = await postJSON("/auth/joyid", body);
    expect(resp.ok).toBe(true);
    expect(resp.json.jwt).toBeTruthy();
    expect(resp.json.user.bitDomain).toContain("alice");
    expect(resp.json.user.ckbAddress).toBe(address);
    expect(resp.json.offlineToken?.deviceFingerprint).toBe("dfp-123");
  });

  it("should reject reused nonce", async () => {
    const nonce = await getJSON("/auth/joyid/nonce");
    const { challenge } = nonce.json;
    const sig: JoyIDSignatureData = {
      challenge,
      message: "login",
      signature: "0xabc",
      pubkey: "0xpub",
      keyType: "secp256k1",
    };
    const body = { bitDomain: "bob.bit", deviceFingerprint: "dfp-1", signatureData: sig };
    const first = await postJSON("/auth/joyid", body);
    expect(first.ok).toBe(true);
    const second = await postJSON("/auth/joyid", body);
    expect(second.ok).toBe(false);
    expect(second.status).toBe(400);
  });

  it("should allow login when address not matching bitDomain (unbind strict)", async () => {
    const nonce = await getJSON("/auth/joyid/nonce");
    const { challenge } = nonce.json;
    const sig: JoyIDSignatureData = {
      challenge,
      message: "login",
      signature: "0xabc",
      pubkey: "0xpub",
      keyType: "secp256k1",
    };
    const body = {
      bitDomain: "carol.bit",
      address: "ckt1-other-addr",
      deviceFingerprint: "dfp-x",
      signatureData: sig,
    };
    const resp = await postJSON("/auth/joyid", body);
    expect(resp.ok).toBe(true);
    expect(resp.status).toBe(200);
    expect(resp.json.user.bitDomain).toBe("carol.bit");
    expect(resp.json.user.ckbAddress).toBe("ckt1-other-addr");
  });
});