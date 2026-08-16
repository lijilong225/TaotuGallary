(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const LAYOUT_SIZES = { s: 160, m: 240, l: 320 };
  const MASONRY_GAP = 18;

  const state = {
    user: null,
    tree: [],
    currentPath: '',
    imageList: [],
    lbIndex: -1,
    browseData: null,
    sortBy: 'time',
    sortOrder: 'desc',
    timeGroup: 'day',
    pageNum: 1,
    pageSize: 50,
    totalPages: 1,
    thumbSize: 'm',
    zoom: false,
    zoomX: 0,
    zoomY: 0,
  };

  async function api(path, options = {}) {
    const opts = {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };
    const res = await fetch(path, opts);
    if (res.status === 401 && !path.startsWith('/api/login')) {
      showLogin();
      throw new Error('unauthorized');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `请求失败 (${res.status})`);
    }
    const ct = res.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) return res.json();
    return res;
  }

  /* ---------------- Auth ---------------- */
  function showLogin() {
    $('#main-view').classList.add('hidden');
    $('#login-view').classList.remove('hidden');
    state.user = null;
    $('#password').value = '';
    $('#username').focus();
  }

  async function showMain(user) {
    state.user = user;
    $('#login-view').classList.add('hidden');
    $('#main-view').classList.remove('hidden');
    $('#current-user').textContent = user;
    applyThumbSize();
    loadTree();
  }

