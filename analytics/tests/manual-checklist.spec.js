import {test,expect} from '@playwright/test';
async function openChecklist(page, path='/manual-de-bordo.html') {
 await page.addInitScript(()=>localStorage.setItem('cookie_consent_status','denied'));
 await page.goto(path);
 if(!await page.locator('#checklistSidebar').evaluate(el=>el.classList.contains('is-open'))) await page.locator('#checklistSidebarToggle').click();
 await expect(page.locator('#checklistSidebar')).toHaveClass(/is-open/);
}
test('Sidebar mostra os textos reais, filtra grupos e sincroniza os estados aplicáveis',async({page})=>{
 await openChecklist(page);
 await expect(page.locator('section#preparacao')).toHaveCount(0);
 await expect(page.locator('#checklistSidebarGotoBtn,.checklist-share__note')).toHaveCount(0);
 await expect(page.locator('#checklistSidebar [data-checklist-id]')).toHaveCount(25);
 await expect(page.locator('.checklist-share__heading')).toHaveText('Compartilhar');
 const first=page.locator('[data-sidebar-item-id="reserva-dados"]');
 await expect(first).toContainText('Conferi os dados e os passageiros');
 await expect(page.locator('.checklist-sidebar-item__jump')).toHaveCount(0);
 await page.locator('[data-sidebar-group="2"].checklist-sidebar__nav-item').click();
 await expect(page.locator('[data-sidebar-group="2"].checklist-sidebar__nav-item')).toHaveClass(/is-active/);
	await expect(page.locator('[data-group-id="2"] .checklist-sidebar-item')).toHaveCount(6);
 await page.locator('[data-sidebar-group="1"].checklist-sidebar__nav-item').click();
 const minor=page.locator('[data-sidebar-item-id="menor-documentos"]');
 await minor.locator('.checklist-sidebar-item__na-checkbox').check();
 await expect(page.locator('[data-checklist-id="menor-documentos"]')).toHaveClass(/is-not-applicable/);
 await expect(minor.locator('.checklist-sidebar-item__checkbox')).toBeDisabled();
 await minor.locator('.checklist-sidebar-item__na-checkbox').uncheck();
 await expect(minor.locator('.checklist-sidebar-item__checkbox')).toBeEnabled();
 await first.locator('.checklist-sidebar-item__checkbox').check();
 await expect(page.locator('[data-checklist-id="reserva-dados"]')).toHaveClass(/is-checked/);
});
test('Link compartilhado abre o checklist e preserva marcas sem lista duplicada',async({page})=>{
 await openChecklist(page,'/manual-de-bordo.html#checklist');
 await page.locator('[data-sidebar-item-id="reserva-dados"] input[type="checkbox"]').check();
 await page.reload();
 await expect(page.locator('#checklistSidebar')).toHaveClass(/is-open/);
 await expect(page.locator('[data-sidebar-item-id="reserva-dados"] input[type="checkbox"]')).toBeChecked();
 await expect(page.locator('[data-checklist-id]')).toHaveCount(25);
});
test('Atalho no menu fecha a navegação e foca o checklist lateral',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.setItem('cookie_consent_status','denied'));
 await page.goto('/manual-de-bordo.html');
 await page.locator('#navToggle').click();
 await page.locator('#drawer [data-open-checklist]').click();
 await expect(page.locator('#drawer')).toHaveAttribute('data-open','false');
 await expect(page.locator('#checklistSidebar')).toHaveClass(/is-open/);
 await expect(page.locator('#checklistSidebarClose')).toBeFocused();
});
test('Orientações aparecem ao passar o mouse e pelo teclado sem sair do checklist',async({page})=>{
 await openChecklist(page); const url=page.url();
 const help=page.locator('[data-sidebar-item-id="voucher-solicitado"] [data-checklist-help]');
 await help.hover();
 await expect(page.locator('#checklistHelpPopover')).toBeVisible();
 await expect(page.locator('#checklistHelpPopover')).toContainText('Júnior');
 await expect(help.locator('svg')).toHaveCount(1);
 await expect(help).toHaveText('');
 await expect(page.locator('#checklistHelpPopover h4')).toHaveCount(0);
 await page.keyboard.press('Escape');
 await expect(page.locator('#checklistHelpPopover')).toBeHidden();
 await expect(page.locator('#checklistSidebar')).toHaveClass(/is-open/);
 await page.keyboard.press('Tab'); await help.focus();
 await expect(page.locator('#checklistHelpPopover')).toBeVisible();
 expect(page.url()).toBe(url);
 await page.locator('.checklist-help-popover__close').click();
 await expect(page.locator('#checklistHelpPopover')).toBeHidden();
 await expect(help).toBeFocused();
});
test('Copiar, email e WhatsApp usam marcas atuais, todos os itens e formatos próprios',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}});});
 await openChecklist(page);
 await page.locator('[data-sidebar-item-id="reserva-dados"] .checklist-sidebar-item__checkbox').check();
 await page.locator('[data-sidebar-item-id="menor-documentos"] .checklist-sidebar-item__na-checkbox').check();
 const footer=page.locator('.checklist-sidebar__footer');
 await footer.locator('[data-checklist-export="copy"]').click();
 const copied=await page.evaluate(()=>window.__copied);
 expect(copied).toContain('[x] Conferi os dados'); expect(copied).toContain('[ ]'); expect(copied).toContain('[—]');
 expect(copied).toContain('https://manualdebordo.kriativosonboard.com.br/#checklist');
 const mail=new URL(await footer.locator('[data-checklist-export="email"]').getAttribute('href'));
 expect(mail.protocol).toBe('mailto:'); expect(mail.searchParams.get('body')).toContain('Olá,'); expect(mail.searchParams.get('body')).toContain('• Não se aplica —');
 const wa=new URL(await footer.locator('[data-checklist-export="whatsapp"]').getAttribute('href'));
 expect(wa.hostname).toBe('api.whatsapp.com'); expect(wa.pathname).toBe('/send'); expect(wa.searchParams.get('text')).toContain('☑️ Conferi os dados'); expect(wa.searchParams.get('text')).toContain('☑️ Conferido · 🔲 Pendente · ▪️ Não se aplica');
 for(const channel of [copied,mail.searchParams.get('body'),wa.searchParams.get('text')]) expect(channel).toMatch(/4\. jogos/i);
});
test('Clipboard indisponível oferece texto selecionável',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}}});});
 await openChecklist(page);
 await page.locator('.checklist-sidebar__footer [data-checklist-export="copy"]').click();
 await expect(page.locator('.checklist-sidebar__footer textarea')).toBeVisible();
 await expect(page.locator('.checklist-sidebar__footer textarea')).toBeFocused();
 await expect(page.locator('.checklist-sidebar__footer [role="status"]')).toContainText('Selecione');
});
test('Impressão gera documento próprio com os 25 itens e suas marcas',async({page})=>{
 await page.addInitScript(()=>{window.print=()=>{window.parent.__printRequested=true;};});
 await openChecklist(page);
 await page.locator('[data-sidebar-item-id="reserva-dados"] .checklist-sidebar-item__checkbox').check();
 await page.locator('.checklist-sidebar__footer [data-checklist-export="print"]').click();
 const frame=page.frameLocator('#checklistPrintFrame');
 await expect(frame.locator('li')).toHaveCount(25); await expect(frame.locator('h2')).toHaveCount(4);
 await expect(frame.locator('.box.checked')).toHaveCount(1); await expect(frame.locator('.box.pending')).toHaveCount(24);
 await expect.poll(()=>page.evaluate(()=>window.__printRequested)).toBe(true);
});
for(const [lang,path] of [['en','/en/manual-de-bordo.html'],['es','/es/manual-de-bordo.html']]) {
 test(`Ferramentas e orientações localizadas em ${lang}`,async({page})=>{
  await openChecklist(page,path);
  await expect(page.locator('[data-checklist-share]')).toHaveCount(1);
  await expect(page.locator('#checklistSidebar img')).toHaveAttribute('src','/assets/images/manual/kriativa-checklist.png');
  await page.locator('.checklist-sidebar-item [data-checklist-help]').first().click();
  await expect(page.locator('#checklistHelpPopover')).toBeVisible();
  await expect(page.locator('#checklistHelpPopover')).toContainText('Royal Trip');
 });
}
for(const [lang,path] of [['pt','/manual-de-bordo.html'],['en','/en/manual-de-bordo.html'],['es','/es/manual-de-bordo.html']]) {
 test(`Apagar progresso mantém contraste no hover e foco em ${lang}`,async({page})=>{
  await openChecklist(page,path);
  const reset=page.locator('#checklistResetBtn');
  const settle=()=>reset.evaluate(async el=>{
   await new Promise(resolve=>requestAnimationFrame(resolve));
   await Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{})));
  });
  const contrast=()=>reset.evaluate(el=>{
   const luminance=color=>{
    const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
   };
   let surface=el;
   while(surface.parentElement&&getComputedStyle(surface).backgroundColor==='rgba(0, 0, 0, 0)') surface=surface.parentElement;
   const a=luminance(getComputedStyle(el).color),b=luminance(getComputedStyle(surface).backgroundColor);
   return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  await reset.hover();
  await settle();
  await expect.poll(contrast).toBeGreaterThanOrEqual(4.5);
  await page.mouse.move(380,100);
  await page.keyboard.press('Tab');
  await reset.focus();
  await settle();
  await expect(reset).toBeFocused();
  await expect.poll(contrast).toBeGreaterThanOrEqual(4.5);
 });
}
test.describe('Orientação por toque',()=>{
test.use({hasTouch:true,isMobile:true});
for(const width of [320,390]) {
 test(`Checklist e orientação cabem em ${width}px e a orientação fecha por toque`,async({page})=>{
  await page.setViewportSize({width,height:800}); await page.emulateMedia({reducedMotion:'reduce'}); await openChecklist(page);
  const help=page.locator('.checklist-sidebar-item [data-checklist-help]').first(); await help.tap();
  await expect(page.locator('#checklistHelpPopover')).toBeVisible();
  const pop=await page.locator('#checklistHelpPopover').boundingBox(); expect(pop.x).toBeGreaterThanOrEqual(0); expect(pop.x+pop.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await page.locator('.checklist-help-popover__close').click(); await expect(page.locator('#checklistHelpPopover')).toBeHidden();
 });
}
});
