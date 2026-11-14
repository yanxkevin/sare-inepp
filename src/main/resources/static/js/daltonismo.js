/* =====================================================================
 * SARE INEP — Acessibilidade para daltonismo
 * =====================================================================
 * Adiciona à página um botão "Modo daltônico" (canto inferior esquerdo).
 * A pessoa liga o modo e escolhe o seu tipo de daltonismo. Então:
 *
 * 1) A PÁGINA INTEIRA tem as cores ajustadas para aquele tipo
 *    ("daltonização"). As diferenças de cor que a pessoa não percebe
 *    (ex.: vermelho x verde) são deslocadas para tons que ela percebe.
 *
 * 2) O GRÁFICO troca o verde/vermelho por uma paleta segura
 *    (Okabe-Ito: azul e laranja) e ganha TEXTURAS nas barras, com a
 *    biblioteca Patternomaly. Assim a informação não depende só da cor
 *    (WCAG 2.2, critério 1.4.1 "Uso de cor").
 *
 * Bibliotecas usadas (carregadas no index.html):
 *    - Chart.js ...... desenha o gráfico (já fazia parte do projeto)
 *    - Patternomaly .. cria as texturas — github.com/ashiguruma/patternomaly
 *
 * Base científica da correção:
 *    - Simulação de cada tipo: Machado, Oliveira e Fernandes (2009)
 *    - Daltonização: Fidaner, Lin e Ozguven (2005), com uma melhoria nossa:
 *      o brilho de cada cor é preservado, para o contraste dos textos não piorar
 *
 * O arquivo também deixa uma pequena API disponível no navegador:
 *    Daltonismo.ativarModo(true)              // liga (ou false para desligar)
 *    Daltonismo.escolherTipo('protanopia')    // ou 'deuteranopia', 'tritanopia'
 * ===================================================================== */
