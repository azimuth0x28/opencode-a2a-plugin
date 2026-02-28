/**
 * A2A Logger Utility
 *
 * Centralized logging for the A2A plugin
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogParams {
	body: {
		service: string;
		level: string;
		message: string;
		extra?: Record<string, unknown>;
	};
}

interface Logger {
	log(params: LogParams): Promise<void>;
}

let globalLogger: Logger | null = null;

/**
 * Set the global logger instance
 */
export function setLogger(logger: Logger): void {
	globalLogger = logger;
}

/**
 * Get the global logger instance
 */
export function getLogger(): Logger | null {
	return globalLogger;
}

/**
 * Create a logger for a specific module
 */
export function createLogger(module: string): Logger {
	return {
		log: async (params: LogParams) => {
			if (globalLogger) {
				await globalLogger.log({
					body: {
						...params.body,
						service: `a2a-plugin.${module}`,
					},
				});
			}
		},
	};
}

/**
 * Log helper functions
 */
export const log = {
	debug: async (
		module: string,
		message: string,
		extra?: Record<string, unknown>,
	) => {
		await createLogger(module).log({
			body: { service: `a2a-plugin.${module}`, level: "debug", message, extra },
		});
	},
	info: async (
		module: string,
		message: string,
		extra?: Record<string, unknown>,
	) => {
		await createLogger(module).log({
			body: { service: `a2a-plugin.${module}`, level: "info", message, extra },
		});
	},
	warn: async (
		module: string,
		message: string,
		extra?: Record<string, unknown>,
	) => {
		await createLogger(module).log({
			body: { service: `a2a-plugin.${module}`, level: "warn", message, extra },
		});
	},
	error: async (
		module: string,
		message: string,
		extra?: Record<string, unknown>,
	) => {
		await createLogger(module).log({
			body: { service: `a2a-plugin.${module}`, level: "error", message, extra },
		});
	},
};

export type { Logger, LogLevel, LogParams };
