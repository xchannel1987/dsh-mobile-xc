// src/index.ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// src/pwa.ts
var SW_VERSION = "202608-xc2";
var MANIFEST_JSON = JSON.stringify(
  {
    id: "/",
    name: "DeepSeek Harness",
    short_name: "DSH",
    description: "DeepSeek Harness \u79FB\u52A8\u7AEF",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // 去 orientation 硬锁（决策：平板横屏友好）；theme_color 与默认深色主题对齐，运行时由 vendor ThemePresenter 的 meta 动态同步
    theme_color: "#0f172a",
    background_color: "#0f172a",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/pwa/icon-180.png", sizes: "180x180", type: "image/png", purpose: "any" }
    ]
  },
  null,
  2
);
var OFFLINE_HTML = [
  "<!doctype html>",
  '<html lang="zh-CN">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="theme-color" content="#0f172a">',
  "<title>DSH \xB7 \u79BB\u7EBF</title>",
  "<style>",
  'body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center;padding:24px}',
  "img{width:72px;height:72px;border-radius:18px}",
  "h1{font-size:18px;margin:0;font-weight:600}",
  "p{font-size:14px;color:#94a3b8;margin:0}",
  "button{margin-top:10px;padding:10px 28px;border:1px solid #334155;border-radius:12px;background:rgba(148,163,184,.12);color:#e2e8f0;font-size:14px;cursor:pointer}",
  "</style>",
  "</head>",
  "<body>",
  '<img src="/pwa/icon-192.png" alt="DSH">',
  "<h1>\u79BB\u7EBF\u4E2D</h1>",
  "<p>\u5F53\u524D\u7F51\u7EDC\u4E0D\u53EF\u7528\uFF0C\u6062\u590D\u540E\u81EA\u52A8\u91CD\u8FDE</p>",
  '<button onclick="location.reload()">\u91CD\u8BD5</button>',
  "</body>",
  "</html>"
].join("\n");
var REGISTER_SCRIPT = [
  "<script data-dsh-xc-pwa>",
  "(function () {",
  "  if (!('serviceWorker' in navigator)) return;",
  "  if (typeof localStorage !== 'undefined' && localStorage.getItem('dsh-mobile-xc.pwa') === 'off') return;",
  "  window.addEventListener('load', function () {",
  "    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(function () {});",
  "  });",
  "})();",
  "</script>"
].join("\n");
var HEAD_EXTRA = [
  '<link rel="apple-touch-icon" href="/pwa/icon-180.png">',
  '<meta name="theme-color" content="#0f172a">',
  REGISTER_SCRIPT
].join("\n    ");
var STATIC_URLS = [
  "'/manifest.webmanifest'",
  "'/favicon.svg'",
  "'/pwa/icon-192.png'",
  "'/pwa/icon-512.png'",
  "'/pwa/icon-180.png'"
];
var SW_SOURCE = [
  "/* dsh-mobile-xc service worker \u2014 generated from src/pwa.ts */",
  "'use strict';",
  "var VERSION = " + JSON.stringify(SW_VERSION) + ";",
  "var CACHE = 'dsh-pwa-' + VERSION;",
  "var OFFLINE = " + JSON.stringify(OFFLINE_HTML) + ";",
  "var STATIC_URLS = [" + STATIC_URLS.join(",") + "];",
  "var BOOT_ASSET_LIMIT = 12;",
  "",
  "function collectBootAssets() {",
  "  return fetch('/', { cache: 'no-store' })",
  "    .then(function (res) { return res.text(); })",
  "    .then(function (html) {",
  "      var urls = [];",
  '      var re = /(?:src|href)="(\\/assets\\/[^"]+)"/g;',
  "      var m;",
  "      while ((m = re.exec(html)) && urls.length < BOOT_ASSET_LIMIT) urls.push(m[1]);",
  "      return urls;",
  "    })",
  "    .catch(function () { return []; });",
  "}",
  "",
  "self.addEventListener('install', function (event) {",
  "  event.waitUntil(",
  "    Promise.all([",
  "      caches.open(CACHE).then(function (cache) {",
  "        var put = function (url) {",
  "          return fetch(url).then(function (res) {",
  "            if (res.ok) return cache.put(url, res);",
  "          }).catch(function () {});",
  "        };",
  "        var tasks = STATIC_URLS.map(put);",
  "        tasks.push(cache.put('/offline', new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } })));",
  "        return collectBootAssets().then(function (urls) {",
  "          return Promise.all(urls.map(function (u) { return put(u); }));",
  "        }).then(function () { return Promise.all(tasks); });",
  "      }),",
  "      self.skipWaiting()",
  "    ])",
  "  );",
  "});",
  "",
  "self.addEventListener('activate', function (event) {",
  "  event.waitUntil(",
  "    caches.keys().then(function (keys) {",
  "      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));",
  "    }).then(function () { return self.clients.claim(); })",
  "  );",
  "});",
  "",
  "self.addEventListener('fetch', function (event) {",
  "  var req = event.request;",
  "  if (req.method !== 'GET') return;",
  "  var url = new URL(req.url);",
  "  if (url.origin !== self.location.origin) return;",
  "  var path = url.pathname;",
  "",
  "  /* \u9274\u6743/\u5B9E\u65F6/\u52A8\u6001\u6D41\u91CF\uFF1A\u5B8C\u5168\u65C1\u8DEF */",
  "  if (path === '/api' || path.indexOf('/api/') === 0) return;",
  "  if (path === '/plugins/events') return;",
  "",
  "  /* \u5BFC\u822A\uFF1Anetwork-first\uFF0C\u5931\u8D25\u56DE\u9000\u79BB\u7EBF\u9875 */",
  "  if (req.mode === 'navigate') {",
  "    event.respondWith(",
  "      fetch(req).then(function (res) {",
  "        if (res && res.ok) {",
  "          var clone = res.clone();",
  "          caches.open(CACHE).then(function (cache) { return cache.put(req, clone); }).catch(function () {});",
  "        }",
  "        return res;",
  "      }).catch(function () {",
  "        return caches.match('/offline');",
  "      })",
  "    );",
  "    return;",
  "  }",
  "",
  "  /* \u5185\u5BB9\u5BFB\u5740\uFF1Acache-first + \u540E\u53F0\u66F4\u65B0\uFF08\u5347\u7EA7\u540E rev/\u54C8\u5E0C\u53D8\u5316\u81EA\u52A8\u53D6\u65B0\uFF0C\u4E0D\u4F1A\u5403\u5230\u9648\u65E7 bundle\uFF09*/",
  '  var cacheable = path.indexOf("/assets/") === 0',
  "    || (path.indexOf('/plugins/') === 0 && path.indexOf('/plugins/events') !== 0)",
  "    || path.indexOf('/pwa/') === 0",
  "    || path === '/manifest.webmanifest'",
  "    || path === '/favicon.svg';",
  "  if (!cacheable) return;",
  "",
  "  event.respondWith(",
  "    caches.open(CACHE).then(function (cache) {",
  "      return cache.match(req).then(function (cached) {",
  "        if (cached) {",
  "          fetch(req).then(function (res) {",
  "            if (res && res.ok) cache.put(req, res);",
  "          }).catch(function () {});",
  "          return cached;",
  "        }",
  "        return fetch(req).then(function (res) {",
  "          if (res && res.ok) cache.put(req, res.clone());",
  "          return res;",
  "        }).catch(function () {",
  "          return new Response('', { status: 503, statusText: 'Offline' });",
  "        });",
  "      });",
  "    })",
  "  );",
  "});"
].join("\n");