(function () {
    'use strict';

    // -----------------------------------------------------------------
    // 1. CONFIGURAÇÕES
    // -----------------------------------------------------------------

    // Paleta Okabe-Ito: as cores continuam diferentes entre si
    // para os principais tipos de daltonismo.
    const PALETA_SEGURA = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00'];

    // Uma textura da Patternomaly para cada série do gráfico
    // (1ª série: pontos, 2ª série: listras diagonais, ...).
    const TEXTURAS = ['dot', 'diagonal', 'cross', 'dash', 'zigzag', 'line-vertical'];

    // Tipos de daltonismo.
    // - "simulacao": matriz de Machado et al. (2009), que descreve como
    //   aquele tipo de olho percebe as cores.
    // - "ajuste": para onde vai a informação de cor que a pessoa não enxerga.
    //   Valores escolhidos para deixar as cores do SARE (azul, verde, vermelho,
    //   laranja e azul-escuro) o mais diferentes possível entre si para aquele tipo.
    const TIPOS = {
        protanopia: {
            nome: 'Protanopia',
            descricao: 'Dificuldade com o vermelho',
            simulacao: [[0.152286, 1.052583, -0.204868],
                [0.114503, 0.786281, 0.099216],
                [-0.003882, -0.048116, 1.051998]],
            ajuste: [[0, 0, 0],
                [-0.7, 0.7, 1.0],
                [-0.7, 1.0, -0.7]]
        },
        deuteranopia: {
            nome: 'Deuteranopia',
            descricao: 'Dificuldade com o verde',
            simulacao: [[0.367322, 0.860646, -0.227968],
                [0.280085, 0.672501, 0.047413],
                [-0.011820, 0.042940, 0.968881]],
            ajuste: [[0, 0, 0],
                [-0.7, 0.35, 0.35],
                [0.7, 1.0, 1.0]]
        },
        tritanopia: {
            nome: 'Tritanopia',
            descricao: 'Dificuldade com o azul',
            simulacao: [[1.255528, -0.076749, -0.178779],
                [-0.078411, 0.930809, 0.147602],
                [0.004733, 0.691367, 0.303900]],
            ajuste: [[-0.35, -0.7, 1.0],
                [-0.7, 1.0, -0.7],
                [0, 0, 0]]
        }
    };

    // Peso de cada cor no brilho que o olho percebe (vermelho, verde, azul)
    const LUMINANCIA = [0.2126, 0.7152, 0.0722];
    const TIPO_PADRAO = 'deuteranopia';

    // Nomes usados para lembrar as escolhas do usuário no navegador
    const CHAVE_MODO = 'sare-inep:modo-daltonico';
    const CHAVE_TIPO = 'sare-inep:tipo-daltonismo';

    const estado = {
        ligado: lerPreferencia(CHAVE_MODO) === 'ligado',
        tipo: TIPOS[lerPreferencia(CHAVE_TIPO)] ? lerPreferencia(CHAVE_TIPO) : TIPO_PADRAO
    };

    // -----------------------------------------------------------------
    // 2. CORREÇÃO DE CORES DA PÁGINA (daltonização)
    // -----------------------------------------------------------------
    // Passo 1 (daltonização):
    //   cor corrigida = cor + AJUSTE × (cor − cor como o daltônico vê)
    //   Em forma de matriz: D = I + AJUSTE × (I − SIMULAÇÃO)
    // Passo 2 (melhoria nossa): devolve a cada cor o brilho que ela tinha para o
    //   daltônico. Assim só o TOM muda, e o contraste dos textos não piora.
    // O navegador aplica a matriz final na página inteira com um filtro SVG.

    function multiplicar(a, b) {
        return a.map((linha) => b[0].map((_, j) => linha.reduce((soma, valor, k) => soma + valor * b[k][j], 0)));
    }

    function matrizDeCorrecao(tipo) {
        const identidade = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        const { simulacao, ajuste } = TIPOS[tipo];

        // Passo 1: D = I + AJUSTE × (I − SIMULAÇÃO)
        const corPerdida = identidade.map((linha, i) => linha.map((valor, j) => valor - simulacao[i][j]));
        const deslocamento = multiplicar(ajuste, corPerdida);
        const D = identidade.map((linha, i) => linha.map((valor, j) => valor + deslocamento[i][j]));

        // Passo 2: brilho percebido pelo daltônico antes (L×S) e depois (L×S×D) da correção
        const brilhoAntes = multiplicar([LUMINANCIA], simulacao)[0];
        const brilhoDepois = multiplicar([brilhoAntes], D)[0];
        // Soma a diferença igualmente em R, G e B (só clareia/escurece, sem mudar o tom)
        return D.map((linha) => linha.map((valor, j) => valor + brilhoAntes[j] - brilhoDepois[j]));
    }

    function criarFiltrosSvg() {
        let filtros = '';

        for (const tipo of Object.keys(TIPOS)) {
            const m = matrizDeCorrecao(tipo);
            // O feColorMatrix usa uma matriz 4x5 (vermelho, verde, azul, transparência)
            const valores = [
                m[0][0], m[0][1], m[0][2], 0, 0,
                m[1][0], m[1][1], m[1][2], 0, 0,
                m[2][0], m[2][1], m[2][2], 0, 0,
                0, 0, 0, 1, 0
            ].map((n) => n.toFixed(6)).join(' ');
            filtros += `<filter id="a11y-correcao-${tipo}" color-interpolation-filters="linearRGB">` +
                `<feColorMatrix type="matrix" values="${valores}"/></filter>`;
        }

        document.getElementById('a11y-raiz').insertAdjacentHTML('beforeend',
            `<svg class="a11y-svg" aria-hidden="true" focusable="false"><defs>${filtros}</defs></svg>`);
    }

    function aplicarCorrecaoNaPagina() {
        // O filtro vai no elemento <html>, então vale para a página inteira
        document.documentElement.style.filter = estado.ligado ? `url(#a11y-correcao-${estado.tipo})` : '';
    }

    // -----------------------------------------------------------------
    // 3. GRÁFICO: PALETA SEGURA + TEXTURAS (plugin do Chart.js)
    // -----------------------------------------------------------------
    // O Chart.js chama este plugin antes de cada atualização do gráfico.
    // Por isso não precisamos mexer no script.js: qualquer gráfico criado
    // na página passa por aqui e recebe as cores certas.

    const texturasCriadas = new Map(); // guarda as texturas para não recriar

    function criarTextura(nomeTextura, cor) {
        const chave = nomeTextura + '|' + cor;
        if (!texturasCriadas.has(chave)) {
            texturasCriadas.set(chave, window.pattern.draw(nomeTextura, cor));
        }
        return texturasCriadas.get(chave);
    }

    const pluginModoDaltonico = {
        id: 'modoDaltonico',
        beforeUpdate(grafico) {
            const patternomalyCarregada = window.pattern && typeof window.pattern.draw === 'function';

            grafico.data.datasets.forEach((serie, indice) => {
                // Na primeira vez, guarda a cor original para poder voltar depois
                if (!('_corOriginal' in serie)) {
                    serie._corOriginal = serie.backgroundColor;
                }

                if (!estado.ligado) {
                    serie.backgroundColor = serie._corOriginal;
                    return;
                }

                const cor = PALETA_SEGURA[indice % PALETA_SEGURA.length];
                const textura = TEXTURAS[indice % TEXTURAS.length];

                // Se a Patternomaly não carregou (sem internet), usa só a paleta segura
                serie.backgroundColor = patternomalyCarregada ? criarTextura(textura, cor) : cor;
            });
        }
    };

    let pluginRegistrado = false;

    function registrarPlugin() {
        if (pluginRegistrado || !window.Chart) return;
        window.Chart.register(pluginModoDaltonico);
        pluginRegistrado = true;
    }

    function redesenharGraficos() {
        if (!window.Chart || !window.Chart.instances) return;
        Object.values(window.Chart.instances).forEach((grafico) => grafico.update());
    }

    // -----------------------------------------------------------------
    // 4. PAINEL (interface)
    // -----------------------------------------------------------------

    const ESTILOS = `
        #a11y-raiz, #a11y-raiz * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }
        #a11y-raiz .a11y-svg { position: absolute; width: 0; height: 0; overflow: hidden; }

        #a11y-raiz .a11y-abrir {
            position: fixed; left: 20px; bottom: 20px; z-index: 9999;
            display: inline-flex; align-items: center; gap: 8px;
            width: auto; margin: 0; padding: 12px 18px;
            background: #1e3a8a; color: #fff; border: none; border-radius: 999px;
            font-size: 15px; font-weight: 600; cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); opacity: 1;
        }
        #a11y-raiz .a11y-abrir:hover { background: #1d4ed8; opacity: 1; }
        #a11y-raiz .a11y-abrir-estado { font-weight: 400; }

        #a11y-raiz .a11y-painel {
            position: fixed; left: 20px; bottom: 80px; z-index: 9999;
            width: 320px; max-width: calc(100vw - 40px); max-height: calc(100vh - 110px); overflow-y: auto;
            background: #fff; color: #1f2937; border-radius: 12px; padding: 20px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        #a11y-raiz .a11y-painel[hidden] { display: none; }

        #a11y-raiz .a11y-cabecalho {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 15px;
        }
        #a11y-raiz h2 { margin: 0; font-size: 1.2rem; color: #1e3a8a; }
        #a11y-raiz .a11y-fechar {
            width: 36px; height: 36px; margin: 0; padding: 0;
            background: transparent; color: #374151; border: none; border-radius: 6px;
            font-size: 24px; line-height: 1; cursor: pointer; opacity: 1;
        }
        #a11y-raiz .a11y-fechar:hover { background: #f3f4f6; opacity: 1; }

        #a11y-raiz .a11y-secao { margin: 0 0 16px; padding: 0; border: none; }
        #a11y-raiz legend { padding: 0; margin-bottom: 8px; font-weight: 600; font-size: 0.95rem; color: #374151; }
        #a11y-raiz small { display: block; font-size: 0.82rem; color: #4b5563; font-weight: 400; }

        /* Chave liga/desliga */
        #a11y-raiz .a11y-chave { display: flex; align-items: center; gap: 12px; cursor: pointer; }
        #a11y-raiz .a11y-chave input { position: absolute; opacity: 0; width: 1px; height: 1px; }
        #a11y-raiz .a11y-trilho {
            flex-shrink: 0; position: relative; width: 46px; height: 26px;
            background: #6b7280; border-radius: 999px; transition: background 0.2s;
        }
        #a11y-raiz .a11y-trilho::after {
            content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px;
            background: #fff; border-radius: 50%; transition: transform 0.2s;
        }
        #a11y-raiz .a11y-chave input:checked + .a11y-trilho { background: #1d4ed8; }
        #a11y-raiz .a11y-chave input:checked + .a11y-trilho::after { transform: translateX(20px); }

        /* Escolha do tipo */
        #a11y-raiz .a11y-opcao {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 8px 10px; margin-bottom: 4px; border-radius: 8px; cursor: pointer;
        }
        #a11y-raiz .a11y-opcao:hover { background: #f3f4f6; }
        #a11y-raiz .a11y-opcao input { width: 18px; height: 18px; margin: 2px 0 0; accent-color: #1d4ed8; }
        #a11y-raiz fieldset:disabled .a11y-opcao { opacity: 0.55; cursor: not-allowed; }
        #a11y-raiz fieldset:disabled .a11y-opcao:hover { background: transparent; }
        #a11y-raiz .a11y-nota { margin: 0; font-size: 0.8rem; color: #4b5563; }

        /* Contorno de foco bem visível para quem navega pelo teclado */
        #a11y-raiz button:focus-visible,
        #a11y-raiz .a11y-opcao input:focus-visible,
        #a11y-raiz .a11y-chave input:focus-visible + .a11y-trilho {
            outline: 3px solid #1d4ed8; outline-offset: 3px;
        }

        /* Texto lido só por leitores de tela */
        #a11y-raiz .a11y-somente-leitor {
            position: absolute; width: 1px; height: 1px; overflow: hidden;
            clip: rect(0 0 0 0); white-space: nowrap;
        }

        @media (prefers-reduced-motion: reduce) {
            #a11y-raiz .a11y-trilho, #a11y-raiz .a11y-trilho::after { transition: none; }
        }
    `;

    function criarPainel() {
        const estilo = document.createElement('style');
        estilo.textContent = ESTILOS;
        document.head.appendChild(estilo);

        const opcoesTipo = Object.entries(TIPOS).map(([tipo, info]) => `
            <label class="a11y-opcao">
                <input type="radio" name="a11y-tipo" value="${tipo}">
                <span><strong>${info.nome}</strong><small>${info.descricao}</small></span>
            </label>`).join('');

        const raiz = document.createElement('div');
        raiz.id = 'a11y-raiz';
        raiz.innerHTML = `
            <button type="button" class="a11y-abrir" aria-expanded="false" aria-controls="a11y-painel">
                <span aria-hidden="true">👁</span>
                <span>Modo daltônico:</span>
                <span class="a11y-abrir-estado"></span>
            </button>

            <section id="a11y-painel" class="a11y-painel" aria-labelledby="a11y-titulo" hidden>
                <div class="a11y-cabecalho">
                    <h2 id="a11y-titulo">Modo daltônico</h2>
                    <button type="button" class="a11y-fechar" aria-label="Fechar painel do modo daltônico">×</button>
                </div>

                <div class="a11y-secao">
                    <label class="a11y-chave">
                        <input type="checkbox" role="switch" id="a11y-ligar">
                        <span class="a11y-trilho" aria-hidden="true"></span>
                        <span><strong>Ativar modo daltônico</strong><small>Ajusta as cores do site e do gráfico</small></span>
                    </label>
                </div>

                <fieldset class="a11y-secao a11y-tipos">
                    <legend>Qual é o seu tipo de daltonismo?</legend>
                    ${opcoesTipo}
                </fieldset>

                <p class="a11y-nota">As cores da página inteira são ajustadas para o tipo escolhido,
                    e o gráfico também ganha texturas.</p>
            </section>

            <p class="a11y-somente-leitor" role="status" aria-live="polite"></p>
        `;
        document.body.appendChild(raiz);

        const botaoAbrir = raiz.querySelector('.a11y-abrir');
        const painel = raiz.querySelector('.a11y-painel');

        function abrirOuFecharPainel(abrir) {
            painel.hidden = !abrir;
            botaoAbrir.setAttribute('aria-expanded', String(abrir));
            if (abrir) raiz.querySelector('#a11y-ligar').focus();
        }

        botaoAbrir.addEventListener('click', () => abrirOuFecharPainel(painel.hidden));

        raiz.querySelector('.a11y-fechar').addEventListener('click', () => {
            abrirOuFecharPainel(false);
            botaoAbrir.focus();
        });

        // Tecla Esc fecha o painel e devolve o foco ao botão
        painel.addEventListener('keydown', (evento) => {
            if (evento.key === 'Escape') {
                abrirOuFecharPainel(false);
                botaoAbrir.focus();
            }
        });

        raiz.querySelector('#a11y-ligar').addEventListener('change', (evento) => {
            ativarModo(evento.target.checked);
        });

        raiz.querySelectorAll('input[name="a11y-tipo"]').forEach((opcao) => {
            opcao.addEventListener('change', () => escolherTipo(opcao.value));
        });

        atualizarPainel();
    }

    // Deixa o painel e o botão de acordo com o estado atual
    function atualizarPainel() {
        const raiz = document.getElementById('a11y-raiz');
        if (!raiz) return;

        raiz.querySelector('#a11y-ligar').checked = estado.ligado;
        raiz.querySelector('.a11y-tipos').disabled = !estado.ligado;
        raiz.querySelector(`input[name="a11y-tipo"][value="${estado.tipo}"]`).checked = true;
        raiz.querySelector('.a11y-abrir-estado').textContent =
            estado.ligado ? TIPOS[estado.tipo].nome : 'Desligado';
    }

    // Avisa leitores de tela sobre a mudança
    function anunciar(mensagem) {
        const regiao = document.querySelector('#a11y-raiz [role="status"]');
        if (regiao) regiao.textContent = mensagem;
    }

    // -----------------------------------------------------------------
    // 5. AÇÕES (também disponíveis como API: window.Daltonismo)
    // -----------------------------------------------------------------

    function aplicarTudo() {
        aplicarCorrecaoNaPagina();
        redesenharGraficos();
        atualizarPainel();
    }

    function ativarModo(ligado) {
        estado.ligado = Boolean(ligado);
        salvarPreferencia(CHAVE_MODO, estado.ligado ? 'ligado' : 'desligado');
        aplicarTudo();
        anunciar(estado.ligado
            ? `Modo daltônico ativado para ${TIPOS[estado.tipo].nome}.`
            : 'Modo daltônico desativado. As cores voltaram ao original.');
    }

    function escolherTipo(tipo) {
        if (!TIPOS[tipo]) return;
        estado.tipo = tipo;
        salvarPreferencia(CHAVE_TIPO, tipo);
        aplicarTudo();
        anunciar(`Cores ajustadas para ${TIPOS[tipo].nome}.`);
    }

    // -----------------------------------------------------------------
    // 6. PREFERÊNCIAS SALVAS NO NAVEGADOR
    // -----------------------------------------------------------------

    function lerPreferencia(chave) {
        try {
            return localStorage.getItem(chave);
        } catch (erro) {
            return null; // navegador bloqueou o armazenamento: segue sem lembrar
        }
    }

    function salvarPreferencia(chave, valor) {
        try {
            localStorage.setItem(chave, valor);
        } catch (erro) {
            // Sem armazenamento disponível: a escolha vale só até recarregar a página
        }
    }

    // -----------------------------------------------------------------
    // 7. INICIALIZAÇÃO
    // -----------------------------------------------------------------

    function iniciar() {
        registrarPlugin();
        criarPainel();
        criarFiltrosSvg();
        aplicarTudo();
    }

    window.Daltonismo = { ativarModo, escolherTipo };

    registrarPlugin(); // registra já, para pegar o gráfico desde a primeira vez
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
