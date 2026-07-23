// functions/lib/home-renderer.js
// 首页 HTML 分层构建：shell → header → main content → replacements

import { escapeHTML, sanitizeUrl, sanitizeStyleColor, getStyleStr } from './utils';
import { FONT_MAP } from '../constants';
import { renderHorizontalMenu, renderVerticalMenu } from './menu-renderer';
import { renderSiteCards, renderEmptyState } from './card-renderer';
import { buildCardHydrationState } from './card-model';
import { resolveWallpaperUrl } from './wallpaper-defaults';

// ─── Page Shell ───────────────────────────────────────────

export function buildPageShell(settings) {
  const wallpaperUrl = resolveWallpaperUrl(settings.layout_custom_wallpaper, settings.layout_card_style);
  const isCustomWallpaper = Boolean(wallpaperUrl);
  const safeWallpaperUrl = sanitizeUrl(wallpaperUrl);
  const defaultBgColor = '#fdf8f3';

  let bgLayerHtml;
  if (safeWallpaperUrl) {
    const blurStyle = settings.layout_enable_bg_blur
      ? `filter: blur(${settings.layout_bg_blur_intensity}px); transform: scale(1.02);`
      : '';
    bgLayerHtml = `<div id="fixed-background" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -9999; pointer-events: none; overflow: hidden;"><img src="${safeWallpaperUrl}" alt="" fetchpriority="high" style="width: 100%; height: 100%; object-fit: cover; ${blurStyle}" /></div>`;
  } else {
    bgLayerHtml = `<div id="fixed-background" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -9999; pointer-events: none; background-color: ${defaultBgColor};"></div>`;
  }

  const categoryPosition = normalizeCategoryPosition(settings.home_category_position, settings.layout_menu_layout);
  const pageStyleClasses = [
    settings.layout_card_style === 'style4' ? 'desktop-page-style4' : (settings.layout_card_style === 'style3' ? 'desktop-page-style3' : ''),
    settings.mobile_layout_card_style === 'style4' ? 'mobile-page-style4' : (settings.mobile_layout_card_style === 'style3' ? 'mobile-page-style3' : ''),
    `category-pos-${categoryPosition}`,
  ].filter(Boolean).join(' ');

  return {
    isCustomWallpaper,
    safeWallpaperUrl,
    bgLayerHtml,
    pageStyleClasses,
    categoryPosition,
  };
}

function normalizeCategoryPosition(position, menuLayout) {
  if (position === 'above_description') return 'top';
  if (['below_search', 'above_search', 'left', 'top'].includes(position)) return position;
  return menuLayout === 'vertical' ? 'left' : 'below_search';
}

// ─── Theme ────────────────────────────────────────────────

export function computeThemeClasses(isCustomWallpaper) {
  return isCustomWallpaper ? {
    headerClass: 'bg-transparent border-none shadow-none transition-colors duration-300',
    containerClass: 'rounded-2xl',
    titleColorClass: 'text-gray-900 dark:text-gray-100',
    subTextColorClass: 'text-gray-600 dark:text-gray-300',
    searchInputClass: 'bg-white/90 backdrop-blur border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-primary-200 focus:border-primary-400 focus:bg-white dark:bg-gray-800/90 dark:border-gray-600 dark:text-gray-200 dark:focus:bg-gray-800',
    searchIconClass: 'text-gray-400 dark:text-gray-500',
  } : {
    headerClass: 'bg-primary-700 text-white border-b border-primary-600 shadow-sm dark:bg-gray-900 dark:border-gray-800',
    containerClass: 'rounded-2xl border border-primary-100/60 bg-white/80 backdrop-blur-sm shadow-sm dark:bg-gray-800/80 dark:border-gray-700',
    titleColorClass: 'text-white',
    subTextColorClass: 'text-primary-100/90 dark:text-gray-400',
    searchInputClass: 'bg-white/15 text-white placeholder-primary-200 focus:ring-white/30 focus:bg-white/20 border-none dark:bg-gray-800/50 dark:text-gray-200 dark:placeholder-gray-500',
    searchIconClass: 'text-primary-200 dark:text-gray-500',
  };
}

