import rateLimit from "express-rate-limit";
import { entorno } from "../platform/config.js";

export function trustProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  return entorno(env).TRUST_PROXY_HOPS;
}

const WINDOW_MS = 15 * 60 * 1000;
export function loginRateLimitMax(env: NodeJS.ProcessEnv = process.env): number {
  return entorno(env).LOGIN_RATE_LIMIT_MAX;
}

export function loginRateLimiter(max = loginRateLimitMax(), windowMs = WINDOW_MS) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many login attempts" }
  });
}

export function dossierRateLimitMax(env: NodeJS.ProcessEnv = process.env): number {
  return entorno(env).DOSSIER_RATE_LIMIT_MAX;
}

export function dossierRateLimiter(max = dossierRateLimitMax(), windowMs = WINDOW_MS) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many requests" }
  });
}
