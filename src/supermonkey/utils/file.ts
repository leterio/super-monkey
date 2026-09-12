import { saveAs } from "file-saver";
import { injectElement } from "./dom/elements";

/**
 * Sanitizes `fileName` for safe download names.
 * Empty or non-string input becomes `"unknown"`.
 */
export function normalizeFileName(fileName: string): string {
    if (typeof fileName !== "string" || fileName.length === 0) {
        return "unknown";
    }

    let name = fileName.replace(/[\x00-\x1F\x7F]/g, "_");
    name = name.replace(/[\\/:*?"<>|%,;=[\](){}$#@!'`~^&]/g, "_");
    return name.replace(/[ .]+$/, "");
}

/** Saves `data` via FileSaver; normalizes `fileName` when provided. */
export function save(data: Blob | string, fileName?: string): void {
    saveAs(data, fileName != null ? normalizeFileName(fileName) : undefined);
}

/** Serializes `data` as pretty-printed JSON and saves it under `fileName`. */
export function saveJson(data: unknown, fileName: string): void {
    const blob = new Blob(
        [new TextEncoder().encode(JSON.stringify(data, null, 2))],
        { type: "application/json" },
    );
    save(blob, fileName);
}

/** Options for {@link pickTextFile}. */
export type PickTextFileOptions = {
    /** `accept` attribute for the hidden file input. */
    readonly accept?: string;
};

/**
 * Opens a file picker and reads the selected file as text.
 * @returns File contents, or `null` when the user cancels or the file is empty
 */
export function pickTextFile(options?: PickTextFileOptions): Promise<string | null> {
    return new Promise((resolve) => {
        let settled = false;

        const finish = (value: string | null): void => {
            if (settled) {
                return;
            }
            settled = true;
            window.removeEventListener("focus", onWindowFocus);
            fileInput.remove();
            resolve(value);
        };

        const onWindowFocus = (): void => {
            window.setTimeout(() => finish(null), 300);
        };

        const fileInput = injectElement(
            document.body,
            "input",
            {
                type: "file",
                accept: options?.accept ?? "application/json,text/plain",
                style: "display: none",
            },
            {
                change: (event) => {
                    void (async () => {
                        const selectedFile = (event.target as HTMLInputElement).files?.[0];
                        if (selectedFile == null || selectedFile.size === 0) {
                            finish(null);
                            return;
                        }
                        finish(await selectedFile.text());
                    })();
                },
            },
        );

        window.addEventListener("focus", onWindowFocus);
        fileInput.click();
    });
}