// ─── Header Section ───────────────────────────────────────

export function buildHeaderSection(ctx) {
  const { settings, isCustomWallpaper, themeClasses, shell } = ctx;
  const categoryPosition = shell.categoryPosition;
  const isHorizontal = categoryPosition !== 'left';

  const titleHtml = buildTitleBlock(ctx, themeClasses);
  const searchHtml = buildSearchBar(ctx, themeClasses);

  if (!isHorizontal) {
    return `
    <div class="max-w-4xl mx-auto text-center relative z-10 ${isCustomWallpaper ? 'custom-wallpaper' : ''} py-8">
      <div class="home-title-block mb-8">${titleHtml}</div>
      <div class="home-search-shell relative max-w-xl mx-auto">
        ${searchHtml}
      </div>
    </div>`;
  }

  const categoryNavHtml = buildCategoryNav(ctx);

  return `
    <div class="max-w-5xl mx-auto text-center relative z-10 ${isCustomWallpaper ? 'custom-wallpaper' : ''}">
      ${categoryPosition === 'top' ? `<div class="category-nav-top-wrap">${categoryNavHtml}</div>` : ''}
      <div class="home-title-block max-w-4xl mx-auto mb-8">${titleHtml}</div>
      ${categoryPosition === 'above_search' ? `<div class="mb-8">${categoryNavHtml}</div>` : ''}
      <div class="home-search-shell relative max-w-xl mx-auto ${categoryPosition === 'below_search' ? 'mb-8' : ''}">
        ${searchHtml}
      </div>
      ${categoryPosition === 'below_search' ? categoryNavHtml : ''}
    </div>`;
}

function buildTitleBlock(ctx, themeClasses) {
  const { settings, siteName, siteDescription } = ctx;
  const titleStyle = getStyleStr(settings.home_title_size, settings.home_title_color, settings.home_title_font);
  const subtitleStyle = getStyleStr(settings.home_subtitle_size, settings.home_subtitle_color, settings.home_subtitle_font);

  let html = '';
  if (!settings.layout_hide_title) {
    html += `<h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-3 ${themeClasses.titleColorClass}" ${titleStyle}>${escapeHTML(siteName)}</h1>`;
  }
  if (!settings.layout_hide_subtitle) {
    html += `<p class="${themeClasses.subTextColorClass} opacity-90 text-sm md:text-base" ${subtitleStyle}>${escapeHTML(siteDescription)}</p>`;
  }
  return html;
}

function buildSearchBar(ctx, themeClasses) {
  const { settings } = ctx;
  const engines = parseSearchEngines(settings.home_search_engines);
  const engineOptionsHtml = settings.home_search_engine_enabled ? buildSearchEngineSwitcher(engines) : '';

  return `
    ${engineOptionsHtml}
    <div class="home-search-field relative">
      <input type="search" placeholder="搜索书签..." class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${themeClasses.searchInputClass}" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="search" enterkeyhint="search" aria-label="搜索书签" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
      <svg xmlns="http://www.w3.org/2000/svg" class="home-search-icon h-6 w-6 absolute left-4 top-3.5 ${themeClasses.searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
    </div>`;
}

function parseSearchEngines(raw) {
  const defaults = [
    {"name":"站内","url":"local","icon":""},
    {"name":"Google","url":"https://www.google.com/search?q=%s","icon":"https://faviconsnap.com/api/favicon?url=https://google.com&size=32"},
    {"name":"Baidu","url":"https://www.baidu.com/s?wd=%s","icon":"https://faviconsnap.com/api/favicon?url=https://baidu.com&size=32"},
    {"name":"Github","url":"https://github.com/search?q=%s","icon":"https://faviconsnap.com/api/favicon?url=https://github.com&size=32"}
  ];
  try {
    const parsed = JSON.parse(raw || '[]');
    return parsed.length ? parsed : defaults;
  } catch {
    return defaults;
  }
}

