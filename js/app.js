let currentBooks = [];
let activeBook = null;
let currentTrackIndex = 0;
const player = document.getElementById('audiobook-player');

// Yükleme göstergesi orijinal içerik (hata sonrası geri yüklenebilir)
const LOADING_BADGE_HTML = '<div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mistral-cream text-mistral-ink border border-mistral-beige-deep text-xs font-semibold"><span class="w-2.5 h-2.5 rounded-full bg-mistral-orange animate-ping"></span><span>LibriVox sesli kitap arşivi taranıyor...</span></div>';

// Varsayılan yükleme: popüler LibriVox kayıtları
const DEFAULT_QUERY = '(title:(sherlock) OR title:(dracula) OR title:(frankenstein) OR title:(alice) OR title:(monte cristo))';

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&/g, '&').replace(/"/g, '"').trim();
}

function formatCreator(creator) {
  if (Array.isArray(creator)) {
    return creator.join(', ') || 'Bilinmiyor';
  }
  return String(creator || 'Bilinmiyor');
}

// Süre formatı: "33:18" (dk:sn) veya saniye → "X saat Y dk"
function parseLength(len) {
  if (!len) return 0;
  const s = String(len);
  if (s.includes(':')) {
    const parts = s.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }
  return parseFloat(s) || 0;
}

function formatDuration(totalSec) {
  if (!totalSec || totalSec <= 0) return '';
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.round((totalSec % 3600) / 60);
  if (hrs > 0) return hrs + ' saat ' + mins + ' dk';
  return mins + ' dk';
}

// Arşiv arama: archive.org librivoxaudio koleksiyonu (CORS-open, LibriVox kayıtları)
async function loadAudiobooks() {
  const loading = document.getElementById('books-loading');
  const grid = document.getElementById('books-grid');
  const q = (document.getElementById('search-book').value || '').trim();

  loading.innerHTML = LOADING_BADGE_HTML;
  loading.classList.remove('hidden');
  grid.classList.add('hidden');

  try {
    let query = 'collection:librivoxaudio AND mediatype:audio';
    if (q) {
      query += ' AND (title:(' + q + ') OR creator:(' + q + '))';
    } else {
      query += ' AND ' + DEFAULT_QUERY;
    }

    const url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(query) +
      '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=description&fl%5B%5D=downloads&fl%5B%5D=language' +
      '&rows=24&output=json&sort%5B%5D=downloads+desc';

    const res = await fetch(url);
    if (!res.ok) throw new Error('Arşiv servisi yanıt vermedi (HTTP ' + res.status + ')');
    const data = await res.json();
    const docs = (data.response && data.response.docs) || [];

    currentBooks = docs.map(d => ({
      id: d.identifier,
      title: stripHtml(d.title) || 'Başlıksız Eser',
      authors: formatCreator(d.creator),
      description: stripHtml(d.description).slice(0, 300) || 'Açıklama bulunmuyor.',
      downloads: Number(d.downloads) || 0,
      language: Array.isArray(d.language) ? d.language[0] : (d.language || 'English'),
      detailsUrl: 'https://archive.org/details/' + d.identifier,
      tracks: null
    }));

    document.getElementById('audio-books-count').innerText = currentBooks.length + ' Sesli Kitap';

    loading.classList.add('hidden');
    grid.classList.remove('hidden');

    renderBooks(currentBooks);
  } catch(err) {
    console.error('loadAudiobooks error:', err);
    loading.innerHTML = '<span class="text-rose-500 font-medium text-sm">Sesli kitaplar yüklenemedi: ' + err.message + '</span>';
  }
}

function quickSearch(title) {
  document.getElementById('search-book').value = title;
  loadAudiobooks();
}

function renderBooks(list) {
  const grid = document.getElementById('books-grid');
  if (list.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-mistral-stone font-medium text-sm">Aramanıza uygun sesli kitap bulunamadı.</div>';
    return;
  }

  grid.innerHTML = list.map(b => `
    <div class="p-6 rounded-xl bg-white border border-mistral-hairline hover:border-mistral-orange/40 hover:shadow-md transition duration-200 flex flex-col justify-between group">
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-2xl">🎧</span>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-mistral-cream text-mistral-ink border border-mistral-beige-deep">
            ⬇️ ${b.downloads.toLocaleString('tr-TR')} dinlenme
          </span>
        </div>
        <h3 class="text-lg font-bold font-editorial text-mistral-ink group-hover:text-mistral-orange transition truncate mb-1">
          ${b.title}
        </h3>
        <span class="text-xs font-semibold text-mistral-slate block mb-2">✍️ ${b.authors}</span>
        <p class="text-xs text-mistral-slate line-clamp-3 leading-relaxed mb-4">
          ${b.description}
        </p>
      </div>

      <div class="pt-3 border-t border-mistral-hairline flex items-center justify-between gap-2">
        <button 
          onclick='selectAndPlayBook(${JSON.stringify(b).replace(/'/g, "'")})'
          class="flex-1 py-2 px-3 rounded-md bg-mistral-orange hover:bg-mistral-orange-deep text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer">
          <span>▶</span> Dinle & İncele
        </button>
        <a href="${b.detailsUrl}" target="_blank" rel="noopener" title="LibriVox Arşivine Git" class="p-2 rounded-md text-mistral-ink font-boldbg-mistral-cream hover:bg-mistral-cream-deeper text-mistral-ink border border-mistral-beige-deep text-xs">
          ↗
        </a>
      </div>
    </div>
  `).join('');
}

