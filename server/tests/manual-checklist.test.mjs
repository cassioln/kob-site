import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatChecklist,printableChecklist} from '../../assets/js/manual-de-bordo-checklist.js';
import {manualLanguagePath} from '../../assets/js/manual-de-bordo-routing.js';
const data={url:'https://kriativosonboard.com.br/manualdebordo',progress:'1 de 2 conferidos',groups:[{title:'Documentos',items:[{title:'Conferir reserva',checked:true},{title:'Imprimir voucher',checked:false},{title:'Autorizar menor',na:true}]}]};
test('Formatos de texto mantêm todos os estados e diferem por canal',()=>{
 const copy=formatChecklist(data,'copy'); const email=formatChecklist(data,'email'); const wa=formatChecklist(data,'whatsapp');
 assert.match(copy,/\[x\] Conferir reserva/); assert.match(copy,/\[ \] Imprimir/); assert.match(copy,/\[—\] Autorizar/);
 assert.match(email,/Olá,/); assert.match(email,/• Conferido — Conferir/); assert.match(email,/• Não se aplica — Autorizar/);
 assert.match(wa,/\*Meu checklist/); assert.match(wa,/☑️ Conferir/); assert.match(wa,/🔲 Imprimir/); assert.match(wa,/▪️ Autorizar/);
 assert.ok(wa.includes('☑️ Conferido · 🔲 Pendente · ▪️ Não se aplica'));
 assert.match(formatChecklist(data,'email','en'),/Hello,/); assert.match(formatChecklist(data,'email','es'),/Hola,/);
});
test('HTML de impressão escapa texto e mantém estados',()=>{
 const html=printableChecklist({...data,groups:[{title:'<script>',items:[{title:'<img onerror="x">',checked:true}]}]});
 assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/class="box checked"/);
});
test('Idiomas respeitam domínio principal, subdomínio e preview em arquivo',()=>{
 assert.equal(manualLanguagePath('en','/manualdebordo','kriativosonboard.com.br'),'/en/manualdebordo');
 assert.equal(manualLanguagePath('pt','/es/','manualdebordo.kriativosonboard.com.br'),'/');
 assert.equal(manualLanguagePath('es','/manual-de-bordo.html','127.0.0.1'),'/es/manual-de-bordo.html');
});
