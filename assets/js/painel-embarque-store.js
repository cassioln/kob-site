(function () {
  'use strict';
  var NAME = 'kob-boarding-offline', VERSION = 1;
  function clean(manifest) {
    return { waiting: manifest.waiting || 0, generated_at: manifest.generated_at,
      people: manifest.people.map(function (person) {
        var copy = {};
        ['id', 'registration_id', 'code', 'name', 'contact', 'group', 'bus_number', 'vip', 'primary', 'minor', 'lap_child', 'outbound', 'return']
          .forEach(function (key) { if (person[key] !== undefined) copy[key] = person[key]; });
        return copy;
      }) };
  }
  window.KobBoardingStore = {
    clean: clean,
    open: async function (token, changed) {
      if (!window.indexedDB || !window.crypto || !crypto.subtle) throw new Error('storage_unavailable');
      var bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      var scope = Array.from(new Uint8Array(bytes)).map(function (n) { return n.toString(16).padStart(2, '0'); }).join('');
      var db = await new Promise(function (resolve, reject) {
        var request = indexedDB.open(NAME, VERSION);
        request.onupgradeneeded = function () { request.result.createObjectStore('sessions'); };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
        request.onblocked = function () { reject(new Error('storage_blocked')); };
      });
      db.onversionchange = function () { db.close(); };
      var channel = window.BroadcastChannel ? new BroadcastChannel(NAME) : null;
      if (channel) channel.onmessage = function (event) { if (event.data === scope) changed(); };
      function transaction(write, update) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction('sessions', write ? 'readwrite' : 'readonly'), result, failure;
          var store = tx.objectStore('sessions'), get = store.get(scope);
          get.onsuccess = function () {
            try {
              result = get.result || null;
              if (write) {
                result = result || { manifest: null, pending: [], savedAt: 0, lease: null };
                if (update(result) === false) { store.delete(scope); result = null; }
                else store.put(result, scope);
              }
            } catch (error) { failure = error; tx.abort(); }
          };
          tx.oncomplete = function () { if (write && channel) channel.postMessage(scope); resolve(result); };
          tx.onabort = tx.onerror = function () { reject(failure || tx.error || new Error('storage_failed')); };
        });
      }
      return { read: function () { return transaction(false); }, mutate: function (fn) { return transaction(true, fn); },
        clear: function () { return transaction(true, function () { return false; }); },
        close: function () { if (channel) channel.close(); db.close(); } };
    }
  };
})();
