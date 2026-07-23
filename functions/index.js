// functions/index.js
// 首页 SSR 编排器：缓存检查 → 数据加载 → 组装 → 模板注入 → 响应

import { isAdminAuthenticated, getHomeCacheKey, clearHomeCacheDirty, markHomeCacheDirty, getHomeCacheDirtyValue } from './_middleware';
import { HOME_CACHE_TTL } from './constants';
import { normalizeSortOrder } from './lib/utils';
import { getSettingsKeys, parseSettings } from './lib/settings-parser';
import { ensureSchemaReady } from './lib/schema-migration';
import { getTemplateHtml, applyPlaceholders, injectIntoHead, injectBeforeMarker } from './lib/template-engine';
import { buildPageShell, computeThemeClasses, assemblePage, buildTemplateReplacements } from './lib/home-renderer';

// ─── 1. 缓存检查 ─────────────────────────────────────────

async function checkHomeCache(env, request, isAuthenticated) {
  const url = new URL(request.url);
  const isHomePage = url.pathname === '/' && !url.search;
  if (!isHomePage) return null;

  const cacheScope = isAuthenticated ? 'private' : 'public';
  const homeCacheKey = getHomeCacheKey(cacheScope);
  const cookies = request.headers.get('Cookie') || '';
  const hasLegacyStaleCookie = cookies.includes('iori_cache_stale=1');
  const hasPublicStaleCookie = hasLegacyStaleCookie || cookies.includes('iori_cache_public_stale=1');
  const hasPrivateStaleCookie = hasLegacyStaleCookie || cookies.includes('iori_cache_private_stale=1');
  let shouldClearCookie = false;

  if (isAuthenticated && (hasPublicStaleCookie || hasPrivateStaleCookie)) {
    if (hasPublicStaleCookie && hasPrivateStaleCookie) {
      await markHomeCacheDirty(env, 'all');
    } else if (hasPublicStaleCookie) {
      await markHomeCacheDirty(env, 'public');
    } else {
      await markHomeCacheDirty(env, 'private');
    }
    shouldClearCookie = true;
  }

  let cacheDirty = false;
  let cachedHtml = null;
  try {
    const [cacheDirtyValue, html] = await Promise.all([
      getHomeCacheDirtyValue(env, cacheScope),
      env.NAV_AUTH.get(homeCacheKey),
      ensureSchemaReady(env),
    ]);
    cacheDirty = !!cacheDirtyValue;
    cachedHtml = html;
  } catch (e) {
    console.warn('Failed to read home cache:', e);
  }

  if (!cacheDirty && cachedHtml) {
    const response = new Response(cachedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': isAuthenticated ? 'private, no-store, max-age=0' : 'public, max-age=0, must-revalidate',
        'X-Cache': 'HIT',
      }
    });

    if (shouldClearCookie) {
      response.headers.append('Set-Cookie', 'iori_cache_stale=; Path=/; Max-Age=0; SameSite=Lax');
      response.headers.append('Set-Cookie', 'iori_cache_public_stale=; Path=/; Max-Age=0; SameSite=Lax');
      response.headers.append('Set-Cookie', 'iori_cache_private_stale=; Path=/; Max-Age=0; SameSite=Lax');
    }

    return { hit: true, response };
  }

  return { hit: false, response: null, shouldClearCookie, cacheDirty, cacheScope, homeCacheKey };
}

// ─── 2. 数据加载 ─────────────────────────────────────────