function buildSearchEngineSwitcher(engines) {
  return `
    <div class="search-engine-popup-wrapper">
        <button class="search-engine-icon-btn" onclick="event.stopPropagation();this.nextElementSibling.classList.toggle('hidden')" aria-label="切换搜索引擎" data-engine="${escapeHTML(engines[0].url)}">
            ${engines[0].icon ? `<img src="${escapeHTML(engines[0].icon)}" class="search-engine-current-icon" alt="">` : escapeHTML(engines[0].name[0] || '?')}
        </button>
        <div class="search-engine-popup hidden">
            ${engines.map(e => `
            <button class="search-engine-popup-item" data-engine="${escapeHTML(e.url)}" onclick="document.querySelector('.search-engine-icon-btn').setAttribute('data-engine','${escapeHTML(e.url)}');this.closest('.search-engine-popup').classList.add('hidden');IoriHome?.setSearchEngine?.('${escapeHTML(e.url)}')">
                ${e.icon ? `<img src="${escapeHTML(e.icon)}" alt="">` : `<span>${escapeHTML(e.name[0]||'?')}</span>`}
                <span>${escapeHTML(e.name)}</span>
            </button>`).join('')}
        </div>
    </div>`;
}

function buildCategoryNav(ctx) {
  const { settings, rootCategories, currentCatalogName } = ctx;
  const categoryFlow = settings.home_category_flow === 'multi_line' ? 'multi_line' : 'single_line';
  const catalogExists = ctx.catalogExists;
  const allLinkClass = catalogExists ? 'inactive' : 'active';
  const allLinkActiveMarker = catalogExists ? '' : 'nav-item-active';

  const horizontalAllLink = `
    <div class="menu-item-wrapper relative inline-block text-left">
      <a href="?catalog=all" class="nav-btn ${allLinkClass} ${allLinkActiveMarker}">全部</a>
    </div>`;

  const horizontalMarkup = horizontalAllLink + renderHorizontalMenu(rootCategories, currentCatalogName);

  const justifyClass = categoryFlow === 'multi_line' ? 'justify-start' : 'justify-center';
  const wrapClass = categoryFlow === 'multi_line' ? 'flex-wrap' : 'flex-nowrap';
  const flowClass = categoryFlow === 'multi_line' ? 'is-multi-line' : 'is-single-line';
  const moreHtml = categoryFlow === 'multi_line' ? '' : `
          <div id="horizontalMoreWrapper" class="relative hidden">
            <button id="horizontalMoreBtn" class="nav-btn inactive">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
            </button>
            <div id="horizontalMoreDropdown" class="dropdown-menu hidden absolute mt-2 w-auto z-50"></div>
          </div>`;

  return `
      <div class="horizontal-category-nav-shell relative mx-auto">
        <div id="horizontalCategoryNav" class="flex ${wrapClass} ${justifyClass} items-center gap-3 overflow-visible ${flowClass} transition-all duration-300">
          ${horizontalMarkup}
          ${moreHtml}
        </div>
      </div>`;
}

// ─── Stats Row ────────────────────────────────────────────

export function buildStatsRow(ctx) {
  const { settings } = ctx;
  const shouldRender = !settings.home_hide_stats || !settings.home_hide_hitokoto;
  const pyClass = shouldRender ? 'my-8' : 'hidden';
  const hiddenClass = shouldRender ? '' : 'hidden';
  const statsStyle = getStyleStr(settings.home_stats_size, settings.home_stats_color, settings.home_stats_font);
  const hitokotoStyle = getStyleStr(settings.home_hitokoto_size, settings.home_hitokoto_color, settings.home_hitokoto_font);

  return { pyClass, hiddenClass, statsStyle, hitokotoStyle };
}

// ─── Main Content ─────────────────────────────────────────

