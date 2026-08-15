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
    browseData: null,
    sortBy: 'name',
    sortOrder: 'asc',
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
      if (data.needsPasswordChange) {
        openPwdModal(true);
      }
    } catch (err) {
      $('#login-error').textContent = err.message;
      $('#login-error').classList.remove('hidden');
    }
  });

  $('#btn-logout').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    showLogin();
  });

  /* ---------------- Change password ---------------- */
  let pwdForced = false;

  async function getCsrfToken() {
    try {
      const data = await api('/api/csrf-token');
      return data.csrfToken || '';
    } catch {
      return '';
    }
  }

  function openPwdModal(forced) {
    pwdForced = !!forced;
    $('#pwd-old').value = '';
    $('#pwd-new').value = '';
    $('#pwd-confirm').value = '';
    $('#pwd-error').classList.add('hidden');
    $('#pwd-modal').classList.remove('hidden');
    $('#pwd-old').focus();
  }

  function closePwdModal() {
    $('#pwd-modal').classList.add('hidden');
    pwdForced = false;
  }

  $('#btn-change-password').addEventListener('click', () => openPwdModal(false));

  $('#pwd-cancel').addEventListener('click', () => {
    if (pwdForced) return;
    closePwdModal();
  });

  $('#pwd-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = $('#pwd-old').value;
    const newPassword = $('#pwd-new').value;
    const confirm = $('#pwd-confirm').value;

    if (newPassword.length < 6) {
      return showPwdError('新密码至少6个字符');
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return showPwdError('新密码必须包含字母和数字');
    }
    if (newPassword !== confirm) {
      return showPwdError('两次输入的新密码不一致');
    }

    try {
      const csrfToken = await getCsrfToken();
      await api('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      closePwdModal();
      alert('密码修改成功');
    } catch (err) {
      showPwdError(err.message);
    }
  });

  function showPwdError(msg) {
    $('#pwd-error').textContent = msg;
    $('#pwd-error').classList.remove('hidden');
  }

  /* ---------------- Sorting ---------------- */
  $('#sort-by').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    if (state.browseData) renderBrowse();
  });

  $('#sort-order').addEventListener('change', (e) => {
    state.sortOrder = e.target.value;
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
    try {
      const data = await api('/api/browse?path=' + encodeURIComponent(relPath || ''));
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
        type: 'file', mime: 'image', path: img.rel, name: img.name, mtime: img.mtime,
      }));
    }
    if (hasVideos) {
      data.videos.forEach((v) => mediaItems.push({
        type: 'file', mime: 'video', path: v.rel, name: v.name, mtime: v.mtime,
      }));
    }
    if (mediaItems.length) renderMediaGrid(sortItems(mediaItems, state.sortBy));
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
    stopVideo();
    $('#lightbox').classList.add('hidden');
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
    try {
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
    const target = $('#lightbox');
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (target.requestFullscreen) {
      target.requestFullscreen();
    }
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