async function loadData(env, isAuthenticated, requestUrl) {
  const includePrivate = isAuthenticated ? 1 : 0;

  const categoryQuery = isAuthenticated
    ? 'SELECT id, catelog, sort_order, parent_id, is_private FROM category ORDER BY sort_order ASC, id ASC'
    : 'SELECT id, catelog, sort_order, parent_id FROM category WHERE is_private = 0 ORDER BY sort_order ASC, id ASC';

  const settingsKeys = getSettingsKeys();
  const settingsPlaceholders = settingsKeys.map(() => '?').join(',');
  const sitesQuery = `SELECT id, name, url, logo, desc, catelog_id, catelog_name
                      FROM sites WHERE (is_private = 0 OR ? = 1) ORDER BY sort_order ASC, create_time DESC`;

  const settingsCacheKey = 'settings_cache';
  const fetchSettings = async () => {
    try {
      const cached = await env.NAV_AUTH.get(settingsCacheKey, { type: 'json' });
      if (cached) return { results: cached, fromCache: true };
    } catch (e) {
      console.warn('Settings cache read failed:', e);
    }
    const result = await env.NAV_DB.prepare(`SELECT key, value FROM settings WHERE key IN (${settingsPlaceholders})`).bind(...settingsKeys).all();
    if (result.results && env.NAV_AUTH) {
      env.NAV_AUTH.put(settingsCacheKey, JSON.stringify(result.results), { expirationTtl: 86400 }).catch(() => {});
    }
    return result;
  };

  const [categoriesResult, settingsResult, sitesResult, templateHtml] = await Promise.all([
    env.NAV_DB.prepare(categoryQuery).all().catch(e => ({ results: [], error: e })),
    fetchSettings().catch(e => ({ results: [], error: e })),
    env.NAV_DB.prepare(sitesQuery).bind(includePrivate).all().catch(e => ({ results: [], error: e })),
    getTemplateHtml(env, requestUrl),
  ]);

  return { categoriesResult, settingsResult, sitesResult, templateHtml };
}

// ─── 3. 分类树 ───────────────────────────────────────────

function buildCategoryTree(categories) {
  const categoryMap = new Map();
  const categoryIdMap = new Map();
  const rootCategories = [];

  categories.forEach(cat => {
    cat.children = [];
    cat.sort_order = normalizeSortOrder(cat.sort_order);
    categoryMap.set(cat.id, cat);
    if (cat.catelog) categoryIdMap.set(cat.catelog, cat.id);
  });

  categories.forEach(cat => {
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id).children.push(cat);
    } else {
      rootCategories.push(cat);
    }
  });

  const sortCats = (cats) => {
    cats.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    cats.forEach(c => sortCats(c.children));
  };
  sortCats(rootCategories);

  return { categoryMap, categoryIdMap, rootCategories };
}

function resolveCatalogId(catalogValue, categoryMap, categoryIdMap, options = {}) {
  const value = String(catalogValue || '').trim();
  if (!value || value.toLowerCase() === 'all') return null;
  if (/^\d+$/.test(value)) {
    const id = Number(value);
    if (categoryMap.has(id)) return id;
  }
  return options.allowName && categoryIdMap.has(value) ? categoryIdMap.get(value) : null;
}

// ─── 4. 响应与缓存 ──────────────────────────────────────

function buildFinalResponse(html, isAuthenticated) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': isAuthenticated ? 'private, no-store, max-age=0' : 'public, max-age=0, must-revalidate',
    }
  });
}

function clearStaleCookies(response, request) {
  const cookies = request.headers.get('Cookie') || '';
  const hasStale = cookies.includes('iori_cache_stale=1')
    || cookies.includes('iori_cache_public_stale=1')
    || cookies.includes('iori_cache_private_stale=1');
  if (hasStale) {
    response.headers.append('Set-Cookie', 'iori_cache_stale=; Path=/; Max-Age=0; SameSite=Lax');
    response.headers.append('Set-Cookie', 'iori_cache_public_stale=; Path=/; Max-Age=0; SameSite=Lax');
    response.headers.append('Set-Cookie', 'iori_cache_private_stale=; Path=/; Max-Age=0; SameSite=Lax');
  }
}

