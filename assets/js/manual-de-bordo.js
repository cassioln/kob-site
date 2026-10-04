/**
 * Kriativos On Board 2026 — Guia de Quem Já Reservou (Embarcados)
 * JavaScript modular, acessível e resiliente a falhas de rede/storage.
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // DADOS DOS CAPÍTULOS DA LIVE (#17) — 28 CAPÍTULOS CONFERIDOS
  // --------------------------------------------------------------------------
  var LIVE_CHAPTERS = [
    {
      time: "00:13:53",
      seconds: 833,
      title: "Boas-vindas e apresentação da viagem",
      keywords: "abertura feriado live introducao evento",
      transcript: "Boas-vindas aos passageiros do Kriativos On Board 2026. Abertura da reunião online de alinhamento e apresentação geral do cruzeiro temático no feriado prolongado de novembro."
    },
    {
      time: "00:15:13",
      seconds: 913,
      title: "Royal Trip e quarta edição do KOB",
      keywords: "agencia royal trip msc musica edicao junior organizacao",
      transcript: "Apresentação da agência oficial Royal Trip com Júnior, histórico de 14 anos no mercado de turismo náutico e cruzeiros temáticos, detalhes da quarta edição a bordo do MSC Musica."
    },
    {
      time: "00:16:49",
      seconds: 1009,
      title: "Datas, desembarque e retorno do fretado",
      keywords: "datas cabine segunda-feira retorno onibus desembarque horario fretado",
      transcript: "Período da expedição de 20 a 23 de novembro de 2026. Horário de desembarque na segunda-feira pela manhã no Porto de Santos e saída dos ônibus fretados programada para as 10h30 com destino à Barra Funda em São Paulo."
    },
    {
      time: "00:17:16",
      seconds: 1036,
      title: "Parceiros do evento",
      keywords: "acervo monitores apoiadores editoras encounter facil shopping moedas jogue vista board games sp",
      transcript: "Apresentação dos patrocinadores e parceiros oficiais: Moedas & Co com moedas de metal, Jogue & Vista com vestuário temático, Board Games São Paulo no apoio e monitores especializados da Encounter para ensinar regras."
    },
    {
      time: "00:20:50",
      seconds: 1250,
      title: "Documentos e autorização para menores",
      keywords: "documentos rg cnh passaporte foto aplicativo menores autorizacao cartorio autenticada validade certidao",
      transcript: "Regras de documentação para embarque nacional: RG em bom estado ou CNH física original. CNH digital somente no aplicativo oficial do governo, vedado print ou foto. Menores de 18 anos desacompanhados ou com apenas um dos pais exigem autorização com firma reconhecida em cartório."
    },
    {
      time: "00:22:25",
      seconds: 1345,
      title: "Vouchers, check-in e etiquetas",
      keywords: "junior privado impressao voucher checkin etiquetas royal trip pdf whatsapp mala bagagem",
      transcript: "Check-in do grupo centralizado pela Royal Trip. Júnior avisa no grupo de WhatsApp e o responsável da cabine entra em contato no privado para receber vouchers em PDF e etiquetas de mala para imprimir antes da viagem."
    },
    {
      time: "00:28:22",
      seconds: 1702,
      title: "Aeroportos e chegada a Santos",
      keywords: "aeroporto gru congonhas cgh viracopos vcp cometa rodoviaria santos van aviao uber taxi transfer",
      transcript: "Como chegar a Santos para quem vem de avião: desembarque em Congonhas (CGH), Guarulhos (GRU) ou Viracopos (VCP), linhas de ônibus executivo da Viação Cometa direto para Santos, opções de van, táxi e transporte por aplicativo."
    },
    {
      time: "00:29:25",
      seconds: 1765,
      title: "Estacionamento no Concais",
      keywords: "carro concais estacionamento reserva veiculo porto terminal santos vaga coberta diaria",
      transcript: "Orientações para quem viaja de carro próprio: estacionamento oficial do Terminal Marítimo de Passageiros Concais em Santos, reserva antecipada obrigatória pela internet para assegurar vaga coberta durante os 4 dias."
    },
    {
      time: "00:30:52",
      seconds: 1852,
      title: "Cruise Card, cartões e gastos a bordo",
      keywords: "cruise card cartao moeda wise nomad parcelamento compras credito dolares deposito dinheiro caucao totem",
      transcript: "Cartão de bordo Cruise Card como chave da cabine e documento financeiro no navio. Moeda oficial a bordo em dólares americanos (USD). Vinculação de cartão de crédito internacional, cartões digitais globais (Wise, Nomad) ou depósito caução em espécie nos totens.",
      notice: "Valores e condições dependem da oferta, da apólice e da confirmação da agência."
    },
    {
      time: "00:32:43",
      seconds: 1963,
      title: "Buffet e liberação das cabines",
      keywords: "buffet almoco comida restaurante 13h 14h cabine malas anuncio comandante 13 andar refeicao",
      transcript: "Após cruzar a passarela de embarque, o buffet no 13º andar já está funcionando com almoço completo à vontade. As cabines são liberadas entre 13h e 14h com anúncio pelo sistema de som, e as malas despachadas são entregues na porta da cabine."
    },
    {
      time: "00:34:01",
      seconds: 2041,
      title: "Encontro, kits e mural de programação",
      keywords: "crystal lounge cracha cordao pulseira moeda facil shopping kit mural programacao boas-vindas encontro",
      transcript: "Ponto de encontro inicial da comunidade previsto no Crystal Lounge. Retirada dos kits exclusivos KOB com crachá personalizado, cordão oficial, pulseira de identificação e moeda de metal. Consulta do mural com horários das mesas e torneios."
    },
    {
      time: "00:36:01",
      seconds: 2161,
      title: "Roupas e Festa do Branco",
      keywords: "roupas festa do branco traje jantar agasalho esporte fino chinelo regata bermuda frio ar condicionado casaco",
      transcript: "Trajes recomendados a bordo: roupas casuais e confortáveis para o dia e jogatinas. Para o jantar à la carte no restaurante principal, traje esporte fino (proibido entrar com regata, bermuda de praia ou chinelo de dedo). Noite da tradicional Festa do Branco (levar peça branca) e casaco leve para os ambientes climatizados."
    },
    {
      time: "00:37:56",
      seconds: 2276,
      title: "Gestantes",
      keywords: "gestante gravidez semanas atestado medico crm crbm parto obstetra 24 semanas saude restricao",
      transcript: "Diretrizes rígidas de gestação da MSC: proibido o embarque se a gravidez atingir 24 semanas ou mais em qualquer dia do cruzeiro. Gestantes abaixo desse limite devem apresentar atestado médico original comprovando aptidão para viagem marítima e idade gestacional.",
      notice: "A regra da MSC considera a idade gestacional durante todo o cruzeiro (limite 24 semanas)."
    },
    {
      time: "00:38:59",
      seconds: 2339,
      title: "Bebês na reserva",
      keywords: "bebe crianca reserva berco tarifa menor cabine recem nascido fralda",
      transcript: "Inclusão de bebês e crianças de colo na reserva: mesmo recém-nascidos devem constar obrigatoriamente no bilhete da cabine e na lista de passageiros com solicitação de berço junto à Royal Trip."
    },
    {
      time: "00:39:28",
      seconds: 2368,
      title: "Água, chá, café e sistema Aqua",
      keywords: "agua cha cafe buffet garrafa retornavel sistema aqua dispensador termica bebedouro gratuito",
      transcript: "Bebidas gratuitas disponíveis no restaurante buffet: dispensadores com água filtrada, café americano e água quente com sachês de chá durante o funcionamento das refeições. Permitido encher garrafinhas térmicas particulares."
    },
    {
      time: "00:40:23",
      seconds: 2423,
      title: "Pacotes de bebidas",
      keywords: "pacote bebidas easy premium extra nao alcoolico drinks cerveja bar 15 bebidas limite diario 6h as 6h refrigerante chopp",
      transcript: "Funcionamento dos pacotes de bebidas Easy e Premium Extra: limite de 15 bebidas alcoólicas diárias por pessoa da MSC (ciclo renovado das 6h às 6h do dia seguinte). Regra de cabine onde todos os hóspedes adultos devem contratar a mesma modalidade."
    },
    {
      time: "00:45:15",
      seconds: 2715,
      title: "Internet por aparelho e sinal em Búzios",
      keywords: "wifi internet pacote aparelho celular buzios sinal dados operadora satelite 4g 5g antena msc",
      transcript: "Internet no navio: Wi-Fi gratuito para uso da rede interna e aplicativo MSC for Me. Planos de internet via satélite para navegação externa são contratados por dispositivo. Durante a escala em Búzios, sinal celular 4G e 5G de operadoras nacionais pode funcionar dependendo da localização.",
      notice: "Confira o dia da escala na sua reserva. O sinal de celular depende da cobertura da sua operadora."
    },
    {
      time: "00:48:14",
      seconds: 2894,
      title: "Jantar, turnos e mesas com amigos",
      keywords: "jantar turno maitre restaurante mesa amigos reserva tolerancia horario 15 minutos pizzaria buffet cozinha sentar juntos",
      transcript: "Jantar servido em turnos no restaurante principal à la carte: tolerância rigorosa de até 15 minutos para fechamento da cozinha. Em caso de atraso, o buffet e a pizzaria funcionam como opção. Para juntar amigos de outras cabines na mesma mesa, procurar o Maitre logo no primeiro dia com os números das cabines."
    },
    {
      time: "00:52:34",
      seconds: 3154,
      title: "Frigobar e cobranças",
      keywords: "frigobar minibar quarto pacote bebidas cobranca separado taxa geladeira lata garrafa dica",
      transcript: "Esclarecimento fundamental sobre frigobar: os produtos do frigobar da cabine NÃO estão inclusos em nenhum pacote de bebidas (nem no Premium Extra) e são tarifados avulsos. Dica prática: retirar latas ou garrafas nos bares do navio cobertos pelo pacote e guardá-las no frigobar para consumir geladas."
    },
    {
      time: "00:53:33",
      seconds: 3213,
      title: "Tema Anos 80 e encerramento",
      keywords: "anos 80 festa encerramento fantasia retro neon domingo comemoracao baile musica discoteca",
      transcript: "Anúncio especial do tema da festa de encerramento no domingo à noite: Noite dos Anos 80! Trazer roupas retrô, adereços divertidos, peças neon e cores vibrantes para celebrar a última noite da expedição."
    },
    {
      time: "00:58:26",
      seconds: 3506,
      title: "Restaurantes de especialidades",
      keywords: "especialidades kaito sushi butchers cut carne restaurante pago a parte gastronomia japonês a la carte",
      transcript: "Opções gastronômicas pagas à parte no MSC Musica: restaurantes temáticos de especialidades como o Kaito Sushi Bar e a casa de carnes no estilo steakhouse, como alternativa aos restaurantes inclusos."
    },
    {
      time: "01:02:46",
      seconds: 3766,
      title: "MSC for Me e chat interno",
      keywords: "msc for me app aplicativo chat mensagens kriativo interno navio perfil rede sem custo wifi",
      transcript: "Aplicativo MSC for Me conectado à rede Wi-Fi interna sem necessidade de contratar pacote de internet. Uso do chat integrado gratuito para localizar amigos a bordo. Dica: incluir o prefixo Kriativo no nome do perfil para facilitar encontrar conhecidos."
    },
    {
      time: "01:05:42",
      seconds: 3942,
      title: "Board Game Guru e sorteios",
      keywords: "guru board game guru eu vou encounter inscricao manual favoritos ludopedia bgg compartilhar jogos sorteio acervo",
      transcript: "Aplicativo oficial Board Game Guru para Android e iOS: confirmar presença clicando em 'Eu vou' para participar dos sorteios diários de jogos a bordo. Exploração do acervo de jogos, verificação de monitores por título e cadastro de jogos próprios com importação da Ludopedia ou BoardGameGeek.",
      notice: "Registre-se no Board Game Guru ou solicite inclusão manual à Encounter para concorrer aos sorteios."
    },
    {
      time: "01:11:05",
      seconds: 4265,
      title: "Seguro e despesas médicas",
      keywords: "seguro viagem apolice cobertura moeda medico hospital despesas enfermaria atendimento particular dolares 112 reais cancelamento",
      transcript: "Orientações sobre seguro viagem marítimo: atendimento médico e enfermaria a bordo são cobrados em moeda estrangeira (dólar). Na live foi citado plano do grupo pela Royal Trip com preço em torno de R$ 112 por pessoa cobrindo 29 motivos de cancelamento; conferir apólice oficial antes de contratar.",
      notice: "Valores e coberturas dependem da oferta e apólice da agência. Não há valores garantidos pela live."
    },
    {
      time: "01:13:09",
      seconds: 4389,
      title: "Crianças e clubinho",
      keywords: "criancas clubinho doremi fraldas refeicoes recreacao kids monitores faixa etaria entretenimento",
      transcript: "Espaço infantil MSC Doremi Club: monitoria e recreação por faixas etárias gratuitas. Crianças desfraldadas podem permanecer com os monitores; bebês de fralda podem utilizar o espaço na companhia dos pais ou responsáveis.",
      notice: "Confirme horários e condições do serviço com a equipe infantil a bordo."
    },
    {
      time: "01:14:16",
      seconds: 4456,
      title: "Bagagem",
      keywords: "bagagem franquia peso malas malas despachadas mao msc 23kg 10kg etiquetas identificacao 100kg limite",
      transcript: "Franquia e limites oficiais de bagagem da MSC: até duas malas despachadas de 23 kg por pessoa e até duas malas de mão de 10 kg. Limite máximo total da cabine de até 100 kg ou 8 volumes. Recomenda-se etiquetar todas as bagagens com as etiquetas oficiais impressas.",
      notice: "Consulte a regra oficial da MSC no guia: há diferenças em relação às informações faladas na live."
    },
    {
      time: "01:14:41",
      seconds: 4481,
      title: "Cabine e itens para a mala",
      keywords: "cabine higiene itens proibidos secador chapinha tomada shampoo amenidades protetor solar ferro toalha sabonete",
      transcript: "Estrutura da cabine e itens de viagem: fornecidos toalhas, roupa de cama, sabonete líquido, shampoo e secador de parede. O que levar na mala: escova de dente, pasta, condicionador, protetor solar, medicamentos pessoais e adaptador universal. Itens expressamente proibidos pela MSC: ferro de passar, cafeteira, chapinha sem certificação, armas e bebidas alcoólicas externas.",
      notice: "Consulte a lista oficial MSC de itens permitidos e proibidos antes de fechar a mala."
    },
    {
      time: "01:18:32",
      seconds: 4712,
      title: "Grupo oficial e recados finais",
      keywords: "grupo avisos acompanhantes familiares whatsapp contatos duvidas capitania encerramento suporte",
      transcript: "Recados finais da organização: inclusão de familiares e acompanhantes no grupo oficial de avisos de WhatsApp, acompanhamento dos comunicados de véspera e contatos de suporte com a capitania e com a agência."
    }
  ];

  // Helper de normalização para busca sem acentos, sem pontuações e sem símbolos
  function normalizeText(str) {
    if (!str) return '';
    return str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  }

  // Helper de escape para segurança de injeção HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function createAccentInsensitiveRegex(query) {
    if (!query) return null;
    var norm = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!norm) return null;

    var pattern = '';
    for (var i = 0; i < norm.length; i++) {
      var ch = norm[i];
      if (ch === 'a') pattern += '[aáàãâä]';
      else if (ch === 'e') pattern += '[eéèêë]';
      else if (ch === 'i') pattern += '[iíìîï]';
      else if (ch === 'o') pattern += '[oóòõôö]';
      else if (ch === 'u') pattern += '[uúùûü]';
      else if (ch === 'c') pattern += '[cç]';
      else if (/[0-9a-z]/i.test(ch)) pattern += escapeRegex(ch);
      else pattern += '\\s*';
    }
    try {
      return new RegExp('(' + pattern + ')', 'gi');
    } catch (e) {
      return null;
    }
  }

  function highlightMatch(text, query) {
    if (!text) return '';
    var escaped = escapeHtml(text);
    if (!query || !query.trim()) return escaped;
    var regex = createAccentInsensitiveRegex(query);
    if (!regex) return escaped;
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  // --------------------------------------------------------------------------
  // CONTADOR REGRESSIVO DE DIAS (#16)
  // --------------------------------------------------------------------------
  function initCountdown() {
    var countdownEl = document.getElementById('guideCountdownText');
    if (!countdownEl) return;

    var lang = (document.documentElement.lang || 'pt-BR').toLowerCase();
    var isEn = lang.startsWith('en');
    var isEs = lang.startsWith('es');

    try {
      // Data alvo: 20 de novembro de 2026 no fuso de São Paulo (-03:00)
      var now = new Date();
      // Obter data no fuso de São Paulo
      var spFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      var spParts = spFormatter.format(now).split('-');
      var currentYear = parseInt(spParts[0], 10);
      var currentMonth = parseInt(spParts[1], 10);
      var currentDay = parseInt(spParts[2], 10);

      var todaySP = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay));
      var eventDateSP = new Date(Date.UTC(2026, 10, 20)); // 20/11/2026
      var eventEndSP = new Date(Date.UTC(2026, 10, 23));  // 23/11/2026

      var diffTime = eventDateSP.getTime() - todaySP.getTime();
      var diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        if (isEn) {
          countdownEl.textContent = 'Only ' + diffDays + ' days until boarding day.';
        } else if (isEs) {
          countdownEl.textContent = 'Faltan ' + diffDays + ' días para el día del embarque.';
        } else {
          countdownEl.textContent = 'Faltam ' + diffDays + ' dias para o dia do embarque.';
        }
      } else if (diffDays === 1) {
        if (isEn) {
          countdownEl.textContent = 'Only 1 day until boarding day.';
        } else if (isEs) {
          countdownEl.textContent = 'Falta 1 día para el día del embarque.';
        } else {
          countdownEl.textContent = 'Falta 1 dia para o dia do embarque.';
        }
      } else if (diffDays === 0) {
        if (isEn) {
          countdownEl.textContent = 'Today is boarding day! Check your voucher and team instructions.';
        } else if (isEs) {
          countdownEl.textContent = '¡Hoy es el día del embarque! Revisa tu voucher y las instrucciones del equipo.';
        } else {
          countdownEl.textContent = 'Hoje é o dia do embarque. Confira seu voucher e as orientações da equipe.';
        }
      } else if (todaySP.getTime() <= eventEndSP.getTime()) {
        if (isEn) {
          countdownEl.textContent = 'We are sailing in Kriativos On Board! Check the onboard daily program.';
        } else if (isEs) {
          countdownEl.textContent = '¡Estamos a bordo de Kriativos On Board! Consulta la programación a bordo.';
        } else {
          countdownEl.textContent = 'Estamos nos dias do Kriativos On Board. Consulte a programação a bordo.';
        }
      } else {
        if (isEn) {
          countdownEl.textContent = 'The 2026 edition has concluded. See you next trip!';
        } else if (isEs) {
          countdownEl.textContent = 'La edición 2026 ha finalizado. ¡Nos vemos en el próximo viaje!';
        } else {
          countdownEl.textContent = 'A edição 2026 foi encerrada.';
        }
      }
    } catch (e) {
      // Fallback
      if (isEn) {
        countdownEl.textContent = 'Boarding on November 20, 2026.';
      } else if (isEs) {
        countdownEl.textContent = 'Embarque el 20 de noviembre de 2026.';
      } else {
        countdownEl.textContent = 'Embarque em 20 de novembro de 2026.';
      }
    }
  }

  // --------------------------------------------------------------------------
  // CHECKLIST DE PREPARAÇÃO COM PERSISTÊNCIA LOCAL (#18)
  // --------------------------------------------------------------------------
  var CHECKLIST_STORAGE_KEY = 'kob_embarcados_checklist_2026_v1';

  function initChecklist() {
    var checklistRoot = document.getElementById('checklistContainer');
    if (!checklistRoot) return;

    var progressText = document.getElementById('checklistProgressText');
    var progressFill = document.getElementById('checklistProgressFill');
    var progressBar = document.getElementById('checklistProgressBar');
    var completedMsg = document.getElementById('checklistCompletedMsg');
    var resetBtn = document.getElementById('checklistResetBtn');

    var lang = (document.documentElement.lang || 'pt-BR').toLowerCase();
    var isEn = lang.startsWith('en');
    var isEs = lang.startsWith('es');

    // Carregar estado salvo
    var savedState = {};
    try {
      var raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          savedState = parsed;
        }
      }
    } catch (e) {
      console.warn('LocalStorage indisponível para checklist; usando memória.');
    }

    var items = checklistRoot.querySelectorAll('.checklist-item');

    // Inicializar inputs com base no estado salvo
    items.forEach(function (item) {
      var id = item.getAttribute('data-checklist-id');
      if (!id) return;

      var checkbox = item.querySelector('.checklist-item__checkbox');
      var naToggle = item.querySelector('.checklist-item__na-checkbox');

      if (savedState[id]) {
        if (savedState[id].checked && checkbox) {
          checkbox.checked = true;
          item.classList.add('is-checked');
        }
        if (savedState[id].na && naToggle) {
          naToggle.checked = true;
          item.classList.add('is-not-applicable');
          if (checkbox) checkbox.disabled = true;
        }
      }

      if (checkbox) {
        checkbox.addEventListener('change', function () {
          if (checkbox.checked) {
            item.classList.add('is-checked');
          } else {
            item.classList.remove('is-checked');
          }
          saveAndRefresh();
        });
      }

      if (naToggle) {
        naToggle.addEventListener('change', function () {
          if (naToggle.checked) {
            item.classList.add('is-not-applicable');
            if (checkbox) {
              checkbox.checked = false;
              checkbox.disabled = true;
              item.classList.remove('is-checked');
            }
          } else {
            item.classList.remove('is-not-applicable');
            if (checkbox) {
              checkbox.disabled = false;
            }
          }
          saveAndRefresh();
        });
      }
    });

    function saveAndRefresh() {
      var stateToSave = {};
      var totalApplicable = 0;
      var checkedCount = 0;

      items.forEach(function (item) {
        var id = item.getAttribute('data-checklist-id');
        var type = item.getAttribute('data-checklist-type'); // essential, recommended, conditional, optional
        var checkbox = item.querySelector('.checklist-item__checkbox');
        var naToggle = item.querySelector('.checklist-item__na-checkbox');

        var isChecked = checkbox ? checkbox.checked : false;
        var isNa = naToggle ? naToggle.checked : false;

        stateToSave[id] = { checked: isChecked, na: isNa };

        // Itens essenciais ou condicionais contam para o progresso principal
        var isEssentialOrConditional = (type === 'essential' || type === 'conditional');

        if (isEssentialOrConditional) {
          if (!isNa) {
            totalApplicable++;
            if (isChecked) {
              checkedCount++;
            }
          }
        }
      });

      // Salvar
      try {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (e) {}

      // Atualizar progresso
      var percentage = totalApplicable > 0 ? Math.round((checkedCount / totalApplicable) * 100) : 0;
      if (progressFill) progressFill.style.width = percentage + '%';
      if (progressBar) progressBar.setAttribute('aria-valuenow', percentage.toString());

      if (progressText) {
        if (isEn) {
          progressText.textContent = checkedCount + ' of ' + totalApplicable + ' essential or applicable items checked';
        } else if (isEs) {
          progressText.textContent = checkedCount + ' de ' + totalApplicable + ' ítems esenciales o aplicables verificados';
        } else {
          progressText.textContent = checkedCount + ' de ' + totalApplicable + ' itens essenciais ou aplicáveis conferidos';
        }
      }

      if (completedMsg) {
        if (totalApplicable > 0 && checkedCount === totalApplicable) {
          completedMsg.classList.add('is-visible');
        } else {
          completedMsg.classList.remove('is-visible');
        }
      }

      // Atualizar progresso no Boarding Pass da Hero (Slide 1)
      var heroBoardingText = document.getElementById('heroBoardingProgressText');
      var heroBoardingBar = document.getElementById('heroBoardingProgressBar');
      if (heroBoardingText) {
        if (isEn) {
          heroBoardingText.textContent = checkedCount + ' of ' + totalApplicable + ' ready';
        } else if (isEs) {
          heroBoardingText.textContent = checkedCount + ' de ' + totalApplicable + ' listos';
        } else {
          heroBoardingText.textContent = checkedCount + ' de ' + totalApplicable + ' concluídos';
        }
      }
      if (heroBoardingBar) {
        heroBoardingBar.style.width = percentage + '%';
        var heroBoardingBarWrap = heroBoardingBar.parentElement;
        if (heroBoardingBarWrap && heroBoardingBarWrap.getAttribute('role') === 'progressbar') {
          heroBoardingBarWrap.setAttribute('aria-valuenow', percentage.toString());
        }
      }

      // Atualizar a Sidebar retrátil
      if (sidebarController && typeof sidebarController.update === 'function') {
        sidebarController.update(checkedCount, totalApplicable, percentage, items);
      }
    }

    // Inicializar Sidebar Retrátil na Lateral Esquerda
    var sidebarController = initChecklistSidebar(items, function () {
      saveAndRefresh();
    });

    // Reset button
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        var confirmMsg = isEn
          ? 'Clear all checklist marks in this browser?'
          : isEs
          ? '¿Borrar todas las marcas de esta lista en este navegador?'
          : 'Apagar as marcações deste checklist neste navegador?';

        if (window.confirm(confirmMsg)) {
          try {
            localStorage.removeItem(CHECKLIST_STORAGE_KEY);
          } catch (e) {}

          items.forEach(function (item) {
            var checkbox = item.querySelector('.checklist-item__checkbox');
            var naToggle = item.querySelector('.checklist-item__na-checkbox');
            if (checkbox) {
              checkbox.checked = false;
              checkbox.disabled = false;
            }
            if (naToggle) {
              naToggle.checked = false;
            }
            item.classList.remove('is-checked', 'is-not-applicable');
          });

          saveAndRefresh();
          resetBtn.focus();
        }
      });
    }

    // Primeira atualização
    saveAndRefresh();
  }

  // --------------------------------------------------------------------------
  // SIDEBAR RETRÁTIL DO CHECKLIST (SLIDERBAR LATERAL ESQUERDA)
  // --------------------------------------------------------------------------
  function initChecklistSidebar(mainItems, onStateChange) {
    var sidebarToggle = document.getElementById('checklistSidebarToggle');
    var sidebarToggleBadge = document.getElementById('checklistSidebarToggleBadge');
    var sidebarBackdrop = document.getElementById('checklistSidebarBackdrop');
    var sidebarAside = document.getElementById('checklistSidebar');
    var sidebarClose = document.getElementById('checklistSidebarClose');
    var sidebarProgressFill = document.getElementById('checklistSidebarProgressFill');
    var sidebarProgressText = document.getElementById('checklistSidebarProgressText');
    var sidebarList = document.getElementById('checklistSidebarList');
    var sidebarNavItems = document.querySelectorAll('.checklist-sidebar__nav-item');
    var sidebarGotoBtn = document.getElementById('checklistSidebarGotoBtn');

    if (!sidebarAside || !sidebarToggle || !sidebarList) {
      return null;
    }

    var lang = (document.documentElement.lang || 'pt-BR').toLowerCase();
    var isEn = lang.startsWith('en');
    var isEs = lang.startsWith('es');

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function getTagLabel(type) {
      if (type === 'essential') return isEn ? 'Essential' : isEs ? 'Esencial' : 'Essencial';
      if (type === 'recommended') return isEn ? 'Recommended' : isEs ? 'Recomendado' : 'Recomendado';
      if (type === 'conditional') return isEn ? 'Conditional' : isEs ? 'Condicional' : 'Condicional';
      return isEn ? 'Optional' : isEs ? 'Opcional' : 'Opcional';
    }

    // Montar os itens compactos da sidebar espelhando a lista principal
    sidebarList.innerHTML = '';
    mainItems.forEach(function (mainItem) {
      var id = mainItem.getAttribute('data-checklist-id');
      if (!id) return;

      var type = mainItem.getAttribute('data-checklist-type') || 'essential';
      var groupEl = mainItem.closest('.checklist-group');
      var groupId = groupEl && groupEl.id ? groupEl.id.replace('checklistGroup', '') : '1';

      var titleEl = mainItem.querySelector('.checklist-item__title');
      var titleText = titleEl ? titleEl.textContent.trim() : id;
      var tagLabel = getTagLabel(type);

      var div = document.createElement('div');
      div.className = 'checklist-sidebar-item';
      div.setAttribute('data-sidebar-item-id', id);
      div.setAttribute('data-sidebar-group', groupId);

      div.innerHTML =
        '<input type="checkbox" class="checklist-sidebar-item__checkbox" id="sidebar_chk_' + escapeHtml(id) + '" aria-label="' + escapeHtml(titleText) + '">' +
        '<div class="checklist-sidebar-item__content">' +
          '<div class="checklist-sidebar-item__header">' +
            '<span class="checklist-sidebar-item__tag checklist-sidebar-item__tag--' + escapeHtml(type) + '">' + escapeHtml(tagLabel) + '</span>' +
            '<a href="#' + escapeHtml(id) + '" class="checklist-sidebar-item__jump" aria-label="Ir para ' + escapeHtml(titleText) + '">#' + escapeHtml(id) + '</a>' +
          '</div>' +
          '<label for="sidebar_chk_' + escapeHtml(id) + '" class="checklist-sidebar-item__text">' + escapeHtml(titleText) + '</label>' +
        '</div>';

      sidebarList.appendChild(div);

      // Evento de clique / alteração na sidebar sincronizando com a página principal
      var sCheckbox = div.querySelector('.checklist-sidebar-item__checkbox');
      if (sCheckbox) {
        sCheckbox.addEventListener('change', function () {
          var mainCheckbox = mainItem.querySelector('.checklist-item__checkbox');
          if (mainCheckbox && !mainCheckbox.disabled) {
            mainCheckbox.checked = sCheckbox.checked;
            if (sCheckbox.checked) {
              mainItem.classList.add('is-checked');
              div.classList.add('is-checked');
            } else {
              mainItem.classList.remove('is-checked');
              div.classList.remove('is-checked');
            }
            if (typeof onStateChange === 'function') {
              onStateChange();
            }
          } else {
            // Se estava desabilitado (ex: N/A marcado na página principal), reverte o checkbox
            sCheckbox.checked = mainCheckbox ? mainCheckbox.checked : false;
          }
        });
      }

      // Link de salto para o item na página principal
      var jumpLink = div.querySelector('.checklist-sidebar-item__jump');
      if (jumpLink) {
        jumpLink.addEventListener('click', function (e) {
          e.preventDefault();
          closeSidebar();

          // Se a aba do grupo estiver oculta na página, ativa a aba correspondente
          var parentGroup = mainItem.closest('.checklist-group');
          if (parentGroup && parentGroup.classList.contains('is-hidden')) {
            var tabBtn = document.querySelector('.checklist-tab[data-tab="' + parentGroup.id.replace('checklistGroup', '') + '"]');
            if (tabBtn) tabBtn.click();
          }

          // Rola suavemente até o item e dá destaque
          setTimeout(function () {
            mainItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            mainItem.classList.add('is-focused-highlight');
            setTimeout(function () {
              mainItem.classList.remove('is-focused-highlight');
            }, 1800);
          }, 150);
        });
      }
    });

    // Abrir e Fechar Sidebar
    function openSidebar() {
      sidebarAside.classList.add('is-open');
      sidebarAside.setAttribute('aria-hidden', 'false');
      if (sidebarBackdrop) {
        sidebarBackdrop.classList.add('is-open');
        sidebarBackdrop.setAttribute('aria-hidden', 'false');
      }
      sidebarToggle.setAttribute('aria-expanded', 'true');
      if (sidebarClose) sidebarClose.focus();
    }

    function closeSidebar() {
      sidebarAside.classList.remove('is-open');
      sidebarAside.setAttribute('aria-hidden', 'true');
      if (sidebarBackdrop) {
        sidebarBackdrop.classList.remove('is-open');
        sidebarBackdrop.setAttribute('aria-hidden', 'true');
      }
      sidebarToggle.setAttribute('aria-expanded', 'false');
      sidebarToggle.focus();
    }

    sidebarToggle.addEventListener('click', function () {
      if (sidebarAside.classList.contains('is-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    if (sidebarClose) {
      sidebarClose.addEventListener('click', closeSidebar);
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebarAside.classList.contains('is-open')) {
        closeSidebar();
      }
    });

    // Botão de rodapé "Ver Checklist Completo na Página"
    if (sidebarGotoBtn) {
      sidebarGotoBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeSidebar();
        var prepSection = document.getElementById('preparacao');
        if (prepSection) {
          prepSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    // Filtragem de grupos dentro da Sidebar
    sidebarNavItems.forEach(function (navBtn) {
      navBtn.addEventListener('click', function () {
        sidebarNavItems.forEach(function (btn) { btn.classList.remove('is-active'); });
        navBtn.classList.add('is-active');

        var filterGroup = navBtn.getAttribute('data-sidebar-group') || 'all';
        var sidebarItems = sidebarList.querySelectorAll('.checklist-sidebar-item');

        sidebarItems.forEach(function (sItem) {
          var itemGroup = sItem.getAttribute('data-sidebar-group');
          if (filterGroup === 'all' || itemGroup === filterGroup) {
            sItem.style.display = 'flex';
          } else {
            sItem.style.display = 'none';
          }
        });
      });
    });

    // Função de atualização chamada por saveAndRefresh()
    return {
      update: function (checkedCount, totalApplicable, percentage, currentMainItems) {
        // Atualizar badge do botão flutuante
        if (sidebarToggleBadge) {
          sidebarToggleBadge.textContent = checkedCount + '/' + totalApplicable;
        }

        // Atualizar barra de progresso da sidebar
        if (sidebarProgressFill) {
          sidebarProgressFill.style.width = percentage + '%';
        }

        // Atualizar texto de progresso da sidebar
        if (sidebarProgressText) {
          if (isEn) {
            sidebarProgressText.textContent = checkedCount + ' of ' + totalApplicable + ' completed';
          } else if (isEs) {
            sidebarProgressText.textContent = checkedCount + ' de ' + totalApplicable + ' verificados';
          } else {
            sidebarProgressText.textContent = checkedCount + ' de ' + totalApplicable + ' conferidos';
          }
        }

        // Atualizar o estado de cada checkbox e visual do item da sidebar
        currentMainItems.forEach(function (mainItem) {
          var id = mainItem.getAttribute('data-checklist-id');
          if (!id) return;

          var mainCheckbox = mainItem.querySelector('.checklist-item__checkbox');
          var mainNa = mainItem.querySelector('.checklist-item__na-checkbox');
          var isChecked = mainCheckbox ? mainCheckbox.checked : false;
          var isNa = mainNa ? mainNa.checked : false;

          var sItem = sidebarList.querySelector('[data-sidebar-item-id="' + id + '"]');
          if (sItem) {
            var sCheckbox = sItem.querySelector('.checklist-sidebar-item__checkbox');
            if (sCheckbox) {
              sCheckbox.checked = isChecked;
              sCheckbox.disabled = isNa;
            }
            if (isChecked) {
              sItem.classList.add('is-checked');
            } else {
              sItem.classList.remove('is-checked');
            }
            if (isNa) {
              sItem.style.opacity = '0.45';
            } else {
              sItem.style.opacity = '1';
            }
          }
        });
      }
    };
  }

  // --------------------------------------------------------------------------
  // FAQ DETALHADO (#20) — BUSCA & CATEGORIAS
  // --------------------------------------------------------------------------
  function initFAQ() {
    var searchInput = document.getElementById('faqSearchInput');
    var clearBtn = document.getElementById('faqClearBtn');
    var categoryBtns = document.querySelectorAll('.faq-category-btn');
    var faqItems = document.querySelectorAll('.faq-item');
    var emptyState = document.getElementById('faqEmptyState');
    var resultsCounter = document.getElementById('faqResultsCount');

    if (!faqItems.length) return;

    var currentCategory = 'all';

    function filterFAQ() {
      var query = searchInput ? normalizeText(searchInput.value) : '';
      var visibleCount = 0;

      faqItems.forEach(function (item) {
        var itemCategory = item.getAttribute('data-category') || '';
        var matchesCategory = (currentCategory === 'all' || itemCategory === currentCategory);

        var titleEl = item.querySelector('.faq-item__summary-title');
        var textEl = item.querySelector('.faq-item__content');
        var id = item.getAttribute('id') || '';

        var textContent = (titleEl ? titleEl.textContent : '') + ' ' + (textEl ? textEl.textContent : '') + ' ' + id;
        var normalizedContent = normalizeText(textContent);

        var matchesQuery = !query || normalizedContent.indexOf(query) !== -1;

        if (matchesCategory && matchesQuery) {
          item.style.display = '';
          visibleCount++;
          // Se o usuário fez uma busca com 3+ caracteres, abre os itens para leitura facilitada
          if (query.length >= 3) {
            item.setAttribute('open', '');
          }
        } else {
          item.style.display = 'none';
        }
      });

      if (emptyState) {
        if (visibleCount === 0) {
          emptyState.classList.add('is-visible');
        } else {
          emptyState.classList.remove('is-visible');
        }
      }

      if (resultsCounter) {
        resultsCounter.textContent = visibleCount.toString();
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', filterFAQ);
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (searchInput) {
          searchInput.value = '';
        }
        currentCategory = 'all';
        categoryBtns.forEach(function (btn) {
          if (btn.getAttribute('data-category') === 'all') {
            btn.classList.add('is-active');
          } else {
            btn.classList.remove('is-active');
          }
        });
        filterFAQ();
        if (searchInput) searchInput.focus();
      });
    }

    categoryBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        categoryBtns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentCategory = btn.getAttribute('data-category') || 'all';
        filterFAQ();
      });
    });

    // Abrir âncora direta (ex: #faq-o12)
    function checkHashTarget() {
      var hash = window.location.hash;
      if (hash && hash.startsWith('#faq-')) {
        var targetEl = document.querySelector(hash);
        if (targetEl && targetEl.tagName.toLowerCase() === 'details') {
          targetEl.setAttribute('open', '');
          setTimeout(function () {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            var summary = targetEl.querySelector('summary');
            if (summary) summary.focus();
          }, 200);
        }
      }
    }

    window.addEventListener('hashchange', checkHashTarget);
    checkHashTarget();
  }

  // --------------------------------------------------------------------------
  // LIVE HERO CINEMA & CAPÍTULOS EM SLIDE (#17)
  // --------------------------------------------------------------------------
  function initLiveModule() {
    var chaptersList = document.getElementById('liveChaptersList');
    var searchInput = document.getElementById('liveSearchInput');
    var loadPlayerBtn = document.getElementById('loadLivePlayerBtn');
    var playerFacade = document.getElementById('livePlayerFacade');
    var playerContainer = document.getElementById('livePlayerContainer');
    var emptyMsg = document.getElementById('liveEmptyChaptersMsg');
    var topicStatus = document.getElementById('heroLiveTopicStatus');
    var toggleDrawerBtn = document.getElementById('heroLiveToggleChaptersBtn');
    var closeDrawerBtn = document.getElementById('heroLiveChaptersCloseBtn');
    var cinemaContainer = document.getElementById('heroLiveCinema');

    if (!chaptersList) return;

    var playerIframe = null;
    var isPlayerLoaded = false;
    var pendingSeconds = null;

    // Alternar entre drawer recolhido (vídeo em tamanho máximo) e expandido
    function toggleDrawer(forceCollapse) {
      if (!cinemaContainer) return;
      var isCollapsed = cinemaContainer.classList.contains('is-collapsed');
      var willCollapse = (typeof forceCollapse === 'boolean') ? forceCollapse : !isCollapsed;

      if (willCollapse) {
        cinemaContainer.classList.add('is-collapsed');
        if (toggleDrawerBtn) {
          toggleDrawerBtn.setAttribute('aria-expanded', 'false');
          toggleDrawerBtn.classList.add('is-active');
          var textEl = toggleDrawerBtn.querySelector('.hero-live-toggle-text');
          if (textEl) textEl.textContent = 'Abrir Capítulos (28)';
        }
      } else {
        cinemaContainer.classList.remove('is-collapsed');
        if (toggleDrawerBtn) {
          toggleDrawerBtn.setAttribute('aria-expanded', 'true');
          toggleDrawerBtn.classList.remove('is-active');
          var textEl = toggleDrawerBtn.querySelector('.hero-live-toggle-text');
          if (textEl) textEl.textContent = 'Recolher Capítulos';
        }
      }
    }

    if (toggleDrawerBtn) {
      toggleDrawerBtn.addEventListener('click', function () {
        toggleDrawer();
      });
    }

    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', function () {
        toggleDrawer(true);
      });
    }

    // Renderizar capítulos
    function renderChapters(filterQuery) {
      chaptersList.innerHTML = '';
      var query = normalizeText(filterQuery);
      var count = 0;

      LIVE_CHAPTERS.forEach(function (cap) {
        var searchIndex = normalizeText(cap.time + ' ' + cap.title + ' ' + cap.keywords + ' ' + (cap.transcript || ''));
        if (query && searchIndex.indexOf(query) === -1) {
          return;
        }

        count++;
        var li = document.createElement('li');
        li.className = 'live-chapter-item';
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
        li.setAttribute('data-seconds', cap.seconds.toString());
        li.setAttribute('data-transcript', cap.transcript || '');

        var timeSpan = document.createElement('span');
        timeSpan.className = 'live-chapter-item__time';
        timeSpan.textContent = cap.time;

        var bodyDiv = document.createElement('div');
        bodyDiv.className = 'live-chapter-item__content';

        var titleP = document.createElement('p');
        titleP.className = 'live-chapter-item__title';
        if (query) {
          titleP.innerHTML = highlightMatch(cap.title, query);
        } else {
          titleP.textContent = cap.title;
        }
        bodyDiv.appendChild(titleP);

        // Se a busca encontrou termo no transcript e não no título, exibe snippet contextual sem prefixo e destacando a palavra da busca
        if (query && cap.transcript) {
          var normTrans = normalizeText(cap.transcript);
          var matchIdx = normTrans.indexOf(query);
          var normTitle = normalizeText(cap.title);
          if (matchIdx !== -1 && normTitle.indexOf(query) === -1) {
            var snippetP = document.createElement('p');
            snippetP.className = 'live-chapter-item__snippet';
            var start = Math.max(0, matchIdx - 20);
            var end = Math.min(cap.transcript.length, matchIdx + query.length + 60);
            var rawSnippet = (start > 0 ? '… ' : '') + cap.transcript.substring(start, end).trim() + (end < cap.transcript.length ? ' …' : '');
            snippetP.innerHTML = highlightMatch(rawSnippet, query);
            bodyDiv.appendChild(snippetP);
          }
        }

        if (cap.notice) {
          var noticeP = document.createElement('p');
          noticeP.className = 'live-chapter-item__notice';
          noticeP.textContent = '⚠️ ' + cap.notice;
          bodyDiv.appendChild(noticeP);
        }

        var playIcon = document.createElement('span');
        playIcon.className = 'live-chapter-item__play';
        playIcon.setAttribute('aria-hidden', 'true');
        playIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>';

        li.appendChild(timeSpan);
        li.appendChild(bodyDiv);
        li.appendChild(playIcon);

        function triggerChapter() {
          selectChapter(cap.seconds, li);
        }

        li.addEventListener('click', triggerChapter);
        li.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerChapter();
          }
        });

        chaptersList.appendChild(li);
      });

      if (emptyMsg) {
        if (count === 0) {
          emptyMsg.style.display = 'block';
        } else {
          emptyMsg.style.display = 'none';
        }
      }
    }

    function selectChapter(seconds, element) {
      var allItems = chaptersList.querySelectorAll('.live-chapter-item');
      allItems.forEach(function (el) { el.classList.remove('is-active'); });
      if (element) {
        element.classList.add('is-active');
        var titleEl = element.querySelector('.live-chapter-item__title');
        var timeEl = element.querySelector('.live-chapter-item__time');
        if (topicStatus && titleEl) {
          topicStatus.textContent = 'Tópico: ' + titleEl.textContent + (timeEl ? ' (' + timeEl.textContent + ')' : '');
        }
      }

      if (!isPlayerLoaded) {
        pendingSeconds = seconds;
        loadPlayer(seconds);
      } else if (playerIframe && playerIframe.contentWindow) {
        // Enviar comando seekTo para IFrame do YouTube
        playerIframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
          '*'
        );
        playerIframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        );
      }

      // Scroll suave até o player se estiver em mobile
      if (window.innerWidth < 992 && playerContainer) {
        playerContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function loadPlayer(startAtSeconds) {
      if (isPlayerLoaded) return;
      isPlayerLoaded = true;

      var origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
      var src = 'https://www.youtube-nocookie.com/embed/AtIvlc62KgI?enablejsapi=1&origin=' + encodeURIComponent(origin);
      if (startAtSeconds) {
        src += '&start=' + startAtSeconds + '&autoplay=1';
      }

      playerIframe = document.createElement('iframe');
      playerIframe.setAttribute('src', src);
      playerIframe.setAttribute('title', 'Live de Embarque Kriativos On Board 2026');
      playerIframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      playerIframe.setAttribute('allowfullscreen', 'true');
      playerIframe.className = 'hero-live-player__iframe';

      if (playerFacade) {
        playerFacade.classList.add('is-hidden');
        playerFacade.style.display = 'none';
      }
      if (playerContainer) {
        playerContainer.innerHTML = '';
        playerContainer.appendChild(playerIframe);
        playerContainer.style.display = 'block';
      }
    }

    if (loadPlayerBtn) {
      loadPlayerBtn.addEventListener('click', function () {
        loadPlayer(pendingSeconds || 833);
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        renderChapters(searchInput.value);
      });
    }

    renderChapters('');
  }

  // --------------------------------------------------------------------------
  // HERO SLIDER INTERATIVO COM DESTAQUE DA LIVE (#16)
  // --------------------------------------------------------------------------
  function initHeroSlider() {
    var track = document.getElementById('heroSliderTrack');
    var slides = document.querySelectorAll('.hero-slide');
    var dots = document.querySelectorAll('.hero-slider__dot');
    var prevBtn = document.getElementById('heroSliderPrev');
    var nextBtn = document.getElementById('heroSliderNext');

    if (!track || slides.length <= 1) return;

    var currentIndex = 0;
    var totalSlides = slides.length;
    var autoPlayTimer = null;
    var autoPlayDelay = 9000;
    var isPaused = false;

    function goToSlide(index) {
      if (index < 0) {
        currentIndex = totalSlides - 1;
      } else if (index >= totalSlides) {
        currentIndex = 0;
      } else {
        currentIndex = index;
      }

      slides.forEach(function (slide, idx) {
        if (idx === currentIndex) {
          slide.classList.add('is-active');
          slide.setAttribute('aria-hidden', 'false');
        } else {
          slide.classList.remove('is-active');
          slide.setAttribute('aria-hidden', 'true');
        }
      });

      dots.forEach(function (dot, idx) {
        if (idx === currentIndex) {
          dot.classList.add('is-active');
          dot.setAttribute('aria-selected', 'true');
        } else {
          dot.classList.remove('is-active');
          dot.setAttribute('aria-selected', 'false');
        }
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        goToSlide(currentIndex - 1);
        resetAutoPlay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        goToSlide(currentIndex + 1);
        resetAutoPlay();
      });
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var targetIndex = parseInt(dot.getAttribute('data-slide-to'), 10);
        if (!isNaN(targetIndex)) {
          goToSlide(targetIndex);
          resetAutoPlay();
        }
      });
    });

    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        goToSlide(currentIndex - 1);
        resetAutoPlay();
      } else if (e.key === 'ArrowRight') {
        goToSlide(currentIndex + 1);
        resetAutoPlay();
      }
    });

    // Touch swipe simples
    var startX = 0;
    track.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches[0]) {
        startX = e.touches[0].clientX;
      }
    }, { passive: true });

    track.addEventListener('touchend', function (e) {
      if (e.changedTouches && e.changedTouches[0]) {
        var diffX = e.changedTouches[0].clientX - startX;
        if (Math.abs(diffX) > 50) {
          if (diffX > 0) {
            goToSlide(currentIndex - 1);
          } else {
            goToSlide(currentIndex + 1);
          }
          resetAutoPlay();
        }
      }
    }, { passive: true });

    track.addEventListener('mouseenter', function () { isPaused = true; });
    track.addEventListener('mouseleave', function () { isPaused = false; });
    track.addEventListener('focusin', function () { isPaused = true; });
    track.addEventListener('focusout', function () { isPaused = false; });

    function startAutoPlay() {
      stopAutoPlay();
      autoPlayTimer = setInterval(function () {
        if (!isPaused) {
          goToSlide(currentIndex + 1);
        }
      }, autoPlayDelay);
    }

    function stopAutoPlay() {
      if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
      }
    }

    function resetAutoPlay() {
      stopAutoPlay();
      startAutoPlay();
    }

    goToSlide(0);
    startAutoPlay();
  }

  // --------------------------------------------------------------------------
  // HERO LIVE CINEMA: CONTROLE INTEGRADO NO INITLIVEMODULE
  // --------------------------------------------------------------------------
  function initHeroLiveCinema() {
    // Unificado com o initLiveModule com suporte completo ao drawer de capítulos e busca
  }

  // --------------------------------------------------------------------------
  // MODAL DE VÍDEO DA LIVE (#17)
  // --------------------------------------------------------------------------
  function initLiveModal() {
    var modal = document.getElementById('liveModal');
    var closeBtn = document.getElementById('liveModalCloseBtn');
    var iframeContainer = document.getElementById('liveModalIframeContainer');
    var triggerButtons = document.querySelectorAll('[data-open-live-modal]');
    var seekPills = document.querySelectorAll('[data-modal-seek]');
    var gotoSectionBtn = document.getElementById('liveModalGotoSectionBtn');

    if (!modal) return;

    var lastFocusedEl = null;
    var modalIframe = null;

    function openLiveModal(startSeconds) {
      lastFocusedEl = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');

      var origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
      var sec = startSeconds || 833;
      var src = 'https://www.youtube-nocookie.com/embed/AtIvlc62KgI?enablejsapi=1&autoplay=1&start=' + sec + '&origin=' + encodeURIComponent(origin);

      if (iframeContainer) {
        iframeContainer.innerHTML = '';
        modalIframe = document.createElement('iframe');
        modalIframe.setAttribute('src', src);
        modalIframe.setAttribute('title', 'Vídeo oficial da live de alinhamento KOB 2026');
        modalIframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        modalIframe.setAttribute('allowfullscreen', 'true');
        iframeContainer.appendChild(modalIframe);
      }

      if (closeBtn) closeBtn.focus();
    }

    function closeLiveModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');

      if (iframeContainer) {
        iframeContainer.innerHTML = '';
        modalIframe = null;
      }

      if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        lastFocusedEl.focus();
      }
    }

    triggerButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openLiveModal(833);
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLiveModal(833);
        }
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeLiveModal);
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeLiveModal();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeLiveModal();
      }
    });

    seekPills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        var sec = parseInt(pill.getAttribute('data-modal-seek'), 10);
        if (!isNaN(sec)) {
          seekPills.forEach(function (p) { p.classList.remove('is-active'); });
          pill.classList.add('is-active');

          if (modalIframe && modalIframe.contentWindow) {
            modalIframe.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'seekTo', args: [sec, true] }),
              '*'
            );
            modalIframe.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            );
          } else {
            openLiveModal(sec);
          }
        }
      });
    });

    if (gotoSectionBtn) {
      gotoSectionBtn.addEventListener('click', function () {
        closeLiveModal();
      });
    }
  }

  // --------------------------------------------------------------------------
  // ATENDIMENTO HUMANO & FORMULÁRIO MODAL (#21)
  // --------------------------------------------------------------------------
  function initSupportModal() {
    var modal = document.getElementById('supportModal');
    var openBtns = document.querySelectorAll('[data-open-support-modal]');
    var closeBtn = document.getElementById('supportModalCloseBtn');
    var form = document.getElementById('supportForm');
    var msgInput = document.getElementById('supportMsgInput');
    var charCount = document.getElementById('supportCharCount');
    var statusBox = document.getElementById('supportStatusBox');
    var submitBtn = document.getElementById('supportSubmitBtn');

    if (!modal) return;

    var lastFocusedElement = null;

    function openModal() {
      lastFocusedElement = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      var firstInput = modal.querySelector('input, textarea, button');
      if (firstInput) firstInput.focus();

      document.addEventListener('keydown', handleTrapFocus);
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleTrapFocus);

      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      }
    }

    function handleTrapFocus(e) {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      if (e.key === 'Tab') {
        var focusables = modal.querySelectorAll('input:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    openBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Contador de caracteres da mensagem
    if (msgInput && charCount) {
      msgInput.addEventListener('input', function () {
        var remaining = 2000 - msgInput.value.length;
        charCount.textContent = msgInput.value.length + ' / 2000';
      });
    }

    // Submissão do formulário
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var name = (document.getElementById('supportNameInput') || {}).value || '';
        var email = (document.getElementById('supportEmailInput') || {}).value || '';
        var whatsapp = (document.getElementById('supportWhatsappInput') || {}).value || '';
        var message = msgInput ? msgInput.value : '';

        var optEmail = (document.getElementById('newsletterEmailOpt') || {}).checked || false;
        var optWhatsapp = (document.getElementById('newsletterWhatsappOpt') || {}).checked || false;

        // Validações básicas
        if (!name.trim()) {
          showStatus('Informe seu nome.', 'error');
          return;
        }

        if (!email.trim() || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
          showStatus('Informe um e-mail válido para receber a resposta.', 'error');
          return;
        }

        if (!message.trim()) {
          showStatus('Escreva sua dúvida.', 'error');
          return;
        }

        if (message.length > 2000) {
          showStatus('Sua mensagem deve ter até 2.000 caracteres.', 'error');
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Enviando sua dúvida…';
        }

        var payload = {
          name: name.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          message: message.trim(),
          newsletter: { email: optEmail, whatsapp: optWhatsapp },
          timestamp: new Date().toISOString()
        };

        fetch('/api/embarcados-contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (res) {
            if (res.ok) {
              return res.json().catch(function () { return {}; });
            }
            throw new Error(res.status.toString());
          })
          .then(function () {
            showStatus('Sua dúvida foi recebida pela equipe. A resposta será enviada ao contato informado.', 'success');
            form.reset();
            if (charCount) charCount.textContent = '0 / 2000';
          })
          .catch(function (err) {
            // Se o endpoint não estiver configurado (ex.: 404 em ambiente de preview/locaweb), informar os canais alternativos com elegância
            showStatus(
              'O formulário ainda não está disponível. Use os canais de contato abaixo (WhatsApp Royal Trip ou organização) para tirar sua dúvida.',
              'error'
            );
          })
          .finally(function () {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Enviar dúvida à equipe';
            }
          });
      });
    }

    function showStatus(text, type) {
      if (!statusBox) return;
      statusBox.textContent = text;
      statusBox.className = 'form-status-box form-status-box--' + type;
      statusBox.style.display = 'block';
      statusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // --------------------------------------------------------------------------
  // ABAS DO CHECKLIST (#18 UX OPTIMIZATION)
  // --------------------------------------------------------------------------
  function initChecklistTabs() {
    var tabs = document.querySelectorAll('.checklist-tab');
    var groups = document.querySelectorAll('.checklist-group');
    if (!tabs.length || !groups.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');

        var targetGroup = tab.getAttribute('data-group');
        groups.forEach(function (group) {
          if (targetGroup === 'all' || group.getAttribute('data-group-id') === targetGroup) {
            group.classList.remove('is-hidden');
          } else {
            group.classList.add('is-hidden');
          }
        });
      });
    });
  }

  // --------------------------------------------------------------------------
  // ABAS DO CRONOGRAMA (#19 UX OPTIMIZATION)
  // --------------------------------------------------------------------------
  function initTimelineTabs() {
    var tabs = document.querySelectorAll('.timeline-tab');
    var steps = document.querySelectorAll('.timeline-step');
    if (!tabs.length || !steps.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');

        var targetPhase = tab.getAttribute('data-phase');
        steps.forEach(function (step) {
          if (targetPhase === 'all' || step.getAttribute('data-timeline-phase') === targetPhase) {
            step.classList.remove('is-hidden');
          } else {
            step.classList.add('is-hidden');
          }
        });
      });
    });
  }

  // --------------------------------------------------------------------------
  // FERRAMENTAS DO FAQ (EXPANDIR/RECOLHER TUDO)
  // --------------------------------------------------------------------------
  function initFAQTools() {
    var expandBtn = document.querySelector('[data-faq-action="expand-all"]');
    var collapseBtn = document.querySelector('[data-faq-action="collapse-all"]');
    var faqItems = document.querySelectorAll('#duvidas details.faq-item');

    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        faqItems.forEach(function (item) {
          if (item.style.display !== 'none') {
            item.open = true;
          }
        });
      });
    }

    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        faqItems.forEach(function (item) {
          item.open = false;
        });
      });
    }
  }

  // --------------------------------------------------------------------------
  // ATIVAÇÃO DE LINKS DE NAVEGAÇÃO AO ROLAR (INTERSECTION OBSERVER)
  // --------------------------------------------------------------------------
  function initNavSpy() {
    var navLinks = document.querySelectorAll('.guide-nav-bar__link');
    var dockLinks = document.querySelectorAll('.guide-quick-dock__item');
    var sections = document.querySelectorAll('section[id]');
    if (!sections.length) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var id = entry.target.getAttribute('id');
              navLinks.forEach(function (link) {
                var href = link.getAttribute('href');
                if (href === '#' + id) {
                  link.classList.add('is-active');
                } else {
                  link.classList.remove('is-active');
                }
              });
              dockLinks.forEach(function (dLink) {
                var dHref = dLink.getAttribute('href');
                if (dHref === '#' + id) {
                  dLink.classList.add('is-active');
                } else {
                  dLink.classList.remove('is-active');
                }
              });
            }
          });
        },
        { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
      );

      sections.forEach(function (sec) {
        observer.observe(sec);
      });
    }
  }

  // --------------------------------------------------------------------------
  // INICIALIZAÇÃO GERAL
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    initHeroSlider();
    initHeroLiveCinema();
    initCountdown();
    initChecklist();
    initChecklistTabs();
    initTimelineTabs();
    initFAQ();
    initFAQTools();
    initLiveModule();
    initLiveModal();
    initSupportModal();
    initNavSpy();
  });
})();
