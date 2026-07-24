// functions/_middleware.js
// 全局中间件编排器 + 向后兼容的重导出层

import { ensureSchemaReady } from './lib/schema-migration';
import { errorResponse } from './lib/response';
import { validateCsrfToken, validateOrigin } from './lib/csrf';

// ── 重导出（保持现有 import 路径不变） ─────────────────

export { normalizeSortOrder } from './lib/utils';
export { errorResponse, jsonResponse } from './lib/response';
export {
  getHomeCacheKey, getHomeDirtyKey,
  getHomeCacheDirtyValue, clearHomeCache,
  markHomeCacheDirty, clearHomeCacheDirty, isHomeCacheDirty,
} from './lib/cache-dirty';
export {
  checkRateLimit, checkLoginRateLimit,
  recordLoginFailure, clearLoginFailures,
} from './lib/rate-limit';
export {
  buildSessionCookie, getSessionToken,
  timingSafeEqual, validateCsrfToken, validateOrigin,
} from './lib/csrf';

// ── 认证与功能开关 ──────────────────────────────────────

export function isSubmissionEnabled(env) {
  return String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
}

export async function isAdminAuthenticated(request, env) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return false;

  const match = cookie.match(/admin_session=([^;]+)/);
  if (!match) return false;

  const token = match[1];
  const session = await env.NAV_AUTH.get(`session_${token}`);
  return Boolean(session);
}

// ── 全局中间件 ──────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  // Schema 迁移：首页 GET 留给 index.js 里与 KV/DB 读并行执行
  if (env.NAV_DB) {
    const isHomePageGet = method === 'GET' && url.pathname === '/' && !url.search;
    if (!isHomePageGet) {
      await ensureSchemaReady(env);
    }
  }

  // CSRF 校验
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/config/submit') {
      // 公开提交接口：Origin 校验
      if (!validateOrigin(request)) {
        return errorResponse('Forbidden: invalid origin', 403);
      }
    } else {
      // 管理 API：CSRF token 校验
      const { valid } = await validateCsrfToken(request, env);
      if (!valid) {
        return errorResponse('Forbidden: invalid CSRF token', 403);
      }
    }
  }

  return context.next();
}
