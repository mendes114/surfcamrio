const main = document.getElementById('main');
const elStatus = document.getElementById('status');
const elContagem = document.getElementById('contagem');
const btnRefresh = document.getElementById('btn-refresh');

const MAX_PLAYERS = 8;
const activeHls = new Map();

const ZONAS_ORDEM = [
  { id: 'recreio',  label: 'Recreio' },
  { id: 'barra',    label: 'Barra da Tijuca' },
  { id: 'zona-sul', label: 'Zona Sul' },
];

const ZONAS_ESCONDIDAS = new Set(['sp', 'outra']);

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}

// ---- HLS player management ----

function destroyPlayer(id) {
  const entry = activeHls.get(id);
  if (!entry) return;
  try { entry.hls?.destroy(); } catch {}
  try { entry.video?.pause(); entry.video?.removeAttribute('src'); entry.video?.load(); } catch {}
  try { entry.iframe?.remove(); } catch {}
  activeHls.delete(id);
}

function destroyFarthest() {
  if (activeHls.size < MAX_PLAYERS) return;
  let worst = null, worstDist = -1;
  for (const [id, entry] of activeHls) {
    const rect = entry.container?.getBoundingClientRect();
    if (!rect) continue;
    const dist = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
    if (dist > worstDist) { worstDist = dist; worst = id; }
  }
  if (worst) {
    destroyPlayer(worst);
    const cont = document.querySelector(`[data-id="${worst}"] .cam-video`);
    if (cont) cont.replaceChildren(el('div', 'cam-placeholder', 'Role para ativar'));
  }
}

function showPlayButton(id, urls, container, ytId, iframeUrl) {
  const wrap = el('div', 'cam-play-wrap');
  const btn = el('button', 'cam-play-btn');
  btn.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
  btn.onclick = () => {
    destroyFarthest();
    if (iframeUrl) startIframe(id, iframeUrl, container);
    else if (ytId) startYouTube(id, ytId, container);
    else startPlayer(id, urls, container);
  };
  wrap.appendChild(btn);
  container.replaceChildren(wrap);
}

function startYouTube(id, ytId, container) {
  if (activeHls.has(id)) return;
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;top:0;left:0';
  container.style.position = 'relative';
  container.replaceChildren(iframe);
  activeHls.set(id, { hls: null, video: null, container, iframe });
}

function startIframe(id, url, container) {
  if (activeHls.has(id)) return;
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = true;
  iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;top:0;left:0';
  container.style.position = 'relative';
  container.replaceChildren(iframe);
  activeHls.set(id, { hls: null, video: null, container, iframe });
}

function startPlayer(id, urls, container) {
  if (activeHls.has(id)) return;

  const video = document.createElement('video');
  video.controls = true;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  const expandBtn = el('button', 'btn-expand');
  expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  expandBtn.onclick = (e) => {
    e.stopPropagation();
    if (video.requestFullscreen) video.requestFullscreen();
    else if (video.webkitEnterFullScreen) video.webkitEnterFullScreen();
  };

  container.replaceChildren(video, expandBtn);

  if (typeof Hls !== 'undefined' && Hls.isSupported()) {
    let idx = 0;
    let hls = null;
    function tryNext() {
      if (idx >= urls.length) {
        container.replaceChildren(el('div', 'cam-erro', 'Offline'));
        activeHls.delete(id);
        return;
      }
      if (hls) { try { hls.destroy(); } catch {} }
      hls = new Hls({
        enableWorker: false,
        lowLatencyMode: true,
        maxBufferLength: 8,
        maxMaxBufferLength: 15,
        maxBufferSize: 2 * 1024 * 1024,
        backBufferLength: 0,
      });
      hls.loadSource(urls[idx]);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_ev, data) => {
        if (data.fatal) { idx++; tryNext(); }
      });
      activeHls.set(id, { hls, video, container });
    }
    tryNext();
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = urls[0];
    activeHls.set(id, { hls: null, video, container });
  }
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const card = entry.target;
    const id = card.dataset.id;
    const urls = JSON.parse(card.dataset.urls || '[]');
    const ytId = card.dataset.ytid || null;
    const iframeUrl = card.dataset.iframeurl || null;
    if (!id || (!urls.length && !ytId && !iframeUrl)) continue;
    const videoBox = card.querySelector('.cam-video');
    if (!videoBox) continue;

    if (entry.isIntersecting) {
      if (!activeHls.has(id) && activeHls.size < MAX_PLAYERS) {
        if (iframeUrl) startIframe(id, iframeUrl, videoBox);
        else if (ytId) startYouTube(id, ytId, videoBox);
        else startPlayer(id, urls, videoBox);
      } else if (!activeHls.has(id)) {
        showPlayButton(id, urls, videoBox, ytId, iframeUrl);
      }
    } else {
      destroyPlayer(id);
      showPlayButton(id, urls, videoBox, ytId, iframeUrl);
    }
  }
}, { rootMargin: '200px 0px' });

