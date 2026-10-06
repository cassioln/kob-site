// Only proposals 01, 02, 03, 05, 08, 09, 10, 15 and 18 approved on 2026-10-06.
// Absolute cue times come from the recording's pt-orig captions; see the mapping report.
export const SUPPORT_DURATION = 12;
export const SUPPORT_NOTICES = [
  {
    id: 'support-01', cueSeconds: [1741.760],
    emphasis: { pt: 'Vai usar a Cometa?', en: 'Travelling with Cometa?', es: '¿Viajas con Cometa?' },
    texts: {
      pt: 'Vai usar a Cometa? Consulte os transfers e confira rota, data, horários e ponto de chegada.',
      en: 'Travelling with Cometa? Check the transfers, route, date, departure times and arrival point.',
      es: '¿Viajas con Cometa? Consulta los traslados y comprueba ruta, fecha, horarios y punto de llegada.'
    },
    action: {
      href: 'https://www.viacaocometa.com.br/transfer',
      labels: { pt: 'Ver transfers da Cometa', en: 'View Cometa transfers', es: 'Ver traslados de Cometa' }
    }
  },
  {
    id: 'support-02', cueSeconds: [1778.440],
    texts: {
      pt: 'Consulte o estacionamento do Concais e confirme disponibilidade, tarifa e acesso antes de sair.',
      en: 'Check Concais parking and confirm availability, prices and access before setting off.',
      es: 'Consulta el estacionamiento de Concais y confirma disponibilidad, tarifa y acceso antes de salir.'
    },
    action: {
      href: 'https://www.concais.com.br/estacionamento',
      labels: { pt: 'Consultar estacionamento', en: 'Check parking', es: 'Consultar estacionamiento' }
    }
  },
  {
    id: 'support-03', cueSeconds: [3823.119, 3964.119, 4221.199],
    emphasis: { pt: 'Instale agora o BG Guru!:', en: 'Install BG Guru now!', es: '¡Instala BG Guru ahora!' },
    texts: {
      pt: 'Instale agora o BG Guru!: no site do Board Game Guru você encontra os links para Android e iOS.',
      en: 'Install BG Guru now! The Board Game Guru website has the download links for Android and iOS.',
      es: '¡Instala BG Guru ahora! En el sitio de Board Game Guru encontrarás los enlaces para Android e iOS.'
    },
    action: {
      href: 'https://boardgameguru.app/',
      labels: { pt: 'Baixar o Guru', en: 'Download Guru', es: 'Descargar Guru' }
    }
  },
  {
    id: 'support-05', cueSeconds: [1088.280],
    emphasis: { pt: 'Quer aprender um jogo ou encontrar uma mesa?', en: 'Want to learn a game or find a table?', es: '¿Quieres aprender un juego o encontrar una mesa?' },
    texts: {
      pt: 'Quer aprender um jogo ou encontrar uma mesa? Procure a monitoria da Encounter.',
      en: 'Want to learn a game or find a table? Ask the Encounter game facilitators.',
      es: '¿Quieres aprender un juego o encontrar una mesa? Consulta al equipo de monitores de Encounter.'
    },
    action: { faqId: 'faq-o24' }
  },
  {
    id: 'support-08', cueSeconds: [1465.640],
    texts: {
      pt: 'Deixe documentos e itens essenciais na bagagem de mão. Uma troca para piscina ajuda a aproveitar o primeiro dia enquanto aguarda as malas.',
      en: 'Keep documents and essentials in your carry-on. Pack a change for the pool to enjoy your first day while waiting for your luggage.',
      es: 'Lleva documentos y artículos esenciales en el equipaje de mano. Una muda para la piscina ayuda a disfrutar del primer día mientras esperas las maletas.'
    },
    action: { faqId: 'faq-o09' }
  },
  {
    id: 'support-09', cueSeconds: [1563.080, 1673.120],
    texts: {
      pt: 'Confira os horários vigentes, o ponto de encontro e o ônibus atribuído à sua reserva na página do fretado oficial.',
      en: 'Check the current times, meeting point and bus assigned to your booking on the official charter page.',
      es: 'Consulta los horarios vigentes, el punto de encuentro y el autobús asignado a tu reserva en la página del autobús oficial.'
    },
    action: {
      href: 'https://kriativosonboard.com.br/onibus.html',
      labels: { pt: 'Ver fretado oficial', en: 'View official charter', es: 'Ver autobús oficial' }
    }
  },
  {
    id: 'support-10', cueSeconds: [1762.120],
    texts: {
      pt: 'Se o ônibus terminar na Rodoviária de Santos, programe também o deslocamento até o Concais e reserve margem para o trânsito.',
      en: 'If your bus ends at Santos Bus Station, plan the onward journey to Concais and allow extra time for traffic.',
      es: 'Si el autobús termina en la terminal de Santos, organiza también el traslado hasta Concais y deja margen para el tráfico.'
    },
    action: { faqId: 'faq-o13' }
  },
  {
    id: 'support-15', cueSeconds: [2592.280],
    texts: {
      pt: 'Ainda quer contratar um pacote? Peça à Royal Trip a oferta vigente e confirme preço, prazo e condições da sua cabine.',
      en: 'Still want to buy a package? Ask Royal Trip for the current offer and confirm prices, deadlines and conditions for your cabin.',
      es: '¿Quieres contratar un paquete? Pide a Royal Trip la oferta vigente y confirma precio, plazo y condiciones de tu cabina.'
    },
    action: {
      href: 'https://api.whatsapp.com/send?phone=5513981580498',
      labels: { pt: 'Consultar a Royal Trip', en: 'Ask Royal Trip', es: 'Consultar a Royal Trip' }
    }
  },
  {
    id: 'support-18', cueSeconds: [2843.680, 3661.880],
    texts: {
      pt: 'Veja mais detalhes e link de download no site da MSC',
      en: 'Find more details and the download link on the MSC website',
      es: 'Consulta más detalles y el enlace de descarga en el sitio de MSC'
    },
    action: {
      href: 'https://www.msccruzeiros.com.br/a-bordo/internet-e-aplicativos/msc-for-me',
      labels: { pt: 'MSC for Me', en: 'MSC for Me', es: 'MSC for Me' }
    }
  }
];

export function supportAt(seconds) {
  const position = Number(seconds);
  if (!Number.isFinite(position)) return null;
  return SUPPORT_NOTICES.find(notice => notice.cueSeconds.some(start => position >= start && position < start + SUPPORT_DURATION)) || null;
}
