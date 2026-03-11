(function(){
  const base = window.pokedexEstado;
  const e = base.elementos;
  let tiposInicializados = false;
  let gerandoEstrategia = false;
  let rodandoTeste = false;

  function obterEstadoAtual(dadosEstado){
    return dadosEstado || base.estadoTela.estadoAtual || {};
  }

  function obterPokemonsDisponiveis(dadosEstado){
    const mapa = new Map();
    for (const pokemon of (dadosEstado?.pokemons || [])){
      mapa.set(Number(pokemon.id), pokemon);
    }
    for (const pokemon of (dadosEstado?.ranking || [])){
      if (!mapa.has(Number(pokemon.id))){
        mapa.set(Number(pokemon.id), pokemon);
      }
    }
    return Array.from(mapa.values()).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  }

  function normalizarPrioridades(disponiveis){
    const idsDisponiveis = new Set(disponiveis.map((pokemon) => Number(pokemon.id)));
    base.estadoTela.idsPrioritariosEstrategia = (base.estadoTela.idsPrioritariosEstrategia || []).filter((id) => idsDisponiveis.has(Number(id)));
  }

  function abrirEstrategia(){
    if (!e.telaEstrategia){
      return null;
    }
    e.telaEstrategia.classList.add("aberta");
    preencherTipos();
    desenharEstrategia(base.estadoTela.estadoAtual?.estrategia, base.estadoTela.estadoAtual);
    atualizarStatus(base.estadoTela.estadoAtual);
    return e.telaEstrategia;
  }

  function fecharEstrategia(){
    if (!e.telaEstrategia){
      return;
    }
    e.telaEstrategia.classList.remove("aberta");
  }

  function textoTipo(valor){
    return String(valor || "").replace(/-/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
  }

  function escapar(texto){
    return String(texto || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function criarOpcao(valor, rotulo){
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = rotulo;
    return option;
  }

  function formatarNumero(valor){
    const numero = Number(valor || 0);
    if (!Number.isFinite(numero)){
      return "0";
    }
    if (Math.abs(numero % 1) < 0.001){
      return String(Math.round(numero));
    }
    return numero.toFixed(1);
  }

  function formatarDataIso(valor){
    if (!valor){
      return "agora";
    }
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())){
      return "agora";
    }
    return data.toLocaleString("pt-BR");
  }

  function formatarRotulo(chave){
    return String(chave || "").replace(/_/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
  }

  function atualizarAcoesEstrategia(){
    const bloqueado = gerandoEstrategia || rodandoTeste;
    if (e.botaoGerarEstrategia){
      e.botaoGerarEstrategia.disabled = bloqueado;
    }
    if (e.botaoTestarEstrategia){
      e.botaoTestarEstrategia.disabled = bloqueado;
    }
  }

  function preencherTipos(){
    if (tiposInicializados || !e.seletorTipoAlvoPrimario || !e.seletorTipoAlvoSecundario){
      return;
    }
    const tipos = window.dadosProjeto?.tiposPokemonDisponiveis || [];
    const seletores = [e.seletorTipoAlvoPrimario, e.seletorTipoAlvoSecundario];
    for (const seletor of seletores){
      seletor.innerHTML = "";
      seletor.appendChild(criarOpcao("", "Sem alvo definido"));
      for (const tipo of tipos){
        seletor.appendChild(criarOpcao(tipo, textoTipo(tipo)));
      }
    }
    tiposInicializados = true;
  }

  function desenharVazio(mensagem){
    e.painelEstrategia.innerHTML =
      "<div class='vazio-estrategia'>" +
        "<div class='vazio-estrategia-painel'>" +
          "<span class='estrategia-selo-vazio'>Battle Screen</span>" +
          "<strong>Aguardando estrategia</strong>" +
          "<p>" + escapar(mensagem) + "</p>" +
        "</div>" +
      "</div>";
  }

  function criarCardSelecionado(pokemon){
    return (
      "<article class='selecionado-estrategia-item'>" +
        "<img src='" + escapar(pokemon.imagem || "") + "' alt='" + escapar(pokemon.nome || "pokemon") + "'>" +
        "<div>" +
          "<strong>" + escapar(base.tituloNome(pokemon.nome || "")) + "</strong>" +
          "<em class='selecionado-status'>Locked</em>" +
          "<span>#" + escapar(pokemon.id) + " | " + escapar(pokemon.papel_tatico || "equilibrado") + "</span>" +
        "</div>" +
      "</article>"
    );
  }

  function desenharPainelTeste(teste){
    if (!teste){
      return (
        "<section class='teste-estrategia teste-estrategia-vazio'>" +
          "<div class='teste-topo'>" +
            "<strong>Teste tatico</strong>" +
            "<span>Rode o teste depois de gerar o plano para medir valor, personagens e cenarios.</span>" +
          "</div>" +
        "</section>"
      );
    }

    const metricas = Object.entries(teste.metricas || {}).map(([chave, valor]) => (
      "<article class='teste-metrica'>" +
        "<span>" + escapar(formatarRotulo(chave)) + "</span>" +
        "<strong>" + escapar(formatarNumero(valor)) + "/100</strong>" +
      "</article>"
    )).join("");

    const personagens = (teste.personagens || []).map((personagem) => (
      "<article class='teste-personagem'>" +
        "<img src='" + escapar(personagem.imagem || "") + "' alt='" + escapar(personagem.nome || "pokemon") + "'>" +
        "<div>" +
          "<strong>" + escapar(base.tituloNome(personagem.nome || "")) + "</strong>" +
          "<span>Slot " + escapar(personagem.slot) + " | " + escapar(personagem.papel_tatico || "equilibrado") + "</span>" +
          "<span>Valor tatico " + escapar(formatarNumero(personagem.valor_tatico)) + "/100" + (personagem.prioridade_manual ? " | prioridade manual" : "") + "</span>" +
          "<p>" + escapar(personagem.leitura || "") + "</p>" +
          "<em class='teste-golpe'>Golpe-chave: " + escapar(personagem.melhor_golpe?.nome || "nao definido") + " | " + escapar(textoTipo(personagem.melhor_golpe?.tipo || "")) + " | x" + escapar(formatarNumero(personagem.melhor_golpe?.multiplicador_alvo || 1)) + "</em>" +
        "</div>" +
      "</article>"
    )).join("") || "<div class='vazio-capturados-estrategia'>Nenhum personagem analisado no teste.</div>";

    const cenarios = (teste.cenarios || []).map((cenario) => (
      "<article class='teste-cenario'>" +
        "<div class='teste-cenario-topo'>" +
          "<strong>" + escapar(cenario.nome || "") + "</strong>" +
          "<span>" + escapar(formatarNumero(cenario.valor)) + "/100</span>" +
        "</div>" +
        "<p>" + escapar(cenario.leitura || "") + "</p>" +
      "</article>"
    )).join("") || "<div class='vazio-capturados-estrategia'>Nenhum cenario disponivel.</div>";

    const recomendacoes = (teste.recomendacoes || []).map((item) => "<li>" + escapar(item) + "</li>").join("") || "<li>Sem recomendacoes adicionais.</li>";

    return (
      "<section class='teste-estrategia'>" +
        "<div class='teste-topo'>" +
          "<strong>Teste tatico concluido</strong>" +
          "<span>Ultima simulacao em " + escapar(formatarDataIso(teste.rodado_em)) + "</span>" +
        "</div>" +
        "<div class='teste-valor'>" +
          "<span>Valor da estrategia</span>" +
          "<strong>" + escapar(formatarNumero(teste.valor_estrategia)) + "/100</strong>" +
          "<em>" + escapar(formatarRotulo(teste.classificacao || "em avaliacao")) + "</em>" +
        "</div>" +
        "<div class='teste-metricas-grid'>" + metricas + "</div>" +
        "<div class='teste-listas-grid'>" +
          "<div class='teste-coluna'>" +
            "<strong>Personagens em campo</strong>" +
            "<div class='teste-personagens'>" + personagens + "</div>" +
          "</div>" +
          "<div class='teste-coluna'>" +
            "<strong>Cenarios simulados</strong>" +
            "<div class='teste-cenarios'>" + cenarios + "</div>" +
          "</div>" +
          "<div class='teste-coluna'>" +
            "<strong>Leitura final</strong>" +
            "<ul>" + recomendacoes + "</ul>" +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  function togglePrioridadePokemon(idPokemon){
    const ids = new Set(base.estadoTela.idsPrioritariosEstrategia || []);
    const id = Number(idPokemon);
    if (ids.has(id)){
      ids.delete(id);
    } else {
      ids.add(id);
    }
    base.estadoTela.idsPrioritariosEstrategia = Array.from(ids);
    desenharSelecaoCapturados(base.estadoTela.estadoAtual);
  }

  function desenharSelecaoCapturados(dadosEstado){
    if (!e.listaCapturadosEstrategia || !e.selecionadosEstrategia){
      return;
    }

    const disponiveis = obterPokemonsDisponiveis(obterEstadoAtual(dadosEstado));
    normalizarPrioridades(disponiveis);
    const idsPrioritarios = new Set(base.estadoTela.idsPrioritariosEstrategia || []);
    const filtro = String(e.inputBuscaCapturadosEstrategia?.value || "").trim().toLowerCase();

    const selecionados = disponiveis.filter((pokemon) => idsPrioritarios.has(Number(pokemon.id)));
    const filtrados = disponiveis.filter((pokemon) => {
      if (!filtro){
        return true;
      }
      const nome = String(pokemon.nome || "").toLowerCase();
      const id = String(pokemon.id || "");
      return nome.includes(filtro) || id.includes(filtro);
    });

    if (e.contadorPrioridadesEstrategia){
      e.contadorPrioridadesEstrategia.textContent = selecionados.length + " priorizados";
    }
    if (e.contadorCapturadosEstrategia){
      e.contadorCapturadosEstrategia.textContent = disponiveis.length + " disponiveis";
    }

    if (selecionados.length > 0){
      e.selecionadosEstrategia.innerHTML = selecionados.map(criarCardSelecionado).join("");
    } else {
      e.selecionadosEstrategia.innerHTML = "<div class='selecionados-vazio'>Os Pokemon priorizados aparecem aqui em tempo real.</div>";
    }

    if (filtrados.length === 0){
      e.listaCapturadosEstrategia.innerHTML = "<div class='vazio-capturados-estrategia'>Nenhum capturado combina com a busca atual.</div>";
      return;
    }

    e.listaCapturadosEstrategia.innerHTML = "";
    for (const pokemon of filtrados){
      const item = document.createElement("button");
      item.type = "button";
      item.className = "capturado-estrategia" + (idsPrioritarios.has(Number(pokemon.id)) ? " ativo" : "");
      item.innerHTML =
        "<img src='" + escapar(pokemon.imagem || "") + "' alt='" + escapar(pokemon.nome || "pokemon") + "'>" +
        "<div class='capturado-estrategia-info'>" +
          "<strong>" + escapar(base.tituloNome(pokemon.nome || "")) + "</strong>" +
          "<span>#" + escapar(pokemon.id) + " | " + escapar(pokemon.papel_tatico || "equilibrado") + "</span>" +
        "</div>";
      item.addEventListener("click", () => togglePrioridadePokemon(pokemon.id));
      e.listaCapturadosEstrategia.appendChild(item);
    }
  }

  function aplicarEstrategiaNoEstadoLocal(estrategia){
    const estadoAnterior = base.estadoTela.estadoAtual || {};
    base.estadoTela.estadoAtual = { ...estadoAnterior, estrategia: estrategia || {} };
  }

  function desenharEstrategia(estrategia, dadosEstado){
    const dados = obterEstadoAtual(dadosEstado);
    const resultado = estrategia || dados.estrategia || {};
    const time = Array.isArray(resultado.time) ? resultado.time : [];
    const preferencias = resultado.preferencias || {};
    const parametros = resultado.parametros || {};
    const estiloNome = window.dadosProjeto?.estilosEstrategiaDisponiveis?.[parametros.estilo] || formatarRotulo(parametros.estilo || "equilibrada");

    preencherTipos();
    desenharSelecaoCapturados(dados);
    atualizarAcoesEstrategia();

    if (!time.length){
      const temCaptura = (dados?.pokemons?.length || 0) > 0 || (dados?.ranking?.length || 0) > 0;
      desenharVazio(temCaptura ? "Monte uma estrategia para ver o time sugerido, os personagens, os golpes e o teste tatico." : "Colete Pokemon antes de montar a estrategia.");
      return;
    }

    const preferidos = (preferencias.priorizados_encontrados || []).map((pokemon) => criarCardSelecionado(pokemon)).join("");
    const plano = (resultado.plano_batalha || []).map((item) => "<li>" + escapar(item) + "</li>").join("") || "<li>Plano tatico indisponivel.</li>";
    const cobertura = (resultado.cobertura || []).map((item) => "<li>" + escapar(item) + "</li>").join("") || "<li>Sem leitura de cobertura.</li>";
    const riscos = (resultado.riscos || []).map((item) => "<li>" + escapar(item) + "</li>").join("") || "<li>Sem riscos destacados.</li>";
    const painelTeste = desenharPainelTeste(resultado.teste);

    const cards = time.map((pokemon) => {
      const golpes = (pokemon.golpes_recomendados || []).slice(0, 3).map((golpe) => (
        "<li>" +
          "<strong>" + escapar(golpe.nome_exibicao || golpe.nome || "") + "</strong>" +
          "<span>" + escapar((golpe.classe || "") + " | " + textoTipo(golpe.tipo || "") + " | x" + formatarNumero(golpe.multiplicador_alvo || 1)) + "</span>" +
        "</li>"
      )).join("") || "<li><strong>Sem golpes sugeridos</strong><span>Gere outra estrategia para recalcular a ofensiva.</span></li>";

      const razoes = (pokemon.razoes || []).slice(0, 3).map((item) => "<li>" + escapar(item) + "</li>").join("") || "<li>Sem leitura adicional.</li>";

      return (
        "<article class='estrategia-card" + (pokemon.prioridade_manual ? " estrategia-card-prioritario" : "") + "'>" +
          "<div class='estrategia-card-topo'>" +
            "<span class='estrategia-slot'>Slot " + escapar(pokemon.slot) + "</span>" +
            "<span class='estrategia-score'>" + escapar(formatarNumero(pokemon.score_estrategia)) + "/100</span>" +
          "</div>" +
          (pokemon.prioridade_manual ? "<div class='badge-prioritario'>Prioridade manual aplicada</div>" : "") +
          "<div class='estrategia-pokemon'>" +
            "<img src='" + escapar(pokemon.imagem || "") + "' alt='" + escapar(pokemon.nome || "pokemon") + "'>" +
            "<div>" +
              "<h4>" + escapar(base.tituloNome(pokemon.nome || "")) + "</h4>" +
              "<p>" + escapar((pokemon.papel_tatico || "equilibrado") + " | total " + (pokemon.total_stats || 0)) + "</p>" +
              "<div class='estrategia-tipos'>" + (pokemon.tipos || []).map((tipo) => "<span>" + escapar(textoTipo(tipo)) + "</span>").join("") + "</div>" +
            "</div>" +
          "</div>" +
          "<div class='estrategia-subbloco'><strong>Golpes</strong><ul>" + golpes + "</ul></div>" +
          "<div class='estrategia-subbloco'><strong>Leitura tatica</strong><ul>" + razoes + "</ul></div>" +
        "</article>"
      );
    }).join("");

    e.painelEstrategia.innerHTML =
      "<section class='estrategia-resumo'>" +
        "<div class='estrategia-resumo-topo'>" +
          "<div>" +
            "<span class='estrategia-meta'>Plano atual</span>" +
            "<h4>" + escapar(resultado.alvo?.descricao || "Cobertura geral") + "</h4>" +
            "<p>" + escapar(resultado.resumo || "Plano pronto para analise.") + "</p>" +
          "</div>" +
          "<div class='estrategia-resumo-grid'>" +
            "<article class='resumo-cartao'>" +
              "<span>Estilo</span>" +
              "<strong>" + escapar(estiloNome) + "</strong>" +
              "<em>Python + Selenium</em>" +
            "</article>" +
            "<article class='resumo-cartao'>" +
              "<span>Time</span>" +
              "<strong>" + escapar(time.length) + " slots</strong>" +
              "<em>gerado em " + escapar(formatarDataIso(resultado.gerada_em)) + "</em>" +
            "</article>" +
            "<article class='resumo-cartao'>" +
              "<span>Preferidos</span>" +
              "<strong>" + escapar((preferencias.ids_prioritarios || []).length) + " marcados</strong>" +
              "<em>" + escapar((preferencias.priorizados_encontrados || []).length) + " aplicados</em>" +
            "</article>" +
            "<article class='resumo-cartao'>" +
              "<span>Motor</span>" +
              "<strong>" + escapar(resultado.estatisticas?.movimentos_analisados || 0) + " golpes</strong>" +
              "<em>" + escapar(resultado.estatisticas?.pokemons_avaliados || 0) + " capturados avaliados</em>" +
            "</article>" +
          "</div>" +
        "</div>" +
        "<div class='estrategia-metricas'>" +
          "<span>" + escapar((resultado.estatisticas?.candidatos_analisados || 0) + " candidatos analisados") + "</span>" +
          "<span>" + escapar((resultado.alvo?.tipos || []).length + " tipos alvo") + "</span>" +
          "<span>" + escapar((resultado.preferencias?.ids_prioritarios || []).length + " priorizados") + "</span>" +
          "<span>" + escapar(Boolean(resultado.estatisticas?.gerado_com_selenium) ? "motor com Selenium ativo" : "motor tatico local") + "</span>" +
        "</div>" +
        ((resultado.preferencias?.priorizados_encontrados || []).length > 0
          ? "<div class='preferidos-estrategia'><strong>Preferidos aplicados</strong><div class='preferidos-estrategia-grid'>" + preferidos + "</div></div>"
          : "") +
      "</section>" +
      painelTeste +
      "<section class='estrategia-secao-titulo'><h4>Personagens da estrategia</h4><p>Veja quem entrou no plano, por qual motivo e quais golpes sustentam o ataque.</p></section>" +
      "<section class='estrategia-time'>" + cards + "</section>" +
      "<section class='estrategia-listas'>" +
        "<div class='estrategia-subbloco'><strong>Plano de batalha</strong><ul>" + plano + "</ul></div>" +
        "<div class='estrategia-subbloco'><strong>Cobertura</strong><ul>" + cobertura + "</ul></div>" +
        "<div class='estrategia-subbloco'><strong>Riscos</strong><ul>" + riscos + "</ul></div>" +
      "</section>";
  }

  function atualizarStatus(estadoAtual){
    if (!e.statusEstrategia){
      return;
    }
    if (rodandoTeste){
      e.statusEstrategia.textContent = "Rodando teste tatico da estrategia atual...";
      return;
    }
    if (gerandoEstrategia){
      e.statusEstrategia.textContent = "Gerando estrategia com Python + Selenium...";
      return;
    }

    const estrategiaAtual = estadoAtual?.estrategia || {};
    if (estrategiaAtual?.teste && Object.keys(estrategiaAtual.teste).length > 0){
      e.statusEstrategia.textContent = "Teste tatico pronto: valor " + formatarNumero(estrategiaAtual.teste.valor_estrategia) + "/100 com classificacao " + formatarRotulo(estrategiaAtual.teste.classificacao || "funcional") + ".";
      return;
    }
    if ((estrategiaAtual.time || []).length > 0){
      e.statusEstrategia.textContent = estrategiaAtual.resumo || "Estrategia disponivel.";
      return;
    }

    const quantidade = (estadoAtual?.pokemons?.length || 0) + (estadoAtual?.ranking?.length || 0);
    if (quantidade > 0){
      e.statusEstrategia.textContent = "Use os capturados atuais para montar um time ofensivo por alvo e estilo.";
      return;
    }
    e.statusEstrategia.textContent = "Colete Pokemon e monte um plano ofensivo baseado nos capturados.";
  }

  function montarPayloadEstrategia(){
    return {
      tipo_alvo_primario: e.seletorTipoAlvoPrimario?.value || "",
      tipo_alvo_secundario: e.seletorTipoAlvoSecundario?.value || "",
      estilo: e.seletorEstiloEstrategia?.value || "equilibrada",
      tamanho_time: Number(e.seletorTamanhoTimeEstrategia?.value || 3),
      ids_prioritarios: base.estadoTela.idsPrioritariosEstrategia || []
    };
  }

  async function gerarEstrategia(){
    const estadoAtual = obterEstadoAtual();
    const temCaptura = (estadoAtual?.pokemons?.length || 0) > 0 || (estadoAtual?.ranking?.length || 0) > 0;
    if (!temCaptura){
      base.mostrarPopup("Estrategia indisponivel", "Colete pelo menos um Pokemon antes de montar a estrategia.");
      return null;
    }
    if (gerandoEstrategia || rodandoTeste){
      return null;
    }

    gerandoEstrategia = true;
    atualizarAcoesEstrategia();
    atualizarStatus(estadoAtual);

    try{
      const resposta = await base.lerJson("/estrategia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(montarPayloadEstrategia())
      });

      if (!resposta.ok){
        e.statusEstrategia.textContent = resposta.mensagem || "Nao foi possivel gerar a estrategia.";
        base.mostrarPopup("Falha na estrategia", e.statusEstrategia.textContent);
        return null;
      }

      aplicarEstrategiaNoEstadoLocal(resposta.estrategia);
      desenharEstrategia(resposta.estrategia, { ...estadoAtual, estrategia: resposta.estrategia });
      e.statusEstrategia.textContent = resposta.mensagem || "Estrategia gerada.";
      return resposta;
    } catch (erro){
      e.statusEstrategia.textContent = "Erro ao gerar estrategia.";
      base.mostrarPopup("Falha na estrategia", "Nao foi possivel montar a estrategia agora.");
      return null;
    } finally {
      gerandoEstrategia = false;
      atualizarAcoesEstrategia();
      atualizarStatus(base.estadoTela.estadoAtual);
    }
  }

  async function rodarTesteTatico(){
    if (gerandoEstrategia || rodandoTeste){
      return null;
    }

    let estadoAtual = obterEstadoAtual();
    let estrategiaAtual = estadoAtual?.estrategia || {};
    if (!Array.isArray(estrategiaAtual.time) || estrategiaAtual.time.length === 0){
      const respostaGeracao = await gerarEstrategia();
      if (!respostaGeracao || !respostaGeracao.ok){
        return null;
      }
      estadoAtual = obterEstadoAtual();
      estrategiaAtual = respostaGeracao.estrategia || estadoAtual?.estrategia || {};
    }

    rodandoTeste = true;
    atualizarAcoesEstrategia();
    atualizarStatus(estadoAtual);

    try{
      const resposta = await base.lerJson("/estrategia/testar", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!resposta.ok){
        e.statusEstrategia.textContent = resposta.mensagem || "Nao foi possivel rodar o teste tatico.";
        base.mostrarPopup("Falha no teste tatico", e.statusEstrategia.textContent);
        return null;
      }

      const estrategiaComTeste = resposta.estrategia || { ...estrategiaAtual, teste: resposta.teste };
      aplicarEstrategiaNoEstadoLocal(estrategiaComTeste);
      desenharEstrategia(estrategiaComTeste, { ...estadoAtual, estrategia: estrategiaComTeste });
      e.statusEstrategia.textContent = resposta.mensagem || "Teste tatico concluido.";
      return resposta;
    } catch (erro){
      e.statusEstrategia.textContent = "Erro ao rodar o teste tatico.";
      base.mostrarPopup("Falha no teste tatico", "Nao foi possivel executar o teste da estrategia agora.");
      return null;
    } finally {
      rodandoTeste = false;
      atualizarAcoesEstrategia();
      atualizarStatus(base.estadoTela.estadoAtual);
    }
  }

  if (e.botaoGerarEstrategia){
    e.botaoGerarEstrategia.addEventListener("click", gerarEstrategia);
  }
  if (e.botaoTestarEstrategia){
    e.botaoTestarEstrategia.addEventListener("click", rodarTesteTatico);
  }
  if (e.inputBuscaCapturadosEstrategia){
    e.inputBuscaCapturadosEstrategia.addEventListener("input", () => {
      desenharSelecaoCapturados(base.estadoTela.estadoAtual);
    });
  }
  if (e.botaoFecharEstrategia){
    e.botaoFecharEstrategia.addEventListener("click", fecharEstrategia);
  }

  atualizarAcoesEstrategia();

  window.pokedexEstrategia = {
    abrirEstrategia,
    fecharEstrategia,
    preencherTipos,
    desenharSelecaoCapturados,
    atualizarStatus,
    desenharEstrategia,
    gerarEstrategia,
    rodarTesteTatico
  };
})();
