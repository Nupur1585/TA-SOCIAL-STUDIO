import type { Server } from "node:http";
import mongoose from "mongoose";
import { publishesInFlight } from "../services/publishing/publishService.js";
import { stopScheduler } from "../services/publishing/scheduler.js";

/** How long to wait for posts that are mid-publish before giving up (their state is repaired on next start). */
const DRAIN_MS = 25_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * SIGINT/SIGTERM: stop claiming new scheduled posts, stop accepting connections, let posts that are already
 * being published finish (bounded), then close MongoDB. Nothing is marked published or failed here: a post that
 * is still running when the wait ends stays "Publishing" and is marked Failed (never retried) by
 * recoverInterrupted() on the next start.
 * A second signal exits immediately.
 */
export function installShutdown(server: Server): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      console.warn(`${signal} received again: forcing exit`);
      process.exit(1);
    }
    shuttingDown = true;
    console.log(`${signal} received: shutting down`);
    let code = 0;
    try {
      stopScheduler();
      await new Promise<void>((resolve) => {
        server.close((error) => {
          if (error) console.error("HTTP server close failed:", error.name);
          resolve();
        });
        server.closeIdleConnections();
        // Keep-alive connections that are still busy would otherwise hold the server open.
        setTimeout(() => server.closeAllConnections(), 5_000).unref();
      });
      const deadline = Date.now() + DRAIN_MS;
      while (publishesInFlight() > 0 && Date.now() < deadline) await sleep(250);
      if (publishesInFlight() > 0) {
        console.warn(`${publishesInFlight()} publish(es) still running at shutdown; they will be marked Failed on next start`);
        code = 1;
      }
      await mongoose.disconnect();
    } catch (error) {
      console.error("Shutdown error:", error instanceof Error ? error.name : "unknown");
      code = 1;
    }
    process.exit(code);
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => void shutdown(signal));
  }
}