export function buildMainContent(ctx) {
  const { sites, categories, settings } = ctx;
  if (!sites || !sites.length) {
    return renderEmptyState(categories.length, settings.home_hide_admin);
  }
  return renderSiteCards(sites, settings);
}

// ─── Grid Class ───────────────────────────────────────────

export function buildGridClass(settings) {
  const getMobileGridClass = (cols) => {
    if (cols === '1') return 'grid-cols-1';
    if (cols === '3') return 'grid-cols-3';
    return 'grid-cols-2';
  };
  const getDesktopGridClass = (cols) => {
    if (cols === '5') return 'md:grid-cols-3 lg:grid-cols-5';
    if (cols === '6') return 'md:grid-cols-3 lg:grid-cols-5 min-[1200px]:grid-cols-6';
    if (cols === '7') return 'md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7';
    return 'md:grid-cols-3 lg:grid-cols-4';
  };
  const getCardStyleGridClass = (style, prefix) => {
    if (style === 'style3') return `${prefix}-card-style3`;
    if (style === 'style4') return `${prefix}-card-style4`;
    return style === 'style2' ? `${prefix}-card-style2` : `${prefix}-card-style1`;
  };

  const mobileCardStyleClass = getCardStyleGridClass(settings.mobile_layout_card_style, 'mobile');
  const desktopCardStyleClass = getCardStyleGridClass(settings.layout_card_style, 'desktop');

  return `grid ${getMobileGridClass(settings.mobile_layout_grid_cols)} ${getDesktopGridClass(settings.layout_grid_cols)} ${mobileCardStyleClass} ${desktopCardStyleClass} gap-3 sm:gap-6 justify-items-center`;
}

// ─── Head Injections ──────────────────────────────────────

/**
 * 收集所有需要注入到 </head> 之前的 HTML
 */
export function collectHeadInjections(ctx) {
  const { settings, safeWallpaperUrl, env } = ctx;
  let injections = '';

  // 隐藏图标的 CSS
  if (settings.home_hide_admin) {
    injections += '<style>a[href^="/admin"] { display: none !important; }</style>';
  }

  // 壁纸预加载
  if (safeWallpaperUrl) {
    injections += `<link rel="preload" as="image" href="${safeWallpaperUrl}">\n`;
  }

  // 全局滚动样式
  injections += `<style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
    #app-scroll { width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
    body { background-color: transparent !important; }
    #fixed-background { transition: background-color 0.3s ease, filter 0.3s ease; }
    @supports (-webkit-touch-callout: none) { #fixed-background { height: -webkit-fill-available; } }
  </style>`;

  // CSS 变量
  const cardRadius = normalizeCssPixelValue(settings.layout_card_border_radius, 12);
  const mobileCardRadius = normalizeCssPixelValue(settings.mobile_layout_card_border_radius, cardRadius);
  const frostedBlur = normalizeCssPixelValue(settings.layout_frosted_glass_intensity, 15);
  const mobileFrostedBlur = normalizeCssPixelValue(settings.mobile_layout_frosted_glass_intensity, frostedBlur);
  injections += `<style>:root { --card-padding: 1.25rem; --card-radius: ${cardRadius}px; --frosted-glass-blur: ${frostedBlur}px; }@media (max-width: 767px) { :root { --card-radius: ${mobileCardRadius}px; --frosted-glass-blur: ${mobileFrostedBlur}px; } }</style>`;

  // 字体链接
  const fontInjection = collectFontInjections(settings);
  if (fontInjection.css) injections += fontInjection.css;
  if (fontInjection.preconnects) injections += fontInjection.preconnects;

  // Logo icon preconnect
  if (env.ICON_API) {
    try {
      const iconOrigin = new URL(env.ICON_API).origin;
      injections += `<link rel="preconnect" href="${escapeHTML(iconOrigin)}" crossorigin>`;
    } catch { /* ICON_API 格式异常时静默跳过 */ }
  }

  // 卡片自定义字体 CSS
  const cardCss = collectCardCustomCss(settings);
  if (cardCss) injections += `<style>${cardCss}</style>`;

  return injections;
}

