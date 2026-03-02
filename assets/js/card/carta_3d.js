(function(){
  const base = window.pokedexEstado;
  const e = base.elementos;

  function atualizarRotuloGiroCarta(){
    if (e.carta3d.classList.contains("girada")){
      e.botaoGirarCarta.textContent = "Ver frente";
    } else {
      e.botaoGirarCarta.textContent = "Ver verso";
    }
  }

  function abrirCarta(){
    e.telaCarta.classList.add("aberta");
  }

  function fecharCarta(){
    e.telaCarta.classList.remove("aberta");
    e.carta3d.classList.remove("girada");
    atualizarRotuloGiroCarta();
  }

  function alternarGiroCarta(){
    e.carta3d.classList.toggle("girada");
    atualizarRotuloGiroCarta();
  }

  function preencherCarta3d(pokemon){
    e.cartaId.textContent = "#" + pokemon.id;
    e.cartaNome.textContent = base.tituloNome(pokemon.nome);
    e.cartaImagem.src = pokemon.imagem || "";
    e.cartaImagem.alt = pokemon.nome || "pokemon";

    e.cartaTipos.innerHTML = "";
    for (const tipo of pokemon.tipos || []){
      const selo = document.createElement("span");
      selo.className = "tipo";
      selo.textContent = tipo;
      e.cartaTipos.appendChild(selo);
    }

    e.cartaStats.innerHTML = "";
    for (const chave in pokemon.stats || {}){
      const item = document.createElement("div");
      const nomeStat = base.nomesStats[chave] || chave;
      item.textContent = nomeStat + ": " + pokemon.stats[chave];
      e.cartaStats.appendChild(item);
    }

    const listaEvolucoes = pokemon.evolucoes || [];
    if (listaEvolucoes.length > 0){
      e.cartaEvolucoes.textContent = "Evoluções: " + listaEvolucoes.map(base.tituloNome).join(" -> ");
    } else {
      e.cartaEvolucoes.textContent = "Evoluções: não disponíveis nesta coleta.";
    }

    e.carta3d.classList.remove("girada");
    atualizarRotuloGiroCarta();
    abrirCarta();
  }

  window.pokedexCarta = {
    atualizarRotuloGiroCarta,
    abrirCarta,
    fecharCarta,
    alternarGiroCarta,
    preencherCarta3d
  };
})();
