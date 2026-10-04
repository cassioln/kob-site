const words = {
  pt: { title: 'Meu checklist de bordo · KOB 2026', copy: 'Copiar', email: 'E-mail', whatsapp: 'WhatsApp', print: 'Imprimir', checked: 'Conferido', pending: 'Pendente', na: 'Não se aplica', greeting: 'Olá,\n\nSegue meu checklist para o Kriativos On Board 2026.', note: 'Esta lista é uma ajuda pessoal e não valida a reserva nem substitui as orientações da agência e da MSC.', copied: 'Checklist copiado com suas marcações.', failed: 'Não foi possível copiar automaticamente. Selecione e copie o texto abaixo.', guidance: 'Orientação', close: 'Fechar orientação', fallback: 'Confira este item com a agência e com a organização antes de embarcar.', all: 'As opções incluem os 25 itens e suas marcações.', printError: 'Não foi possível abrir a impressão. Você pode copiar o checklist.' },
  en: { title: 'My onboard checklist · KOB 2026', copy: 'Copy', email: 'Email', whatsapp: 'WhatsApp', print: 'Print', checked: 'Checked', pending: 'Pending', na: 'Not applicable', greeting: 'Hello,\n\nHere is my checklist for Kriativos On Board 2026.', note: 'This is a personal aid. It does not validate your reservation or replace agency and MSC instructions.', copied: 'Checklist copied with your current marks.', failed: 'Automatic copying is unavailable. Select and copy the text below.', guidance: 'Guidance', close: 'Close guidance', fallback: 'Check this item with the agency and event team before boarding.', all: 'Each option includes all 25 items and your marks.', printError: 'Printing is unavailable. You can copy the checklist instead.' },
  es: { title: 'Mi checklist de a bordo · KOB 2026', copy: 'Copiar', email: 'Correo', whatsapp: 'WhatsApp', print: 'Imprimir', checked: 'Verificado', pending: 'Pendiente', na: 'No se aplica', greeting: 'Hola,\n\nEste es mi checklist para Kriativos On Board 2026.', note: 'Esta lista es una ayuda personal. No valida la reserva ni sustituye las indicaciones de la agencia y MSC.', copied: 'Checklist copiado con tus marcas actuales.', failed: 'No se pudo copiar automáticamente. Selecciona y copia el texto de abajo.', guidance: 'Orientación', close: 'Cerrar orientación', fallback: 'Confirma este punto con la agencia y el equipo antes de embarcar.', all: 'Cada opción incluye los 25 elementos y tus marcas.', printError: 'No se pudo abrir la impresión. Puedes copiar el checklist.' }
};
const text = (lang) => words[lang] || words.pt;
const infoIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>';
const state = (item) => item.na ? 'na' : item.checked ? 'checked' : 'pending';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function formatChecklist(snapshot, channel, lang = 'pt') {
  const w = text(lang);
  const symbols = channel === 'whatsapp' ? { checked:'☑️', pending:'🔲', na:'▪️' } : { checked:'[x]', pending:'[ ]', na:'[—]' };
  const groups = snapshot.groups.map(group => {
    const heading = channel === 'whatsapp' ? `*${group.title}*` : channel === 'email' ? group.title.toLocaleUpperCase() : group.title;
    const lines = group.items.map(item => channel === 'email'
      ? `• ${w[state(item)]} — ${item.title}`
      : `${symbols[state(item)]} ${item.title}${item.na ? ` (${w.na})` : ''}`);
    return [heading, ...lines].join('\n');
  }).join('\n\n');
  const heading = channel === 'whatsapp' ? `*${w.title}*` : w.title;
  const legend = channel === 'email' ? '' : `${symbols.checked} ${w.checked} · ${symbols.pending} ${w.pending} · ${symbols.na} ${w.na}`;
  return [channel === 'email' ? w.greeting : '', heading, snapshot.progress, legend, groups, w.note, snapshot.url].filter(Boolean).join('\n\n');
}

