(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = {
    user: null,
    tree: [],
    currentPath: '',
    imageList: [],
    lbIndex: -1,
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

  function showMain(user) {
    state.user = user;
    $('#login-view').classList.add('hidden');
    $('#main-view').classList.remove('hidden');
    $('#current-user').textContent = user;
    loadTree();
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('#username').value.trim();
    const password = $('#password').value;
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      showMain(data.user);
    } catch (err) {
      $('#login-error').textContent = err.message;
      $('#login-error').classList.remove('hidden');
    }
  });

  $('#btn-logout').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    showLogin();
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
      crumb.addEventListener('click', () => {
        state.currentPath = acc;
        openDirectory(acc);
      });
      bc.appendChild(crumb);
    });
  }

  /* ---------------- Browsing ---------------- */
  async function openDirectory(relPath) {
    state.currentPath = relPath;
    renderBreadcrumb();
    clearArea();
    try {
      const data = await api('/api/browse?path=' + encodeURIComponent(relPath || ''));
      renderBrowse(data);
    } catch (err) {
      showEmpty(err.message);
    }
  }

  function clearArea() {
    $('#empty-tip').classList.add('hidden');
    $('#folder-grid').innerHTML = '';
    $('#folder-grid').classList.add('hidden');
    $('#archive-grid').innerHTML = '';
    $('#archive-grid').classList.add('hidden');
    $('#image-grid').innerHTML = '';
  }

  function showEmpty(msg) {
    $('#empty-tip').textContent = msg;
    $('#empty-tip').classList.remove('hidden');
  }

  function renderBrowse(data) {
    const hasFolders = data.folders && data.folders.length;
    const hasArchives = data.archives && data.archives.length;
    const hasImages = data.images && data.images.length;

    if (!hasFolders && !hasArchives && !hasImages) {
      showEmpty('该目录下暂无内容');
      return;
    }

    if (hasFolders) {
      $('#folder-grid').classList.remove('hidden');
      renderFolderCards(data.folders, $('#folder-grid'));
    }
    if (hasArchives) {
      $('#archive-grid').classList.remove('hidden');
      renderFolderCards(data.archives, $('#archive-grid'));
    }
    if (hasImages) {
      const imageItems = data.images.map((img) => ({
        type: 'file',
        path: img.rel,
        name: img.name,
      }));
      renderImageGrid(imageItems);
    }
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
    clearArea();
    try {
      const data = await api('/api/archive-images?path=' + encodeURIComponent(relPath));
      const imageItems = (data.images || []).map((img) => ({
        type: 'archive',
        path: relPath,
        entry: img.entry,
        name: img.name,
      }));
      if (!imageItems.length) {
        showEmpty('压缩包内没有图片');
        return;
      }
      renderImageGrid(imageItems);
    } catch (err) {
      showEmpty(err.message);
    }
  }

  /* ---------------- Image grid ---------------- */
  function thumbUrl(item) {
    const p = encodeURIComponent(item.path);
    if (item.type === 'archive') {
      return `/api/thumb?path=${p}&entry=${encodeURIComponent(item.entry)}`;
    }
    return `/api/thumb?path=${p}`;
  }

  function rawUrl(item) {
    const p = encodeURIComponent(item.path);
    if (item.type === 'archive') {
      return `/api/image?path=${p}&entry=${encodeURIComponent(item.entry)}`;
    }
    return `/api/image?path=${p}`;
  }

  function renderImageGrid(items) {
    state.imageList = items;
    const grid = $('#image-grid');
    grid.innerHTML = '';
    items.forEach((item, idx) => {
      const box = document.createElement('div');
      box.className = 'thumb-box loading';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = item.name;
      img.dataset.thumb = thumbUrl(item);
      img.addEventListener('load', () => box.classList.remove('loading'));

      const name = document.createElement('div');
      name.className = 'thumb-name';
      name.textContent = item.name;
      box.appendChild(img);
      box.appendChild(name);

      box.addEventListener('click', () => openLightbox(idx));
      grid.appendChild(box);
    });
    lazyLoad();
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
    updateLightbox();
    $('#lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    $('#lightbox').classList.add('hidden');
    $('#lb-img').src = '';
    document.body.style.overflow = '';
  }

  function updateLightbox() {
    const item = state.imageList[state.lbIndex];
    if (!item) return;
    $('#lb-img').src = rawUrl(item);
    $('#lb-counter').textContent = `${state.lbIndex + 1} / ${state.imageList.length}`;
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

  document.addEventListener('keydown', (e) => {
    if ($('#lightbox').classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') nextImage();
    else if (e.key === 'ArrowLeft') prevImage();
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
