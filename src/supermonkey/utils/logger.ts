import { SCRIPT_FULL_NAME } from "../constants";
import { boundNumber } from "./number";
import { getValue, setValue } from "./value";

/** Numeric thresholds for {@link Logger}; also stored as Tampermonkey `logLevel`. */
export enum LogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5,
}

/** Tampermonkey storage key for the production log threshold. */
export const LOG_LEVEL_STORAGE_KEY = "logLevel";

/**
 * Console logger that prefixes each line with the script name, level, and an optional context.
 * Trace through warn are emitted only when the instance log level allows them; error and fatal always emit.
 * In development builds the initial level is debug; otherwise it comes from the Tampermonkey value `logLevel` (default info).
 * {@link Logger.setLevel} updates the threshold immediately and persists it.
 */
export class Logger {

    //#region Instance API

    /**
     * @param context - Optional label included in every message from this instance
     */
    constructor(private readonly context: string) { }

    private buildMessageAndOutput(output: (...messages: any[]) => void, level: string, ...messages: any[]): void {
        const opts: any[] = [
            SCRIPT_FULL_NAME,
            "-", level
        ];

        if (this.context) {
            opts.push("-", this.context);
        }

        opts.push("-", ...messages);

        output(...opts);
    }

    private buildMessageAndOutputWithOptionalTable(
        output: (...messages: any[]) => void,
        level: string,
        ...messages: any[]
    ): void {
        let tablePayload: unknown;
        let head = messages;

        if (messages.length > 0) {
            const last = messages[messages.length - 1];
            if (last != null && typeof last === "object") {
                tablePayload = last;
                head = messages.slice(0, -1);
            }
        }

        if (head.length > 0) {
            this.buildMessageAndOutput(output, level, ...head);
        }

        if (tablePayload !== undefined) {
            console.table(tablePayload);
        }
    }

    /**
     * Emits a trace message when the log level is at or below trace.
     * When the last argument is an object or array, it is omitted from the line and passed to `console.table`.
     */
    trace(...messages: any[]): void {
        if (!Logger.isTraceEnabled()) {
            return;
        }

        this.buildMessageAndOutputWithOptionalTable(console.debug, "TRACE", ...messages);
    }

    /**
     * Emits a debug message when the log level is at or below debug.
     * When the last argument is an object or array, it is omitted from the line and passed to `console.table`.
     */
    debug(...messages: any[]): void {
        if (!Logger.isDebugEnabled()) {
            return;
        }

        this.buildMessageAndOutputWithOptionalTable(console.debug, "DEBUG", ...messages);
    }

    /** Emits an info message when the log level is at or below info. */
    info(...messages: any[]): void {
        if (!Logger.isInfoEnabled()) {
            return;
        }

        this.buildMessageAndOutput(console.log, "INFO ", ...messages);
    }

    /** Emits a warning when the log level is at or below warn. */
    warn(...messages: any[]): void {
        if (!Logger.isWarnEnabled()) {
            return;
        }

        this.buildMessageAndOutput(console.warn, "WARN ", ...messages);
    }

    /** Emits an error message. */
    error(...messages: any[]): void {
        if (!Logger.isErrorEnabled()) {
            return;
        }

        this.buildMessageAndOutput(console.error, "ERROR", ...messages);
    }

    /**
     * Emits a fatal error block with the main message, error detail, and optional extras.
     * @param mainMessage - Primary fatal summary
     * @param mainError - Error or value whose message is included in the block
     * @param additionalMessages - Extra lines appended after the error detail
     */
    fatal(mainMessage: string, mainError: any, ...additionalMessages: string[]): void {
        const block = [
            "\n==============================================================\n",
            mainMessage, "\n",
            (mainError instanceof Error ? mainError.message : String(mainError)).replace(/^\n/, ''), "\n",
            ...additionalMessages,
            "\n==============================================================",
        ].join("");

        this.buildMessageAndOutput(console.error, "FATAL", block);
    }

    //#endregion Instance API

    //#region Static API

    private static _logLevel: LogLevel = Logger.resolveLogLevel();

    /** The effective global log level for the script. */
    static get logLevel(): LogLevel {
        return this._logLevel;
    }

    /**
     * Sets the global log level for the current tab and persists it as Tampermonkey `logLevel`.
     * The new threshold applies immediately, including in development builds.
     */
    static setLevel(level: LogLevel): void {
        this._logLevel = boundNumber(level, LogLevel.TRACE, LogLevel.FATAL, LogLevel.INFO) as LogLevel;
        setValue(LOG_LEVEL_STORAGE_KEY, this._logLevel);
    }

    /** Sets the global log level for the script. */
    static set logLevel(value: LogLevel) {
        this.setLevel(value);
    }

    /** Returns true if the log level is at or below trace. */
    static isTraceEnabled(): boolean {
        return this.logLevel <= LogLevel.TRACE;
    }

    /** Returns true if the log level is at or below debug. */
    static isDebugEnabled(): boolean {
        return this.logLevel <= LogLevel.DEBUG;
    }

    /** Returns true if the log level is at or below info. */
    static isInfoEnabled(): boolean {
        return this.logLevel <= LogLevel.INFO;
    }

    /** Returns true if the log level is at or below warn. */
    static isWarnEnabled(): boolean {
        return this.logLevel <= LogLevel.WARN;
    }

    /** Returns true if the log level is at or below error. */
    static isErrorEnabled(): boolean {
        return true; // Error is always enabled
    }

    private static resolveLogLevel(): LogLevel {
        const rawLogLevel = getValue<number>(LOG_LEVEL_STORAGE_KEY, LogLevel.INFO);
        const resolvedLogLevel = boundNumber(rawLogLevel, LogLevel.TRACE, LogLevel.FATAL, LogLevel.INFO) as LogLevel;

        if (resolvedLogLevel == LogLevel.TRACE) {
            return LogLevel.TRACE;
        }

        if (import.meta.env.DEV === true) {
            return LogLevel.DEBUG;
        }

        return resolvedLogLevel;
    }
}
