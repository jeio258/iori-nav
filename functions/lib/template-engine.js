// functions/lib/template-engine.js
// 模板加载、缓存与类型化占位符替换

import { escapeHTML } from './utils';

// 占位符分类：HTML 类型允许完整 HTML 片段，TEXT 类型强制转义
const HTML_PLACEHOLDERS = new Set([
  'HEADER_CONTENT',
  'CATALOG_LINKS',
  'SITES_GRID',
  'LEFT_TOP_ACTION',
  'RIGHT_TOP_ACTION',
]);

const TEXT_PLACEHOLDERS = new Set([
  'SITE_NAME',
  'SITE_DESCRIPTION',
  'FOOTER_TEXT',
  'HEADING_TEXT',
  'HEADING_DEFAULT',
  'HEADING_ACTIVE',
  'HITOKOTO_CONTENT',
  'CURRENT_YEAR',
  'CANONICAL_URL',
  'OG_IMAGE_URL',
]);

const BOOLEAN_PLACEHOLDERS = new Set([
  'CATALOG_EXISTS',
  'STATS_VISIBLE',
  'HITOKOTO_VISIBLE',
  'STATS_ROW_HIDDEN',
]);

const CLASS_PLACEHOLDERS = new Set([
  'HEADER_CLASS',
  'CONTAINER_CLASS',
  'FOOTER_CLASS',
  'HITOKOTO_CLASS',
  'STATS_ROW_PY_CLASS',
  'SIDEBAR_CLASS',
  'MAIN_CLASS',
  'SIDEBAR_TOGGLE_CLASS',
  'SUBMISSION_CLASS',
]);

const STYLE_ATTR_PLACEHOLDERS = new Set([
  'STATS_STYLE',
  'HITOKOTO_STYLE',
]);

// 所有已知占位符
const ALL_PLACEHOLDERS = new Set([
  ...HTML_PLACEHOLDERS,
  ...TEXT_PLACEHOLDERS,
  ...BOOLEAN_PLACEHOLDERS,
  ...CLASS_PLACEHOLDERS,
  ...STYLE_ATTR_PLACEHOLDERS,
]);

/**
 * 加载并缓存 index.html 模板
 * 模板内容在 Worker 运行时实例生命周期内不变，缓存避免每次 MISS 重复 ASSETS.fetch
 */
let cachedTemplateHtml = null;

export async function getTemplateHtml(env, requestUrl) {
  if (cachedTemplateHtml !== null) return cachedTemplateHtml;
  const res = await env.ASSETS.fetch(new URL('/index.html', requestUrl));
  cachedTemplateHtml = await res.text();
  return cachedTemplateHtml;
}

/**
 * 替换模板中所有 {{PLACEHOLDER}} 占位符
 * @param {string} html - 原始 HTML 模板
 * @param {object} map - { PLACEHOLDER: value, ... }
 * @param {object} [opts]
 * @param {boolean} [opts.strict=false] - 严格模式：未映射的占位符 console.warn
 * @returns {string}
 */
export function applyPlaceholders(html, map, opts = {}) {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in map)) {
      if (opts.strict) {
        console.warn(`[template-engine] Missing placeholder: {{${key}}}`);
      }
      return match;
    }

    const value = map[key];

    // TEXT 类型强制转义
    if (TEXT_PLACEHOLDERS.has(key)) {
      return escapeHTML(String(value));
    }

    return String(value);
  });
}

/**
 * 将内容注入到 </head> 之前
 * @param {string} html
 * @param {string} injections - 要注入的 HTML 字符串
 * @returns {string}
 */
export function injectIntoHead(html, injections) {
  if (!injections) return html;
  return html.replace('</head>', `${injections}</head>`);
}

/**
 * 在指定 marker 字符串之前注入代码
 * @param {string} html
 * @param {string} marker - 在 HTML 中搜索的标记字符串
 * @param {string} code - 要注入的代码
 * @returns {string}
 */
export function injectBeforeMarker(html, marker, code) {
  if (!html.includes(marker)) {
    console.error(`[template-engine] injectBeforeMarker: marker not found`);
    return html;
  }
  // 使用函数式 replacement 避免 code 中的 $& 等被当作 back-reference
  return html.replace(marker, () => `${code}\n${marker}`);
}

/**
 * 验证占位符映射表是否都在已知集合中（开发用）
 * @param {object} map
 */
export function validatePlaceholders(map) {
  for (const key of Object.keys(map)) {
    if (!ALL_PLACEHOLDERS.has(key)) {
      console.warn(`[template-engine] Unknown placeholder: {{${key}}}`);
    }
  }
}
