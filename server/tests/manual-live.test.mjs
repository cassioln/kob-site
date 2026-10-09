import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHAPTERS } from '../../assets/js/manual-de-bordo-live-data.js';
import { normalizeSearch, matchChapter, excerpt, highlightParts, transcriptFor } from '../../assets/js/manual-de-bordo-live-search.js';

const expected = [1453,1502,1535,2190,2544,2654,2996,3094,3814,4009,4102,4509,4657,833,913,1009,1036,1250,1345,1702,1765,1852,1963,2041,2161,2276,2339,2368,2423,2715,2894,3154,3213,3506,3766,3942,4265,4389,4456,4481,4712].sort((a,b)=>a-b);
test('41 assuntos cronológicos com conversão exata dos tempos e títulos PT/EN/ES', () => {
  assert.deepEqual(CHAPTERS.map(c=>c.seconds), expected);
  assert.equal(new Set(CHAPTERS.map(c=>c.id)).size,41);
  for(const c of CHAPTERS){ assert.equal(c.time.split(':').reduce((s,n)=>s*60+Number(n),0),c.seconds); for(const l of ['pt','en','es'])assert.ok(c.titles[l]); }
});
test('busca usa a fala fornecida e separa os avisos das informações divergentes', () => {
  const bags=CHAPTERS.find(c=>c.seconds===4456);
  assert.match(bags.transcripts.pt,/3 malas/); assert.match(bags.notice.pt,/Regra da MSC.*23 kg.*não é aceita no check-in/); assert.match(bags.notice.pt,/Royal Trip.*por sua conta e risco/); assert.equal(bags.faqId,'faq-o08');
  const items=CHAPTERS.find(c=>c.seconds===4481);
  assert.doesNotMatch(items.transcripts.pt,/chapinha sem certificação/);
  const partners=CHAPTERS.find(c=>c.seconds===1036);
  assert.doesNotMatch(partners.transcripts.pt,/Moedas & Co|Jogue & Vista/); assert.match(partners.transcripts.pt,/Fácil Shopping/);
  for(const [term,seconds] of [['Encounter',3814],['favoritos',4009],['Ludopedia',4102],['BoardGameGeek',4102],['premiações',4657]])assert.ok(matchChapter(CHAPTERS.find(c=>c.seconds===seconds),term));
  const child=CHAPTERS.find(c=>c.seconds===4389); assert.match(child.transcripts.pt,/refeições/);
});
test('cada capítulo traz a fala em PT, EN e ES, e a busca mostra o trecho no idioma da página',()=>{
  for(const c of CHAPTERS){
    for(const l of ['pt','en','es'])assert.ok(c.transcripts[l]?.trim(),`${c.id} sem ${l}`);
    assert.notEqual(c.transcripts.en,c.transcripts.pt,c.id); assert.notEqual(c.transcripts.es,c.transcripts.pt,c.id);
    for(const name of ['Royal Trip','MSC Musica','Concais','Encounter','Board Game Guru','Doremi Club','Fácil Shopping'])
      if(c.transcripts.pt.includes(name))for(const l of ['en','es'])assert.ok(c.transcripts[l].includes(name),`${c.id} ${l} perdeu ${name}`);
  }
  const parking=CHAPTERS.find(c=>c.seconds===1765);
  assert.ok(matchChapter(parking,'parking lot','en')); assert.match(excerpt(transcriptFor(parking,'en'),'parking lot'),/parking lot/);
  assert.ok(matchChapter(parking,'estacionamiento','es')); assert.match(excerpt(transcriptFor(parking,'es'),'auto'),/auto/);
  assert.equal(transcriptFor({transcripts:{pt:'só PT'}},'en'),'só PT');
});
test('consultas de vários termos ignoram acentos, caixa e pontuação, inclusive em EN/ES',()=>{
  assert.equal(normalizeSearch(' ÁGUA—chá / CAFÉ! '),'agua cha cafe');
  for(const [q,sec,lang] of [['wise nomad',1852,'pt'],['fraldas refeições',4389,'pt'],['eu-vou',3942,'pt'],['luggage',4456,'en'],['embarazadas',2276,'es']]) {
    const found=CHAPTERS.filter(c=>matchChapter(c,q,lang)); assert.ok(found.some(c=>c.seconds===sec),q);
  }
  assert.equal(CHAPTERS.filter(c=>matchChapter(c,'jantar documentacao impossivel')).length,0);
  assert.equal(CHAPTERS.filter(c=>matchChapter(c,'')).length,41);
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
