import { beforeEach, describe, expect, it, vi } from "vitest";
import { WsManager } from "@/services/websocket/WsManager";

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  send(payload: string) {
    this.sent.push(payload);
  }
}

let instances: FakeSocket[] = [];

function installFakeSocket() {
  const original = globalThis.WebSocket;
  class Tracked extends FakeSocket {
    constructor() {
      super();
      instances.push(this);
    }
  }
  // @ts-expect-error - test double
  globalThis.WebSocket = Tracked;
  return () => {
    globalThis.WebSocket = original;
  };
}

describe("WsManager", () => {
  beforeEach(() => {
    instances = [];
  });

  it("subscribes to every stream when the socket opens", () => {
    const restore = installFakeSocket();
    const manager = new WsManager({ url: "wss://example.test/ws" });
    const handler = vi.fn();
    manager.subscribe(["btcusdt@trade", "ethusdt@trade"], handler);
    manager.connect();

    const socket = instances[0];
    socket.onopen?.();

    const messages = socket.sent.map((entry) => JSON.parse(entry));
    expect(messages[0].method).toBe("SUBSCRIBE");
    expect(messages[0].params).toEqual(["btcusdt@trade", "ethusdt@trade"]);
    restore();
    manager.dispose();
  });

  it("dispatches payloads to the matching subscriber only", () => {
    const restore = installFakeSocket();
    const manager = new WsManager({ url: "wss://example.test/ws" });
    const btcHandler = vi.fn();
    const ethHandler = vi.fn();
    manager.subscribe(["btcusdt@trade"], btcHandler);
    manager.subscribe(["ethusdt@trade"], ethHandler);
    manager.connect();

    const socket = instances[0];
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({ stream: "btcusdt@trade", data: { e: "trade", p: "1" } }) });

    expect(btcHandler).toHaveBeenCalledTimes(1);
    expect(ethHandler).not.toHaveBeenCalled();
    restore();
    manager.dispose();
  });

  it("ignores malformed frames", () => {
    const restore = installFakeSocket();
    const manager = new WsManager({ url: "wss://example.test/ws" });
    const handler = vi.fn();
    manager.subscribe(["btcusdt@trade"], handler);
    manager.connect();
    const socket = instances[0];
    socket.onopen?.();
    socket.onmessage?.({ data: "not json" });
    expect(handler).not.toHaveBeenCalled();
    restore();
    manager.dispose();
  });

  it("unsubscribes and closes the socket when the last subscriber leaves", () => {
    const restore = installFakeSocket();
    const manager = new WsManager({ url: "wss://example.test/ws" });
    const handler = vi.fn();
    const unsubscribe = manager.subscribe(["btcusdt@trade"], handler);
    manager.connect();
    const socket = instances[0];
    socket.onopen?.();
    unsubscribe();
    const messages = socket.sent.map((entry) => JSON.parse(entry));
    expect(messages.some((message) => message.method === "UNSUBSCRIBE")).toBe(true);
    restore();
    manager.dispose();
  });

  it("reconnects after an unexpected close", () => {
    vi.useFakeTimers();
    const restore = installFakeSocket();
    const states: string[] = [];
    const manager = new WsManager({
      url: "wss://example.test/ws",
      reconnectBaseMs: 10,
      onStateChange: (state) => states.push(state),
    });
    manager.subscribe(["btcusdt@trade"], vi.fn());
    manager.connect();
    instances[0].onopen?.();
    instances[0].onclose?.();
    expect(states).toContain("reconnecting");
    vi.advanceTimersByTime(60);
    expect(instances.length).toBeGreaterThan(1);
    vi.useRealTimers();
    restore();
    manager.dispose();
  });
});