// src/index.ts
var name = "dsh-mobile-xc";
var inject = ["webServer"];
var ICON_SIZES = ["192", "512", "180"];
var route = (effect, label, fn) => {
  effect(() => {
    fn();
    return () => {
    };
  }, label);
};
var readIcon = (size) => readFile(fileURLToPath(new URL("../assets/pwa/icon-" + size + ".png", import.meta.url)));
function apply(ctx) {
  const ws = ctx.webServer;
  if (ws === void 0) return;
  const effect = ctx.effect.bind(ctx);
  route(effect, "dsh-mobile-xc: /sw.js", () => ws.register({
    kind: "exact",
    path: "/sw.js",
    handler: (_req, res) => {
      res.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-cache"
      });
      res.end(SW_SOURCE);
    }
  }));
  route(effect, "dsh-mobile-xc: /manifest.webmanifest", () => ws.register({
    kind: "exact",
    path: "/manifest.webmanifest",
    handler: (_req, res) => {
      res.writeHead(200, { "content-type": "application/manifest+json" });
      res.end(MANIFEST_JSON);
    }
  }));
  for (const size of ICON_SIZES) {
    route(effect, "dsh-mobile-xc: /pwa/icon-" + size + ".png", () => ws.register({
      kind: "exact",
      path: "/pwa/icon-" + size + ".png",
      handler: async (_req, res) => {
        try {
          const body = await readIcon(size);
          res.writeHead(200, {
            "content-type": "image/png",
            "cache-control": "public, max-age=31536000, immutable"
          });
          res.end(body);
        } catch {
          res.writeHead(404);
          res.end();
        }
      }
    }));
  }
  route(effect, "dsh-mobile-xc: pwa index tap", () => ws.tapIndex((html) => {
    if (html.includes("data-dsh-xc-pwa")) return html;
    if (!html.includes("</head>")) return html + HEAD_EXTRA;
    return html.replace("</head>", HEAD_EXTRA + "</head>");
  }));
}
export {
  apply,
  inject,
  name
};
