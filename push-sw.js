/*
 * Push handlers for the generated service worker.
 *
 * vite-plugin-pwa generates the worker (precaching, auto-update) and pulls this
 * file in with `importScripts`, so the app keeps Workbox's own update logic and
 * only gains the two events push needs. Plain JS, not bundled: it runs inside
 * the worker exactly as written.
 *
 * Two senders, one payload shape { title, body, url, tag, kind? }:
 *   - `send-reminders`: a check-in reminder. Every field is optional, so a
 *     push with an empty body still shows a sensible Hebrew reminder.
 *   - `notify-admins`: an administrator alert, `kind: 'alert'`, with its own
 *     per-alert tag. It also tells any open app window, so a dashboard that is
 *     on screen refreshes its queue without the administrator pressing refresh.
 */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : undefined }
  }

  const shown = self.registration.showNotification(data.title || 'תזכורת לדיווח', {
    body: data.body || 'תזכורת קטנה למלא את דיווח הרווחה. זה לוקח פחות מדקה.',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    lang: 'he',
    dir: 'rtl',
    // One reminder at a time: a newer one replaces an unread older one.
    // Alerts carry `alert-<id>`, so they stack instead.
    tag: data.tag || 'checkin-reminder',
    data: { url: data.url || './#/checkin' },
  })

  const told =
    data.kind === 'alert'
      ? self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then((windows) => windows.forEach((client) => client.postMessage({ type: 'wellbeing-alert' })))
      : Promise.resolve()

  event.waitUntil(Promise.all([shown, told]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(
    (event.notification.data && event.notification.data.url) || './#/checkin',
    self.registration.scope,
  ).href

  // Reuse an open app window when there is one, rather than stacking tabs.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
