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
            const url = q ? `/api/librivox/audiobooks?q=${encodeURIComponent(q)}` : '/api/librivox/audiobooks';
            const res = await fetch(url);
            const data = await res.json();

            if (!data.success) throw new Error(data.error);

            currentBooks = data.books || [];
            document.getElementById('audio-books-count').innerText = currentBooks.length + ' Sesli Kitap';

            loading.classList.add('hidden');
            grid.classList.remove('hidden');

            renderBooks(currentBooks);
          } catch(err) {
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

          // LibriVox RSS akışından doğrudan MP3 stream'i açabilir
          if (b.rssUrl) {
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
