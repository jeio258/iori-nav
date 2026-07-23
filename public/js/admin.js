// public/js/admin.js
// 管理后台入口 - ES module bundle entry

import './admin-cache.js';
import './admin-shared.js';
import './admin-tabs.js';
import './admin-bookmark-list.js';
import './admin-bookmark-privacy.js';
import './admin-pending.js';
import './admin-bookmarks.js';
import './admin-categories.js';
import './admin-batch.js';
import './admin-import-export.js';
import './admin-settings-defaults.js';
import './wallpaper-defaults.js';
import './admin-settings-preview-shared.js';
import './admin-settings-preview-data.js';
import './admin-settings-preview-nav.js';
import './admin-settings-preview-animation.js';
import './admin-settings-preview-render.js';
import './admin-settings-preview-controls.js';
import './admin-settings-preview.js';
import './admin-settings-form.js';
import './admin-settings-core.js';
import './admin-settings-wallpaper.js';
import './admin-settings-ai.js';
import './admin-settings.js';

(function () {
  function initAdminPage() {
    window.AdminBookmarkList?.init?.();
    window.AdminPending?.init?.();
    window.AdminTabs?.init?.();
    window.AdminBookmarkPrivacy?.init?.();

    window.loadGlobalCategories?.()
      ?.catch?.(err => console.error('Failed to load categories:', err));
  }

  initAdminPage();
})();