function applyThumbSize() {
    const grid = $('#image-grid');
    if (grid) grid.dataset.size = state.thumbSize;
    $$('#thumb-size-group .thumb-size-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.size === state.thumbSize);
    });
  }

  $$('#thumb-size-group .thumb-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.thumbSize = btn.dataset.size;
      applyThumbSize();
      if (state.browseData) renderBrowse();
    });
  });

  /* ---------------- Sorting ---------------- */
  $('#sort-by').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    $('#time-group').classList.toggle('hidden', state.sortBy !== 'time');
    if (state.browseData) renderBrowse();
  });

  $('#sort-order').addEventListener('change', (e) => {
    state.sortOrder = e.target.value;
    if (state.browseData) renderBrowse();
  });

  $('#time-group').addEventListener('change', (e) => {
    state.timeGroup = e.target.value;
    if (state.browseData) renderBrowse();
  });

  /* ---------------- Tree ---------------- */
  function renderTree() {
    const root = $('#tree');
    root.innerHTML = '';
    const ul = document.createElement('div');
    ul.className = 'tree-children';
    ul.style.display = 'block';
    state.tree.forEach((node) => ul.appendChild(buildNode(node)));
    root.appendChild(ul);
  }

  function buildNode(node, depth = 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node' + (node.children && node.children.length ? '' : ' leaf');

    const item = document.createElement('div');
    item.className = 'tree-item';
    item.style.paddingLeft = (10 + depth * 16) + 'px';

    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    toggle.textContent = '▶';
    item.appendChild(toggle);

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = node.type === 'archive' ? '🗜️' : '📁';
    item.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name;
    item.appendChild(label);

    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (node.type === 'dir' && node.children && node.children.length) {
        wrapper.classList.toggle('open');
        toggle.textContent = wrapper.classList.contains('open') ? '▼' : '▶';
      }
      selectNode(node);
    });

    wrapper.appendChild(item);

    if (node.children && node.children.length) {
      const children = document.createElement('div');
      children.className = 'tree-children';
      node.children.forEach((c) => children.appendChild(buildNode(c, depth + 1)));
      wrapper.appendChild(children);
    }
    return wrapper;
  }

  async function loadTree() {
    try {
      const data = await api('/api/tree');
      state.tree = data.tree || [];
      renderTree();
    } catch (err) {
      console.error(err);
    }
  }

  function clearActive() {
    $$('.tree-item.active').forEach((el) => el.classList.remove('active'));
  }

  function selectNode(node) {
    clearActive();
    const items = $$('.tree-item');
    items.forEach((el) => {
      if (el.querySelector('.tree-label').textContent === node.name && el.closest('.tree-node')) {
        const labelEl = el.querySelector('.tree-label');
        labelEl.classList.add('active');
        labelEl.closest('.tree-item').classList.add('active');
      }
    });
    state.currentPath = node.rel;
    state.imageList = [];
    if (node.type === 'archive') {
      openArchive(node.rel);
    } else {
      openDirectory(node.rel);
    }
  }

  /* ---------------- Breadcrumb ---------------- */
  function renderBreadcrumb() {
    const bc = $('#breadcrumb');
    bc.innerHTML = '';
    const rootCrumb = document.createElement('span');
    rootCrumb.className = 'crumb';
    rootCrumb.textContent = '根目录';
    rootCrumb.addEventListener('click', () => {
      state.currentPath = '';
      openDirectory('');
    });
    bc.appendChild(rootCrumb);

    if (!state.currentPath) return;

    const parts = state.currentPath.split('/');
    let acc = '';
    parts.forEach((part, i) => {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '/';
      bc.appendChild(sep);

      acc = acc ? acc + '/' + part : part;
      const crumb = document.createElement('span');
      crumb.className = 'crumb';
      crumb.textContent = part;
      crumb.dataset.path = acc;
      const crumbPath = acc;
      crumb.addEventListener('click', () => {
        state.currentPath = crumbPath;
        openDirectory(crumbPath);
      });
      bc.appendChild(crumb);
    });
  }

  /* ---------------- Browsing ---------------- */
  async function openDirectory(relPath, pageNum = 1) {
    state.currentPath = relPath;
    state.pageNum = pageNum;
    renderBreadcrumb();
    try {
      const data = await api(`/api/browse?path=${encodeURIComponent(relPath || '')}&page=${pageNum}&pageSize=${state.pageSize}`);
      state.totalPages = data.pagination ? data.pagination.totalPages : 1;
      if (data.pagination && data.pagination.pageNum) state.pageNum = data.pagination.pageNum;
      state.browseData = {
        mode: 'dir',
        folders: data.folders || [],
        archives: data.archives || [],
        images: data.images || [],
        videos: data.videos || [],
      };
      renderBrowse();
    } catch (err) {
      showEmpty(err.message);
    }
  }

  function renderPagination() {
    const pag = $('#pagination');
    const data = state.browseData;
    if (!data || data.mode !== 'dir' || state.totalPages <= 1) {
      pag.classList.add('hidden');
      return;
    }
    pag.classList.remove('hidden');
    pag.innerHTML = '';

    const pageSizeSel = document.createElement('select');
    pageSizeSel.className = 'page-size';
    [50, 80, 100].forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = `${n} / 页`;
      opt.selected = n === state.pageSize;
      pageSizeSel.appendChild(opt);
    });
    pageSizeSel.addEventListener('change', () => {
      state.pageSize = parseInt(pageSizeSel.value, 10);
      state.pageNum = 1;
      openDirectory(state.currentPath, 1);
    });
    pag.appendChild(pageSizeSel);

    const mkBtn = (label, page, cls, disabled) => {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (cls ? ' ' + cls : '');
      btn.textContent = label;
      btn.disabled = !!disabled;
      btn.addEventListener('click', () => openDirectory(state.currentPath, page));
      return btn;
    };

    pag.appendChild(mkBtn('«', 1, 'page-first', state.pageNum === 1));
    pag.appendChild(mkBtn('‹', state.pageNum - 1, 'page-prev', state.pageNum === 1));

    const total = state.totalPages;
    const cur = state.pageNum;
    const start = Math.max(1, Math.min(cur - 2, total - 4));
    const end = Math.min(total, start + 4);
    for (let p = start; p <= end; p++) {
      pag.appendChild(mkBtn(String(p), p, p === cur ? 'page-cur' : '', p === cur));
    }

    pag.appendChild(mkBtn('›', state.pageNum + 1, 'page-next', state.pageNum === total));
    pag.appendChild(mkBtn('»', total, 'page-last', state.pageNum === total));
  }

  function sortItems(items, key) {
    const dir = state.sortOrder === 'desc' ? -1 : 1;
    return items.slice().sort((a, b) => {
      let r;
      if (key === 'time') {
        const ta = a.mtime != null ? a.mtime : 0;
        const tb = b.mtime != null ? b.mtime : 0;
        r = ta - tb;
        if (r === 0) r = a.name.localeCompare(b.name, 'zh');
      } else {
        r = a.name.localeCompare(b.name, 'zh');
      }
      return r * dir;
    });
  }

  function clearArea() {
    $('#empty-tip').classList.add('hidden');
    $('#folder-grid').innerHTML = '';
    $('#folder-grid').classList.add('hidden');
    $('#archive-grid').innerHTML = '';
    $('#archive-grid').classList.add('hidden');
    $('#image-grid').innerHTML = '';
    if (state.browseData) {
      $('#sortbar').classList.remove('hidden');
    }
  }

  function showEmpty(msg) {
    $('#sortbar').classList.add('hidden');
    $('#pagination').classList.add('hidden');
    $('#empty-tip').textContent = msg;
    $('#empty-tip').classList.remove('hidden');
  }

  function renderBrowse() {
    const data = state.browseData;
    if (!data) return;
    const hasFolders = data.folders.length;
    const hasArchives = data.archives.length;
    const hasImages = data.images.length;
    const hasVideos = data.videos.length;

    if (!hasFolders && !hasArchives && !hasImages && !hasVideos) {
      showEmpty('该目录下暂无内容');
      return;
    }
    clearArea();

    const folders = sortItems(data.folders, state.sortBy);
    const archives = sortItems(data.archives, state.sortBy);
    if (hasFolders) {
      $('#folder-grid').classList.remove('hidden');
      renderFolderCards(folders, $('#folder-grid'));
    }
    if (hasArchives) {
      $('#archive-grid').classList.remove('hidden');
      renderFolderCards(archives, $('#archive-grid'));
    }
    const mediaItems = [];
    if (hasImages) {
      data.images.forEach((img) => mediaItems.push({
        type: img.type || 'file', mime: 'image', path: img.path != null ? img.path : img.rel,
        name: img.name, mtime: img.mtime, entry: img.entry,
      }));
    }
    if (hasVideos) {
      data.videos.forEach((v) => mediaItems.push({
        type: v.type || 'file', mime: 'video', path: v.path != null ? v.path : v.rel,
        name: v.name, mtime: v.mtime, entry: v.entry,
      }));
    }
    if (mediaItems.length) renderMediaGrid(sortItems(mediaItems, state.sortBy));
    renderPagination();
  }

  function renderFolderCards(items, container) {
    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'folder-card' + (item.type === 'archive' ? ' archive-card' : '');
      const isArchive = item.type === 'archive';
      card.innerHTML = `
        <div class="icon">${isArchive ? '🗜️' : '📂'}</div>
        <div class="name"></div>
        <div class="count">${isArchive ? '压缩包' : (item.count !== undefined ? item.count + ' 张图片' : '')}</div>
      `;
      card.querySelector('.name').textContent = item.name;
      card.addEventListener('click', () => {
        if (isArchive) {
          openArchive(item.rel);
        } else {
          openDirectory(item.rel);
        }
      });
      container.appendChild(card);
    });
  }

  /* ---------------- Archive browsing ---------------- */
  async function openArchive(relPath) {
    state.currentPath = relPath;
    renderBreadcrumb();
    try {
      const data = await api('/api/archive-images?path=' + encodeURIComponent(relPath));
      const mediaItems = [];
      (data.images || []).forEach((img) => mediaItems.push({
        type: 'archive', mime: 'image', path: relPath, entry: img.entry, name: img.name, mtime: img.mtime,
      }));
      (data.videos || []).forEach((v) => mediaItems.push({
        type: 'archive', mime: 'video', path: relPath, entry: v.entry, name: v.name, mtime: v.mtime,
      }));
      state.browseData = { mode: 'archive', folders: [], archives: [], images: mediaItems.filter(i => i.mime === 'image'), videos: mediaItems.filter(i => i.mime === 'video') };
      if (!mediaItems.length) {
        showEmpty('压缩包内没有图片或视频');
        return;
      }
      renderBrowse();
    } catch (err) {
      showEmpty(err.message);
    }
  }

  /* ---------------- Media grid ---------------- */
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

  function renderMediaGrid(items) {
    state.imageList = items;
    if (state.sortBy === 'time') return renderTimeline(items);
    renderMasonry(items);
  }

  function renderTimeline(items) {
    const groups = groupByTime(items, state.timeGroup);
    const grid = $('#image-grid');
    grid.innerHTML = '';
    grid.classList.add('masonry');
    grid.dataset.size = state.thumbSize;
    let globalIdx = 0;
    groups.forEach(group => {
      const header = document.createElement('div');
      header.className = 'timeline-header';
      header.innerHTML = `<span class="th-date">${formatTimeHeader(group.items[0].mtime, state.timeGroup)}</span><span class="th-count">${group.items.length} 个文件</span><span class="th-line"></span>`;
      grid.appendChild(header);
      const row = document.createElement('div');
      row.className = 'timeline-row masonry';
      row.dataset.size = state.thumbSize;
      const width = grid.clientWidth || 800;
      const size = LAYOUT_SIZES[state.thumbSize];
      const gap = MASONRY_GAP;
      const cols = Math.max(2, Math.min(8, Math.floor((width + gap) / (size + gap))));
      const columns = [];
      for (let i = 0; i < cols; i++) {
        const col = document.createElement('div');
        col.className = 'masonry-col';
        columns.push(col);
        row.appendChild(col);
      }
      group.items.forEach((item, idx) => {
        const box = createThumbBox(item, globalIdx++);
        box.style.aspectRatio = '1 / 1';
        columns[idx % cols].appendChild(box);
      });
      grid.appendChild(row);
    });
    lazyLoad();
  }

  function renderMasonry(items) {
    state.imageList = items;
    const grid = $('#image-grid');
    grid.classList.add('masonry');
    grid.dataset.size = state.thumbSize;
    grid.innerHTML = '';
    const width = grid.clientWidth || 800;
    const size = LAYOUT_SIZES[state.thumbSize];
    const gap = MASONRY_GAP;
    const cols = Math.max(2, Math.min(8, Math.floor((width + gap) / (size + gap))));
    const columns = [];
    for (let i = 0; i < cols; i++) {
      const col = document.createElement('div');
      col.className = 'masonry-col';
      columns.push(col);
      grid.appendChild(col);
    }
    items.forEach((item, idx) => {
      const box = createThumbBox(item, idx);
      box.style.aspectRatio = '1 / 1';
      columns[idx % cols].appendChild(box);
    });
    lazyLoad();
  }

  function createThumbBox(item, idx) {
    const box = document.createElement('div');
    box.className = 'thumb-box loading';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = item.name;
    img.dataset.thumb = thumbUrl(item);
    img.addEventListener('load', () => {
      box.classList.remove('loading');
      box.style.aspectRatio = '';
    });

    const name = document.createElement('div');
    name.className = 'thumb-name';
    name.textContent = item.name;
    box.appendChild(img);
    box.appendChild(name);

    if (item.mime === 'video') {
      const badge = document.createElement('div');
      badge.className = 'video-badge';
      badge.innerHTML = '&#9658;';
      box.appendChild(badge);
      box.classList.add('video-box');
    }

    box.addEventListener('click', () => openLightbox(idx));
    return box;
  }

  function lazyLoad() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (!img.src) {
          img.src = img.dataset.thumb;
          img.dataset.thumb = '';
        }
        io.unobserve(img);
      });
    }, { rootMargin: '200px' });
    $$('#image-grid img[data-thumb]').forEach((img) => io.observe(img));
  }

  /* ---------------- Lightbox ---------------- */
  function openLightbox(index) {
    state.lbIndex = index;
    $('#lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    hideInfoPanel();
    resetZoom();
    updateLightbox();
  }

  function closeLightbox() {
    stopVideo();
    clearTimeout(vcTimer);
    $('#lightbox').classList.add('hidden');
    $('#lb-img').src = '';
    document.body.style.overflow = '';
    hideInfoPanel();
    resetZoom();
  }

  function updateLightbox() {
    const item = state.imageList[state.lbIndex];
    if (!item) return;
    $('#lb-counter').textContent = `${state.lbIndex + 1} / ${state.imageList.length}`;

    if (item.mime === 'video') {
      $('#lb-img').classList.add('hidden');
      $('#lb-video-wrap').classList.remove('hidden');
      $('#lb-zoom-toggle').classList.add('hidden');
      $('#lb-download').classList.add('hidden');
      const video = $('#lb-video');
      stopVideo();
      video.src = videoUrl(item);
      video.load();
      video.play().catch(() => {});
    } else {
      stopVideo();
      $('#lb-video-wrap').classList.add('hidden');
      $('#lb-img').classList.remove('hidden');
      $('#lb-zoom-toggle').classList.remove('hidden');
      $('#lb-download').classList.remove('hidden');
      $('#lb-img').src = rawUrl(item);
    }
    resetZoom();
    if (!isInfoPanelHidden()) renderInfoPanel();
  }

  function downloadCurrent() {
    const item = state.imageList[state.lbIndex];
    if (!item || item.mime === 'video') return;
    const url = rawUrl(item);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function stopVideo() {
    const video = $('#lb-video');    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if (document.pictureInPictureElement === video) {
        document.exitPictureInPicture().catch(() => {});
      }
    } catch (err) {
      console.error(err);
    }
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (err) {
      console.error(err);
    }
    $('#vc-progress').value = 0;
    $('#vc-time').textContent = '0:00 / 0:00';
  }

  /* ---------------- Info panel ---------------- */
  function isInfoPanelHidden() {
    return $('#lb-info-panel').classList.contains('hidden');
  }

  function hideInfoPanel() {
    $('#lb-info-panel').classList.add('hidden');
  }

  function showInfoPanel() {
    $('#lb-info-panel').classList.remove('hidden');
    renderInfoPanel();
  }

  function toggleInfoPanel() {
    if (isInfoPanelHidden()) showInfoPanel();
    else hideInfoPanel();
  }

  async function renderInfoPanel() {
    const item = state.imageList[state.lbIndex];
    if (!item) return;
    $('#lb-info-loading').classList.remove('hidden');
    $('#lb-info-error').classList.add('hidden');
    $('#lb-info-fields').classList.add('hidden');
    $('#lb-info-fields').innerHTML = '';
    try {
      let q = 'path=' + encodeURIComponent(item.path);
      if (item.entry) q += '&entry=' + encodeURIComponent(item.entry);
      const info = await api('/api/info?' + q);
      renderInfoFields(info, item);
    } catch (err) {
      $('#lb-info-loading').classList.add('hidden');
      $('#lb-info-error').textContent = err.message;
      $('#lb-info-error').classList.remove('hidden');
    }
  }

  function infoRow(label, value) {
    const row = document.createElement('div');
    row.className = 'info-row';
    const l = document.createElement('span');
    l.className = 'info-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'info-value';
    v.textContent = value;
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function renderInfoFields(info, item) {
    const fields = $('#lb-info-fields');
    fields.innerHTML = '';

    const typeText = info.type === 'video' ? '视频' : '图片';
    let pathText = info.path || '-';
    if (info.location === 'archive' && info.archiveName) {
      pathText = info.archiveName + ' / ' + info.entry;
    }

    fields.appendChild(infoRow('文件名', info.name || '-'));
    fields.appendChild(infoRow('路径', pathText));
    fields.appendChild(infoRow('类型', typeText));
    fields.appendChild(infoRow('大小', info.sizeText || '-'));

    if (info.type === 'image') {
      let dim = '-';
      if (info.width && info.height) dim = `${info.width} x ${info.height}`;
      fields.appendChild(infoRow('尺寸', dim));
    } else if (info.type === 'video') {
      const videoEl = $('#lb-video');
      const dur = isFinite(videoEl.duration) && videoEl.duration > 0 ? fmtTime(videoEl.duration) : null;
      if (dur) {
        fields.appendChild(infoRow('时长', dur));
      } else {
        fields.appendChild(infoRow('时长', '加载中...'));
        const onMeta = () => {
          videoEl.removeEventListener('loadedmetadata', onMeta);
          if (!isInfoPanelHidden() && state.imageList[state.lbIndex] === item) renderInfoFields(info, item);
        };
        videoEl.addEventListener('loadedmetadata', onMeta);
      }
    }

    fields.appendChild(infoRow('修改时间', info.mtimeText || '-'));

    $('#lb-info-loading').classList.add('hidden');
    fields.classList.remove('hidden');
  }

  function nextImage() {
    if (!state.imageList.length) return;
    state.lbIndex = (state.lbIndex + 1) % state.imageList.length;
    updateLightbox();
  }

  function prevImage() {
    if (!state.imageList.length) return;
    state.lbIndex = (state.lbIndex - 1 + state.imageList.length) % state.imageList.length;
    updateLightbox();
  }

  $('#lb-close').addEventListener('click', closeLightbox);
  $('#lb-next').addEventListener('click', nextImage);
  $('#lb-prev').addEventListener('click', prevImage);
  $('#lb-info-toggle').addEventListener('click', toggleInfoPanel);
  $('#lb-download').addEventListener('click', downloadCurrent);

  /* ---------------- Zoom & pan ---------------- */
  const lbImg = $('#lb-img');
  const navEl = $('#lb-navigator');
  let zoomDrag = null;
  let navDrag = null;

  function resetZoom() {
    state.zoom = false;
    state.zoomX = 0;
    state.zoomY = 0;
    lbImg.classList.remove('zoomed', 'dragging');
    lbImg.style.width = '';
    lbImg.style.height = '';
    lbImg.style.transform = '';
    $('#lb-zoom-toggle').title = '放大到原始大小';
    $('#lb-zoom-ico').textContent = '+';
    navEl.classList.add('hidden');
  }

  function clampZoom() {
    const stage = $('.lightbox-stage');
    const natW = lbImg.naturalWidth;
    const natH = lbImg.naturalHeight;
    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;
    if (natW <= stageW) state.zoomX = (stageW - natW) / 2;
    else state.zoomX = Math.max(Math.min(0, stageW - natW), Math.min(0, state.zoomX));
    if (natH <= stageH) state.zoomY = (stageH - natH) / 2;
    else state.zoomY = Math.max(Math.min(0, stageH - natH), Math.min(0, state.zoomY));
  }

  function applyZoom() {
    lbImg.style.transform = `translate(${state.zoomX}px, ${state.zoomY}px)`;
    renderNavigator();
  }

  function renderNavigator() {
    const stage = $('.lightbox-stage');
    const navW = navEl.clientWidth;
    const navH = navEl.clientHeight;
    const natW = lbImg.naturalWidth;
    const natH = lbImg.naturalHeight;
    if (!natW || !natH) return;
    const scale = Math.min(navW / natW, navH / natH);
    const rW = natW * scale;
    const rH = natH * scale;
    const ox = (navW - rW) / 2;
    const oy = (navH - rH) / 2;
    const navImg = $('#lb-nav-img');
    navImg.style.width = `${rW}px`;
    navImg.style.height = `${rH}px`;
    navImg.style.left = `${ox}px`;
    navImg.style.top = `${oy}px`;
    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;
    let vx = ox + (-state.zoomX) * scale;
    let vy = oy + (-state.zoomY) * scale;
    let vw = stageW * scale;
    let vh = stageH * scale;
    vw = Math.min(vw, rW);
    vh = Math.min(vh, rH);
    vx = Math.max(ox, Math.min(vx, ox + rW - vw));
    vy = Math.max(oy, Math.min(vy, oy + rH - vh));
    const vp = $('#lb-nav-viewport');
    vp.style.left = `${vx}px`;
    vp.style.top = `${vy}px`;
    vp.style.width = `${vw}px`;
    vp.style.height = `${vh}px`;
  }

  function jumpToView(clientX, clientY) {
    const rect = navEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const navW = navEl.clientWidth;
    const navH = navEl.clientHeight;
    const natW = lbImg.naturalWidth;
    const natH = lbImg.naturalHeight;
    const scale = Math.min(navW / natW, navH / natH);
    const rW = natW * scale;
    const rH = natH * scale;
    const ox = (navW - rW) / 2;
    const oy = (navH - rH) / 2;
    const imgX = (x - ox) / scale;
    const imgY = (y - oy) / scale;
    const stage = $('.lightbox-stage');
    state.zoomX = stage.clientWidth / 2 - imgX;
    state.zoomY = stage.clientHeight / 2 - imgY;
    clampZoom();
    applyZoom();
  }

  function toggleZoom() {
    if (!state.zoom) {
      const natW = lbImg.naturalWidth;
      const natH = lbImg.naturalHeight;
      if (!natW || !natH) return;
      state.zoom = true;
      lbImg.classList.add('zoomed');
      lbImg.style.width = `${natW}px`;
      lbImg.style.height = `${natH}px`;
      const stage = $('.lightbox-stage');
      state.zoomX = (stage.clientWidth - natW) / 2;
      state.zoomY = (stage.clientHeight - natH) / 2;
      $('#lb-zoom-toggle').title = '缩放适配屏幕';
      $('#lb-zoom-ico').textContent = '−';
      $('#lb-nav-img').src = lbImg.src;
      navEl.classList.remove('hidden');
      clampZoom();
      applyZoom();
    } else {
      resetZoom();
    }
  }

  $('#lb-zoom-toggle').addEventListener('click', toggleZoom);

  lbImg.addEventListener('pointerdown', (e) => {
    if (!state.zoom) return;
    e.preventDefault();
    zoomDrag = { x: e.clientX, y: e.clientY, ox: state.zoomX, oy: state.zoomY };
    lbImg.classList.add('dragging');
    lbImg.setPointerCapture(e.pointerId);
  });

  lbImg.addEventListener('pointermove', (e) => {
    if (!zoomDrag) return;
    state.zoomX = zoomDrag.ox + (e.clientX - zoomDrag.x);
    state.zoomY = zoomDrag.oy + (e.clientY - zoomDrag.y);
    clampZoom();
    applyZoom();
  });

  lbImg.addEventListener('pointerup', () => {
    zoomDrag = null;
    lbImg.classList.remove('dragging');
  });

  lbImg.addEventListener('pointercancel', () => {
    zoomDrag = null;
    lbImg.classList.remove('dragging');
  });

  navEl.addEventListener('pointerdown', (e) => {
    if (!state.zoom) return;
    e.preventDefault();
    navDrag = e.pointerId;
    navEl.setPointerCapture(e.pointerId);
    jumpToView(e.clientX, e.clientY);
  });

  navEl.addEventListener('pointermove', (e) => {
    if (navDrag === null) return;
    jumpToView(e.clientX, e.clientY);
  });

  navEl.addEventListener('pointerup', () => { navDrag = null; });
  navEl.addEventListener('pointercancel', () => { navDrag = null; });

  window.addEventListener('resize', () => {
    if (!state.zoom) return;
    clampZoom();
    applyZoom();
  });

  /* ---------------- Video controls ---------------- */
  const video = $('#lb-video');
  const videoWrap = $('#lb-video-wrap');
  let vcTimer = null;

  function showVideoControls() {
    videoWrap.querySelector('.video-controls').classList.add('show');
    $('#lightbox').classList.remove('hide-overlays');
  }

  function hideVideoControls() {
    videoWrap.querySelector('.video-controls').classList.remove('show');
    if (document.fullscreenElement) $('#lightbox').classList.add('hide-overlays');
  }

  function resetVideoControlsTimer() {
    clearTimeout(vcTimer);
    vcTimer = setTimeout(() => {
      if (!video.paused && document.fullscreenElement) hideVideoControls();
    }, 3000);
  }

  function onVideoActivity() {
    if (document.fullscreenElement) {
      showVideoControls();
      if (!video.paused) resetVideoControlsTimer();
    }
  }

  function syncVideoControls() {
    clearTimeout(vcTimer);
    if (video.paused) {
      showVideoControls();
      return;
    }
    if (document.fullscreenElement) {
      showVideoControls();
      resetVideoControlsTimer();
    } else {
      hideVideoControls();
    }
  }

  videoWrap.addEventListener('mousemove', onVideoActivity);
  videoWrap.addEventListener('pointerdown', onVideoActivity);

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  $('#vc-play').addEventListener('click', () => {
    if (video.paused) video.play();
    else video.pause();
  });

  video.addEventListener('play', () => { $('#vc-play').innerHTML = '&#10074;&#10074;'; syncVideoControls(); });
  video.addEventListener('pause', () => { $('#vc-play').innerHTML = '&#9658;'; syncVideoControls(); });

  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    $('#vc-progress').value = (video.currentTime / video.duration) * 1000;
    $('#vc-time').textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
  });

  $('#vc-progress').addEventListener('input', () => {
    if (!video.duration) return;
    video.currentTime = (parseInt($('#vc-progress').value, 10) / 1000) * video.duration;
  });

  video.addEventListener('loadedmetadata', () => {
    $('#vc-time').textContent = `0:00 / ${fmtTime(video.duration)}`;
  });

  $('#vc-volume').addEventListener('input', () => {
    const v = parseInt($('#vc-volume').value, 10) / 100;
    video.volume = v;
    video.muted = v === 0;
    $('#vc-mute').innerHTML = v === 0 ? '&#128263;' : '&#128266;';
  });

  $('#vc-mute').addEventListener('click', () => {
    video.muted = !video.muted;
    $('#vc-mute').innerHTML = video.muted ? '&#128263;' : '&#128266;';
  });

  $('#vc-pip').addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP failed:', err);
    }
  });

  $('#vc-fullscreen').addEventListener('click', () => {
    const target = $('#lightbox');
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (target.requestFullscreen) {
      target.requestFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if ($('#lb-video-wrap').classList.contains('hidden')) return;
    syncVideoControls();
  });

  video.addEventListener('dblclick', () => {
    const target = $('#lightbox');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.fullscreenEnabled) target.requestFullscreen();
  });

  $('#vc-close').addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => {
    if ($('#lightbox').classList.contains('hidden')) return;
    if ($('#lb-video-wrap').classList.contains('hidden')) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') nextImage();
      else if (e.key === 'ArrowLeft') prevImage();
      return;
    }
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === ' ') { e.preventDefault(); if (video.paused) video.play(); else video.pause(); }
    else if (e.key === 'ArrowRight') { video.currentTime = Math.min(video.duration, video.currentTime + 5); }
    else if (e.key === 'ArrowLeft') { video.currentTime = Math.max(0, video.currentTime - 5); }
  });

  $('#lightbox').addEventListener('click', (e) => {
    if (e.target === $('#lightbox') || e.target.id === 'lightbox') closeLightbox();
  });

  /* ---------------- Init ---------------- */
  (async () => {
    try {
      const data = await api('/api/me');
      showMain(data.user);
    } catch {
      showLogin();
    }
  })();
})();
