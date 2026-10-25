/* 博客编辑器离线缓存：缓存编辑器自身资源（cache-first），
   页面导航走 network-first 以便尽快拿到更新版本；绝不拦截/缓存 GitHub API 请求。 */
const CACHE = "blog-editor-shell-v1";
const ASSETS = [
	"./",
	"./index.html",
	"./style.css",
	"./app.js",
	"./marked.min.js",
	"./lucide.min.js",
	"./manifest.webmanifest",
	"./icon-192.png",
	"./icon-512.png",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return; // api.github.com 等一律直连
	if (!url.pathname.startsWith("/editor/")) return;

	if (
		req.mode === "navigate" ||
		url.pathname.endsWith("/editor/") ||
		url.pathname.endsWith("/editor/index.html")
	) {
		event.respondWith(
			fetch(req)
				.then((res) => {
					const copy = res.clone();
					caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
					return res;
				})
				.catch(() => caches.match("./index.html")),
		);
		return;
	}

	event.respondWith(
		caches.match(req).then(
			(hit) =>
				hit ||
				fetch(req).then((res) => {
					const copy = res.clone();
					caches.open(CACHE).then((cache) => cache.put(req, copy));
					return res;
				}),
		),
	);
});
