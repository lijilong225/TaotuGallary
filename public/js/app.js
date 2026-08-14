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
    const hasVideos = data.videos && data.videos.length;

    if (!hasFolders && !hasArchives && !hasImages && !hasVideos) {
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
    const mediaItems = [];
    if (hasImages) {
      data.images.forEach((img) => mediaItems.push({ type: 'file', mime: 'image', path: img.rel, name: img.name }));
    }
    if (hasVideos) {
      data.videos.forEach((v) => mediaItems.push({ type: 'file', mime: 'video', path: v.rel, name: v.name }));
    }
    if (mediaItems.length) renderMediaGrid(mediaItems);
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
      const mediaItems = [];
      (data.images || []).forEach((img) => mediaItems.push({
        type: 'archive', mime: 'image', path: relPath, entry: img.entry, name: img.name,
      }));
      (data.videos || []).forEach((v) => mediaItems.push({
        type: 'archive', mime: 'video', path: relPath, entry: v.entry, name: v.name,
      }));
      if (!mediaItems.length) {
        showEmpty('压缩包内没有图片或视频');
        return;
      }
      renderMediaGrid(mediaItems);
    } catch (err) {
      showEmpty(err.message);
    }
  }

  /* ---------------- Media grid ---------------- */
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

  function videoUrl(item) {
    const p = encodeURIComponent(item.path);
    if (item.type === 'archive') {
      return `/api/video?path=${p}&entry=${encodeURIComponent(item.entry)}`;
    }
    return `/api/video?path=${p}`;
  }

  function renderMediaGrid(items) {
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

      if (item.mime === 'video') {
        const badge = document.createElement('div');
        badge.className = 'video-badge';
        badge.innerHTML = '&#9658;';
        box.appendChild(badge);
        box.classList.add('video-box');
      }

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
    $('#lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateLightbox();
  }

  function closeLightbox() {
    $('#lightbox').classList.add('hidden');
    stopVideo();
    $('#lb-img').src = '';
    document.body.style.overflow = '';
  }

  function updateLightbox() {
    const item = state.imageList[state.lbIndex];
    if (!item) return;
    $('#lb-counter').textContent = `${state.lbIndex + 1} / ${state.imageList.length}`;

    if (item.mime === 'video') {
      $('#lb-img').classList.add('hidden');
      $('#lb-video-wrap').classList.remove('hidden');
      const video = $('#lb-video');
      stopVideo();
      video.src = videoUrl(item);
      video.load();
      video.play().catch(() => {});
    } else {
      stopVideo();
      $('#lb-video-wrap').classList.add('hidden');
      $('#lb-img').classList.remove('hidden');
      $('#lb-img').src = rawUrl(item);
    }
  }

  function stopVideo() {
    const video = $('#lb-video');
    if (document.pictureInPictureElement === video) {
      document.exitPictureInPicture().catch(() => {});
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
    $('#vc-progress').value = 0;
    $('#vc-time').textContent = '0:00 / 0:00';
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

  /* ---------------- Video controls ---------------- */
  const video = $('#lb-video');

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

  video.addEventListener('play', () => { $('#vc-play').innerHTML = '&#10074;&#10074;'; });
  video.addEventListener('pause', () => { $('#vc-play').innerHTML = '&#9658;'; });

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
    const wrap = $('#lb-video-wrap');
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (wrap.requestFullscreen) {
      wrap.requestFullscreen();
    }
  });

  video.addEventListener('dblclick', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.fullscreenEnabled) $('#lb-video-wrap').requestFullscreen();
  });

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
