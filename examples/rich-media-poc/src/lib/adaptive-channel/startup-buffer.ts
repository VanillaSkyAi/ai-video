export class StartupBufferGate<T> {
  private readonly pending: T[] = [];
  private durationSec = 0;
  private opened = false;

  constructor(private readonly targetDurationSec: number) {}

  push(event: T, durationSec: number): { events: T[]; openedNow: boolean } {
    if (this.opened) return { events: [event], openedNow: false };
    this.pending.push(event);
    this.durationSec += Math.max(0, durationSec);
    if (this.durationSec < this.targetDurationSec) return { events: [], openedNow: false };
    this.opened = true;
    return { events: this.pending.splice(0), openedNow: true };
  }

  flush(): T[] {
    if (this.pending.length === 0) return [];
    this.opened = true;
    return this.pending.splice(0);
  }
}
