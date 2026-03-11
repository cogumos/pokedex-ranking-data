(function(){
  const elementos = {
    visor: document.getElementById("visor"),
    logs: document.getElementById("logs"),
    rankingCorpo: document.getElementById("ranking-corpo"),
    grade: document.getElementById("grade"),
    resumoQuantidade: document.getElementById("resumo-quantidade"),
    resumoProgresso: document.getElementById("resumo-progresso"),
    botaoDownloadTopo: document.getElementById("botao-download-topo"),
    botaoDownloadTop10: document.getElementById("botao-download-top10"),
    botaoDownloadDados: document.getElementById("botao-download-dados"),
    botaoIniciar: document.getElementById("botao-iniciar"),
    botaoApagar: document.getElementById("botao-apagar"),
    botaoEstrategiaTopo: document.getElementById("botao-estrategia-topo"),
    botaoGerarEstrategia: document.getElementById("botao-gerar-estrategia"),
    botaoTestarEstrategia: document.getElementById("botao-testar-estrategia"),
    botaoConfigTopo: document.getElementById("botao-config-topo"),
    botaoFecharConfig: document.getElementById("botao-fechar-config"),
    botaoFecharEstrategia: document.getElementById("botao-fechar-estrategia"),
    botaoSalvarConfig: document.getElementById("botao-salvar-config"),
    telaConfig: document.getElementById("tela-config"),
    telaEstrategia: document.getElementById("tela-estrategia"),
    seletorModo: document.getElementById("modo-coleta"),
    campoQuantidade: document.getElementById("campo-quantidade"),
    inputQuantidade: document.getElementById("quantidade"),
    statusConfig: document.getElementById("status-config"),
    statusEstrategia: document.getElementById("status-estrategia"),
    seletorTipoAlvoPrimario: document.getElementById("tipo-alvo-primario"),
    seletorTipoAlvoSecundario: document.getElementById("tipo-alvo-secundario"),
    seletorEstiloEstrategia: document.getElementById("estilo-estrategia"),
    seletorTamanhoTimeEstrategia: document.getElementById("tamanho-time-estrategia"),
    inputBuscaCapturadosEstrategia: document.getElementById("busca-capturados-estrategia"),
    contadorPrioridadesEstrategia: document.getElementById("contador-prioridades-estrategia"),
    contadorCapturadosEstrategia: document.getElementById("contador-capturados-estrategia"),
    selecionadosEstrategia: document.getElementById("selecionados-estrategia"),
    listaCapturadosEstrategia: document.getElementById("lista-capturados-estrategia"),
    painelEstrategia: document.getElementById("painel-estrategia"),
    seletorNavegador: document.getElementById("navegador-config"),
    seletorHeadless: document.getElementById("headless-config"),
    inputTimeout: document.getElementById("timeout-config"),
    inputLargura: document.getElementById("largura-config"),
    inputAltura: document.getElementById("altura-config"),
    inputIntervalo: document.getElementById("intervalo-config"),
    telaCarta: document.getElementById("tela-carta"),
    botaoFecharCarta: document.getElementById("botao-fechar-carta"),
    botaoGirarCarta: document.getElementById("botao-girar-carta"),
    cartaPalco: document.getElementById("carta-palco"),
    carta3d: document.getElementById("carta3d"),
    cartaId: document.getElementById("carta-id"),
    cartaNome: document.getElementById("carta-nome"),
    cartaImagem: document.getElementById("carta-imagem"),
    cartaTipos: document.getElementById("carta-tipos"),
    cartaStats: document.getElementById("carta-stats"),
    cartaEvolucoes: document.getElementById("carta-evolucoes"),
    menuContexto: document.getElementById("menu-contexto"),
    popupOverlay: document.getElementById("popup-overlay"),
    popupTitulo: document.getElementById("popup-titulo"),
    popupMensagem: document.getElementById("popup-mensagem"),
    popupFechar: document.getElementById("popup-fechar")
  };

  const nomesStats = {
    hp: "HP",
    attack: "Ataque",
    defense: "Defesa",
    "special-attack": "Atq. Esp.",
    "special-defense": "Def. Esp.",
    speed: "Velocidade"
  };

  const nomesNavegadores = {
    chrome: "Google Chrome",
    edge: "Microsoft Edge",
    firefox: "Mozilla Firefox"
  };

  const estadoTela = {
    pokemonSelecionadoTop10Id: null,
    rankingAtual: [],
    mapaPokemon: new Map(),
    pokemonArrastadoId: null,
    estadoAtual: null,
    idsPrioritariosEstrategia: []
  };

  const camposNumericos = [
    elementos.inputQuantidade,
    elementos.inputTimeout,
    elementos.inputLargura,
    elementos.inputAltura,
    elementos.inputIntervalo
  ];
  const filaPopup = [];
  let popupAberto = false;

  function tituloNome(nome){
    if (!nome){
      return "";
    }
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  }

  function iniciarAbertura(){
    setTimeout(() => {
      document.body.classList.add("aberta");
    }, 2550);
  }

  function atualizarCamposColeta(){
    if (elementos.seletorModo.value === "mais_forte"){
      elementos.campoQuantidade.classList.add("oculto");
    } else {
      elementos.campoQuantidade.classList.remove("oculto");
    }
  }

  function limparEntradaNumerica(campo){
    const atual = String(campo.value || "");
    const limpo = atual.replace(/[^0-9]/g, "");
    if (atual !== limpo){
      campo.value = limpo;
    }
  }

  function normalizarCampoNumerico(campo, valorPadrao){
    limparEntradaNumerica(campo);
    let numero = Number(campo.value || valorPadrao);
    if (!Number.isFinite(numero)){
      numero = valorPadrao;
    }
    numero = Math.trunc(numero);
    const minimo = campo.min !== "" ? Number(campo.min) : null;
    const maximo = campo.max !== "" ? Number(campo.max) : null;
    if (Number.isFinite(minimo) && numero < minimo){
      numero = minimo;
    }
    if (Number.isFinite(maximo) && numero > maximo){
      numero = maximo;
    }
    campo.value = String(numero);
    return numero;
  }

  function teclaPermitidaNumero(evento){
    if (evento.ctrlKey || evento.metaKey || evento.altKey){
      return true;
    }
    if (["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End", "Enter"].includes(evento.key)){
      return true;
    }
    return /^[0-9]$/.test(evento.key);
  }

  function instalarControleNumerico(campo, valorPadrao){
    campo.addEventListener("keydown", (evento) => {
      if (!teclaPermitidaNumero(evento)){
        evento.preventDefault();
      }
    });
    campo.addEventListener("input", () => {
      limparEntradaNumerica(campo);
    });
    campo.addEventListener("blur", () => {
      normalizarCampoNumerico(campo, valorPadrao);
    });
  }

  function obterPokemonPorId(id){
    const numero = Number(id);
    if (!numero){
      return null;
    }
    return estadoTela.mapaPokemon.get(numero) || null;
  }

  async function lerJson(url, opcoes){
    const resposta = await fetch(url, opcoes);
    return await resposta.json();
  }

  function fecharPopup(){
    if (!elementos.popupOverlay){
      return;
    }
    elementos.popupOverlay.classList.remove("aberto");
    elementos.popupOverlay.setAttribute("aria-hidden", "true");
    popupAberto = false;
    if (filaPopup.length > 0){
      const proximo = filaPopup.shift();
      mostrarPopup(proximo.titulo, proximo.mensagem);
    }
  }

  function mostrarPopup(titulo, mensagem){
    const cabecalho = titulo ? String(titulo).trim() : "Aviso";
    const corpo = mensagem ? String(mensagem).trim() : "";
    if (elementos.popupOverlay && elementos.popupTitulo && elementos.popupMensagem){
      if (popupAberto){
        filaPopup.push({ titulo: cabecalho, mensagem: corpo });
        return;
      }
      elementos.popupTitulo.textContent = cabecalho;
      elementos.popupMensagem.textContent = corpo || "Sem detalhes adicionais.";
      elementos.popupOverlay.classList.add("aberto");
      elementos.popupOverlay.setAttribute("aria-hidden", "false");
      popupAberto = true;
      return;
    }
    if (corpo){
      window.alert(cabecalho + "\n\n" + corpo);
      return;
    }
    window.alert(cabecalho);
  }

  if (elementos.popupFechar){
    elementos.popupFechar.addEventListener("click", fecharPopup);
  }
  if (elementos.popupOverlay){
    elementos.popupOverlay.addEventListener("click", (evento) => {
      if (evento.target === elementos.popupOverlay){
        fecharPopup();
      }
    });
  }

  window.pokedexEstado = {
    elementos,
    nomesStats,
    nomesNavegadores,
    estadoTela,
    camposNumericos,
    tituloNome,
    iniciarAbertura,
    atualizarCamposColeta,
    limparEntradaNumerica,
    normalizarCampoNumerico,
    teclaPermitidaNumero,
    instalarControleNumerico,
    obterPokemonPorId,
    lerJson,
    mostrarPopup,
    fecharPopup
  };
})();
