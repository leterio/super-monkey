export type OptsFindingKind = "reject" | "repair";

export type OptsFinding = {
    readonly path: string;
    readonly message: string;
    readonly kind: OptsFindingKind;
};

export type Normalized<T> = {
    readonly value?: T;
    readonly findings: readonly OptsFinding[];
};

/**
 * Accumulator for one normalize walk.
 * Owner walks call {@link reject} / {@link repair} and {@link finish} with the cleaned value.
 */
export class OptsNormalization {
    private readonly collected: OptsFinding[] = [];
    private hasReject = false;

    reject(path: string, message: string): void {
        this.hasReject = true;
        this.collected.push({ path, message, kind: "reject" });
    }

    repair(path: string, message: string): void {
        this.collected.push({ path, message, kind: "repair" });
    }

    finish<T>(value: T | undefined): Normalized<T> {
        if (this.hasReject || value == null) {
            return { findings: this.collected };
        }

        return { value, findings: this.collected };
    }
}

/**
 * Formats a finding for loader logs.
 */
export function formatOptsFinding(finding: OptsFinding): string {
    return `\n - ${finding.path}: ${finding.message}`;
}
