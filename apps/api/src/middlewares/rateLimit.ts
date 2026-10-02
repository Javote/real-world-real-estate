import rateLimit from "express-rate-limit";

export function trustProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const hops = Number.parseInt(env.TRUST_PROXY_HOPS ?? "", 10);
  return Number.isInteger(hops) && hops >= 0 ? hops : 0;
}

const WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 20;

export function loginRateLimitMax(env: NodeJS.ProcessEnv = process.env): number {
  const max = Number.parseInt(env.LOGIN_RATE_LIMIT_MAX ?? "", 10);
  return Number.isInteger(max) && max > 0 ? max : DEFAULT_MAX;
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

const DEFAULT_DOSSIER_MAX = 60;

export function dossierRateLimitMax(env: NodeJS.ProcessEnv = process.env): number {
  const max = Number.parseInt(env.DOSSIER_RATE_LIMIT_MAX ?? "", 10);
  return Number.isInteger(max) && max > 0 ? max : DEFAULT_DOSSIER_MAX;
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
