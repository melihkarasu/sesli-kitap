let currentBooks = [];
let activeBook = null;
const player = document.getElementById('audiobook-player');

async function loadAudiobooks() {
    const loading = document.getElementById('books-loading');
    const grid = document.getElementById('books-grid');
    const q = (document.getElementById('search-book').value || '').trim();

    loading.classList.remove('hidden');
    grid.classList.add('hidden');

    try {
        // Direct LibriVox API call (no backend proxy)
        let url = 'https://librivox.org/api/feed/audiobooks/?format=json&limit=25';
        if (q) {
            // LibriVox API supports title= or author= prefix
            const isAuthor = q.toLowerCase().startsWith('author:');
            const searchTerm = isAuthor ? q.substring(7).trim() : q;
            url += '&' + (isAuthor ? 'author=' : 'title=') + encodeURIComponent(searchTerm);
        }

        const res = await fetch(url, {
            headers: { 'User-Agent': 'SesliKutuphane/1.0 (https://melihkarasu.github.io)' }
        });
        
        if (!res.ok) throw new Error('LibriVox API yanıt vermedi');
        
        const data = await res.json();
        const rawBooks = data.books || [];

        // Transform to match existing UI expectations
        currentBooks = rawBooks.map(b => ({
            id: b.id,
            title: b.title || 'Başlıksız Eser',
            authors: (b.authors || []).map(a => `${a.first_name || ''} ${a.last_name || ''}`.trim()).join(', ') || 'Bilinmiyor',
            description: (b.description || 'Açıklama bulunmuyor.').replace(/<[^>]+>/g, '').slice(0, 300),
            totalTime: formatDuration(b.totaltime) || 'Belirtilmemiş',
            language: b.language || 'English',
            listenUrl: b.url_librivox || '',
            rssUrl: b.url_rss || '',
            zipUrl: b.url_zip_file || ''
        }));

        document.getElementById('audio-books-count').innerText = currentBooks.length + ' Sesli Kitap';

        loading.classList.add('hidden');
        grid.classList.remove('hidden');

        renderBooks(currentBooks);
    } catch(err) {
        loading.innerHTML = '<span class="text-rose-500 font-medium text-sm">Sesli kitaplar yüklenemedi: ' + err.message + '</span>';
    }
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs} saat ${mins} dk`;
    return `${mins} dk`;
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
                        ⏱ ${b.totalTime}
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
                    onclick='selectAndPlayBook(${JSON.stringify(b).replace(/'/g, "&apos;")})'
                    class="flex-1 py-2 px-3 rounded-md bg-mistral-orange hover:bg-mistral-orange-deep text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer">
                    <span>▶</span> Dinle & İncele
                </button>
                <a href="${b.listenUrl}" target="_blank" rel="noopener" title="LibriVox Arşivine Git" class="p-2 rounded-md text-mistral-ink font-boldbg-mistral-cream hover:bg-mistral-cream-deeper text-mistral-ink border border-mistral-beige-deep text-xs">
                    ↗
                </a>
            </div>
        </div>
    `).join('');
}

function selectAndPlayBook(b) {
    activeBook = b;
    document.getElementById('dock-status').innerText = 'SESLİ KİTAP SEÇİLDİ';
    document.getElementById('dock-title').innerText = b.title;
    document.getElementById('dock-author').innerText = b.authors + ' • Toplam Süre: ' + b.totalTime;

    const extBtn = document.getElementById('btn-dock-external');
    extBtn.href = b.listenUrl;
    extBtn.classList.remove('hidden');
    extBtn.classList.add('inline-flex');

    // LibriVox HTML pages have audio players; we open the page for streaming
    if (b.listenUrl) {
        player.src = b.listenUrl;
    }
    window.scrollTo({ top: 100, behavior: 'smooth' });
}

function toggleAudioPlay() {
    if (!activeBook) {
        if (currentBooks.length > 0) selectAndPlayBook(currentBooks[0]);
        return;
    }

    if (activeBook.listenUrl) {
        window.open(activeBook.listenUrl, '_blank');
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