function collectFontInjections(settings) {
  const usedFonts = new Set();
  if (!settings.layout_hide_title && settings.home_title_font) usedFonts.add(settings.home_title_font);
  if (!settings.layout_hide_subtitle && settings.home_subtitle_font) usedFonts.add(settings.home_subtitle_font);
  if (!settings.home_hide_stats && settings.home_stats_font) usedFonts.add(settings.home_stats_font);
  if (!settings.home_hide_hitokoto && settings.home_hitokoto_font) usedFonts.add(settings.home_hitokoto_font);
  if (settings.card_title_font) usedFonts.add(settings.card_title_font);
  if (settings.card_desc_font) usedFonts.add(settings.card_desc_font);
  if (settings.mobile_card_title_font) usedFonts.add(settings.mobile_card_title_font);
  if (settings.mobile_card_desc_font) usedFonts.add(settings.mobile_card_desc_font);

  let css = '';
  let preconnects = '';
  let needsPreconnect = false;

  usedFonts.forEach(font => {
    if (font && FONT_MAP[font]) {
      css += `<link rel="stylesheet" href="${FONT_MAP[font]}">`;
      needsPreconnect = true;
    }
  });

  const safeCustomFontUrl = sanitizeUrl(settings.home_custom_font_url);
  if (safeCustomFontUrl) {
    css += `<link rel="stylesheet" href="${safeCustomFontUrl}">`;
    try {
      const origin = new URL(safeCustomFontUrl).origin;
      if (origin !== 'https://fonts.loli.net') {
        preconnects += `<link rel="preconnect" href="${escapeHTML(origin)}" crossorigin>`;
      }
    } catch { /* sanitizeUrl 已校验，这里不会触达 */ }
  }

  if (needsPreconnect) {
    preconnects += `<link rel="preconnect" href="https://fonts.loli.net" crossorigin>`;
  }

  return { css, preconnects };
}

function collectCardCustomCss(settings) {
  let css = '';
  const desktopCardTitleStyle = getStyleStr(settings.card_title_size, settings.card_title_color, settings.card_title_font).replace('style="', '').replace('"', '');
  const mobileCardTitleStyle = getStyleStr(settings.mobile_card_title_size, settings.mobile_card_title_color, settings.mobile_card_title_font).replace('style="', '').replace('"', '');
  const desktopCardTitleColor = sanitizeStyleColor(settings.card_title_color);
  const mobileCardTitleColor = sanitizeStyleColor(settings.mobile_card_title_color);
  const desktopCardDescStyle = getStyleStr(settings.card_desc_size, settings.card_desc_color, settings.card_desc_font).replace('style="', '').replace('"', '');
  const mobileCardDescStyle = getStyleStr(settings.mobile_card_desc_size, settings.mobile_card_desc_color, settings.mobile_card_desc_font).replace('style="', '').replace('"', '');

  if (desktopCardTitleStyle) css += `@media (min-width: 768px) { .site-title { ${desktopCardTitleStyle} } }`;
  if (mobileCardTitleStyle) css += `@media (max-width: 767px) { .site-title { ${mobileCardTitleStyle} } }`;
  if (desktopCardTitleColor) css += `@media (min-width: 768px) { body { --desktop-card-title-color: ${desktopCardTitleColor}; } }`;
  if (mobileCardTitleColor) css += `@media (max-width: 767px) { body { --mobile-card-title-color: ${mobileCardTitleColor}; } }`;
  if (desktopCardDescStyle) css += `@media (min-width: 768px) { .site-card p { ${desktopCardDescStyle} } }`;
  if (mobileCardDescStyle) css += `@media (max-width: 767px) { .site-card p { ${mobileCardDescStyle} } }`;

  return css;
}

