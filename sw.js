// ==========================================
// 1. 캐시 이름 및 버전 정의
// 코드를 수정하셨을 때 버전을 올려주시면(v2 -> v3) 
// 브라우저가 이전 캐시를 자동으로 삭제합니다.
// ==========================================
const CACHE_NAME = 'translator-v2.03';

// 오프라인 상태에서도 기본 작동에 필요한 필수 정적 파일 목록
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

// ==========================================
// 2. 서비스 워커 설치 (Install Event)
// ==========================================
self.addEventListener('install', (event) => {
    // 새 서비스 워커가 대기하지 않고 즉시 설치를 완료하도록 설정
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] 필수 정적 자원 캐싱 중...');
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// ==========================================
// 3. 서비스 워커 활성화 (Activate Event)
// ==========================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        // 이전 버전의 구 캐시(Old Cache) 모두 찾아 지우기
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] 구버전 캐시 삭제:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            // 현재 열려 있는 모든 클라이언트(탭/창) 제어권을 즉시 획득
            return self.clients.claim();
        })
    );
});

// ==========================================
// 4. 네트워크 요청 처리 (Fetch Event)
// ==========================================
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // POST 요청이나 Google API, 외부 번역 통신은 캐시하지 않음
    if (request.method !== 'GET' || request.url.includes('translate.googleapis.com')) {
        return;
    }

    // HTML 파일 또는 루팅 요청은 Network-First (네트워크 우선 -> 실패 시 캐시)
    // 이 처리가 되어 있어야 Ctrl + R 없이도 파일 수정 시 최신 웹페이지가 나옵니다.
    if (request.mode === 'navigate' || request.headers.get('accept').includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // 최신 응답을 캐시에 업데이트
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // 오프라인 등으로 네트워크 실패 시 저장된 캐시 반환
                    return caches.match(request);
                })
        );
        return;
    }

    // 그 외 정적 자원(이미지, CSS, 외부 JS 등)은 Stale-While-Revalidate 전략 적용
    // 캐시에서 먼저 보여주되, 백그라운드에서 최신 자원을 받아 업데이트함
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                // 정상 응답을 받아왔다면 캐시 업데이트
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // 오프라인 시 에러 무시
            });

            // 캐시가 있으면 캐시를 반환, 없으면 네트워크 요청 완료를 기다림
            return cachedResponse || fetchPromise;
        })
    );
});