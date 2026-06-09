/**
 * MediaFlow — app.js
 * Tam frontend məntiqi: URL aşkarlanması, API çağrıları, UI idarəetməsi
 */

// ─── Konfiqurasiya ─────────────────────────────────────────────
// Cloudflare Worker URL-ni buraya yazın (deploy etdikdən sonra)
const WORKER_URL = 'https://mediaflow-worker.YOUR-SUBDOMAIN.workers.dev';

// ─── Platform URL Pattern-ları ─────────────────────────────────
const PLATFORM_PATTERNS = {
  youtube: [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([\w-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([\w-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([\w-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([\w-]+)/,
    /(?:https?:\/\/)?youtu\.be\/([\w-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([\w-]+)/,
    /(?:https?:\/\/)?m\.youtube\.com\/watch\?(?:.*&)?v=([\w-]+)/,
    /(?:https?:\/\/)?music\.youtube\.com\/watch\?(?:.*&)?v=([\w-]+)/,
  ],
  instagram: [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([\w-]+)/,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reels\/([\w-]+)/,
    /(?:https?:\/\/)?instagr\.am\/(?:p|reel)\/([\w-]+)/,
  ],
  tiktok: [
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.]+\/video\/(\d+)/,
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([\w]+)/,
    /(?:https?:\/\/)?vm\.tiktok\.com\/([\w]+)/,
    /(?:https?:\/\/)?vt\.tiktok\.com\/([\w]+)/,
    /(?:https?:\/\/)?m\.tiktok\.com\/v\/(\d+)/,
  ],
};

// Qısa link domenləri (redirect ehtimalı)
const SHORT_LINK_DOMAINS = [
  'youtu.be', 'instagr.am', 'vm.tiktok.com', 'vt.tiktok.com',
  'bit.ly', 'tinyurl.com', 'ow.ly', 't.co', 'is.gd', 'buff.ly',
];

// Platform SVG İkonları
const PLATFORM_ICONS = {
  youtube: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="1" y="4" width="18" height="12" rx="3" fill="#FF0000"/>
    <path d="M8 7.5l5 2.5-5 2.5V7.5z" fill="white"/>
  </svg>`,
  instagram: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="2" y="2" width="16" height="16" rx="4.5" stroke="url(#ig)" stroke-width="1.5"/>
    <circle cx="10" cy="10" r="3.5" stroke="url(#ig)" stroke-width="1.5"/>
    <circle cx="14.5" cy="5.5" r="1" fill="#E1306C"/>
    <defs>
      <linearGradient id="ig" x1="2" y1="18" x2="18" y2="2">
        <stop stop-color="#F56040"/><stop offset="0.5" stop-color="#C13584"/><stop offset="1" stop-color="#833AB4"/>
      </linearGradient>
    </defs>
  </svg>`,
  tiktok: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M13 2c.3 2 1.5 3.2 3 3.5v2.8c-1.2 0-2.3-.4-3-1v5.2c0 3-2.3 5.5-5 5.5S3 15.5 3 12.5 5.3 7 8 7v3c-1 0-2 .7-2 2.5s1 2.5 2 2.5 2-1 2-2.5V2h3z" fill="#69C9D0"/>
    <path d="M12 1c.3 2 1.5 3.2 3 3.5v2.8c-1.2 0-2.3-.4-3-1v5.2c0 3-2.3 5.5-5 5.5S2 14.5 2 11.5 4.3 6 7 6v3c-1 0-2 .7-2 2.5s1 2.5 2 2.5 2-1 2-2.5V1h3z" fill="#EE1D52"/>
  </svg>`,
  unknown: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="9" stroke="#555" stroke-width="1.5"/>
    <path d="M7 10h6M10 7v6" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
};

// ─── DOM Elementləri ───────────────────────────────────────────
const $ = id => document.getElementById(id);
const urlInput        = $('urlInput');
const clearBtn        = $('clearBtn');
const fetchBtn        = $('fetchBtn');
const platformIcon    = $('platformIcon');
const inputHint       = $('inputHint');
const inputSection    = $('inputSection');
const loadingCard     = $('loadingCard');
const loadingText     = $('loadingText');
const errorCard       = $('errorCard');
const errorTitle      = $('errorTitle');
const errorMsg        = $('errorMsg');
const retryBtn        = $('retryBtn');
const videoCard       = $('videoCard');
const thumbnail       = $('thumbnail');
const durationBadge   = $('durationBadge');
const platformTag     = $('platformTag');
const videoTitle      = $('videoTitle');
const videoAuthor     = $('videoAuthor');
const tabVideo        = $('tabVideo');
const tabAudio        = $('tabAudio');
const videoFormats    = $('videoFormats');
const audioFormats    = $('audioFormats');
const downloadBtn     = $('downloadBtn');
const progressCard    = $('progressCard');
const progressLabel   = $('progressLabel');
const progressPct     = $('progressPct');
const progressFill    = $('progressFill');
const progressSub     = $('progressSub');
const successCard     = $('successCard');
const successSub      = $('successSub');
const newDownloadBtn  = $('newDownloadBtn');

// ─── Vəziyyət ──────────────────────────────────────────────────
let state = {
  platform: null,
  url: '',
  videoData: null,
  selectedFormat: null,
  activeTab: 'video',
};

// ─── URL Aşkarlama ─────────────────────────────────────────────
function detectPlatform(url) {
  if (!url || url.trim().length < 5) return null;
  const trimmed = url.trim();
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) return platform;
    }
  }
  // Qısa link yoxlaması
  try {
    const hostname = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed).hostname.replace('www.', '');
    if (SHORT_LINK_DOMAINS.includes(hostname)) return 'short';
  } catch {}
  return null;
}

function isValidUrl(url) {
  try {
    const u = new URL(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

function normalizeUrl(url) {
  let u = url.trim();
  if (!u.startsWith('http')) u = 'https://' + u;
  return u;
}

// ─── UI Yardımçı Funksiyalar ───────────────────────────────────
function hide(...els) { els.forEach(el => { if (el) el.style.display = 'none'; }); }
function show(el, display = 'flex') { if (el) el.style.display = display; }
function showBlock(el) { show(el, 'block'); }

function resetToInput() {
  hide(loadingCard, errorCard, videoCard, progressCard, successCard);
  show(inputSection, 'flex');
  state.selectedFormat = null;
  state.videoData = null;
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v9M5 9l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 15h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    Format Seçin
  `;
}

function updatePlatformIcon(platform) {
  platformIcon.innerHTML = PLATFORM_ICONS[platform] || PLATFORM_ICONS.unknown;
  platformIcon.className = 'platform-icon' + (platform && platform !== 'short' ? ' ' + platform + ' detected' : '');
  setTimeout(() => platformIcon.classList.remove('detected'), 400);
}

function setInputHint(msg, type = '') {
  inputHint.textContent = msg;
  inputHint.className = 'input-hint' + (type ? ' ' + type : '');
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '~';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getPlatformLabel(p) {
  return { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' }[p] || p;
}

// ─── Input Event-ləri ──────────────────────────────────────────
urlInput.addEventListener('input', () => {
  const val = urlInput.value;
  clearBtn.style.display = val.length > 0 ? 'flex' : 'none';

  if (val.trim().length === 0) {
    state.platform = null;
    state.url = '';
    updatePlatformIcon(null);
    setInputHint('Linki yuxarıya yapışdırın');
    fetchBtn.disabled = true;
    return;
  }

  const platform = detectPlatform(val);
  state.platform = platform;
  state.url = val.trim();
  updatePlatformIcon(platform);

  if (platform === 'youtube') {
    setInputHint('✓ YouTube linki aşkar edildi', 'valid');
    fetchBtn.disabled = false;
  } else if (platform === 'instagram') {
    setInputHint('✓ Instagram linki aşkar edildi', 'valid');
    fetchBtn.disabled = false;
  } else if (platform === 'tiktok') {
    setInputHint('✓ TikTok linki aşkar edildi', 'valid');
    fetchBtn.disabled = false;
  } else if (platform === 'short') {
    setInputHint('↳ Qısa link — yönləndirilir…', 'info');
    fetchBtn.disabled = false;
  } else if (isValidUrl(val)) {
    setInputHint('Dəstəklənməyən link formatı', 'invalid');
    fetchBtn.disabled = true;
  } else {
    setInputHint('Düzgün link formatı daxil edin', 'invalid');
    fetchBtn.disabled = true;
  }
});

urlInput.addEventListener('paste', () => {
  // Paste-dən sonra input fire olmur, setTimeout ilə tetikleyirik
  setTimeout(() => urlInput.dispatchEvent(new Event('input')), 50);
});

clearBtn.addEventListener('click', () => {
  urlInput.value = '';
  urlInput.dispatchEvent(new Event('input'));
  urlInput.focus();
});

// ─── API Çağrıları ─────────────────────────────────────────────
async function fetchVideoInfo(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const resp = await fetch(`${WORKER_URL}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizeUrl(url) }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Server xətası: ${resp.status}`);
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Sorğu vaxtı bitdi. İnternet bağlantınızı yoxlayın.');
    throw err;
  }
}

async function fetchDownload(url, formatId, type) {
  const resp = await fetch(`${WORKER_URL}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: normalizeUrl(url), format_id: formatId, type }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Yüklənmə uğursuz oldu' }));
    throw new Error(err.error || `Yüklənmə xətası: ${resp.status}`);
  }

  return resp;
}

// ─── Format Siyahısı Render ────────────────────────────────────
function renderFormats(formats, container) {
  container.innerHTML = '';

  if (!formats || formats.length === 0) {
    container.innerHTML = '<p style="color:var(--text-3);font-size:.85rem;text-align:center;padding:16px">Format tapılmadı</p>';
    return;
  }

  formats.forEach(fmt => {
    const item = document.createElement('div');
    item.className = 'format-item';
    item.dataset.id = fmt.format_id;

    const qualityLabel = fmt.quality || fmt.height ? `${fmt.height || ''}${fmt.height ? 'p' : ''}` : fmt.abr ? `${fmt.abr}kbps` : 'Standart';
    const codecLabel   = [fmt.vcodec !== 'none' ? fmt.vcodec : '', fmt.acodec !== 'none' ? fmt.acodec : ''].filter(Boolean).join(' · ') || fmt.ext || '';
    const sizeLabel    = fmt.filesize ? formatFileSize(fmt.filesize) : fmt.filesize_approx ? '~' + formatFileSize(fmt.filesize_approx) : '–';

    item.innerHTML = `
      <div class="format-item-left">
        <span class="format-quality">${qualityLabel}</span>
        <div class="format-details">
          <span class="format-codec">${fmt.ext?.toUpperCase() || 'MP4'} ${codecLabel ? '· ' + codecLabel : ''}</span>
          <span class="format-size">${sizeLabel}</span>
        </div>
      </div>
      <div class="format-select-indicator"></div>
    `;

    item.addEventListener('click', () => {
      container.querySelectorAll('.format-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      state.selectedFormat = fmt.format_id;
      updateDownloadBtn(fmt);
    });

    container.appendChild(item);
  });
}

function updateDownloadBtn(fmt) {
  const label = fmt.height ? `${fmt.height}p yüklə` : fmt.abr ? `${fmt.abr}kbps MP3 yüklə` : 'Yüklə';
  downloadBtn.disabled = false;
  downloadBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v9M5 9l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 15h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    ${label}
  `;
}

// ─── Tab Keçidi ────────────────────────────────────────────────
tabVideo.addEventListener('click', () => {
  state.activeTab = 'video';
  tabVideo.classList.add('active');
  tabAudio.classList.remove('active');
  show(videoFormats, 'flex');
  hide(audioFormats);
  state.selectedFormat = null;
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v9M5 9l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 15h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    Format Seçin
  `;
  videoFormats.querySelectorAll('.format-item').forEach(el => el.classList.remove('selected'));
});

tabAudio.addEventListener('click', () => {
  state.activeTab = 'audio';
  tabAudio.classList.add('active');
  tabVideo.classList.remove('active');
  hide(videoFormats);
  show(audioFormats, 'flex');
  state.selectedFormat = null;
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v9M5 9l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 15h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    Format Seçin
  `;
  audioFormats.querySelectorAll('.format-item').forEach(el => el.classList.remove('selected'));
});

// ─── Video Məlumatlarını Göstər ────────────────────────────────
function displayVideoInfo(data) {
  // Thumbnail
  if (data.thumbnail) {
    thumbnail.src = data.thumbnail;
    thumbnail.onerror = () => {
      thumbnail.style.display = 'none';
    };
  }

  // Müddət
  const dur = formatDuration(data.duration);
  durationBadge.textContent = dur;
  durationBadge.style.display = dur ? 'block' : 'none';

  // Platform taqı
  const p = data.platform || state.platform;
  platformTag.textContent = getPlatformLabel(p);
  platformTag.className = 'platform-tag ' + (p || '');

  // Başlıq və müəllif
  videoTitle.textContent = data.title || 'Başlıq yoxdur';
  videoAuthor.textContent = data.uploader || data.channel || data.creator || '';

  // Formatlar
  const vFormats = (data.formats || []).filter(f =>
    f.vcodec && f.vcodec !== 'none' && f.height
  ).sort((a, b) => (b.height || 0) - (a.height || 0));

  const aFormats = (data.formats || []).filter(f =>
    (!f.vcodec || f.vcodec === 'none') && f.acodec && f.acodec !== 'none'
  ).sort((a, b) => (b.abr || 0) - (a.abr || 0));

  // Yalnız audio olan platformlar (məs. audio-only formatlar mövcud deyilsə,
  // ümumi formatları göstər)
  const finalVFormats = vFormats.length > 0 ? vFormats : (data.formats || []).slice(0, 8);
  const finalAFormats = aFormats.length > 0 ? aFormats : [];

  renderFormats(finalVFormats, videoFormats);
  renderFormats(finalAFormats, audioFormats);

  // Əgər audio format yoxdursa tab-ı disable et
  if (finalAFormats.length === 0) {
    tabAudio.style.opacity = '0.4';
    tabAudio.style.pointerEvents = 'none';
    tabAudio.title = 'Bu media üçün ayrı audio formatı mövcud deyil';
  } else {
    tabAudio.style.opacity = '';
    tabAudio.style.pointerEvents = '';
    tabAudio.title = '';
  }

  // Default: video tab
  tabVideo.click();

  hide(loadingCard, errorCard, inputSection);
  show(videoCard, 'block');
}

// ─── Fetch Button ──────────────────────────────────────────────
fetchBtn.addEventListener('click', handleFetch);
urlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !fetchBtn.disabled) handleFetch();
});

async function handleFetch() {
  const url = urlInput.value.trim();
  if (!url) return;

  hide(errorCard, videoCard, successCard, inputSection);
  show(loadingCard, 'flex');
  loadingText.textContent = 'Məlumatlar alınır…';

  try {
    const data = await fetchVideoInfo(url);
    state.videoData = data;
    displayVideoInfo(data);
  } catch (err) {
    hide(loadingCard);
    show(inputSection, 'flex');
    showError('Məlumat alınamadı', friendlyError(err.message));
  }
}

// ─── Yükləmə ───────────────────────────────────────────────────
downloadBtn.addEventListener('click', handleDownload);

async function handleDownload() {
  if (!state.selectedFormat || !state.videoData) return;

  const type = state.activeTab;
  const url  = urlInput.value.trim();

  hide(videoCard);
  show(progressCard, 'flex');
  progressLabel.textContent = 'Yükləmə başladılır…';
  progressPct.textContent = '0%';
  progressFill.style.width = '0%';
  progressSub.textContent = '';

  // Animasion progress (real streaming progress üçün worker tərəfdə
  // Content-Length header-i lazımdır; əks halda simulasiya göstəririk)
  let fakeProgress = 0;
  const fakeTimer = setInterval(() => {
    if (fakeProgress < 85) {
      fakeProgress += Math.random() * 8;
      setProgress(Math.min(fakeProgress, 85));
    }
  }, 400);

  try {
    progressLabel.textContent = 'Fayl yüklənir…';
    const resp = await fetchDownload(url, state.selectedFormat, type);

    clearInterval(fakeTimer);
    setProgress(95);
    progressLabel.textContent = 'Fayl hazırlanır…';

    // Content-Disposition-dan fayl adını çıxar
    const cd = resp.headers.get('Content-Disposition') || '';
    const nameMatch = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    const fileName  = nameMatch ? decodeURIComponent(nameMatch[1].replace(/"/g, '')) : buildFileName(state.videoData, type);

    const blob = await resp.blob();
    setProgress(100);
    progressLabel.textContent = 'Tamamlandı!';

    // Browser yükləmə
    triggerDownload(blob, fileName);

    setTimeout(() => {
      hide(progressCard);
      showSuccess(fileName);
    }, 600);

  } catch (err) {
    clearInterval(fakeTimer);
    hide(progressCard);
    show(videoCard, 'block');
    showError('Yüklənmə xətası', friendlyError(err.message));
  }
}

function setProgress(pct) {
  const p = Math.round(pct);
  progressPct.textContent = p + '%';
  progressFill.style.width = p + '%';
}

function triggerDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

function buildFileName(data, type) {
  const ext  = type === 'audio' ? 'mp3' : 'mp4';
  const safe = (data.title || 'video').replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ \-_]/g, '').trim().slice(0, 60);
  return `${safe}.${ext}`;
}

// ─── Xəta / Müvəffəqiyyət UI ──────────────────────────────────
function showError(title, msg) {
  errorTitle.textContent = title;
  errorMsg.textContent = msg;
  show(errorCard, 'flex');
}

function showSuccess(fileName) {
  successSub.textContent = `"${fileName}" faylı yükləndi`;
  show(successCard, 'flex');
}

function friendlyError(msg) {
  if (!msg) return 'Naməlum xəta baş verdi.';
  if (msg.includes('abort') || msg.includes('timeout') || msg.includes('vaxtı'))
    return 'Sorğu vaxtı bitdi. İnternet bağlantınızı yoxlayın.';
  if (msg.includes('403') || msg.includes('Private') || msg.includes('private'))
    return 'Bu media gizli və ya əlçatmazdır.';
  if (msg.includes('404'))
    return 'Məzmun tapılmadı. Link silinmiş ola bilər.';
  if (msg.includes('429'))
    return 'Çox sayda sorğu. Bir az gözləyib yenidən cəhd edin.';
  if (msg.includes('geo') || msg.includes('region') || msg.includes('ölkə'))
    return 'Bu məzmun sizin ölkənizdə mövcud deyil.';
  if (msg.includes('age') || msg.includes('yaş'))
    return 'Yaş məhdudiyyəti olan məzmun yüklənə bilmir.';
  if (msg.includes('live') || msg.includes('canlı'))
    return 'Canlı yayımlar yüklənə bilmir.';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed'))
    return 'Şəbəkə xətası. Server əlçatan olmaya bilər.';
  return msg.length > 120 ? msg.slice(0, 120) + '…' : msg;
}

// ─── Retry & Yeni Yükləmə ─────────────────────────────────────
retryBtn.addEventListener('click', () => {
  hide(errorCard);
  show(inputSection, 'flex');
  urlInput.focus();
});

newDownloadBtn.addEventListener('click', () => {
  hide(successCard);
  show(inputSection, 'flex');
  urlInput.value = '';
  urlInput.dispatchEvent(new Event('input'));
  state = { platform: null, url: '', videoData: null, selectedFormat: null, activeTab: 'video' };
  urlInput.focus();
});