function normalizeCssPixelValue(value, fallback) {
  const normalized = String(value ?? '').trim().replace(/[^0-9]/g, '');
  if (normalized === '') return String(fallback);
  return normalized;
}

// ─── Actions HTML ─────────────────────────────────────────

export function buildActionsHtml(ctx) {
  const { settings, shell } = ctx;
  const isHorizontal = shell.categoryPosition !== 'left';

  const themeIconHtml = `
    <button id="themeToggleBtn" class="top-action-icon theme-action-icon" title="切换主题">
      <svg id="themeIconSun" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block dark:hidden"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
      <svg id="themeIconMoon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden dark:block"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    </button>`;

  let adminIconHtml = '';
  if (!settings.home_hide_admin && isHorizontal) {
    adminIconHtml = `
        <a href="/admin" target="_blank" class="top-action-icon admin-action-icon" title="后台管理">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M7 18a5 5 0 0 1 10 0"/></svg>
        </a>`;
  }

  const topRightActionsHtml = `<div class="fixed top-4 right-4 z-50 flex items-center gap-3">${themeIconHtml}${adminIconHtml}</div>`;

  const mobileToggleVisibilityClass = isHorizontal ? 'min-[550px]:hidden' : 'lg:hidden';
  const leftTopActionHtml = `
    <div class="fixed top-4 left-4 z-50 ${mobileToggleVisibilityClass}">
      <button id="sidebarToggle" class="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary-500 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
    </div>`;

  const sidebarClass = isHorizontal ? 'min-[550px]:hidden' : '';
  const mainClass = isHorizontal ? '' : 'lg:ml-64';
  const sidebarToggleClass = isHorizontal ? '!hidden' : '';

  return {
    topRightActionsHtml,
    leftTopActionHtml,
    sidebarClass,
    mainClass,
    sidebarToggleClass,
  };
}

// ─── Top-Level Composer ───────────────────────────────────

/**
 * 构建模板替换映射表
 */
export function buildTemplateReplacements(ctx) {
  const { settings, env, currentCatalogName, catalogExists, requestUrl } = ctx;
  const siteName = settings.home_site_name || env.SITE_NAME || '灰色轨迹';
  const siteDescription = settings.home_site_description || env.SITE_DESCRIPTION || '一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全基于 Cloudflare 全家桶构建';
  const footerText = settings.home_footer_text || env.FOOTER_TEXT || '曾梦想仗剑走天涯';

  const headingPlainText = currentCatalogName ? `${currentCatalogName} · ${ctx.sites.length} 个书签` : `全部收藏 · ${ctx.sites.length} 个书签`;

  const { hitokotoStyle, statsStyle, pyClass, hiddenClass } = buildStatsRow(ctx);
  const actions = buildActionsHtml(ctx);
  const canonicalUrl = `${new URL(requestUrl).origin}/`;
  const ogImageUrl = `${canonicalUrl}favicon.svg`;

  const catalogLinkMarkup = renderVerticalMenu(ctx.rootCategories, currentCatalogName, ctx.isCustomWallpaper);

  return {
    // 来自 shell
    HEADER_CLASS: ctx.themeClasses.headerClass,
    CONTAINER_CLASS: ctx.themeClasses.containerClass,
    FOOTER_CLASS: ctx.isCustomWallpaper
      ? 'bg-transparent py-8 px-6 mt-12 border-none shadow-none'
      : 'bg-white py-8 px-6 mt-12 border-t border-primary-100 dark:bg-gray-900 dark:border-gray-800',
    HITOKOTO_CLASS: (ctx.isCustomWallpaper ? 'text-black dark:text-gray-200' : 'text-gray-500 dark:text-gray-400') + ' ml-auto',

    // 来自 header
    HEADER_CONTENT: ctx.headerContent,

    // 来自 actions
    LEFT_TOP_ACTION: actions.leftTopActionHtml,
    RIGHT_TOP_ACTION: actions.topRightActionsHtml,
    SIDEBAR_CLASS: actions.sidebarClass,
    MAIN_CLASS: actions.mainClass,
    SIDEBAR_TOGGLE_CLASS: actions.sidebarToggleClass,

    // 文本
    SITE_NAME: siteName,
    SITE_DESCRIPTION: siteDescription,
    FOOTER_TEXT: footerText,
    CANONICAL_URL: canonicalUrl,
    OG_IMAGE_URL: ogImageUrl,
    HEADING_TEXT: headingPlainText,
    HEADING_DEFAULT: headingPlainText,
    HEADING_ACTIVE: catalogExists ? currentCatalogName : '',
    HITOKOTO_CONTENT: settings.home_hide_hitokoto ? '' : '疏影横斜水清浅,暗香浮动月黄昏。',
    CURRENT_YEAR: String(new Date().getFullYear()),
    CATALOG_EXISTS: catalogExists ? 'true' : 'false',
    CATALOG_LINKS: catalogLinkMarkup,
    SUBMISSION_CLASS: String(ctx.submissionEnabled) === 'true' ? '' : '!hidden',
    STATS_VISIBLE: settings.home_hide_stats ? 'hidden' : '',
    STATS_STYLE: statsStyle,
    HITOKOTO_VISIBLE: settings.home_hide_hitokoto ? 'hidden' : '',
    STATS_ROW_PY_CLASS: pyClass,
    STATS_ROW_HIDDEN: hiddenClass,
    HITOKOTO_STYLE: hitokotoStyle,
    SITES_GRID: ctx.mainContentHtml,
  };
}

