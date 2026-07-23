(function () {
  const Home = window.IoriHome = window.IoriHome || {};

  Home.initSearch = function () {
    const sitesGrid = document.getElementById('sitesGrid');
    const searchInputs = document.querySelectorAll('.search-input-target');
    /* engineOptions replaced by popup */
    let searchCardCache = null;
    let searchDebounceTimer = null;
    let currentSearchEngine = 'local';

  Home.setSearchEngine = function(url) {
    currentSearchEngine = url === 'local' ? 'local' : url;
    localStorage.setItem('search_engine', currentSearchEngine);
    updateSearchEngineUI(currentSearchEngine);
    reapplyLocalSearchFilter();
  };

    function clearSearchCardCache() {
      searchCardCache = null;
    }

    // 预缓存卡片搜索数据：从 IORI_SITES 按 data-id 查表，避免把数据再塞进 card 的 data-* 属性
    function getSearchCardCache() {
      if (searchCardCache) return searchCardCache;
      const cards = sitesGrid?.querySelectorAll('.site-card');
      if (!cards) return [];
      const sitesById = new Map();
      (window.IORI_SITES || []).forEach(s => sitesById.set(String(s.id), s));
      searchCardCache = Array.from(cards).map(card => {
        const id = card.getAttribute('data-id');
        const s = sitesById.get(String(id)) || {};
        const text = (s.searchText || [s.nameHtml, s.urlHtml, s.catalogHtml, s.descHtml]
          .map(v => String(v || '').toLowerCase()).join('\0'));
        return { el: card, text };
      });
      return searchCardCache;
    }

    function getCurrentLocalSearchKeyword() {
      if (currentSearchEngine !== 'local') return '';
      for (const input of searchInputs) {
        const keyword = input.value.trim();
        if (keyword) return keyword;
      }
      return '';
    }

    function applyLocalSearchFilter(keyword) {
      const normalizedKeyword = String(keyword || '').toLowerCase().trim();
      const cached = getSearchCardCache();

      cached.forEach(({ el, text }) => {
        if (normalizedKeyword === '' || text.includes(normalizedKeyword)) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      });

      updateHeading(normalizedKeyword);
    }

    function reapplyLocalSearchFilter() {
      applyLocalSearchFilter(getCurrentLocalSearchKeyword());
    }

    function updateSearchEngineUI(engine) {
      const btn = document.querySelector('.search-engine-btn');
      const items = document.querySelectorAll('.search-engine-popup-item');
      const field = document.querySelector('.home-search-field');
      
      let placeholder = '搜索书签...';

      // Update button icon + label from popup item
      if (btn) {
        const btnIcon = btn.querySelector('.search-engine-btn-icon');
        const btnLabel = btn.querySelector('.search-engine-btn-label');

        if (engine === 'local') {
          // Show "站内" in button
          if (btnIcon) btnIcon.style.display = 'none';
          if (btnLabel) btnLabel.textContent = '站内';
        } else {
          // Find matching popup item
          items.forEach(item => {
            if (item.dataset.engine === engine) {
              const img = item.querySelector('img');
              const name = item.querySelector('span')?.textContent;
              if (btnIcon && img) { btnIcon.src = img.src; btnIcon.style.display = ''; }
              else if (btnIcon) btnIcon.style.display = 'none';
              if (btnLabel && name) btnLabel.textContent = name;
              if (name) placeholder = name + ' 搜索...';
            }
          });
        }
      }

      // Mark active item in popup
      items.forEach(item => {
        item.classList.toggle('active', item.dataset.engine === engine);
      });

      // Update input placeholder
      searchInputs.forEach(input => {
        input.placeholder = placeholder;
        if (engine === 'local' && input.value.trim()) {
          input.dispatchEvent(new Event('input'));
        }
      });
    }

    function updateHeading(keyword, activeCatalog, count) {
      const heading = document.querySelector('[data-role="list-heading"]');
      if (!heading) return;

      const visibleCount = (count !== undefined) ? count : (sitesGrid?.querySelectorAll('.site-card:not(.hidden)').length || 0);
      const isMobile = window.innerWidth < 440;

      if (activeCatalog !== undefined) {
        if (activeCatalog) {
          heading.dataset.active = activeCatalog;
        } else {
          delete heading.dataset.active;
        }
      }

      if (keyword) {
        heading.textContent = isMobile ? `${visibleCount} 个书签` : `搜索结果 · ${visibleCount} 个书签`;
      } else {
        const currentActive = heading.dataset.active;
        if (isMobile) {
          heading.textContent = `${visibleCount} 个书签`;
        } else if (currentActive) {
          heading.textContent = `${currentActive} · ${visibleCount} 个书签`;
        } else {
          heading.textContent = `全部收藏 · ${visibleCount} 个书签`;
        }
      }
    }

    Home.clearSearchCardCache = clearSearchCardCache;
    Home.reapplyLocalSearchFilter = reapplyLocalSearchFilter;
    Home.updateHeading = updateHeading;

    // Init: restore last engine from localStorage
    const savedEngine = localStorage.getItem('search_engine');
    if (savedEngine && savedEngine !== 'local') {
      currentSearchEngine = savedEngine;
      updateSearchEngineUI(currentSearchEngine);
    }

    // Popup item clicks: update engine + close popup
    document.querySelectorAll('.search-engine-popup-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const engineUrl = item.dataset.engine;
        currentSearchEngine = engineUrl === 'local' ? 'local' : engineUrl;
        localStorage.setItem('search_engine', currentSearchEngine);
        updateSearchEngineUI(currentSearchEngine);
        item.closest('.search-engine-popup')?.classList.add('hidden');
        searchInputs.forEach(input => input.focus());
      });
    });

    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-engine-btn-wrapper')) {
        document.querySelectorAll('.search-engine-popup').forEach(p => p.classList.add('hidden'));
      }
    });

    searchInputs.forEach(input => {
      input.addEventListener('input', function () {
        if (currentSearchEngine !== 'local') return;

        const value = this.value;
        searchInputs.forEach(otherInput => {
          if (otherInput !== this) otherInput.value = value;
        });

        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          applyLocalSearchFilter(value);
        }, 200);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && currentSearchEngine !== 'local') {
          e.preventDefault();
          const query = this.value.trim();
          if (query) {
            const url = currentSearchEngine.replace(/%s/g, encodeURIComponent(query));
            window.open(url, '_blank');
          }
        }
      });
    });

    updateHeading();
  };
})();

// ESM exports for bundling
export const { initSearch } = window.IoriHome || {};

