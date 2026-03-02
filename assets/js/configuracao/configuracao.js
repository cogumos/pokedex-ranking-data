(function(){
  const base = window.pokedexEstado;
  const e = base.elementos;
  const camposConfiguracao = [
    e.seletorNavegador,
    e.seletorHeadless,
    e.inputTimeout,
    e.inputLargura,
    e.inputAltura,
    e.inputIntervalo
  ];
  let alteracaoPendenteConfig = false;
  let salvandoConfig = false;

  function marcarAlteracaoConfig(){
    if (!salvandoConfig){
      alteracaoPendenteConfig = true;
    }
  }

  function instalarControleEdicaoConfiguracao(){
    for (const campo of camposConfiguracao){
      campo.addEventListener("input", marcarAlteracaoConfig);
      campo.addEventListener("change", marcarAlteracaoConfig);
    }
  }

  function abrirConfig(){
    e.telaConfig.classList.add("aberta");
    alteracaoPendenteConfig = false;
    if (base.estadoTela?.estadoAtual){
      desenharConfiguracao(base.estadoTela.estadoAtual, true);
    }
  }

  function fecharConfig(){
    e.telaConfig.classList.remove("aberta");
    alteracaoPendenteConfig = false;
  }

  function desenharConfiguracao(dados, forcar = false){
    const configuracao = dados.configuracao || {};
    const navegador = configuracao.navegador || "chrome";
    const headless = configuracao.headless !== false;
    const timeout = Number(configuracao.timeout_segundos || 25);
    const largura = Number(configuracao.largura_janela || 1700);
    const altura = Number(configuracao.altura_janela || 1100);
    const intervalo = Number(configuracao.intervalo_ms || 0);
    const bloquearSincronizacaoCampos =
      e.telaConfig.classList.contains("aberta") && alteracaoPendenteConfig && !forcar;

    if (!bloquearSincronizacaoCampos){
      if (e.seletorNavegador.value !== navegador){
        e.seletorNavegador.value = navegador;
      }
      if (e.seletorHeadless.value !== String(headless)){
        e.seletorHeadless.value = String(headless);
      }
      if (Number(e.inputTimeout.value || 0) !== timeout){
        e.inputTimeout.value = String(timeout);
      }
      if (Number(e.inputLargura.value || 0) !== largura){
        e.inputLargura.value = String(largura);
      }
      if (Number(e.inputAltura.value || 0) !== altura){
        e.inputAltura.value = String(altura);
      }
      if (Number(e.inputIntervalo.value || 0) !== intervalo){
        e.inputIntervalo.value = String(intervalo);
      }
    }

    if (!e.statusConfig.dataset.manual){
      e.statusConfig.textContent =
        "Atual: " + (base.nomesNavegadores[navegador] || navegador) +
        " | " + (headless ? "headless" : "visual") +
        " | timeout " + timeout + "s | janela " + largura + "x" + altura +
        " | intervalo " + intervalo + "ms";
    }
  }

  async function salvarConfiguracao(){
    const navegador = e.seletorNavegador.value;
    const headless = e.seletorHeadless.value === "true";
    const timeout = base.normalizarCampoNumerico(e.inputTimeout, 25);
    const largura = base.normalizarCampoNumerico(e.inputLargura, 1700);
    const altura = base.normalizarCampoNumerico(e.inputAltura, 1100);
    const intervalo = base.normalizarCampoNumerico(e.inputIntervalo, 0);
    e.botaoSalvarConfig.disabled = true;
    salvandoConfig = true;

    try{
      const dados = await base.lerJson("/configuracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          navegador: navegador,
          headless: headless,
          timeout_segundos: timeout,
          largura_janela: largura,
          altura_janela: altura,
          intervalo_ms: intervalo
        })
      });
      if (!dados.ok){
        if (dados.configuracao){
          desenharConfiguracao({ configuracao: dados.configuracao }, true);
        }
        alteracaoPendenteConfig = false;
        e.statusConfig.dataset.manual = "1";
        e.statusConfig.textContent = dados.mensagem || "Falha ao salvar configuração.";
        base.mostrarPopup("Erro na configuração do Selenium", e.statusConfig.textContent);
        setTimeout(() => {
          e.statusConfig.dataset.manual = "";
        }, 5000);
        return dados;
      }
      alteracaoPendenteConfig = false;
      if (dados.configuracao){
        desenharConfiguracao({ configuracao: dados.configuracao }, true);
      }
      e.statusConfig.dataset.manual = "1";
      e.statusConfig.textContent = dados.mensagem || "Configuração atualizada.";
      setTimeout(() => {
        e.statusConfig.dataset.manual = "";
      }, 5000);
      return dados;
    } catch (erro){
      alteracaoPendenteConfig = false;
      e.statusConfig.dataset.manual = "1";
      e.statusConfig.textContent = "Erro ao salvar configuração.";
      base.mostrarPopup("Erro na configuração do Selenium", "Não foi possível salvar a configuração. Verifique o navegador selecionado e tente novamente.");
      setTimeout(() => {
        e.statusConfig.dataset.manual = "";
      }, 5000);
      return { ok: false };
    } finally {
      salvandoConfig = false;
      e.botaoSalvarConfig.disabled = false;
    }
  }

  function liberarBotaoSalvar(){
    if (!salvandoConfig){
      e.botaoSalvarConfig.disabled = false;
    }
  }

  window.pokedexConfiguracao = {
    abrirConfig,
    fecharConfig,
    desenharConfiguracao,
    salvarConfiguracao,
    liberarBotaoSalvar
  };

  instalarControleEdicaoConfiguracao();
})();
