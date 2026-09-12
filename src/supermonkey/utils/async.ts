import { Logger } from "./logger";

/** Resolves after `ms` milliseconds. */
export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn` and logs how long it took.
 * Warns when duration exceeds `warnThresholdMs`; throws when it exceeds `errorThresholdMs`.
 */
export function traceDuration<T = void>(
    label: string,
    fn: () => T,
    opts?: {
        log?: Logger;
        warnThresholdMs?: number;
        warnAdditionalMessage?: string;
        errorThresholdMs?: number;
        errorAdditionalMessage?: string;
    },
): T {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (opts?.errorThresholdMs != null && duration > opts.errorThresholdMs) {
        opts.log?.error(
            `${label} execution took too long: ${duration}ms${opts.errorAdditionalMessage != null ? `. ${opts.errorAdditionalMessage}` : ""}`,
        );
        throw new Error(`${label} execution took too long: ${duration}ms`);
    } else if (opts?.warnThresholdMs != null && duration > opts.warnThresholdMs) {
        opts.log?.warn(
            `${label} execution took too long: ${duration}ms${opts.warnAdditionalMessage != null ? `. ${opts.warnAdditionalMessage}` : ""}`,
        );
    }

    return result;
}
