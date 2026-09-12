import { pickTextFile, saveJson } from "../../utils/file";
import { Logger } from "../../utils/logger";
import { HistoryStore } from "./history-store";

type HistoryBackupPayload = {
    readonly listed: string[];
    readonly viewed: string[];
};

export class HistoryBackup {
    constructor(
        private readonly store: HistoryStore,
        private readonly log: Logger,
    ) {
    }

    async clear(): Promise<void> {
        const confirmed = window.confirm(
            "Clear all listed and viewed history entries? This action cannot be undone.",
        );
        if (!confirmed) {
            this.log.debug("Clear history cancelled by user");
            return;
        }

        this.log.warn("Clearing history ...");
        this.store.clear();
    }

    async backup(): Promise<void> {
        this.log.info("Saving history to disk ...");

        this.store.flushAll();

        const payload: HistoryBackupPayload = {
            listed: this.store.listed.persisted,
            viewed: this.store.viewed.persisted,
        };

        const fileName = `history-backup-${new Date().toISOString()}.json`;
        saveJson(payload, fileName);
    }

    async restore(): Promise<void> {
        const rawText = await pickTextFile();
        if (rawText == null) {
            alert("Invalid history backup file.");
            return;
        }

        const restored = this.parseBackupPayload(rawText);
        if (restored == null) {
            alert("Invalid history backup file.");
            return;
        }

        this.store.listed.mergePersisted(restored.listed);
        this.store.viewed.mergePersisted(restored.viewed);

        this.log.info("History restored successfully.");
        alert("History restored successfully.");
    }

    private parseBackupPayload(rawText: string): HistoryBackupPayload | null {
        try {
            const parsed = JSON.parse(rawText) as Partial<HistoryBackupPayload>;
            if (!Array.isArray(parsed.listed) || !Array.isArray(parsed.viewed)) {
                return null;
            }

            return {
                listed: parsed.listed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
                viewed: parsed.viewed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
            };
        } catch {
            const listed = rawText
                .split("\n")
                .map((entry) => entry.replace("\r", ""))
                .filter((entry) => entry.length > 0);

            if (listed.length === 0) {
                return null;
            }

            return { listed, viewed: [] };
        }
    }
}
