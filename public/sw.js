// COD CRM Service Worker — handles push notifications

self.addEventListener("push", function (event) {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      vibrate: [200, 100, 200],
      tag: data.tag || "codcrm",
      renotify: true,
      data: { url: data.url || "/commandes" },
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/commandes";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
