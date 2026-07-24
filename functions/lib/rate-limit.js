// functions/lib/rate-limit.js
// 速率限制与登录爆破防护

/**
 * 通用 IP 速率限制（基于 KV 计数器 + TTL 自动过期）
 */
export async function checkRateLimit(env, key, maxRequests, windowSeconds) {
  try {
    const current = await env.NAV_AUTH.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    await env.NAV_AUTH.put(key, String(count + 1), { expirationTtl: windowSeconds });
    return { allowed: true, remaining: maxRequests - count - 1 };
  } catch (e) {
    console.error('Rate limit check failed:', e);
    return { allowed: true, remaining: maxRequests };
  }
}

/**
 * 登录暴力破解防护（基于 IP 的失败计数器）
 */
export async function checkLoginRateLimit(env, ip, maxAttempts, lockoutSeconds) {
  const key = `login_fail_${ip}`;
  try {
    const current = await env.NAV_AUTH.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= maxAttempts) {
      return { locked: true, attemptsLeft: 0 };
    }
    return { locked: false, attemptsLeft: maxAttempts - count };
  } catch (e) {
    console.error('Login rate limit check failed:', e);
    return { locked: false, attemptsLeft: maxAttempts };
  }
}

export async function recordLoginFailure(env, ip, maxAttempts, lockoutSeconds) {
  const key = `login_fail_${ip}`;
  try {
    const current = await env.NAV_AUTH.get(key);
    const count = current ? parseInt(current, 10) : 0;
    await env.NAV_AUTH.put(key, String(count + 1), { expirationTtl: lockoutSeconds });
  } catch (e) {
    console.error('Record login failure failed:', e);
  }
}

export async function clearLoginFailures(env, ip) {
  const key = `login_fail_${ip}`;
  try {
    await env.NAV_AUTH.delete(key);
  } catch (e) {
    // 忽略清除失败
  }
}
