export function manualLanguagePath(lang, path, host) {
  const prefix = lang === 'pt' ? '' : `/${lang}`;
  if (/^manualdebordo\.kriativosonboard\.com\.br$/i.test(host)) return `${prefix}/`;
  if (/^(?:(?:www\.)?kriativosonboard|manualdebordo\.kriativos)\.com\.br$/i.test(host)) return `https://manualdebordo.kriativosonboard.com.br${prefix}/`;
  if (/(?:^|\/)manualdebordo\/?$/.test(path)) return `${prefix}/manualdebordo`;
  return `${prefix}/manual-de-bordo.html`;
}
if (typeof document !== 'undefined') {
  document.querySelectorAll('.lang-switch__item[href]').forEach(link => {
    const lang = (link.getAttribute('lang') || link.hreflang).slice(0,2);
    link.href = manualLanguagePath(lang,location.pathname,location.hostname);
    link.addEventListener('click',()=>{try{localStorage.setItem('kob_lang_pref',lang);}catch{}});
  });
}
