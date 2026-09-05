/**
 * Live event socket (WS /ws/dashboard).
 *
 * Connects to VITE_WS_URL, reconnects with backoff and fans events out to
 * subscribers. Never reloads the page — listeners refresh their data instead.
 */
export interface ClusterEvent {
  event: string;
  timestamp: string;
  level: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  component: string;
  message: string;
  data?: Record<string, unknown>;
}

const WS_URL =
  (import.meta.env["VITE_WS_URL"] as string | undefined) ?? "ws://localhost:8000/ws/dashboard";

type Listener = (event: ClusterEvent) => void;

class ClusterSocket {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  connected = false;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
    };
  }

  connect() {
    if (typeof window === "undefined") return;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;

    try {
      const socket = new WebSocket(WS_URL);
      this.socket = socket;

      socket.onopen = () => {
        this.connected = true;
        this.attempts = 0;
      };
      socket.onmessage = (raw) => {
        try {
          const payload = JSON.parse(raw.data as string) as ClusterEvent;
          this.listeners.forEach((listener) => listener(payload));
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onclose = () => {
        this.connected = false;
        this.scheduleReconnect();
      };
      socket.onerror = () => socket.close();
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.timer) return;
    const delay = Math.min(15_000, 750 * 2 ** this.attempts++);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }
}

export const clusterSocket = new ClusterSocket();