// Metadata endpoint'ten MP3 bölüm listesini çek ve ilk bölümü çalmaya başla
async function selectAndPlayBook(b) {
  activeBook = b;
  document.getElementById('dock-status').innerText = 'SESLİ KİTAP SEÇİLDİ';
  document.getElementById('dock-title').innerText = b.title;
  document.getElementById('dock-author').innerText = b.authors + (b.downloads ? ' • ⬇️ ' + b.downloads.toLocaleString('tr-TR') : '');

  const extBtn = document.getElementById('btn-dock-external');
  extBtn.href = b.detailsUrl;
  extBtn.classList.remove('hidden');
  extBtn.classList.add('inline-flex');

  window.scrollTo({ top: 100, behavior: 'smooth' });

  if (!b.tracks) {
    try {
      const res = await fetch('https://archive.org/metadata/' + encodeURIComponent(b.id));
      if (!res.ok) throw new Error('Bölüm verileri alınamadı');
      const data = await res.json();
      const files = data.files || [];
      const mp3s = files.filter(f => f.name && f.name.toLowerCase().endsWith('.mp3'));
      const preferred = mp3s.filter(f => f.name.includes('64kb'));
      const chosen = preferred.length > 0 ? preferred : mp3s;

      b.tracks = chosen.map(f => ({
        title: stripHtml(f.title || f.name).replace(/\.mp3$/i, ''),
        length: f.length || '',
        url: 'https://archive.org/download/' + b.id + '/' + encodeURI(f.name)
      }));
      b.totalTime = formatDuration(b.tracks.reduce((sum, t) => sum + parseLength(t.length), 0));
    } catch(e) {
      console.error('metadata error:', e);
      b.tracks = [];
    }
  }

  if (b.tracks.length === 0) {
    document.getElementById('dock-status').innerText = 'SES DOSYASI BULUNAMADI';
    document.getElementById('dock-author').innerText = b.authors + ' • Arşiv sayfasından dinleyebilirsiniz';
    return;
  }

  document.getElementById('dock-author').innerText = b.authors + ' • Toplam Süre: ' + (b.totalTime || 'Belirtilmemiş');
  playTrack(0);
}

function playTrack(i) {
  if (!activeBook || !activeBook.tracks || activeBook.tracks.length === 0) return;
  if (i < 0 || i >= activeBook.tracks.length) {
    stopPlayback();
    return;
  }
  currentTrackIndex = i;
  const t = activeBook.tracks[i];

  player.src = t.url;
  player.play().catch(err => {
    console.error('play error:', err);
    // Otomatik oynatma engellendiyse arşiv sayfasına yönlendir
    window.open(activeBook.detailsUrl, '_blank');
  });

  document.getElementById('dock-play-icon').innerText = '⏸';
  document.getElementById('dock-play-text').innerText = 'Duraklat';
  document.getElementById('dock-status').innerText = 'ŞİMDİ ÇALIYOR';
  document.getElementById('dock-author').innerText = activeBook.authors +
    ' • Bölüm ' + (i + 1) + '/' + activeBook.tracks.length +
    (t.length ? ' • ' + t.length : '');
}

function toggleAudioPlay() {
  if (!activeBook) {
    if (currentBooks.length > 0) selectAndPlayBook(currentBooks[0]);
    return;
  }

  if (!player.src) {
    // Bölüm listesi henüz yüklenmedi, tekrar dene
    selectAndPlayBook(activeBook);
    return;
  }

  if (player.paused) {
    player.play().catch(err => {
      console.error('play error:', err);
      window.open(activeBook.detailsUrl, '_blank');
    });
  } else {
    player.pause();
  }
}

function stopPlayback() {
  player.pause();
  player.removeAttribute('src');
  currentTrackIndex = 0;
  document.getElementById('dock-play-icon').innerText = '▶';
  document.getElementById('dock-play-text').innerText = 'Oynat';
}

player.addEventListener('play', () => {
  document.getElementById('dock-play-icon').innerText = '⏸';
  document.getElementById('dock-play-text').innerText = 'Duraklat';
  document.getElementById('dock-status').innerText = 'ŞİMDİ ÇALIYOR';
});

player.addEventListener('pause', () => {
  if (!player.ended) {
    document.getElementById('dock-play-icon').innerText = '▶';
    document.getElementById('dock-play-text').innerText = 'Devam Et';
    document.getElementById('dock-status').innerText = 'DURAKLATILDI';
  }
});

player.addEventListener('ended', () => {
  if (activeBook && activeBook.tracks && currentTrackIndex + 1 < activeBook.tracks.length) {
    playTrack(currentTrackIndex + 1);
  } else {
    document.getElementById('dock-play-icon').innerText = '▶';
    document.getElementById('dock-play-text').innerText = 'Oynat';
    document.getElementById('dock-status').innerText = 'TAMAMLANDI';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadAudiobooks();
});

// Window globals for inline onclicks
window.loadAudiobooks = loadAudiobooks;
window.quickSearch = quickSearch;
window.selectAndPlayBook = selectAndPlayBook;
window.toggleAudioPlay = toggleAudioPlay;