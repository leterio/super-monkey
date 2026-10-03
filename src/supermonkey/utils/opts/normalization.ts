export type OptsFindingKind = "reject" | "repair" | "unknown";

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
 * Owner walks call {@link reject}, {@link repair}, or {@link unknown}, then {@link finish} with the cleaned value.
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

    /**
     * Records a key outside the opts contract.
     * The walk still finishes with `value` when nothing was rejected.
     */
    unknown(path: string, message: string): void {
        this.collected.push({ path, message, kind: "unknown" });
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

/**
 * Joins findings of `kind` into loader log lines.
 * Returns an empty string when none match.
 */
export function formatOptsFindingsOfKind(
    findings: readonly OptsFinding[],
    kind: OptsFindingKind,
): string {
    return findings
        .filter((finding) => finding.kind === kind)
        .map(formatOptsFinding)
        .join("");
}
