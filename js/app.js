let currentBooks = [];
let activeBook = null;
const player = document.getElementById('audiobook-player');

function showLoading(show, msg = '') {
  const loading = document.getElementById('books-loading');
  const grid = document.getElementById('books-grid');
  if (!loading || !grid) return;
  if (show) {
    loading.classList.remove('hidden');
    grid.classList.add('hidden');
    if (msg) loading.innerHTML = `<div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mistral-cream text-mistral-ink border border-mistral-beige-deep text-xs font-semibold"><span class="w-2.5 h-2.5 rounded-full bg-mistral-orange animate-ping"></span><span>${msg}</span></div>`;
  } else {
    loading.classList.add('hidden');
    grid.classList.remove('hidden');
  }
}

function showError(msg) {
  const loading = document.getElementById('books-loading');
  const grid = document.getElementById('books-grid');
  if (loading) {
    loading.classList.remove('hidden');
    loading.innerHTML = `<span class="text-rose-500 font-medium text-sm">${msg}</span>`;
  }
  if (grid) grid.classList.add('hidden');
}

async function loadAudiobooks() {
  const q = (document.getElementById('search-book')?.value || '').trim();

  showLoading(true, 'LibriVox sesli kitap arşivi taranıyor...');

  try {
    // LibriVox API: https://librivox.org/api/feed/audiobooks/
    // We'll use the search endpoint with proper parameters
    let url = 'https://librivox.org/api/feed/audiobooks/?format=json&limit=25';
    if (q) {
      // LibriVox supports title and author search
      const encodedQuery = encodeURIComponent(q);
      url += `&title=${encodedQuery}&author=${encodedQuery}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`LibriVox API hatası: ${res.status}`);
    
    const data = await res.json();
    const rawBooks = data.books || [];

    // Transform LibriVox data to our format
    currentBooks = rawBooks.map(b => ({
      id: b.id,
      title: b.title || 'Başlıksız Eser',
      authors: (b.authors || []).map(a => `${a.first_name || ''} ${a.last_name || ''}`.trim()).filter(Boolean).join(', ') || 'Bilinmiyor',
      description: (b.description || 'Açıklama bulunmuyor.').replace(/<[^>]+>/g, '').slice(0, 300),
      totalTime: b.totaltime || 'Belirtilmemiş',
      language: b.language || 'English',
      listenUrl: b.url_librivox || '',
      rssUrl: b.url_rss || '',
      zipUrl: b.url_zip_file || '',
      coverUrl: b.url_other || ''
    }));

    document.getElementById('audio-books-count').innerText = currentBooks.length + ' Sesli Kitap';

    showLoading(false);
    renderBooks(currentBooks);
  } catch(err) {
    console.error('loadAudiobooks error:', err);
    showError('Sesli kitaplar yüklenemedi: ' + err.message);
  }
}

function quickSearch(title) {
  const input = document.getElementById('search-book');
  if (input) input.value = title;
  loadAudiobooks();
}

function renderBooks(list) {
  const grid = document.getElementById('books-grid');
  if (!grid) return;
  
  if (list.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-mistral-stone font-medium text-sm">Aramanıza uygun sesli kitap bulunamadı.</div>';
    return;
  }

  grid.innerHTML = list.map(b => {
    const safeB = JSON.stringify(b).replace(/'/g, "&apos;");
    const coverImg = b.coverUrl ? `<img src="${b.coverUrl}" alt="${b.title}" class="w-full h-48 object-cover rounded-lg mb-3">` : '<div class="w-full h-48 rounded-lg bg-mistral-cream flex items-center justify-center mb-3"><span class="text-4xl">🎧</span></div>';
    
    return `
      <div class="p-6 rounded-xl bg-white border border-mistral-hairline hover:border-mistral-orange/40 hover:shadow-md transition duration-200 flex flex-col justify-between group">
        <div>
          ${coverImg}
          <h3 class="text-lg font-bold font-editorial text-mistral-ink group-hover:text-mistral-orange transition truncate mb-1">${b.title}</h3>
          <span class="text-xs font-semibold text-mistral-slate block mb-2">✍️ ${b.authors}</span>
          <p class="text-xs text-mistral-slate line-clamp-3 leading-relaxed mb-4">${b.description}</p>
          <div class="flex items-center gap-2 text-[10px] text-mistral-stone">
            <span>🌐 ${b.language}</span>
            <span>⏱ ${b.totalTime}</span>
          </div>
        </div>

        <div class="pt-3 border-t border-mistral-hairline flex items-center justify-between gap-2">
          <button 
            onclick='selectAndPlayBook(${safeB.replace(/'/g, "&apos;")})'
            class="flex-1 py-2 px-3 rounded-md bg-mistral-orange hover:bg-mistral-orange-deep text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer">
            <span>▶</span> Dinle & İncele
          </button>
          <a href="${b.listenUrl}" target="_blank" rel="noopener" title="LibriVox Arşivine Git" class="p-2 rounded-md text-mistral-ink font-bold bg-mistral-cream hover:bg-mistral-cream-deeper text-mistral-ink border border-mistral-beige-deep text-xs">
            ↗
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function selectAndPlayBook(b) {
  activeBook = b;
  const statusEl = document.getElementById('dock-status');
  const titleEl = document.getElementById('dock-title');
  const authorEl = document.getElementById('dock-author');
  const extBtn = document.getElementById('btn-dock-external');
  const player = document.getElementById('audiobook-player');
  
  if (statusEl) statusEl.innerText = 'SESLİ KİTAP SEÇİLDİ';
  if (titleEl) titleEl.innerText = b.title;
  if (authorEl) authorEl.innerText = `${b.authors} • Toplam Süre: ${b.totalTime}`;

  if (extBtn) {
    extBtn.href = b.listenUrl;
    extBtn.classList.remove('hidden');
    extBtn.classList.add('inline-flex');
  }

  // Try to play directly if we have a direct audio URL
  // LibriVox doesn't provide direct MP3 in main API, so we redirect to LibriVox page
  // or we can try to find audio from the RSS feed
  
  if (b.rssUrl) {
    fetchRssForAudio(b.rssUrl, b);
  } else if (b.zipUrl) {
    // Could try to parse zip for mp3s, but for now redirect to LibriVox
    player.src = ''; // Clear
  }

  if (player) player.src = ''; // Clear player until we have audio
  window.scrollTo({ top: 100, behavior: 'smooth' });
}

