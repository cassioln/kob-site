(function () {
  'use strict';
  var uid = function () { return crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2); };
  window.KobBoardingSync = function (options) {
    var store = null, record = null, active = false, busy = false, generation = 0;
    var initializing = false;
    var online = false, storageError = false, authError = false, sending = '', owner = uid();
    var cpfById = new Map();
    var memory = { manifest: null, pending: [], savedAt: 0, lease: null };
    function emit() { options.changed(snapshot()); }
    function snapshot() {
      var data = record || memory, manifest = data.manifest;
      var people = manifest ? structuredClone(manifest.people) : [];
      people.forEach(function (p) { if (cpfById.has(p.id)) p.cpf = cpfById.get(p.id); });
      data.pending.forEach(function (op) {
        var person = people.find(function (p) { return p.id === op.passenger_id; });
        if (person) person[op.leg] = Object.assign({}, person[op.leg], { present: op.present, queued: true });
      });
      return { people: people, confirmed: manifest ? manifest.people : [], waiting: manifest ? manifest.waiting : 0,
        ready: !!manifest, savedAt: data.savedAt, pending: data.pending, durable: !!store && !storageError,
        busy: busy || initializing, sending: sending, online: online && navigator.onLine, authError: authError, storageError: storageError };
    }
    async function mutate(fn) {
      if (store) { record = await store.mutate(fn); storageError = false; }
      else { fn(memory); record = memory; }
      emit();
    }
    async function reload() {
      if (!active || !store) return;
      try {
        record = await store.read();
        if (!record) { authError = true; online = false; }
        emit();
      } catch (_) { storageError = true; emit(); }
    }
    function reconcile(data) {
      data.pending = data.pending.filter(function (op) {
        var person = data.manifest.people.find(function (p) { return p.id === op.passenger_id; });
        if (!person) { op.conflict = 'removed'; return true; }
        if (person.bus_number !== op.bus_number) { op.conflict = 'bus'; return true; }
        var state = person[op.leg];
        if (state.present === op.present) return false;
        if (state.revision !== op.expected_revision) op.conflict = 'revision';
        return true;
      });
    }
    async function refresh() {
      if (!active || initializing || busy || authError || !navigator.onLine) { emit(); return; }
      busy = true; var session = generation, acquired = false; emit();
      try {
        // A transactional lease also works in browsers without Web Locks.
        await mutate(function (data) {
          if (!data.lease || data.lease.expires < Date.now() || data.lease.owner === owner) {
            data.lease = { owner: owner, expires: Date.now() + 45000 }; acquired = true;
          }
        });
        if (!acquired || !active || session !== generation) return;
        var manifest = await options.request('GET');
        if (!active || session !== generation) return;
        online = true; cpfById = new Map(manifest.people.map(function (p) { return [p.id, p.cpf]; }));
        await mutate(function (data) {
          data.manifest = window.KobBoardingStore.clean(manifest); data.savedAt = Date.now(); reconcile(data);
        });
        while (active && session === generation && navigator.onLine) {
          var op = record.pending.find(function (item) { return !item.conflict; });
          if (!op) break;
          sending = op.passenger_id + ':' + op.leg;
          await mutate(function (data) {
            var current = data.pending.find(function (p) { return p.id === op.id; });
            if (current) current.attempted = true;
            data.lease = { owner: owner, expires: Date.now() + 45000 };
          });
          try {
            var result = await options.request('POST', { passenger_id: op.passenger_id, leg: op.leg,
              present: op.present, expected_revision: op.expected_revision, bus_number: op.bus_number });
            if (!active || session !== generation) return;
            await mutate(function (data) {
              var person = data.manifest.people.find(function (p) { return p.id === op.passenger_id; });
              if (person) person[op.leg] = result.checkin;
              data.pending = data.pending.filter(function (p) { return p.id !== op.id; });
              data.savedAt = Date.now();
            });
            options.saved(op);
          } catch (error) {
            if (!active || session !== generation) return;
            if (error.status === 409) {
              await mutate(function (data) {
                var current = data.pending.find(function (p) { return p.id === op.id; });
                var person = data.manifest.people.find(function (p) { return p.id === op.passenger_id; });
                if (error.data.checkin && person) person[op.leg] = error.data.checkin;
                if (current) current.conflict = error.data.error === 'revision_conflict' ? 'revision' : 'bus';
                reconcile(data);
              });
            } else throw error;
          } finally { sending = ''; }
        }
      } catch (error) {
        if (!active || session !== generation) return;
        online = false;
        if ([401, 403, 404].indexOf(error.status) !== -1) authError = true;
        else if (error.name === 'QuotaExceededError' || !error.status && /storage|transaction|database/i.test(error.message || '')) storageError = true;
      } finally {
        if (active && session === generation) {
          if (acquired) {
            try { await mutate(function (data) { if (data.lease && data.lease.owner === owner) data.lease = null; }); }
            catch (_) { storageError = true; }
          }
          busy = false; sending = ''; emit();
        }
      }
    }
    return {
      snapshot: snapshot, refresh: refresh, reload: reload,
      start: async function (token) {
        active = true; initializing = true; generation++; var session = generation;
        authError = false; online = false; storageError = false; record = null;
        emit();
        try {
          var opened = await window.KobBoardingStore.open(token, reload);
          if (!active || session !== generation) { opened.close(); return; }
          store = opened; record = await store.read();
        } catch (_) { storageError = true; }
        if (!active || session !== generation) return;
        initializing = false; emit(); await refresh();
      },
      toggle: async function (id, leg) {
        var state = snapshot(), person = state.people.find(function (p) { return p.id === id; });
        if (!person || authError || sending === id + ':' + leg || storageError || !store) return false;
        var desired = !person[leg].present;
        try {
          await mutate(function (data) {
            var original = data.manifest.people.find(function (p) { return p.id === id; });
            var old = data.pending.find(function (p) { return p.passenger_id === id && p.leg === leg; });
            if (old && old.conflict) return;
            data.pending = data.pending.filter(function (p) { return p !== old; });
            if (!old || old.attempted || desired !== original[leg].present) {
              data.pending.push({ id: uid(), passenger_id: id, leg: leg, present: desired,
                expected_revision: old ? old.expected_revision : original[leg].revision,
                bus_number: old ? old.bus_number : original.bus_number, name: original.name,
                queuedAt: Date.now(), attempted: false });
            }
          });
          // refresh() may be waiting for a GET that started before this click.
          if (!busy) refresh();
          return true;
        } catch (_) { storageError = true; emit(); return false; }
      },
      resolve: async function (id, local) {
        if (!navigator.onLine || !online || authError || busy) return;
        await mutate(function (data) {
          var op = data.pending.find(function (p) { return p.id === id; });
          if (!op) return;
          var person = data.manifest.people.find(function (p) { return p.id === op.passenger_id; });
          data.pending = data.pending.filter(function (p) { return p !== op; });
          if (local && person) data.pending.push(Object.assign({}, op, { id: uid(), conflict: null,
            expected_revision: person[op.leg].revision, bus_number: person.bus_number, attempted: false }));
        });
        refresh();
      },
      stop: async function (clear) {
        active = false; generation++;
        if (store) {
          if (clear) await store.clear();
          else await store.mutate(function (data) { if (data.lease && data.lease.owner === owner) data.lease = null; });
          store.close(); store = null;
        }
        cpfById.clear(); record = null; memory = { manifest: null, pending: [], savedAt: 0, lease: null };
        busy = false; sending = ''; online = false;
      }
    };
  };
})();
