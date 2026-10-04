import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHAPTERS } from '../../assets/js/manual-de-bordo-live-data.js';
import { normalizeSearch, matchChapter, excerpt, highlightParts } from '../../assets/js/manual-de-bordo-live-search.js';

const expected = [833,913,1009,1036,1250,1345,1702,1765,1852,1963,2041,2161,2276,2339,2368,2423,2715,2894,3154,3213,3506,3766,3942,4265,4389,4456,4481,4712];
test('28 capítulos cronológicos com conversão exata dos tempos e títulos PT/EN/ES', () => {
  assert.deepEqual(CHAPTERS.map(c=>c.seconds), expected);
  assert.equal(new Set(CHAPTERS.map(c=>c.id)).size,28);
  for(const c of CHAPTERS){ assert.equal(c.time.split(':').reduce((s,n)=>s*60+Number(n),0),c.seconds); for(const l of ['pt','en','es'])assert.ok(c.titles[l]); }
});
test('busca usa a fala fornecida e separa os avisos das informações divergentes', () => {
  const bags=CHAPTERS.find(c=>c.seconds===4456);
  assert.match(bags.transcript,/3 malas/); assert.match(bags.notice.pt,/diverge/); assert.equal(bags.faqId,'faq-o08');
  const items=CHAPTERS.find(c=>c.seconds===4481);
  assert.doesNotMatch(items.transcript,/chapinha sem certificação/);
  const partners=CHAPTERS.find(c=>c.seconds===1036);
  assert.doesNotMatch(partners.transcript,/Moedas & Co|Jogue & Vista/); assert.match(partners.transcript,/Fácil Shopping/);
  const guru=CHAPTERS.find(c=>c.seconds===3942);
  for(const term of ['Encounter','favoritar','Ludopedia','BoardGameGeek','premiações'])assert.ok(guru.transcript.includes(term));
  const child=CHAPTERS.find(c=>c.seconds===4389); assert.match(child.transcript,/refeições/);
});
test('consultas de vários termos ignoram acentos, caixa e pontuação, inclusive em EN/ES',()=>{
  assert.equal(normalizeSearch(' ÁGUA—chá / CAFÉ! '),'agua cha cafe');
  for(const [q,sec,lang] of [['wise nomad',1852,'pt'],['fraldas refeições',4389,'pt'],['eu-vou',3942,'pt'],['luggage',4456,'en'],['embarazadas',2276,'es']]) {
    const found=CHAPTERS.filter(c=>matchChapter(c,q,lang)); assert.ok(found.some(c=>c.seconds===sec),q);
  }
  assert.equal(CHAPTERS.filter(c=>matchChapter(c,'jantar documentacao impossivel')).length,0);
  assert.equal(CHAPTERS.filter(c=>matchChapter(c,'')).length,28);
});
test('snippets e destaques preservam caracteres originais, offsets Unicode e texto potencialmente malicioso',()=>{
  const input='🚢 Água, CAFÉ e pão. <img src=x onerror=alert(1)> & festa';
  const parts=highlightParts(input,'agua cafe');
  assert.equal(parts.map(p=>p.text).join(''),input);
  assert.deepEqual(parts.filter(p=>p.match).map(p=>p.text),['Água','CAFÉ']);
  const malicious=highlightParts(input,'img'); assert.equal(malicious.map(p=>p.text).join(''),input);
  assert.ok(excerpt('Começo '+ 'x'.repeat(200)+' Água e chá.', 'agua').includes('Água'));
});
test('nenhuma função de busca fabrica HTML ou usa o texto da consulta como código',()=>{
  const src=fs.readFileSync(new URL('../../assets/js/manual-de-bordo-live-search.js',import.meta.url),'utf8');
  assert.doesNotMatch(src,/innerHTML|eval\(|new Function/);
});
