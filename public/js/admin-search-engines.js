// public/js/admin-search-engines.js
// 搜索引擎管理面板

(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  const defaultEngines = [
    { name: '站内', url: 'local', icon: '' },
    { name: 'Google', url: 'https://www.google.com/search?q=%s', icon: 'https://faviconsnap.com/api/favicon?url=https://google.com&size=32' },
    { name: 'Baidu', url: 'https://www.baidu.com/s?wd=%s', icon: 'https://faviconsnap.com/api/favicon?url=https://baidu.com&size=32' },
    { name: 'Github', url: 'https://github.com/search?q=%s', icon: 'https://faviconsnap.com/api/favicon?url=https://github.com&size=32' },
  ];

  function getEngines() {
    try {
      const raw = ns.currentSettings?.home_search_engines;
      if (!raw || raw === '[]') {
        const defaults = [...defaultEngines];
        if (ns.currentSettings) {
          ns.currentSettings.home_search_engines = JSON.stringify(defaults);
          ns.currentSettings.home_search_engine_enabled = true;
        }
        return defaults;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const defaults = [...defaultEngines];
        if (ns.currentSettings) {
          ns.currentSettings.home_search_engines = JSON.stringify(defaults);
          ns.currentSettings.home_search_engine_enabled = true;
        }
        return defaults;
      }
      // Ensure 站内 is always first
      const localIdx = parsed.findIndex(e => e.url === 'local');
      if (localIdx > 0) {
        const local = parsed.splice(localIdx, 1)[0];
        parsed.unshift(local);
      } else if (localIdx === -1) {
        parsed.unshift({ name: '站内', url: 'local', icon: '' });
      }
      return parsed;
    } catch {
      return [...defaultEngines];
    }
  }

  function saveEngines(engines) {
    ns.currentSettings.home_search_engines = JSON.stringify(engines);
    // Also enable search engine display when there are external engines
    ns.currentSettings.home_search_engine_enabled = engines.length > 1;
  }

  function renderEngineList() {
    const list = document.getElementById('searchEngineList');
    if (!list) return;

    const engines = getEngines();

    list.innerHTML = engines.map((eng, idx) => {
      const isLocal = eng.url === 'local';
      const starHtml = !isLocal && idx === 1
        ? '<span class="text-yellow-500 text-xs ml-1" title="默认引擎">★</span>'
        : (!isLocal ? `<button class="text-gray-300 hover:text-yellow-500 text-xs ml-1 set-default-btn" data-idx="${idx}" title="设为默认">☆</button>` : '');
      const deleteHtml = !isLocal
        ? `<button class="text-gray-400 hover:text-red-500 ml-1 delete-engine-btn" data-idx="${idx}" title="删除">✕</button>`
        : '';
      const dragHandle = !isLocal
        ? '<span class="text-gray-300 cursor-grab mr-1 drag-handle" title="拖拽排序">☰</span>'
        : '<span class="text-gray-200 mr-1">☰</span>';

      return `
        <div class="search-engine-row flex items-center gap-2 px-2 py-1.5 bg-white rounded border border-gray-200 text-sm" data-idx="${idx}">
          ${dragHandle}
          ${eng.icon ? `<img src="${window.escapeHTML(eng.icon)}" class="w-5 h-5 rounded object-cover" alt="" onerror="this.style.display='none'">` : '<span class="w-5 h-5 flex items-center justify-center text-xs bg-gray-200 rounded">' + (eng.name[0] || '?') + '</span>'}
          <span class="flex-1 truncate">${window.escapeHTML(eng.name)}</span>
          <span class="text-xs text-gray-400 truncate max-w-[140px] hidden sm:inline">${isLocal ? '—' : window.escapeHTML(eng.url)}</span>
          ${starHtml}
          ${deleteHtml}
        </div>`;
    }).join('');

    bindEngineRowEvents();
  }

  function bindEngineRowEvents() {
    // Set default
    document.querySelectorAll('.set-default-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const engines = getEngines();
        if (idx > 0 && idx < engines.length) {
          const [moved] = engines.splice(idx, 1);
          engines.splice(1, 0, moved); // after 站内
          saveEngines(engines);
          renderEngineList();
        }
      });
    });

    // Delete
    document.querySelectorAll('.delete-engine-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('确定删除这个搜索引擎？')) return;
        const idx = parseInt(btn.dataset.idx);
        const engines = getEngines();
        if (idx > 0 && idx < engines.length) {
          engines.splice(idx, 1);
          saveEngines(engines);
          renderEngineList();
        }
      });
    });
  }

  function initAddEngineModal() {
    const addBtn = document.getElementById('addSearchEngineBtn');
    const modal = document.getElementById('addEngineModal');
    const cancelBtn = document.getElementById('cancelAddEngine');
    const saveBtn = document.getElementById('saveNewEngine');
    const nameInput = document.getElementById('newEngineName');
    const urlInput = document.getElementById('newEngineUrl');
    const iconInput = document.getElementById('newEngineIcon');

    if (!addBtn || !modal) return;

    addBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      nameInput.value = '';
      urlInput.value = '';
      iconInput.value = '';
      nameInput.focus();
    });

    function closeModal() {
      modal.classList.add('hidden');
    }

    cancelBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    saveBtn?.addEventListener('click', () => {
      const name = nameInput.value.trim();
      let url = urlInput.value.trim();
      const icon = iconInput.value.trim();

      if (!name) { alert('请输入搜索引擎名称'); return; }
      if (!url) { alert('请输入搜索 URL'); return; }
      if (!url.includes('%s')) { alert('URL 必须包含 %s 作为搜索词占位符'); return; }

      // Auto-prepend https:// if missing
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }

      const engines = getEngines();
      engines.push({ name, url, icon });
      saveEngines(engines);
      renderEngineList();
      closeModal();
    });
  }

  // Expose to be called from admin.js init
  ns.searchEngines = {
    init() {
      renderEngineList();
      initAddEngineModal();
    },
    render: renderEngineList,
  };
})();
