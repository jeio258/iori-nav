// functions/lib/csrf.js
// 认证 / Session / CSRF / 时序安全工具

/**
 * 构建 session cookie 字符串
 */
export function buildSessionCookie(token, options = {}) {
  const maxAge = options.maxAge !== undefined ? options.maxAge : 86400;
  return `admin_session=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * 从请求 Cookie 中提取 session token
 */
export function getSessionToken(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/admin_session=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * 恒定时间字符串比较，防止时序攻击
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) {
    const dummy = new Uint8Array(bufA.byteLength);
    crypto.subtle.timingSafeEqual(bufA, dummy);
    return false;
  }
  return crypto.subtle.timingSafeEqual(bufA, bufB);
}

/**
 * 校验 CSRF token（Synchronizer Token Pattern）
 */
export async function validateCsrfToken(request, env) {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) return { valid: false };

  const storedToken = await env.NAV_AUTH.get(`csrf_${sessionToken}`);
  if (!storedToken) return { valid: false };

  const headerToken = request.headers.get('X-CSRF-Token');
  if (!headerToken) return { valid: false };

  return { valid: timingSafeEqual(headerToken, storedToken) };
}

/**
 * 校验请求来源（Origin / Referer）
 */
export function validateOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      return new URL(origin).host === url.host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      return new URL(referer).host === url.host;
    } catch {
      return false;
    }
  }
  return false;
}
