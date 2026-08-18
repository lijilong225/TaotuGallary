/* 移动端套图管理器 */
(function () {
  'use strict';

  const state = {
    user: null,
    tree: null,
    favorites: {},   // favKey -> item
    favKey: null,    // 'favorites' view marker
    currentPath: '',
    currentMode: 'dir', // 'dir' | 'archive' | 'favorites'
    cachedItems: null,
    thumbSize: 'm',
    sortBy: 'time',
    sortOrder: 'desc',
    timeGroup: 'month',
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------------- API ---------------- */
  async function api(path, opts) {
    const r = await fetch(path, opts);
    if (!r.ok) {
      let msg = '请求失败';
      try { msg = (await r.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    return r.json();
  }

  /* ---------------- URL helpers ---------------- */
  function thumbUrl(item) {
    const p = encodeURIComponent(item.path);
    const sz = `&size=${state.thumbSize}`;
    if (item.type === 'archive') {
      return `/api/thumb?path=${p}&entry=${encodeURIComponent(item.entry)}${sz}`;
    }
    return `/api/thumb?path=${p}${sz}`;
  }

  function rawUrl(item) {
    const p = encodeURIComponent(item.path);
    if (item.type === 'archive') {
      return `/api/image?path=${p}&entry=${encodeURIComponent(item.entry)}`;
    }
    return `/api/image?path=${p}`;
  }

  function videoUrl(item) {
    const p = encodeURIComponent(item.path);
    if (item.type === 'archive') {
      return `/api/video?path=${p}&entry=${encodeURIComponent(item.entry)}`;
    }
    return `/api/video?path=${p}`;
  }

  function groupByTime(items, level) {
    const groups = {};
    items.forEach(item => {
      const d = new Date(item.mtime);
      let key;
      if (level === 'year') {
        key = String(d.getFullYear());
      } else if (level === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    const keys = Object.keys(groups).sort();
    if (state.sortOrder === 'desc') keys.reverse();
    return keys.map(k => ({ key: k, items: groups[k] }));
  }

  function formatTimeHeader(mtime, level) {
    const d = new Date(mtime);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    if (level === 'year') return `${d.getFullYear()}年`;
    if (level === 'month') return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    const today = new Date();
    const dayStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    if (d.toDateString() === today.toDateString()) return `今天 · ${dayStr} 星期${weekdays[d.getDay()]}`;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `昨天 · ${dayStr} 星期${weekdays[d.getDay()]}`;
    return `${dayStr} 星期${weekdays[d.getDay()]}`;
  }

  function favKey(item) {
    return item.entry ? item.path + '|' + item.entry : item.path;
  }

  function isFavored(key) {
    return !!state.favorites[key];
  }

  /* ---------------- Views ---------------- */
  function showLogin() {
    $('#m-login').classList.remove('hidden');
    $('#m-main').classList.add('hidden');
  }

  function showMain(user) {
    state.user = user;
    $('#m-user').textContent = user;
    $('#m-login').classList.add('hidden');
    $('#m-main').classList.remove('hidden');
    init();
  }

  /* ---------------- Login ---------------- */
  $('#m-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#m-login-error');
    err.classList.add('hidden');
    try {
      const data = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: $('#m-username').value.trim(),
          password: $('#m-password').value,
        }),
      });
      showMain(data.user);
    } catch (err2) {
      err.textContent = err2.message;
      err.classList.remove('hidden');
    }
  });

  $('#m-logout-btn').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    location.reload();
  });

  /* ---------------- Tree (drawer) ---------------- */
  function buildTreeEl(nodes, depth) {
    if (!nodes || !nodes.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'm-tree-children' + (depth === 0 ? ' open' : '');
    nodes.forEach((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const el = document.createElement('div');
      el.dataset.rel = node.rel || '';
      el.className = 'm-tree-node' +
        (node.type === 'dir' ? ' m-tree-node-dir' : ' m-tree-node-file') +
        (hasChildren ? '' : ' leaf');
      el.style.paddingLeft = (16 + depth * 16) + 'px';

      const caret = document.createElement('span');
      caret.className = 'm-tree-caret' + (hasChildren ? '' : ' placeholder');
      caret.textContent = '▸';
      el.appendChild(caret);

      const label = document.createElement('span');
      label.className = 'm-tree-label';
      label.textContent = node.name;
      el.appendChild(label);

      if (node.type === 'dir') {
        el.addEventListener('click', (ev) => {
          if (ev.target === caret) return;
          selectTreeDir(node.rel, node, el);
        });
      }
      if (hasChildren) {
        const childWrap = buildTreeEl(node.children, depth + 1);
        if (childWrap) {
          el.appendChild(childWrap);
          caret.addEventListener('click', (ev) => {
            ev.stopPropagation();
            childWrap.classList.toggle('open');
            el.classList.toggle('expanded');
          });
        }
      }

      wrap.appendChild(el);
    });
    return wrap;
  }

  async function loadTree() {
    const drawer = $('#m-tree');
    drawer.innerHTML = '<div class="m-loading">加载中...</div>';
    try {
      const data = await api('/api/tree');
      state.tree = data.tree || [];

      const rootEl = document.createElement('div');
      rootEl.className = 'm-tree-node m-tree-node-root';
      rootEl.dataset.rel = '';
      rootEl.innerHTML = '<span class="m-tree-label">📁 根目录</span>';
      rootEl.addEventListener('click', () => {
        openDirectory('');
        closeDrawer();
      });
      drawer.innerHTML = '';
      drawer.appendChild(rootEl);

      const body = buildTreeEl(state.tree, 0);
      if (body) drawer.appendChild(body);
      markActiveTree();
    } catch (e) {
      drawer.innerHTML = `<div class="m-loading">${escapeHtml(e.message)}</div>`;
    }
  }

  function markActiveTree() {
    $$('.m-tree-node').forEach((el) => el.classList.remove('active'));
    if (!state.currentPath) {
      const rootEl = $$('.m-tree-node-root')[0];
      if (rootEl) rootEl.classList.add('active');
      return;
    }
    $$('.m-tree-node[data-rel]').forEach((el) => {
      if (el.dataset.rel === state.currentPath) el.classList.add('active');
    });
    expandPathInTree(state.currentPath);
  }

  function selectTreeDir(rel, node, el) {
    $$('.m-tree-node').forEach((x) => x.classList.remove('active'));
    el.classList.add('active');
    openDirectory(rel);
    closeDrawer();
  }

  function expandPathInTree(rel) {
    if (!rel || !state.tree) return;
    const parts = rel.split('/').filter(Boolean);
    const pathSet = new Set();
    let acc = '';
    for (const part of parts) {
      acc = acc ? acc + '/' + part : part;
      pathSet.add(acc);
    }
    $$('.m-tree-node[data-rel]').forEach((el) => {
      if (pathSet.has(el.dataset.rel)) {
        const wrap = el.querySelector('.m-tree-children');
        if (wrap) { wrap.classList.add('open'); el.classList.add('expanded'); }
      }
    });
  }

  /* ---------------- Drawer ---------------- */
  function openDrawer() {
    loadTree();
    $('#m-drawer').classList.add('open');
    $('#m-drawer-bg').classList.remove('hidden');
  }

  function closeDrawer() {
    $('#m-drawer').classList.remove('open');
    $('#m-drawer-bg').classList.add('hidden');
  }

  $('#m-menu-btn').addEventListener('click', () => {
    openDrawer();
    history.pushState({ drawer: true }, '');
  });
  $('#m-drawer-bg').addEventListener('click', closeDrawer);

  /* ---------------- Browsing ---------------- */
  function showPath(path) {
    const parts = (path || '').split('/').filter(Boolean);
    $('#m-path-display').textContent = parts.length ? parts.join(' / ') : '根目录';
  }

  async function openDirectory(relPath, pageNum = 1) {
    state.currentPath = relPath || '';
    state.currentMode = 'dir';
    showPath(state.currentPath);
    showLoading();
    try {
      const url = `/api/browse?path=${encodeURIComponent(state.currentPath)}&page=${pageNum}&pageSize=80&sortBy=${state.sortBy}&sortOrder=${state.sortOrder}`;
      const data = await api(url);
      renderBrowse(data);
    } catch (e) {
      renderEmpty(e.message);
    }
  }

  async function openArchive(relPath) {
    state.currentPath = relPath;
    state.currentMode = 'archive';
    showPath(state.currentPath);
    showLoading();
    try {
      const url = `/api/archive-images?path=${encodeURIComponent(relPath)}&sortBy=${state.sortBy}&sortOrder=${state.sortOrder}`;
      const data = await api(url);
      const mediaItems = (data.media || []).map((m) => ({
        type: 'archive', mime: m.mime, path: relPath, entry: m.entry, name: m.name, mtime: m.mtime,
      }));
      if (mediaItems.length) {
        showSortbar();
      } else {
        hideSortbar();
      }
      renderMedia(mediaItems);
    } catch (e) {
      renderEmpty(e.message);
    }
  }

  async function openFavorites() {
    state.currentMode = 'favorites';
    state.currentPath = 'favorites';
    $('#m-path-display').textContent = '我的收藏';
    showLoading();
    try {
      const data = await api('/api/favorites');
      const items = (data.favorites || []).map((f) => ({
        type: f.type, mime: f.mime, path: f.path, entry: f.entry, name: f.name, mtime: f.mtime,
      }));
      renderOnlyMedia(items);
    } catch (e) {
      renderEmpty(e.message);
    }
  }

  function renderBrowse(data) {
    const folders = data.folders || [];
    const archives = data.archives || [];
    const media = data.media || [];

    $('#m-empty').classList.add('hidden');
    $('#m-loading').classList.add('hidden');

    /* 文件夹卡片 */
    const folderGrid = $('#m-folders');
    folderGrid.innerHTML = '';
    const dirCards = folders.map((f) => ({
      name: f.name, rel: f.rel, count: f.count, type: 'dir',
    }));
    const archCards = archives.map((a) => ({
      name: a.name, rel: a.rel, count: null, type: 'archive',
    }));
    [...dirCards, ...archCards].forEach((item) => {
      if (item.type === 'dir') folderGrid.appendChild(makeFolderCard(item));
      else folderGrid.appendChild(makeArchiveCard(item));
    });

    if (!folders.length && !archives.length) {
      folderGrid.style.display = 'none';
    } else {
      folderGrid.style.display = '';
    }

    if (media.length) {
      showSortbar();
    } else {
      hideSortbar();
    }

    renderMedia(media);
  }

  function renderOnlyMedia(media) {
    $('#m-empty').classList.add('hidden');
    $('#m-loading').classList.add('hidden');
    $('#m-folders').innerHTML = '';
    $('#m-folders').style.display = 'none';
    if (media.length) {
      showSortbar();
    } else {
      hideSortbar();
    }
    renderMedia(media);
  }

  function showSortbar() {
    const sb = $('#m-sortbar');
    sb.classList.remove('hidden');
    $('#m-content').classList.add('has-sortbar');
    syncSortbar();
  }

  function hideSortbar() {
    $('#m-sortbar').classList.add('hidden');
    $('#m-content').classList.remove('has-sortbar');
  }

  function makeFolderCard(f) {
    const card = document.createElement('div');
    card.className = 'm-folder-card';
    card.innerHTML = `
      <div class="m-folder-icon">📁</div>
      <div class="m-folder-name"></div>
      <div class="m-folder-count">${f.count !== undefined ? f.count : ''}</div>
    `;
    card.querySelector('.m-folder-name').textContent = f.name;
    card.addEventListener('click', () => openDirectory(f.rel));
    return card;
  }

  function makeArchiveCard(a) {
    const card = document.createElement('div');
    card.className = 'm-family-card';
    card.innerHTML = `
      <div class="m-family-icon">🗜</div>
      <div class="m-family-name"></div>
    `;
    card.querySelector('.m-family-name').textContent = a.name;
    card.addEventListener('click', () => openArchive(a.rel));
    return card;
  }

  function renderMedia(items) {
    state.cachedItems = items;
    if (state.sortBy === 'time') return renderTimeline(items);
    const mediaBox = $('#m-media');
    mediaBox.innerHTML = '';
    mediaBox.className = 'm-masonry';
    if (!items || !items.length) {
      $('#m-empty').classList.remove('hidden');
      $('#m-empty').textContent = '此目录为空';
      return;
    }
    items.forEach((item) => mediaBox.appendChild(makeMediaItem(item)));
    lazyLoad();
  }

  function renderTimeline(items) {
    const groups = groupByTime(items, state.timeGroup);
    const mediaBox = $('#m-media');
    mediaBox.innerHTML = '';
    mediaBox.className = '';
    if (!groups.length) {
      $('#m-empty').classList.remove('hidden');
      $('#m-empty').textContent = '此目录为空';
      return;
    }
    groups.forEach(group => {
      const header = document.createElement('div');
      header.className = 'm-timeline-header';
      header.innerHTML = `<span class="m-th-date">${formatTimeHeader(group.items[0].mtime, state.timeGroup)}</span><span class="m-th-count">${group.items.length} 个文件</span><span class="m-th-line"></span>`;
      mediaBox.appendChild(header);
      const row = document.createElement('div');
      row.className = 'm-masonry m-timeline-row';
      group.items.forEach((item) => row.appendChild(makeMediaItem(item)));
      mediaBox.appendChild(row);
    });
    lazyLoad();
  }

  function makeMediaItem(item) {
    const box = document.createElement('div');
    box.className = 'm-item' + (item.mime === 'video' ? ' m-item-video' : '');

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = item.name;
    img.dataset.thumb = thumbUrl(item);
    box.appendChild(img);

    if (item.mime === 'video') {
      const badge = document.createElement('div');
      badge.className = 'm-item-video-badge';
      badge.textContent = '▶';
      box.appendChild(badge);
    }

    const fav = document.createElement('button');
    fav.className = 'm-item-fav';
    fav.textContent = '♥';
    const key = favKey(item);
    fav.classList.toggle('fav-on', isFavored(key));
    fav.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(item, fav);
    });
    box.appendChild(fav);

    box.addEventListener('click', () => openViewer(item));
    return box;
  }

  /* ---------------- Lazy load ---------------- */
  let lazyObserver = null;
  function lazyLoad() {
    if (!lazyObserver) {
      lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          if (!img.src) {
            img.src = img.dataset.thumb;
            img.dataset.thumb = '';
          }
          lazyObserver.unobserve(img);
        });
      }, { rootMargin: '300px' });
    }
    $$('#m-media img[data-thumb]').forEach((img) => lazyObserver.observe(img));
  }

  /* ---------------- Favorites ---------------- */
  async function toggleFav(item, el) {
    const key = favKey(item);
    try {
      const data = await api('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: item.path,
          entry: item.entry || null,
          name: item.name,
          mime: item.mime,
          mtime: item.mtime || null,
        }),
      });
      if (data.favorited) state.favorites[key] = item;
      else delete state.favorites[key];
      if (el) el.classList.toggle('fav-on', data.favorited);
      if (state.currentMode === 'favorites' && !data.favorited) {
        const box = el && el.closest('.m-item');
        if (box) box.remove();
      }
    } catch (e) {
      console.error('收藏操作失败', e);
    }
  }

  $('#m-fav-btn').addEventListener('click', () => {
    openFavorites();
  });

  async function loadFavorites() {
    try {
      const data = await api('/api/favorites');
      state.favorites = {};
      (data.favorites || []).forEach((f) => {
        state.favorites[f.entry ? f.path + '|' + f.entry : f.path] = f;
      });
    } catch (e) {
      console.error('加载收藏失败', e);
    }
  }

  /* ---------------- Viewer ---------------- */
  let viewerTimer = null;
  function openViewer(item) {
    const img = $('#m-viewer-img');
    const video = $('#m-viewer-video');
    img.classList.add('hidden');
    video.classList.add('hidden');
    video.removeAttribute('src');
    video.removeAttribute('srcObject');

    $('#m-viewer').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    history.pushState({ viewer: true }, '');

    if (item.mime === 'video') {
      video.classList.remove('hidden');
      const url = videoUrl(item);
      /* 用 fetch 绕过可能存在的 cookie 传递问题 */
      fetch(url, { credentials: 'same-origin' }).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      }).then(blob => {
        video.src = URL.createObjectURL(blob);
        video.play().catch(() => {});
      }).catch(() => {
        /* 降级：直接设置 src */
        video.src = url;
        video.play().catch(() => {});
      });
    } else {
      img.classList.remove('hidden');
      img.src = rawUrl(item);
    }
  }

  function closeViewer() {
    const video = $('#m-viewer-video');
    video.pause();
    video.removeAttribute('src');
    video.load();
    $('#m-viewer-img').src = '';
    $('#m-viewer').classList.add('hidden');
    document.body.style.overflow = '';
  }

  $('#m-viewer-close').addEventListener('click', closeViewer);
  $('#m-viewer').addEventListener('click', (e) => {
    if (e.target === $('#m-viewer') || e.target.classList.contains('m-viewer-body')) closeViewer();
  });

  /* ---------------- Sortbar ---------------- */
  function sortOrderArrow() {
    $('#m-sort-order').textContent = state.sortOrder === 'desc' ? '↓' : '↑';
  }

  function syncSortbar() {
    $('#m-sort-by').value = state.sortBy;
    $('#m-time-group').value = state.timeGroup;
    $('#m-time-group').classList.toggle('hidden', state.sortBy !== 'time');
    sortOrderArrow();
  }

  $('#m-sort-by').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    syncSortbar();
    reloadCurrent();
  });

  $('#m-sort-order').addEventListener('click', () => {
    state.sortOrder = state.sortOrder === 'desc' ? 'asc' : 'desc';
    sortOrderArrow();
    reloadCurrent();
  });

  $('#m-time-group').addEventListener('change', (e) => {
    state.timeGroup = e.target.value;
    if (state.cachedItems) renderMedia(state.cachedItems);
  });

  function reloadCurrent() {
    if (state.currentMode === 'favorites') {
      openFavorites();
    } else if (state.currentMode === 'archive') {
      openArchive(state.currentPath);
    } else {
      openDirectory(state.currentPath, 1);
    }
  }

  /* ---------------- UI helpers ---------------- */
  function showLoading() {
    hideSortbar();
    $('#m-loading').classList.remove('hidden');
    $('#m-empty').classList.add('hidden');
    $('#m-folders').innerHTML = '';
    $('#m-media').innerHTML = '';
    $('#m-folders').style.display = '';
  }

  function renderEmpty(msg) {
    hideSortbar();
    $('#m-loading').classList.add('hidden');
    $('#m-folders').innerHTML = '';
    $('#m-folders').style.display = 'none';
    $('#m-media').innerHTML = '';
    state.cachedItems = null;
    $('#m-empty').textContent = msg || '暂无内容';
    $('#m-empty').classList.remove('hidden');
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ---------------- Init ---------------- */
  async function init() {
    await loadFavorites();
    /* 打开根目录，若根目录有子文件夹则自动进入第一个 */
    try {
      const data = await api(`/api/browse?path=&page=1&pageSize=80&sortBy=${state.sortBy}&sortOrder=${state.sortOrder}`);
      const folders = data.folders || [];
      if (folders.length > 0) {
        openDirectory(folders[0].rel);
      } else {
        state.currentPath = '';
        showPath('');
        renderBrowse(data);
      }
    } catch (e) {
      state.currentPath = '';
      showPath('');
      renderEmpty(e.message);
    }
  }

  /* Android 返回键：关闭查看器或抽屉 */
  window.addEventListener('popstate', () => {
    if (!$('#m-viewer').classList.contains('hidden')) {
      closeViewer();
    } else if ($('#m-drawer').classList.contains('open')) {
      closeDrawer();
    } else if (!$('#m-login').classList.contains('hidden')) {
      return;
    } else {
      openFavorites(); /* 兜底 */
    }
  });

  (async () => {
    try {
      const data = await api('/api/me');
      showMain(data.user);
    } catch {
      showLogin();
    }
  })();
})();