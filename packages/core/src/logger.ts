import pino, { type LogFn, type Logger } from "pino";
import pretty from "pino-pretty";
import { EventEmitter } from "events";
import { parseBooleanFromText } from "./parsing.ts";

// Define custom log levels with their numerical values
const customLevels: Record<string, number> = {
    fatal: 60,
    error: 50,
    warn: 40,
    info: 30,
    log: 29,
    progress: 28,
    success: 27,
    debug: 20,
    trace: 10,
};

const raw = parseBooleanFromText(process?.env?.LOG_JSON_FORMAT) || false;

const createStream = () => {
    if (raw) {
        return undefined;
    }
    return pretty({
        colorize: true,
        translateTime: "yyyy-mm-dd HH:MM:ss",
        ignore: "pid,hostname",
    });
};

const defaultLevel = process?.env?.DEFAULT_LOG_LEVEL || "info";

// create a event emitter for log subscription
const logEmitter = new EventEmitter();

// modify options, add streamWrite hook
const options = {
    level: defaultLevel,
    customLevels,
    hooks: {
        logMethod(
            inputArgs: [string | Record<string, unknown>, ...unknown[]],
            method: LogFn
        ): void {
            const [arg1, ...rest] = inputArgs;

            const formatError = (err: Error) => ({
                message: err.message,
                stack: err.stack?.split('\n').map(line => line.trim()),
                name: err.name,
                ...err
            });

            if (typeof arg1 === "object") {
                if (arg1 instanceof Error) {
                    method.apply(this, [{
                        error: formatError(arg1)
                    }]);
                } else {
                    const messageParts = rest.map((arg) =>
                        typeof arg === "string" ? arg : JSON.stringify(arg)
                    );
                    const message = messageParts.join(" ");
                    method.apply(this, [arg1, message]);
                }
            } else {
                const context = {};
                const messageParts = [arg1, ...rest].map((arg) => {
                    if (arg instanceof Error) {
                        return formatError(arg);
                    }
                    return typeof arg === "string" ? arg : arg;
                });
                const message = messageParts
                    .filter((part) => typeof part === "string")
                    .join(" ");
                const jsonParts = messageParts.filter(
                    (part) => typeof part === "object"
                );

                Object.assign(context, ...jsonParts);

                method.apply(this, [context, message]);
            }
        },
        // add streamWrite hook support
        streamWrite: (originalData: string) => {
            try {
                // send log data to all subscribers
                logEmitter.emit('log', originalData);
            } catch (err) {
                console.error('Error in streamWrite hook:', err);
            }
            return originalData;
        }
    },
};

// define ElizaLogger type, inherit all attributes of Pino Logger
type ElizaLogger = {
    logger: Logger;
    subscribe: (callback: (logData: string) => void) => () => void;
    // explicitly declare all log methods
    log: LogFn;
    progress: LogFn;
    success: LogFn;
    fatal: LogFn;
    error: LogFn;
    warn: LogFn;
    info: LogFn;
    debug: LogFn;
    trace: LogFn;
    // Add all other Logger properties
    level: string | number;
    levels: pino.LevelMapping;
    levelVal: number;
    useLevelLabels: boolean;
    bindings: () => pino.Bindings;
    child: (bindings: pino.Bindings, options?: pino.ChildLoggerOptions) => Logger;
    isLevelEnabled: (level: pino.LevelWithSilentOrString) => boolean;
    version: string;
    [key: string]: any;
};

// create base logger instance
const baseLogger = pino(options, createStream());

// export configurable logger, including subscription mechanism
export const elizaLogger: ElizaLogger = {
    ...baseLogger, // expand all Pino logger methods and attributes
    logger: baseLogger,
    log: baseLogger.log.bind(baseLogger),
    progress: baseLogger.progress.bind(baseLogger),
    success: baseLogger.success.bind(baseLogger),
    fatal: baseLogger.fatal.bind(baseLogger),
    error: baseLogger.error.bind(baseLogger),
    warn: baseLogger.warn.bind(baseLogger),
    info: baseLogger.info.bind(baseLogger),
    debug: baseLogger.debug.bind(baseLogger),
    trace: baseLogger.trace.bind(baseLogger),
    level: baseLogger.level,
    levels: baseLogger.levels,
    levelVal: baseLogger.levelVal,
    useLevelLabels: baseLogger.useLevelLabels,
    bindings: baseLogger.bindings.bind(baseLogger),
    child: baseLogger.child.bind(baseLogger),
    isLevelEnabled: baseLogger.isLevelEnabled.bind(baseLogger),
    version: baseLogger.version,
    /**
     * subscribe to log events
     * @param callback handle log data callback function
     * @returns unsubscribe function
     */
    subscribe: (callback: (logData: string) => void): (() => void) => {
        const listener = (data: string) => {
            try {
                callback(data);
            } catch (err) {
                console.error('Error in log subscriber:', err);
            }
        };
        
        logEmitter.on('log', listener);
        
        // return unsubscribe function
        return () => {
            logEmitter.off('log', listener);
        };
    }
};

export default elizaLogger;
