/*
 * Service worker ของ PWA (ติดตั้งเป็นแอปบนมือถือ) — ลงทะเบียนเฉพาะ build จริง (src/lib/pwa.ts)
 *
 * เก็บ cache แค่ "เปลือก" ของหน้าเว็บ ไม่เก็บข้อมูลจาก API เลย (API อยู่คนละ origin และเป็นข้อมูลส่วนบุคคล)
 *   หน้า HTML (index.html / ลิงก์ลึก) — ขอจากเครือข่ายก่อนเสมอ ได้ของใหม่ทุก deploy · เน็ตหลุดใช้ index.html ที่ cache ไว้
 *   ไฟล์ใน assets/ (ชื่อมี hash ไม่เปลี่ยนเนื้อหา) — ใช้ cache ก่อน ไม่มีค่อยขอ แล้วเก็บไว้
 *   ที่เหลือ (config.js, manifest, รูป) — ขอจากเครือข่ายก่อน ไม่ได้ค่อยใช้ cache
 * ไม่เก็บ assets/ ล่วงหน้า (precache) — deploy ใหม่ชื่อไฟล์เปลี่ยน ไฟล์เก่าในเครื่องจะค้าง ลบด้วย CACHE_VERSION
 */
const CACHE_VERSION = 'itone-v1'
const SHELL = new URL('./', self.location).pathname // /itone/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.add(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const putInCache = (request, response) => {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone()
    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // API, GCS, Google Fonts ฯลฯ — ไม่ยุ่ง ให้เบราว์เซอร์จัดการตามปกติ
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SHELL)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // เก็บเฉพาะหน้าแรก — ลิงก์ลึกบน GitHub Pages คือ 404.html ที่เป็นสำเนาเดียวกัน
          if (response.ok) putInCache(SHELL, response.clone())
          return response
        })
        .catch(() => caches.match(SHELL).then((cached) => cached || Response.error())),
    )
    return
  }

  if (url.pathname.startsWith(`${SHELL}assets/`)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((r) => putInCache(request, r))))
    return
  }

  event.respondWith(
    fetch(request)
      .then((r) => putInCache(request, r))
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  )
})
