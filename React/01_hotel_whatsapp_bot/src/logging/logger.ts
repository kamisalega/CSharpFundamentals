import pino from "pino";
import { getCorrelationId } from "./correlationId";
const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: isDev ? "debug" : "info",
  ...(!isProd && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
  mixin() {
    const correlationId = getCorrelationId();
    return correlationId ? { correlationId } : {};
  },
  redact: {
    paths: ["*.password", "*.token", "*.secret", "*.authorization"],
    remove: true,
  },
  serializers: {
    err: isProd
      ? (err: unknown) => {
          if (err instanceof Error) {
            return {
              message: err.message,
              code: (err as NodeJS.ErrnoException).code,
            };
          }
          return { message: String(err) };
        }
      : pino.stdSerializers.err,
  },
});
