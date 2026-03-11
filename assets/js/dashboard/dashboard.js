(function(){
  const base = window.pokedexEstado;
  const carta = window.pokedexCarta;
  const configuracao = window.pokedexConfiguracao;
  const estrategia = window.pokedexEstrategia;
  const e = base.elementos;
  const estadoTela = base.estadoTela;
  let ultimoErroPopup = "";
  let ultimoErroLogsPopup = "";
  let ultimoErroLogsPopupMs = 0;

  function coletaFinalizada(dados){
    const atual = Number(dados?.progresso?.atual || 0);
    const total = Number(dados?.progresso?.total || 0);
    const temDados = (dados?.pokemons?.length || 0) > 0 || (dados?.ranking?.length || 0) > 0;
    return Boolean(dados && !dados.em_execucao && !dados.pausado && !dados.erro && total > 0 && atual >= total && temDados);
  }

  function atualizarBotoesDownload(dados){
    const finalizada = coletaFinalizada(dados);
    const temRanking = (dados?.ranking?.length || 0) > 0;
    const temPokemons = (dados?.pokemons?.length || 0) > 0;
    const temPacote = temRanking || temPokemons;
    if (e.botaoDownloadTopo){
      e.botaoDownloadTopo.classList.toggle("oculto", !(finalizada && temPacote));
    }
    if (e.botaoDownloadTop10){
      e.botaoDownloadTop10.classList.toggle("oculto", !(finalizada && temRanking));
    }
    if (e.botaoDownloadDados){
      e.botaoDownloadDados.classList.toggle("oculto", !(finalizada && temPokemons));
    }
  }

  function baixarArquivoJson(nomeArquivo, conteudo){
    const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function timestampArquivo(){
    return new Date().toISOString().replace(/[:.]/g, "-");
  }

  function exportarTop10(){
    const dados = estadoTela.estadoAtual;
    if (!coletaFinalizada(dados)){
      base.mostrarPopup("Exportação indisponível", "A exportação do Top 10 só fica disponível após finalizar a coleta.");
      return;
    }
    const pacote = {
      gerado_em: new Date().toISOString(),
      projeto: window.dadosProjeto?.nomeProjeto || "pokedex-ranking-data",
      versao: window.dadosProjeto?.versaoProjeto || "",
      modo: dados.modo || "quantidade",
      top10_mais_fortes: dados.ranking || []
    };
    baixarArquivoJson("top10_mais_fortes_" + timestampArquivo() + ".json", pacote);
  }

  function exportarDadosColetados(){
    const dados = estadoTela.estadoAtual;
    if (!coletaFinalizada(dados)){
      base.mostrarPopup("Exportação indisponível", "A exportação dos dados coletados só fica disponível após finalizar a coleta.");
      return;
    }
    const pacote = {
      gerado_em: new Date().toISOString(),
      projeto: window.dadosProjeto?.nomeProjeto || "pokedex-ranking-data",
      versao: window.dadosProjeto?.versaoProjeto || "",
      modo: dados.modo || "quantidade",
      quantidade: (dados.pokemons || []).length,
      pokemons: dados.pokemons || [],
      top10_mais_fortes: dados.ranking || [],
      estrategia_ataques: dados.estrategia || null
    };
    baixarArquivoJson("dados_coletados_" + timestampArquivo() + ".json", pacote);
  }

  function exportarPacoteCompleto(){
    const dados = estadoTela.estadoAtual;
    if (!coletaFinalizada(dados)){
      base.mostrarPopup("Exportação indisponível", "A exportação completa só fica disponível após finalizar a coleta.");
      return;
    }
    const pacote = {
      gerado_em: new Date().toISOString(),
      projeto: window.dadosProjeto?.nomeProjeto || "pokedex-ranking-data",
      versao: window.dadosProjeto?.versaoProjeto || "",
      modo: dados.modo || "quantidade",
      progresso: dados.progresso || { atual: 0, total: 0 },
      quantidade: (dados.pokemons || []).length,
      pokemons: dados.pokemons || [],
      top10_mais_fortes: dados.ranking || [],
      estrategia_ataques: dados.estrategia || null
    };
    baixarArquivoJson("pokedex_exportacao_completa_" + timestampArquivo() + ".json", pacote);
  }

  function fecharMenuContexto(){
    e.menuContexto.classList.remove("aberto");
    e.menuContexto.innerHTML = "";
  }

  function abrirMenuContexto(x, y, itens){
    fecharMenuContexto();
    if (!itens || itens.length === 0){
      return;
    }
    for (const item of itens){
      const botao = document.createElement("button");
      botao.className = "item-contexto";
      botao.textContent = item.rotulo;
      botao.addEventListener("click", () => {
        fecharMenuContexto();
        item.acao();
      });
      e.menuContexto.appendChild(botao);
    }
    e.menuContexto.classList.add("aberto");
    let posX = x;
    let posY = y;
    const largura = e.menuContexto.offsetWidth;
    const altura = e.menuContexto.offsetHeight;
    if (posX + largura + 8 > window.innerWidth){
      posX = window.innerWidth - largura - 8;
    }
    if (posY + altura + 8 > window.innerHeight){
      posY = window.innerHeight - altura - 8;
    }
    posX = Math.max(8, posX);
    posY = Math.max(8, posY);
    e.menuContexto.style.left = posX + "px";
    e.menuContexto.style.top = posY + "px";
  }

  function montarItensContexto(alvo){
    const itens = [];
    const linha = alvo.closest("#ranking-corpo tr[data-pokemon-id]");
    if (linha){
      const id = linha.dataset.pokemonId;
      const pokemon = base.obterPokemonPorId(id);
      if (pokemon){
        itens.push({
          rotulo: "Abrir carta 3D deste Pokémon",
          acao: () => {
            estadoTela.pokemonSelecionadoTop10Id = pokemon.id;
            desenharRanking(estadoTela.rankingAtual);
            carta.preencherCarta3d(pokemon);
          }
        });
      }
    }

    const card = alvo.closest(".card[data-pokemon-id]");
    if (card){
      const id = card.dataset.pokemonId;
      const pokemon = base.obterPokemonPorId(id);
      if (pokemon){
        itens.push({
          rotulo: "Abrir carta 3D do card",
          acao: () => carta.preencherCarta3d(pokemon)
        });
      }
    }

    if (!e.telaConfig.classList.contains("aberta")){
      itens.push({
        rotulo: "Abrir configurações",
        acao: () => {
          if (estrategia){
            estrategia.fecharEstrategia();
          }
          configuracao.abrirConfig();
        }
      });
    } else {
      itens.push({ rotulo: "Fechar configurações", acao: configuracao.fecharConfig });
    }

    if (estrategia){
      if (!e.telaEstrategia.classList.contains("aberta")){
        itens.push({
          rotulo: "Abrir estratégia",
          acao: () => {
            configuracao.fecharConfig();
            estrategia.abrirEstrategia();
          }
        });
      } else {
        itens.push({ rotulo: "Fechar estratégia", acao: estrategia.fecharEstrategia });
      }
    }

    if (e.telaCarta.classList.contains("aberta")){
      itens.push({ rotulo: "Girar carta 3D", acao: carta.alternarGiroCarta });
      itens.push({ rotulo: "Fechar carta 3D", acao: carta.fecharCarta });
    }

    itens.push({ rotulo: "Atualizar dados", acao: lerEstado });
    return itens;
  }

  function iniciarArrastePokemon(evento, idPokemon){
    estadoTela.pokemonArrastadoId = Number(idPokemon);
    if (evento.dataTransfer){
      evento.dataTransfer.effectAllowed = "copy";
      evento.dataTransfer.setData("text/plain", String(idPokemon));
    }
    evento.currentTarget.classList.add("arrastando");
  }

  function finalizarArrastePokemon(evento){
    evento.currentTarget.classList.remove("arrastando");
    e.cartaPalco.classList.remove("soltar-ativo");
    estadoTela.pokemonArrastadoId = null;
  }

  function desenharLogs(lista){
    const linhas = Array.isArray(lista) ? lista : [];
    e.logs.textContent = linhas.join("\n");
    e.logs.scrollTop = e.logs.scrollHeight;
    for (let indice = linhas.length - 1; indice >= 0; indice -= 1){
      const linha = String(linhas[indice] || "").trim();
      if (!linha){
        continue;
      }
      const ehErro = /erro|falha/i.test(linha);
      if (!ehErro){
        continue;
      }
      const assinatura = linha
        .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "")
        .replace(/índice\s+\d+/i, "índice");
      const agora = Date.now();
      const podeMostrar = assinatura !== ultimoErroLogsPopup || (agora - ultimoErroLogsPopupMs) > 8000;
      if (podeMostrar){
        ultimoErroLogsPopup = assinatura;
        ultimoErroLogsPopupMs = agora;
        base.mostrarPopup("Aviso do Navegador e Selenium", "Foi detectado um erro durante a coleta:\n\n" + assinatura);
      }
      break;
    }
  }

  function desenharRanking(lista){
    e.rankingCorpo.innerHTML = "";
    if (!lista || lista.length === 0){
      const linha = document.createElement("tr");
      linha.innerHTML = "<td colspan='4'>Sem ranking no momento</td>";
      e.rankingCorpo.appendChild(linha);
      return;
    }

    lista.forEach((pokemon, indice) => {
      const linha = document.createElement("tr");
      linha.dataset.pokemonId = String(pokemon.id);
      linha.draggable = true;
      if (estadoTela.pokemonSelecionadoTop10Id === pokemon.id){
        linha.classList.add("selecionado");
      }
      linha.innerHTML =
        "<td>" + (indice + 1) + "</td>" +
        "<td>" + pokemon.id + "</td>" +
        "<td>" + base.tituloNome(pokemon.nome) + "</td>" +
        "<td>" + pokemon.total_stats + "</td>";

      linha.addEventListener("click", () => {
        estadoTela.pokemonSelecionadoTop10Id = pokemon.id;
        desenharRanking(lista);
        carta.preencherCarta3d(pokemon);
      });
      linha.addEventListener("dragstart", (evento) => iniciarArrastePokemon(evento, pokemon.id));
      linha.addEventListener("dragend", (evento) => finalizarArrastePokemon(evento));
      e.rankingCorpo.appendChild(linha);
    });
  }

  function desenharCards(lista){
    e.grade.innerHTML = "";
    if (!lista || lista.length === 0){
      const vazio = document.createElement("div");
      vazio.className = "vazio";
      vazio.textContent = "Inicie a coleta para ver os dados";
      e.grade.appendChild(vazio);
      return;
    }

    for (const pokemon of lista){
      const cardItem = document.createElement("article");
      cardItem.className = "card";
      cardItem.dataset.pokemonId = String(pokemon.id);
      cardItem.draggable = true;
      cardItem.addEventListener("dragstart", (evento) => iniciarArrastePokemon(evento, pokemon.id));
      cardItem.addEventListener("dragend", (evento) => finalizarArrastePokemon(evento));

      const topo = document.createElement("div");
      topo.className = "ct";
      topo.innerHTML = "<span class='id'>#" + pokemon.id + "</span><span>" + base.tituloNome(pokemon.nome) + "</span>";

      const imagem = document.createElement("img");
      imagem.src = pokemon.imagem || "";
      imagem.alt = pokemon.nome || "pokemon";

      const tipos = document.createElement("div");
      tipos.className = "tipos";
      for (const tipo of pokemon.tipos || []){
        const selo = document.createElement("span");
        selo.className = "tipo";
        selo.textContent = tipo;
        tipos.appendChild(selo);
      }

      const stats = document.createElement("div");
      stats.className = "stats";
      for (const chave in pokemon.stats || {}){
        const item = document.createElement("div");
        const nomeStat = base.nomesStats[chave] || chave;
        item.textContent = nomeStat + ": " + pokemon.stats[chave];
        stats.appendChild(item);
      }

      const evolucoes = document.createElement("div");
      evolucoes.className = "ev";
      if ((pokemon.evolucoes || []).length > 0){
        evolucoes.textContent = "Evoluções: " + pokemon.evolucoes.map(base.tituloNome).join(" -> ");
      } else {
        evolucoes.textContent = "Evoluções: não disponíveis nesta coleta.";
      }

      const papel = document.createElement("div");
      papel.className = "papel";
      papel.textContent = "Papel tático: " + (pokemon.papel_tatico || "equilibrado");

      const golpes = document.createElement("div");
      golpes.className = "golpes";
      if ((pokemon.golpes_recomendados || []).length > 0){
        golpes.textContent = "Golpes sugeridos: " + pokemon.golpes_recomendados.slice(0, 3).map((golpe) => golpe.nome_exibicao || golpe.nome).join(" | ");
      } else {
        golpes.textContent = "Golpes sugeridos: gere uma estratégia para analisar este Pokémon.";
      }

      cardItem.appendChild(topo);
      cardItem.appendChild(imagem);
      cardItem.appendChild(tipos);
      cardItem.appendChild(stats);
      cardItem.appendChild(papel);
      cardItem.appendChild(golpes);
      cardItem.appendChild(evolucoes);
      e.grade.appendChild(cardItem);
    }
  }

  function desenharStatus(dados){
    estadoTela.estadoAtual = dados;
    const texto = dados.em_execucao ? "coletando" : "parado";
    const atual = dados.progresso?.atual || 0;
    const total = dados.progresso?.total || 0;
    const erro = dados.erro ? " | erro: " + dados.erro : "";
    const nomeNavegador = base.nomesNavegadores[dados.configuracao?.navegador] || "Google Chrome";
    const textoHeadless = dados.configuracao?.headless ? "headless" : "visual";
    const textoModo = dados.modo === "mais_forte" ? "mais forte de todos os tempos" : "quantidade";

    e.visor.textContent =
      "Status: " + texto +
      " | modo: " + textoModo +
      " | progresso: " + atual + "/" + total +
      " | navegador: " + nomeNavegador + " (" + textoHeadless + ")" + erro;

    const erroAtual = String(dados.erro || "").trim();
    if (erroAtual && erroAtual !== ultimoErroPopup){
      ultimoErroPopup = erroAtual;
      base.mostrarPopup("Erro na coleta", erroAtual);
    }
    if (!erroAtual){
      ultimoErroPopup = "";
    }

    e.resumoQuantidade.textContent = (dados.pokemons?.length || 0) + " Pokémon coletados";
    e.resumoProgresso.textContent = atual + "/" + total;

    if (dados.em_execucao){
      e.botaoIniciar.textContent = "Coletando...";
      e.botaoIniciar.disabled = true;
      e.botaoApagar.textContent = "Parar coleta";
      e.botaoApagar.disabled = false;
    } else if (dados.pausado && dados.resumivel){
      e.botaoIniciar.textContent = "Continuar coleta";
      e.botaoIniciar.disabled = false;
      e.botaoApagar.textContent = "Apagar coleta";
      e.botaoApagar.disabled = false;
    } else {
      e.botaoIniciar.textContent = "Iniciar coleta";
      e.botaoIniciar.disabled = false;
      e.botaoApagar.textContent = "Apagar coleta";
      e.botaoApagar.disabled = false;
    }

    configuracao.liberarBotaoSalvar();
    if (estrategia){
      estrategia.atualizarStatus(dados);
    }

    if (e.seletorModo.value !== (dados.modo || "quantidade") && dados.em_execucao){
      e.seletorModo.value = dados.modo || "quantidade";
      base.atualizarCamposColeta();
    }
    atualizarBotoesDownload(dados);
  }

  async function lerEstado(){
    try{
      const dados = await base.lerJson("/estado");
      estadoTela.rankingAtual = dados.ranking || [];
      estadoTela.mapaPokemon = new Map();

      for (const pokemon of (dados.pokemons || [])){
        estadoTela.mapaPokemon.set(pokemon.id, pokemon);
      }
      for (const pokemon of estadoTela.rankingAtual){
        if (!estadoTela.mapaPokemon.has(pokemon.id)){
          estadoTela.mapaPokemon.set(pokemon.id, pokemon);
        }
      }

      desenharStatus(dados);
      desenharLogs(dados.logs);
      desenharRanking(dados.ranking);
      desenharCards(dados.pokemons);
      if (estrategia){
        estrategia.desenharEstrategia(dados.estrategia, dados);
      }
      configuracao.desenharConfiguracao(dados);
    } catch (erro){
      e.visor.textContent = "Status: falha ao atualizar interface";
    }
  }

  async function iniciarColeta(){
    const modo = e.seletorModo.value;
    const quantidade = base.normalizarCampoNumerico(e.inputQuantidade, 0);
    try{
      const dados = await base.lerJson("/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade: quantidade, modo: modo })
      });
      if (!dados.ok){
        e.visor.textContent = "Status: " + (dados.mensagem || "não foi possível iniciar");
      }
    } catch (erro){
      e.visor.textContent = "Status: erro ao iniciar coleta";
    }
    lerEstado();
  }

  async function continuarColeta(){
    try{
      const dados = await base.lerJson("/continuar", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!dados.ok){
        e.visor.textContent = "Status: " + (dados.mensagem || "não foi possível continuar");
      }
    } catch (erro){
      e.visor.textContent = "Status: erro ao continuar coleta";
    }
    lerEstado();
  }

  async function pararColeta(){
    try{
      const dados = await base.lerJson("/parar", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!dados.ok){
        e.visor.textContent = "Status: " + (dados.mensagem || "não foi possível parar");
      } else if (dados.mensagem){
        e.visor.textContent = "Status: " + dados.mensagem;
      }
    } catch (erro){
      e.visor.textContent = "Status: erro ao parar coleta";
    }
    lerEstado();
  }

  async function apagarColeta(){
    try{
      const dados = await base.lerJson("/apagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!dados.ok){
        e.visor.textContent = "Status: " + (dados.mensagem || "não foi possível apagar");
      } else if (dados.mensagem){
        e.visor.textContent = "Status: " + dados.mensagem;
      }
    } catch (erro){
      e.visor.textContent = "Status: erro ao apagar coleta";
    }
    lerEstado();
  }

  e.botaoIniciar.addEventListener("click", () => {
    if (estadoTela.estadoAtual?.em_execucao){
      return;
    }
    if (estadoTela.estadoAtual?.pausado && estadoTela.estadoAtual?.resumivel){
      continuarColeta();
      return;
    }
    iniciarColeta();
  });

  e.botaoApagar.addEventListener("click", () => {
    if (estadoTela.estadoAtual?.em_execucao){
      pararColeta();
      return;
    }
    apagarColeta();
  });

  if (e.botaoEstrategiaTopo && estrategia){
    e.botaoEstrategiaTopo.addEventListener("click", () => {
      configuracao.fecharConfig();
      carta.fecharCarta();
      estrategia.abrirEstrategia();
    });
  }
  e.botaoConfigTopo.addEventListener("click", () => {
    if (estrategia){
      estrategia.fecharEstrategia();
    }
    configuracao.abrirConfig();
  });
  e.botaoFecharConfig.addEventListener("click", configuracao.fecharConfig);
  e.botaoSalvarConfig.addEventListener("click", async () => {
    await configuracao.salvarConfiguracao();
    lerEstado();
  });
  e.seletorModo.addEventListener("change", base.atualizarCamposColeta);
  e.botaoFecharCarta.addEventListener("click", carta.fecharCarta);
  e.botaoGirarCarta.addEventListener("click", carta.alternarGiroCarta);
  if (e.botaoDownloadTop10){
    e.botaoDownloadTop10.addEventListener("click", exportarTop10);
  }
  if (e.botaoDownloadDados){
    e.botaoDownloadDados.addEventListener("click", exportarDadosColetados);
  }
  if (e.botaoDownloadTopo){
    e.botaoDownloadTopo.addEventListener("click", exportarPacoteCompleto);
  }

  for (const campo of base.camposNumericos){
    const valorPadrao = Number(campo.defaultValue || 0);
    base.instalarControleNumerico(campo, Number.isFinite(valorPadrao) ? valorPadrao : 0);
  }

  e.cartaPalco.addEventListener("dragover", (evento) => {
    evento.preventDefault();
    e.cartaPalco.classList.add("soltar-ativo");
  });

  e.cartaPalco.addEventListener("dragleave", () => {
    e.cartaPalco.classList.remove("soltar-ativo");
  });

  e.cartaPalco.addEventListener("drop", (evento) => {
    evento.preventDefault();
    e.cartaPalco.classList.remove("soltar-ativo");
    const idTexto = (evento.dataTransfer && evento.dataTransfer.getData("text/plain")) || String(estadoTela.pokemonArrastadoId || "");
    const pokemon = base.obterPokemonPorId(idTexto);
    if (pokemon){
      estadoTela.pokemonSelecionadoTop10Id = pokemon.id;
      desenharRanking(estadoTela.rankingAtual);
      carta.preencherCarta3d(pokemon);
    }
  });

  document.addEventListener("contextmenu", (evento) => {
    evento.preventDefault();
    const itens = montarItensContexto(evento.target);
    abrirMenuContexto(evento.clientX, evento.clientY, itens);
  });

  document.addEventListener("click", (evento) => {
    if (!e.menuContexto.contains(evento.target)){
      fecharMenuContexto();
    }
  });

  window.addEventListener("resize", fecharMenuContexto);
  document.addEventListener("scroll", fecharMenuContexto, true);

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape"){
      fecharMenuContexto();
      configuracao.fecharConfig();
      if (estrategia){
        estrategia.fecharEstrategia();
      }
      carta.fecharCarta();
      base.fecharPopup();
    }
  });

  base.atualizarCamposColeta();
  carta.atualizarRotuloGiroCarta();
  base.iniciarAbertura();
  if (estrategia){
    estrategia.preencherTipos();
  }
  lerEstado();
  setInterval(lerEstado, 1200);

  window.pokedexDashboard = {
    lerEstado
  };
})();