function inferirZona(titulo) {
  const t = (titulo || '').toLowerCase();
  if (t.includes('macumba') || t.includes('prainha') || t.includes('curvão') || t.includes('1w') || t.includes('5w') || t.includes('4w') || t.includes('6w') || t.includes('secreto') || t.includes('farofa')) return 'recreio';
  if (t.includes('recreio') || t.includes('canto')) return 'recreio';
  if (t.includes('barra') || t.includes('reserva') || t.includes('postinho') || t.includes('posto 6') || t.includes('meio')) return 'barra';
  if (t.includes('leblon') || t.includes('ipanema') || t.includes('copa') || t.includes('leme') || t.includes('arpoador') || t.includes('conrado') || t.includes('pepino')) return 'zona-sul';
  return 'outra';
}

// ---- Build camera card ----

function criarCard(cam) {
  const card = el('article', 'cam');
  card.dataset.id = cam.id;
  const isYt = cam.streamType === 'youtube' && cam.youtubeId;
  const isIframe = cam.streamType === 'iframe' && cam.iframeUrl;
  const isExterno = cam.streamType === 'externo' && cam.linkExterno;
  const urls = (isYt || isIframe || isExterno) ? [] : (Array.isArray(cam.streamUrl) ? cam.streamUrl : [cam.streamUrl]);
  card.dataset.urls = JSON.stringify(urls);
  if (isYt) card.dataset.ytid = cam.youtubeId;
  if (isIframe) card.dataset.iframeurl = cam.iframeUrl;

  const videoBox = el('div', 'cam-video');
  if (isExterno) {
    const wrap = el('div', 'cam-play-wrap');
    const link = document.createElement('a');
    link.href = cam.linkExterno;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'cam-play-btn';
    link.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/><path d="M5 5v14h14v-7h2v7c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h7v2H5z" fill="white"/></svg>';
    link.title = 'Abrir câmera em nova aba';
    wrap.appendChild(link);
    videoBox.appendChild(wrap);
  } else {
    showPlayButton(cam.id, urls, videoBox, isYt ? cam.youtubeId : null, isIframe ? cam.iframeUrl : null);
  }
  card.appendChild(videoBox);

  const info = el('div', 'cam-info');
  const titulo = el('span', 'cam-titulo');
  const dot = el('span', 'dot-live');
  titulo.prepend(dot);
  const nomeLimpo = (cam.titulo || '').replace(/^SurfConnect\s*·\s*/i, '').replace(/^SurfView\s*·?\s*/i, '');
  titulo.appendChild(document.createTextNode(nomeLimpo));
  info.appendChild(titulo);

  info.appendChild(el('span', 'cam-fonte', 'AO VIVO'));
  card.appendChild(info);

  observer.observe(card);
  return card;
}

// ---- Fetch all cameras ----

function fetchComTimeout(url, ms = 30000) {
  return fetch(url, { signal: AbortSignal.timeout(ms) }).then(r => r.json());
}