/**
 * 组装页面所有组成部分，返回用于模板注入的碎片
 */
export function assemblePage(ctx) {
  const { shell, isCustomWallpaper } = ctx;

  // 构建 header content
  const headerContent = buildHeaderSection(ctx);

  // 构建 main content
  const mainContentHtml = buildMainContent(ctx);

  // 构建 grid class
  const gridClass = buildGridClass(ctx.settings);

  // 构建 hydration 数据
  const cardHydrationState = buildCardHydrationState(ctx.allSites, ctx.settings);
  const safeSitesJson = JSON.stringify(cardHydrationState.cards).replace(/</g, '\\u003c');
  const safeCardConfigJson = JSON.stringify(cardHydrationState.config).replace(/</g, '\\u003c');
  const safeCardConfigsJson = JSON.stringify(cardHydrationState.configs).replace(/</g, '\\u003c');
  const safeLayoutConfigJson = JSON.stringify({
    hideDesc: ctx.settings.layout_hide_desc,
    hideLinks: ctx.settings.layout_hide_links,
    hideCategory: ctx.settings.layout_hide_category,
    gridCols: ctx.settings.layout_grid_cols,
    cardStyle: ctx.settings.layout_card_style,
    cardAnimation: ctx.settings.layout_card_animation,
    enableFrostedGlass: ctx.settings.layout_enable_frosted_glass,
    rememberLastCategory: ctx.settings.home_remember_last_category,
    ssrCatalogId: ctx.catalogExists ? ctx.requestedCatalogId : 'all',
  }).replace(/</g, '\\u003c');

  const headInjections = collectHeadInjections(ctx);

  // 注入到 ctx 供 buildTemplateReplacements 使用
  ctx.headerContent = headerContent;
  ctx.mainContentHtml = mainContentHtml;

  return {
    headerContent,
    mainContentHtml,
    gridClass,
    headInjections,
    bodyClass: `bg-secondary-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 relative ${isCustomWallpaper ? 'custom-wallpaper' : ''} ${shell.pageStyleClasses}`,
    bodyStartHtml: `${shell.bgLayerHtml}<div id="app-scroll">`,
    hydrationScript: `<script>window.IORI_SITES=${safeSitesJson};window.IORI_CARD_CONFIG=${safeCardConfigJson};window.IORI_CARD_CONFIGS=${safeCardConfigsJson};window.IORI_LAYOUT_CONFIG=${safeLayoutConfigJson};</script>`,
  };
}
