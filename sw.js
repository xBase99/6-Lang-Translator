const CACHE_NAME = 'translator-v2.06-ai';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    if (request.method !== 'GET' || request.url.includes('translate.googleapis.com')) {
        return;
    }

    if (request.mode === 'navigate' || request.headers.get('accept').includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {});

            return cachedResponse || fetchPromise;
        })
    );
});

// 녹음 시작
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            lastRecordedBlob = new Blob(audioChunks, { type: 'audio/mp3' });
            const audio = document.getElementById('audioPlayback');
            audio.src = URL.createObjectURL(lastRecordedBlob);
            audio.style.display = 'block';
            
            // 저장 및 삭제 버튼 그룹 표시
            document.getElementById('recActionGroup').style.display = 'grid';
        };

        mediaRecorder.start();

        // 1. 녹음 버튼: 비활성화 및 음영/회색 처리
        const btnStart = document.getElementById('btnRecStart');
        btnStart.disabled = true;
        btnStart.style.opacity = '0.4';
        btnStart.style.cursor = 'not-allowed';

        // 2. 정지 버튼: 빨간색 강조 활성화
        const btnStop = document.getElementById('btnRecStop');
        btnStop.disabled = false;
        btnStop.style.backgroundColor = '#dc2626';
        btnStop.style.color = '#ffffff';
        btnStop.style.border = 'none';
        btnStop.style.cursor = 'pointer';

    } catch (err) { 
        alert("마이크 사용 권한 허용이 필요합니다."); 
    }
}

// 녹음 정지
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        
        // 1. 녹음 버튼 복원
        const btnStart = document.getElementById('btnRecStart');
        btnStart.disabled = false;
        btnStart.style.opacity = '1';
        btnStart.style.cursor = 'pointer';

        // 2. 정지 버튼 원래 스타일(비활성화) 복원
        const btnStop = document.getElementById('btnRecStop');
        btnStop.disabled = true;
        btnStop.style.backgroundColor = '';
        btnStop.style.color = '';
        btnStop.style.border = '';
        btnStop.style.cursor = '';
    }
}

// 현재 음성 버퍼 삭제
function clearRecordedAudio() {
    if (confirm("녹음된 음성 데이터를 삭제하시겠습니까?")) {
        const audio = document.getElementById('audioPlayback');
        audio.pause();
        audio.src = '';
        audio.style.display = 'none';

        // 버퍼 초기화
        lastRecordedBlob = null;
        audioChunks = [];

        // 버튼 그룹 숨김
        document.getElementById('recActionGroup').style.display = 'none';
    }
}