async function carregarTudo() {
  const [resSV, resWZ, resSC, resCAV, resSKY, resIFR] = await Promise.allSettled([
    fetchComTimeout('/api/surfview', 45000),
    fetchComTimeout('/api/macumba', 45000),
    fetchComTimeout('/api/surfconnect', 45000),
    fetchComTimeout('/api/climaaovivo', 45000),
    fetchComTimeout('/api/skyline', 45000),
    fetchComTimeout('/api/iframes', 5000),
  ]);

  const todas = [];
  const idsVistos = new Set();

  if (resSV.status === 'fulfilled') {
    const cams = (resSV.value.cameras || []).filter(c => c.streamUrl);
    for (const c of cams) {
      idsVistos.add(c.id);
      todas.push(c);
    }
  }

  if (resWZ.status === 'fulfilled') {
    const cams = resWZ.value.cameras || [];
    const svBases = new Set();
    for (const c of todas) {
      if (c.streamUrl) {
        const base = (Array.isArray(c.streamUrl) ? c.streamUrl[0] : c.streamUrl)
          .split('?')[0].replace(/\/playlist\.m3u8$/, '');
        svBases.add(base);
      }
    }
    for (const c of cams) {
      if (idsVistos.has(c.id)) continue;
      const base = c.streamUrl.split('?')[0].replace(/\/playlist\.m3u8$/, '');
      if (svBases.has(base)) continue;
      idsVistos.add(c.id);
      todas.push(c);
    }
  }

  if (resSC.status === 'fulfilled') {
    const cams = (resSC.value.cameras || []).filter(c => c.streamUrl);
    const bases = new Set();
    for (const c of todas) {
      if (c.streamUrl) {
        const base = (Array.isArray(c.streamUrl) ? c.streamUrl[0] : c.streamUrl)
          .split('?')[0].replace(/\/playlist\.m3u8$/, '');
        bases.add(base);
      }
    }
    for (const c of cams) {
      if (idsVistos.has(c.id)) continue;
      const base = c.streamUrl.split('?')[0].replace(/\/playlist\.m3u8$/, '');
      if (bases.has(base)) continue;
      idsVistos.add(c.id);
      if (!c.zona) c.zona = inferirZona(c.titulo);
      todas.push(c);
    }
  }

  if (resCAV.status === 'fulfilled') {
    const cams = (resCAV.value.cameras || []).filter(c => c.streamUrl);
    for (const c of cams) {
      if (idsVistos.has(c.id)) continue;
      idsVistos.add(c.id);
      todas.push(c);
    }
  }

  if (resSKY.status === 'fulfilled') {
    const cams = (resSKY.value.cameras || []).filter(c => c.youtubeId);
    for (const c of cams) {
      if (idsVistos.has(c.id)) continue;
      idsVistos.add(c.id);
      todas.push(c);
    }
  }

  if (resIFR.status === 'fulfilled') {
    const cams = (resIFR.value.cameras || []).filter(c => c.iframeUrl || c.linkExterno);
    for (const c of cams) {
      if (idsVistos.has(c.id)) continue;
      idsVistos.add(c.id);
      todas.push(c);
    }
  }

  return todas;
}

// ---- Render ----

function renderizar(cameras) {
  for (const card of main.querySelectorAll('[data-id]')) {
    destroyPlayer(card.dataset.id);
    observer.unobserve(card);
  }
  main.replaceChildren();

  if (!cameras.length) {
    main.appendChild(el('div', 'vazio', 'Nenhuma câmera ao vivo no momento.'));
    return;
  }

  const remap = { macumba: 'recreio' };
  const porZona = new Map();
  for (const cam of cameras) {
    let z = cam.zona || 'outra';
    if (remap[z]) z = remap[z];
    if (ZONAS_ESCONDIDAS.has(z)) continue;
    if (!porZona.has(z)) porZona.set(z, []);
    porZona.get(z).push(cam);
  }

  for (const { id, label } of ZONAS_ORDEM) {
    const cams = porZona.get(id);
    if (!cams?.length) continue;

    const section = el('section', 'zona');
    const header = el('div', 'zona-header');
    header.appendChild(el('h2', 'zona-titulo', label));
    header.appendChild(el('span', 'zona-badge', `${cams.length} ao vivo`));
    section.appendChild(header);

    const grade = el('div', 'grade');
    for (const cam of cams) grade.appendChild(criarCard(cam));
    section.appendChild(grade);

    main.appendChild(section);
    porZona.delete(id);
  }

  for (const [z, cams] of porZona) {
    if (!cams.length) continue;
    const section = el('section', 'zona');
    const header = el('div', 'zona-header');
    header.appendChild(el('h2', 'zona-titulo', z));
    header.appendChild(el('span', 'zona-badge', `${cams.length} ao vivo`));
    section.appendChild(header);

    const grade = el('div', 'grade');
    for (const cam of cams) grade.appendChild(criarCard(cam));
    section.appendChild(grade);
    main.appendChild(section);
  }

  let total = 0;
  for (const [, cams] of porZona) total += cams.length;
  elContagem.textContent = `${total} câmeras`;
}

// ---- Init ----

async function atualizar() {
  btnRefresh.classList.add('is-spinning');
  elStatus.textContent = 'Atualizando...';
  try {
    const cameras = await carregarTudo();
    renderizar(cameras);
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    elStatus.textContent = agora;
  } catch {
    elStatus.textContent = 'Erro';
  } finally {
    btnRefresh.classList.remove('is-spinning');
  }
}

btnRefresh.addEventListener('click', atualizar);
atualizar();
setInterval(atualizar, 120_000);
