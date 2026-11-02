import { claimNextDue, publishClaimed, recoverInterrupted } from "./publishService.js";

let timer: NodeJS.Timeout | null = null;
let running = false;
let stopping = false;
const MAX_PER_TICK = 10;

/** One pass: publish everything that is due. Overlapping passes are skipped. */
export async function runSchedulerOnce(): Promise<number> {
  if (running || stopping) return 0;
  running = true;
  let done = 0;
  try {
    for (let i = 0; i < MAX_PER_TICK && !stopping; i++) {
      const next = await claimNextDue();
      if (!next) break;
      try {
        await publishClaimed(next);
      } catch (error) {
        console.error("[scheduler] publishing crashed:", (error as Error).name);
      }
      done += 1;
    }
  } catch (error) {
    console.error("[scheduler] tick failed:", (error as Error).name);
  } finally {
    running = false;
  }
  return done;
}

/** Starts the in-process scheduler. Due posts live in MongoDB, so nothing depends on a browser being open. */
export async function startScheduler(): Promise<void> {
  if (timer || stopping) return;
  const seconds = Math.max(10, Number(process.env["SCHEDULER_INTERVAL_SECONDS"]) || 30);
  try {
    const n = await recoverInterrupted();
    if (n > 0) console.warn(`[scheduler] marked ${n} interrupted post(s) as Failed`);
  } catch (error) {
    console.error("[scheduler] recovery failed:", (error as Error).name);
  }
  timer = setInterval(() => void runSchedulerOnce(), seconds * 1000);
  timer.unref();
  console.log(`Scheduler running every ${seconds}s`);
}

/** Shutdown: no new posts are claimed after this. A pass already publishing is allowed to finish. */
export function stopScheduler(): void {
  stopping = true;
  if (timer) clearInterval(timer);
  timer = null;
}
