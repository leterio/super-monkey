import { pickTextFile, saveJson } from "../../utils/file";
import { Logger } from "../../utils/logger";
import { isPlainObject } from "../../utils/type";
import { HistoryStore } from "./history-store";

type GroupHistoryBackup = {
    readonly listed: string[];
    readonly viewed: string[];
};

type HistoryBackupPayload = {
    readonly groups: Readonly<Record<string, GroupHistoryBackup>>;
};

export class HistoryBackup {
    constructor(
        private readonly stores: ReadonlyMap<string, HistoryStore>,
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
        for (const store of this.stores.values()) {
            store.clear();
        }
    }

    async backup(): Promise<void> {
        this.log.info("Saving history to disk ...");

        const groups: Record<string, GroupHistoryBackup> = {};
        for (const [groupKey, store] of this.stores) {
            store.flushAll();
            groups[groupKey] = {
                listed: store.listed.persisted,
                viewed: store.viewed.persisted,
            };
        }

        const fileName = `history-backup-${new Date().toISOString()}.json`;
        saveJson({ groups }, fileName);
    }

    async restore(): Promise<void> {
        const rawText = await pickTextFile();
        if (rawText == null) {
            alert("Invalid history backup file.");
            return;
        }

        const restored = HistoryBackup.parseBackupPayload(rawText);
        if (restored == null) {
            alert("Invalid history backup file.");
            return;
        }

        for (const [groupKey, entry] of Object.entries(restored.groups)) {
            const store = this.stores.get(groupKey);
            if (store == null) {
                this.log.debug("Ignoring backup group that is not configured:", groupKey);
                continue;
            }

            store.listed.mergePersisted(entry.listed);
            store.viewed.mergePersisted(entry.viewed);
        }

        this.log.info("History restored successfully.");
        alert("History restored successfully.");
    }

    private static parseBackupPayload(rawText: string): HistoryBackupPayload | null {
        try {
            const parsed: unknown = JSON.parse(rawText);
            return HistoryBackup.readGroupsPayload(parsed);
        } catch {
            return null;
        }
    }

    private static readGroupsPayload(parsed: unknown): HistoryBackupPayload | null {
        if (!isPlainObject(parsed) || !isPlainObject(parsed.groups)) {
            return null;
        }

        const groups: Record<string, GroupHistoryBackup> = {};
        let sawInvalidEntry = false;

        for (const [groupKey, rawEntry] of Object.entries(parsed.groups)) {
            const trimmedKey = groupKey.trim();
            if (trimmedKey.length === 0) {
                sawInvalidEntry = true;
                continue;
            }

            const entry = HistoryBackup.readGroupEntry(rawEntry);
            if (entry == null) {
                sawInvalidEntry = true;
                continue;
            }

            groups[trimmedKey] = entry;
        }

        if (Object.keys(groups).length === 0 && sawInvalidEntry) {
            return null;
        }

        return { groups };
    }

    private static readGroupEntry(raw: unknown): GroupHistoryBackup | null {
        if (!isPlainObject(raw) || !Array.isArray(raw.listed) || !Array.isArray(raw.viewed)) {
            return null;
        }

        return {
            listed: HistoryBackup.filterIds(raw.listed),
            viewed: HistoryBackup.filterIds(raw.viewed),
        };
    }

    private static filterIds(raw: unknown[]): string[] {
        return raw.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
    }
}
