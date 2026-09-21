/**
 * Async semaphore: at most `capacity` overlapping `run` bodies.
 */
export class ConcurrencyLimiter {
    private active = 0;
    private readonly waiters: Array<() => void> = [];

    constructor(private capacity: number) {
        if (capacity < 1) {
            throw new Error("ConcurrencyLimiter capacity must be >= 1");
        }
    }

    setCapacity(capacity: number): void {
        if (capacity < 1) {
            throw new Error("ConcurrencyLimiter capacity must be >= 1");
        }
        this.capacity = capacity;
        this.drainWaiters();
    }

    async run<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }

    private acquire(): Promise<void> {
        if (this.active < this.capacity) {
            this.active += 1;
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            this.waiters.push(() => {
                this.active += 1;
                resolve();
            });
        });
    }

    private release(): void {
        this.active -= 1;
        this.drainWaiters();
    }

    private drainWaiters(): void {
        while (this.active < this.capacity && this.waiters.length > 0) {
            const next = this.waiters.shift();
            next?.();
        }
    }
}