async function fetchRssForAudio(rssUrl, book) {
  const player = document.getElementById('audiobook-player');
  if (!player) return;
  
  try {
    // Fetch RSS through a CORS proxy or direct if allowed
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(proxyUrl);
    const text = await res.text();
    
    // Parse RSS for enclosure (audio files)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'application/xml');
    const items = xmlDoc.querySelectorAll('item');
    
    for (const item of items) {
      const enclosure = item.querySelector('enclosure[url$=".mp3"], enclosure[url$=".m4a"]');
      if (enclosure) {
        const audioUrl = enclosure.getAttribute('url');
        if (audioUrl) {
          const player = document.getElementById('audiobook-player');
          if (player) player.src = audioUrl;
          break;
        }
      }
    }
  } catch(err) {
    console.warn('RSS fetch failed:', err);
    // Fallback: just use LibriVox page
  }
}

function toggleAudioPlay() {
  const player = document.getElementById('audiobook-player');
  if (!player) return;
  
  if (!activeBook) {
    if (currentBooks.length > 0) selectAndPlayBook(currentBooks[0]);
    return;
  }

  if (player.paused) {
    player.play().catch(() => {
      // If direct play fails, open LibriVox page
      if (activeBook?.listenUrl) window.open(activeBook.listenUrl, '_blank');
    });
    document.getElementById('dock-play-icon').innerText = '⏸';
    document.getElementById('dock-play-text').innerText = 'Duraklat';
  } else {
    player.pause();
    document.getElementById('dock-play-icon').innerText = '▶';
    document.getElementById('dock-play-text').innerText = 'Oynat';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAudiobooks();
});

// Window globals for inline onclicks
window.loadAudiobooks = loadAudiobooks;
window.quickSearch = quickSearch;
window.selectAndPlayBook = selectAndPlayBook;
window.toggleAudioPlay = toggleAudioPlay;
