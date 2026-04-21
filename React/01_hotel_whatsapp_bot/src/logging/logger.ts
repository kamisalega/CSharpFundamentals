import pino from "pino";
import { getCorrelationId } from "./correlationId";
const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
  level: isDev ? "debug" : "info",
  transport: { target: "pino-pretty", options: { colorize: true } },
  mixin() {
    const correlationId = getCorrelationId();
    return correlationId ? { correlationId } : {};
  },
  redact: {
    paths: ["*.password", "*.token", "*.secret", "*.authorization"],
    remove: true,
  },
});
