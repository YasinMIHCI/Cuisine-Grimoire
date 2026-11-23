// Ajouté au service worker : toucher une notification (minuteur terminé)
// ramène au premier plan l'appli déjà ouverte, ou l'ouvre.
self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  evenement.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => 'focus' in f);
      return ouverte ? ouverte.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
