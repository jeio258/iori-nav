// functions/lib/cache-dirty.js
// 首页 HTML 的 KV 缓存 dirty 标记管理

import { HOME_CACHE_VERSION, HOME_CACHE_TTL } from '../constants';

export function getHomeCacheKey(scope) {
  return `home_html_${scope}_${HOME_CACHE_VERSION}`;
}

export function getHomeDirtyKey(scope) {
  return `home_dirty_${scope}_${HOME_CACHE_VERSION}`;
}

export async function getHomeCacheDirtyValue(env, scope) {
  try {
    return await env.NAV_AUTH.get(getHomeDirtyKey(scope));
  } catch (e) {
    console.error('Failed to read home cache dirty value:', e);
    return null;
  }
}

export async function clearHomeCache(env, scope = 'all') {
  try {
    const keys = [];
    if (scope === 'all' || scope === 'public') {
      keys.push(getHomeCacheKey('public'));
    }
    if (scope === 'all' || scope === 'private') {
      keys.push(getHomeCacheKey('private'));
    }
    await Promise.all(keys.map(key => env.NAV_AUTH.delete(key)));
  } catch (e) {
    console.error('Failed to clear home cache:', e);
  }
}

export async function markHomeCacheDirty(env, scope = 'all') {
  try {
    const keys = [];
    const dirtyValue = crypto.randomUUID();
    if (scope === 'all' || scope === 'public') {
      keys.push(getHomeDirtyKey('public'));
    }
    if (scope === 'all' || scope === 'private') {
      keys.push(getHomeDirtyKey('private'));
    }
    await Promise.all(
      keys.map(key => env.NAV_AUTH.put(key, dirtyValue, { expirationTtl: HOME_CACHE_TTL }))
    );
  } catch (e) {
    console.error('Failed to mark home cache dirty:', e);
  }
}

export async function clearHomeCacheDirty(env, scope = 'all', expectedValue = null) {
  try {
    const keys = [];
    if (scope === 'all' || scope === 'public') {
      keys.push(getHomeDirtyKey('public'));
    }
    if (scope === 'all' || scope === 'private') {
      keys.push(getHomeDirtyKey('private'));
    }
    await Promise.all(keys.map(async (key) => {
      if (expectedValue === null) {
        await env.NAV_AUTH.delete(key);
        return;
      }
      const latestValue = await env.NAV_AUTH.get(key);
      if (latestValue === expectedValue) {
        await env.NAV_AUTH.delete(key);
      }
    }));
  } catch (e) {
    console.error('Failed to clear home cache dirty flag:', e);
  }
}

export async function isHomeCacheDirty(env, scope) {
  try {
    const value = await getHomeCacheDirtyValue(env, scope);
    return !!value;
  } catch (e) {
    console.error('Failed to check home cache dirty flag:', e);
    return false;
  }
}
