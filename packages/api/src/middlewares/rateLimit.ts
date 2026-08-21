import rateLimit from "express-rate-limit";

/**
 * Cuántos proxies hay delante de la API. Decide de dónde sale la IP del cliente,
 * que es la clave de todo rate limiting.
 *
 * El default es 0 —no confiar en ningún `X-Forwarded-For`— y es a propósito. Las
 * dos configuraciones equivocadas fallan muy distinto:
 *
 * - **De menos** (0 detrás del proxy de Render): todos los clientes comparten la
 *   IP del proxy, caen en el mismo balde y la app se vuelve inusable para todos.
 *   Se ve en el primer minuto.
 * - **De más** (`trust proxy: true`): cualquiera falsifica `X-Forwarded-For` y el
 *   límite deja de existir. No se ve nunca.
 *
 * Se elige el que falla ruidoso, y el que falla en silencio queda **inalcanzable**:
 * esto devuelve siempre un entero, así que `true` no es una configuración posible.
 * El deploy tiene que setear la cantidad real de saltos (Render: 1) — está
 * anotado como prerequisito en D-045, al lado del `generateValue` de JWT_SECRET.
 */
export function trustProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const hops = Number.parseInt(env.TRUST_PROXY_HOPS ?? "", 10);
  return Number.isInteger(hops) && hops >= 0 ? hops : 0;
}

/** 15 minutos: largo para que moleste a un script, corto para que un humano que se equivocó reintente. */
const WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 20;

export function loginRateLimitMax(env: NodeJS.ProcessEnv = process.env): number {
  const max = Number.parseInt(env.LOGIN_RATE_LIMIT_MAX ?? "", 10);
  return Number.isInteger(max) && max > 0 ? max : DEFAULT_MAX;
}

/**
 * Límite de intentos sobre `POST /auth/login`.
 *
 * Existe por una consecuencia directa de haber cerrado el oráculo de tiempos: el
 * login ahora paga un `bcrypt.compare` completo **exista o no la cuenta**. Antes,
 * tirar 10.000 emails inventados era gratis; ahora cuesta 10.000 hashes. En el
 * free tier de Render son 0.1 CPU (D-040), donde cada hash se va a varios cientos
 * de milisegundos: un spray sin autenticar voltea la URL pública, que es el
 * criterio 12 del SOM. El arreglo correcto es limitar, no reabrir el oráculo.
 *
 * Se cuentan TODOS los intentos, no solo los fallidos: lo que se protege es CPU,
 * y el hash se paga igual cuando la password es correcta.
 *
 * La clave es la IP y no el email a propósito. Limitar por email deja que
 * cualquiera bloquee la cuenta de otro con 20 intentos: se cambia una denegación
 * de servicio general por una dirigida, que es peor.
 */
export function loginRateLimiter(max = loginRateLimitMax(), windowMs = WINDOW_MS) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Mismo shape que el resto de los errores de la API. El cliente distingue por
    // status, no por texto (apps/web/src/api/port.ts).
    message: { message: "Too many login attempts" }
  });
}
