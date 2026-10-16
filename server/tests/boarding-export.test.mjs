import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sandbox = { window: {}, Intl, Map };
vm.runInNewContext(readFileSync('assets/js/painel-embarque-i18n.js', 'utf8'), sandbox);
vm.runInNewContext(readFileSync('assets/js/painel-embarque-export.js', 'utf8'), sandbox);
const snapshot = {
  generatedAt: new Date('2026-10-16T13:00:00Z'),
  people: [
    { name: 'Ana Teste', code: 'TESTE001', cpf: '111.111.111-11', registration_id: 'a', group: 'Dados', bus_number: 1, outbound: { present: true }, return: { present: false } },
    { name: 'Bruno Teste', code: 'TESTE002', registration_id: 'b', vip: true, bus_number: 2, outbound: { present: false }, return: { present: true } },
    { name: 'Carla Teste', code: 'TESTE003', registration_id: 'c', vip: true, bus_number: 2, outbound: { present: true }, return: { present: true } }
  ]
};
for (const lang of ['pt', 'en', 'es']) {
  const words = sandbox.window.KobBoardingMessages[lang];
  const t = (key, values = {}) => words[key].replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
  for (const channel of ['copy', 'email']) {
    test(`exportação ${channel}/${lang} preserva todos, dois trechos e agrupa VIPs`, () => {
      const output = sandbox.window.KobBoardingExport.format(snapshot, channel, t, { pt: 'pt-BR', en: 'en-US', es: 'es' }[lang]);
      for (const p of snapshot.people) { assert.ok(output.includes(p.name)); assert.ok(output.includes(p.code)); }
      assert.equal(output.split(words.vipGroup).length - 1, 1);
      assert.equal(output.split(words.soloGroup).length - 1, 1);
      assert.ok(output.includes(words.outbound)); assert.ok(output.includes(words.return));
      assert.ok(output.includes(t('progress', { present: 2, total: 3 })));
      assert.ok(!output.includes('111.111.111-11')); assert.ok(!output.includes('token'));
      if (channel === 'copy') assert.ok(output.includes('[x] ' + words.outbound + ' · [ ] ' + words.return + ' | Ana'));
      if (channel === 'email') assert.ok(output.startsWith(words.exportGreeting));
    });
  }
}