export function printableChecklist(snapshot, lang = 'pt') {
  const w = text(lang);
  const groups = snapshot.groups.map(group => `<section><h2>${escape(group.title)}</h2><ul>${group.items.map(item => `<li><span class="box ${state(item)}">${item.na ? '—' : item.checked ? '✓' : ''}</span><div>${escape(item.title)}<small>${escape(w[state(item)])}</small></div></li>`).join('')}</ul></section>`).join('');
  return `<!doctype html><html lang="${escape(lang)}"><head><meta charset="utf-8"><title>${escape(w.title)}</title><style>
@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:11pt/1.5 Arial,sans-serif;color:#172b3f;margin:0}h1{font-size:22pt;line-height:1.25;margin:0 0 8pt}header{border-bottom:2pt solid #172b3f;padding-bottom:12pt;margin-bottom:18pt}h2{font-size:13pt;margin:18pt 0 8pt;break-after:avoid}ul{list-style:none;margin:0;padding:0}li{display:flex;gap:10pt;padding:8pt 0;border-bottom:.5pt solid #d4dce2;break-inside:avoid}small{display:block;color:#475569;font-size:9pt;margin-top:3pt}.box{display:inline-flex;align-items:center;justify-content:center;width:15pt;height:15pt;border:1pt solid #172b3f;flex:0 0 15pt;margin-top:2pt;font-weight:bold}.box.na{border:0}footer{margin-top:20pt;font-size:9pt;color:#475569}footer p{overflow-wrap:anywhere}</style></head><body><header><h1>${escape(w.title)}</h1><p>${escape(snapshot.progress)}</p></header>${groups}<footer><p>${escape(w.note)}</p><p>${escape(snapshot.url)}</p></footer></body></html>`;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initChecklistTools, { once:true });
  else initChecklistTools();
}
function initChecklistTools() {
  if (!document.getElementById('checklistContainer')) return;
  const lang = document.documentElement.lang.slice(0,2);
  const w = text(lang);
  const clean = el => el?.textContent.replace(/\s+/g,' ').trim() || '';
  const roots = [...document.querySelectorAll('[data-checklist-share]')];
  const icons = { copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>', email:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>', whatsapp:'<path d="M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 21l2.1-5.3A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 8c0 4 4 8 8 8l1-3-3-1-1 1-2-2 1-1-1-3Z"/>', print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/><path d="M18 12h.01"/>' };
  const snapshot = () => ({
    progress: clean(document.getElementById('checklistProgressText')),
    url: `${document.querySelector('link[rel="canonical"]').href}#preparacao`,
    groups:[...document.querySelectorAll('#checklistContainer .checklist-group')].map(group => ({ title:clean(group.querySelector('h3')), items:[...group.querySelectorAll('.checklist-item')].map(item => ({ title:clean(item.querySelector('.checklist-item__text')), checked:item.querySelector('.checklist-item__checkbox').checked, na:Boolean(item.querySelector('.checklist-item__na-checkbox')?.checked) })) }))
  });
  function updateLinks() {
    const data = snapshot();
    document.querySelectorAll('[data-checklist-export="email"]').forEach(a => { a.href=`mailto:?subject=${encodeURIComponent(w.title)}&body=${encodeURIComponent(formatChecklist(data,'email',lang))}`; });
    document.querySelectorAll('[data-checklist-export="whatsapp"]').forEach(a => { a.href=`https://wa.me/?text=${encodeURIComponent(formatChecklist(data,'whatsapp',lang))}`; });
  }
  roots.forEach(root => {
    const controls=document.createElement('div'); controls.className='checklist-share__controls';
    for (const action of ['copy','email','whatsapp','print']) {
      const control=document.createElement(['email','whatsapp'].includes(action)?'a':'button');
      control.dataset.checklistExport=action;
      control.className='checklist-share__button';
      if(control.tagName==='BUTTON') control.type='button';
      if(action==='whatsapp') { control.target='_blank'; control.rel='noopener noreferrer'; }
      control.innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[action]}</svg><span>${w[action]}</span>`;
      controls.append(control);
    }
    const note=document.createElement('p'); note.className='checklist-share__note'; note.textContent=w.all;
    const status=document.createElement('p'); status.className='checklist-share__status'; status.setAttribute('role','status');
    root.append(controls,note,status);
    controls.addEventListener('click', async event => {
      const control=event.target.closest('[data-checklist-export]'); if(!control) return;
      const action=control.dataset.checklistExport;
      updateLinks();
      if(action==='copy') {
        root.querySelector('textarea')?.remove();
        const output=formatChecklist(snapshot(),'copy',lang);
        try { await navigator.clipboard.writeText(output); status.textContent=w.copied; }
        catch { status.textContent=w.failed; const area=document.createElement('textarea'); area.className='checklist-share__fallback'; area.readOnly=true; area.value=output; area.setAttribute('aria-label',w.title); root.append(area); area.focus(); area.select(); }
      } else if(action==='print') {
        document.getElementById('checklistPrintFrame')?.remove();
        const frame=document.createElement('iframe'); frame.id='checklistPrintFrame'; frame.title=w.title; frame.setAttribute('aria-hidden','true'); frame.className='checklist-print-frame';
        frame.onload=async () => { try { await frame.contentDocument.fonts.ready; frame.contentWindow.focus(); frame.contentWindow.print(); } catch { status.textContent=w.printError; } };
        frame.srcdoc=printableChecklist(snapshot(),lang); document.body.append(frame);
      }
    });
  });
  document.addEventListener('change', event => { if(event.target.matches('.checklist-item__checkbox,.checklist-item__na-checkbox,.checklist-sidebar-item__checkbox,.checklist-sidebar-item__na-checkbox')) updateLinks(); });
  document.getElementById('checklistResetBtn')?.addEventListener('click',updateLinks);
  updateLinks();

  const guidance=new Map();
  document.querySelectorAll('#checklistContainer .checklist-item').forEach(item => {
    const id=item.dataset.checklistId;
    const refs=[...item.querySelectorAll('.checklist-item__ref')];
    const ids=new Set(refs.flatMap(a => [a.getAttribute('href')?.replace(/^#/,''), ...[...a.textContent.matchAll(/O\d{2}/gi)].map(m=>'faq-'+m[0].toLowerCase())]).filter(Boolean));
    const entries=[...ids].map(id=>document.getElementById(id)).filter(Boolean).map(faq => ({ title:clean(faq.querySelector('.faq-item__summary-title')), paragraphs:[...faq.querySelectorAll('.faq-item__content > p, .faq-item__content > ul, .faq-item__content > ol')].map(clean).filter(Boolean) }));
    guidance.set(id,{ title:clean(item.querySelector('.checklist-item__text')), entries });
    refs.forEach(a => { const button=document.createElement('button'); button.type='button'; button.className='checklist-item__ref checklist-help-trigger'; button.dataset.checklistHelp=id; button.innerHTML=infoIcon; button.setAttribute('aria-label',`${w.guidance}: ${guidance.get(id).title}`); a.replaceWith(button); });
  });
  const pop=document.createElement('div'); pop.id='checklistHelpPopover'; pop.className='checklist-help-popover'; pop.hidden=true; pop.setAttribute('role','region'); pop.setAttribute('aria-label',w.guidance);
  const dismiss=document.createElement('button'); dismiss.type='button'; dismiss.className='checklist-help-popover__close'; dismiss.setAttribute('aria-label',w.close); dismiss.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  const body=document.createElement('div'); body.id='checklistHelpContent'; body.className='checklist-help-popover__body';
  pop.append(dismiss,body); document.body.append(pop);
  let trigger, pinned=false, hideTimer, suppressFocus=false, pointerType='';
  function hide(returnFocus=false) { clearTimeout(hideTimer); const previous=trigger; pop.hidden=true; trigger?.setAttribute('aria-expanded','false'); trigger?.removeAttribute('aria-describedby'); trigger=undefined; pinned=false; if(returnFocus){suppressFocus=true;previous?.focus({preventScroll:true});suppressFocus=false;} }
  function place() {
    if(!trigger) return;
    const rect=trigger.getBoundingClientRect();
    const width=Math.min(420,innerWidth-24); pop.style.width=`${width}px`;
    const sidebar=document.getElementById('checklistSidebar');
    const adjacent=sidebar.contains(trigger)&&innerWidth>=850;
    const above=rect.top-20, below=innerHeight-rect.bottom-20;
    const maxHeight=Math.min(580,innerHeight*.65,adjacent?innerHeight-24:Math.max(80,above,below));
    pop.style.maxHeight=`${maxHeight}px`;
    body.style.maxHeight=`${maxHeight-42}px`;
    const height=pop.getBoundingClientRect().height;
    const left=adjacent?Math.min(sidebar.getBoundingClientRect().right+12,innerWidth-width-12):Math.min(Math.max(12,rect.right-width),innerWidth-width-12);
    const top=adjacent?rect.top:(below>=above?rect.bottom+8:rect.top-height-8);
    pop.style.left=`${left}px`; pop.style.top=`${Math.max(12,Math.min(top,innerHeight-height-12))}px`;
  }
  function show(button) {
    clearTimeout(hideTimer);
    if(trigger!==button) { hide(); trigger=button; pinned=false;
      const data=guidance.get(button.dataset.checklistHelp); if(!data) return;
      body.replaceChildren();
      if(!data.entries.length) { const p=document.createElement('p');p.textContent=w.fallback;body.append(p); }
      for(const entry of data.entries) { const heading=document.createElement('h5');heading.textContent=entry.title;body.append(heading); for(const text of entry.paragraphs) {const p=document.createElement('p');p.textContent=text;body.append(p);} }
    }
    pop.hidden=false; button.setAttribute('aria-expanded','true'); button.setAttribute('aria-controls',pop.id); button.setAttribute('aria-describedby',body.id); place();
  }
  const scheduleHide=()=>{clearTimeout(hideTimer);if(!pinned)hideTimer=setTimeout(()=>hide(),200);};
  document.addEventListener('pointerdown',event=>{pointerType=event.pointerType;},true);
  document.addEventListener('keydown',()=>{pointerType='';},true);
  document.addEventListener('pointerover',event=>{const button=event.target.closest('[data-checklist-help]');if(button&&event.pointerType==='mouse'&&(!pinned||trigger===button))show(button);});
  document.addEventListener('pointerout',event=>{const button=event.target.closest('[data-checklist-help]');if(button&&!button.contains(event.relatedTarget))scheduleHide();});
  document.addEventListener('focusin',event=>{if(suppressFocus)return;const button=event.target.closest('[data-checklist-help]');if(button){if(pointerType==='touch')return;show(button);if(button.matches(':focus-visible'))pinned=true;}else if(trigger&&!pop.contains(event.target))hide();});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-checklist-help]');if(button){if(trigger===button&&pinned)hide();else{show(button);pinned=true;}}else if(trigger&&!pop.contains(event.target))hide();});
  pop.addEventListener('pointerenter',()=>clearTimeout(hideTimer)); pop.addEventListener('pointerleave',scheduleHide);
  dismiss.addEventListener('click',()=>hide(true));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!pop.hidden){event.preventDefault();event.stopImmediatePropagation();hide(true);}},true);
  document.addEventListener('checklist:close',()=>hide());
  window.addEventListener('resize',()=>hide());
  document.addEventListener('scroll',event=>{
    if(!trigger||pop.contains(event.target)) return;
    const rect=trigger.getBoundingClientRect();
    const region=trigger.closest('.checklist-sidebar__body')?.getBoundingClientRect()||{top:0,bottom:innerHeight};
    if(rect.bottom<region.top||rect.top>region.bottom) hide();
    else place();
  },true);
}