// ─── 主入口 ──────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const isHomePage = url.pathname === '/' && !url.search;

  const isAuthenticated = await isAdminAuthenticated(request, env);

  // 1. 缓存检查
  if (isHomePage) {
    const cacheResult = await checkHomeCache(env, request, isAuthenticated);
    if (cacheResult && cacheResult.hit) return cacheResult.response;
  }

  // 2. 加载数据
  const { categoriesResult, settingsResult, sitesResult, templateHtml } = await loadData(env, isAuthenticated, request.url);

  // 3. 构建分类树
  const categories = categoriesResult.results || [];
  if (categoriesResult.error) console.error('Failed to fetch categories:', categoriesResult.error);
  const { categoryMap, categoryIdMap, rootCategories } = buildCategoryTree(categories);

  // 4. 解析设置
  const settings = parseSettings(settingsResult.results || settingsResult);

  // 5. 处理站点
  const allSites = sitesResult.results || [];
  if (sitesResult.error) return new Response(`Failed to fetch sites: ${sitesResult.error.message}`, { status: 500 });

  // 6. 确定目标分类
  const requestedCatalogValue = (url.searchParams.get('catalog') || '').trim();
  let requestedCatalogId = resolveCatalogId(requestedCatalogValue, categoryMap, categoryIdMap);

  if (!requestedCatalogValue) {
    const defaultCat = (settings.home_default_category || '').trim();
    requestedCatalogId = resolveCatalogId(defaultCat, categoryMap, categoryIdMap, { allowName: true });
  }

  const catalogExists = requestedCatalogId !== null;
  let currentCatalogName = '';
  let targetCategoryIds = [];

  if (catalogExists) {
    const requestedCategory = categoryMap.get(requestedCatalogId);
    currentCatalogName = requestedCategory.catelog;
    targetCategoryIds.push(requestedCatalogId);
  }

  const sites = targetCategoryIds.length > 0
    ? allSites.filter(site => targetCategoryIds.includes(site.catelog_id))
    : allSites;

  // 7. 构建 shell
  const shell = buildPageShell(settings);
  const themeClasses = computeThemeClasses(shell.isCustomWallpaper);

  // 8. 构建 ctx
  const ctx = {
    settings,
    rootCategories,
    sites,
    allSites,
    categories,
    isAuthenticated,
    isCustomWallpaper: shell.isCustomWallpaper,
    safeWallpaperUrl: shell.safeWallpaperUrl,
    env,
    siteName: settings.home_site_name || env.SITE_NAME || '灰色轨迹',
    siteDescription: settings.home_site_description || env.SITE_DESCRIPTION || '一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全基于 Cloudflare 全家桶构建',
    footerText: settings.home_footer_text || env.FOOTER_TEXT || '曾梦想仗剑走天涯',
    currentCatalogName,
    catalogExists,
    requestedCatalogId,
    submissionEnabled: String(env.ENABLE_PUBLIC_SUBMISSION) === 'true',
    themeClasses,
    shell,
    requestUrl: request.url,
  };

  // 9. 组装页面
  const assembled = assemblePage(ctx);

  // 10. 模板注入
  let html = templateHtml;

  // 注入 head
  html = injectIntoHead(html, assembled.headInjections);

  // 替换 body 标签
  html = html.replace(
    '<body class="bg-secondary-50 font-sans text-gray-800">',
    `<body class="${assembled.bodyClass}">${assembled.bodyStartHtml}`
  );
  html = html.replace('</body>', '</div></body>');

  // 注入 hydration 数据
  const mainJsMarker = '<script type="module" src="/dist/main.js';
  if (html.includes(mainJsMarker)) {
    html = injectBeforeMarker(html, mainJsMarker, assembled.hydrationScript);
  } else {
    console.error('Card hydration injection skipped: main.js marker not found in template');
  }

  // 替换占位符
  const replacements = buildTemplateReplacements(ctx);
  html = applyPlaceholders(html, replacements);

  // 替换 grid class（模板中的默认值 → 拼接值）
  html = html.replace('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6', assembled.gridClass);

  // 压缩标签间空白
  html = html.replace(/>\s+</g, '><');

  // 11. 返回响应
  const response = buildFinalResponse(html, isAuthenticated);
  clearStaleCookies(response, request);

  // 12. 异步写入缓存
  if (isHomePage) {
    const cacheScope = isAuthenticated ? 'private' : 'public';
    const homeCacheKey = getHomeCacheKey(cacheScope);
    context.waitUntil((async () => {
      try {
        await env.NAV_AUTH.put(homeCacheKey, html, { expirationTtl: HOME_CACHE_TTL });
        const dirtyValue = await getHomeCacheDirtyValue(env, cacheScope);
        if (dirtyValue) {
          await clearHomeCacheDirty(env, cacheScope, dirtyValue);
        }
      } catch (e) {
        console.warn('Failed to update home cache:', e);
      }
    })());
  }

  return response;
}
