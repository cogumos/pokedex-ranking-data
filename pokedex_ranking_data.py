import json
import os
import logging
import threading
import time
import webbrowser
from datetime import datetime

import flask.cli
from flask import Flask, jsonify, render_template, request
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.support.ui import WebDriverWait

nome_projeto = "pokedex-ranking-data"
versao_projeto = "2.0.0"
criador_projeto = "Cogumos"
github_criador = "https://github.com/cogumos"
navegadores_disponiveis = {
    "chrome": "Google Chrome",
    "edge": "Microsoft Edge",
    "firefox": "Mozilla Firefox",
}

aplicacao = Flask(__name__, static_folder="assets", static_url_path="/assets")

estado = {
    "em_execucao": False,
    "pausado": False,
    "resumivel": False,
    "parar_solicitado": False,
    "logs": [],
    "pokemons": [],
    "acumulado": [],
    "ranking": [],
    "erro": "",
    "progresso": {"atual": 0, "total": 0},
    "modo": "quantidade",
    "configuracao": {
        "navegador": "chrome",
        "headless": True,
        "timeout_segundos": 25,
        "largura_janela": 1700,
        "altura_janela": 1100,
        "intervalo_ms": 0,
    },
}

trava_estado = threading.Lock()


def registrar_log(mensagem):
    horario = datetime.now().strftime("%H:%M:%S")
    linha = f"[{horario}] {mensagem}"
    with trava_estado:
        estado["logs"].append(linha)
        if len(estado["logs"]) > 900:
            estado["logs"] = estado["logs"][-900:]


def iniciar_estado(quantidade, modo):
    with trava_estado:
        estado["em_execucao"] = True
        estado["pausado"] = False
        estado["resumivel"] = False
        estado["parar_solicitado"] = False
        estado["logs"] = []
        estado["pokemons"] = []
        estado["acumulado"] = []
        estado["ranking"] = []
        estado["erro"] = ""
        estado["progresso"] = {"atual": 0, "total": quantidade}
        estado["modo"] = modo


def limpar_estado():
    with trava_estado:
        estado["em_execucao"] = False
        estado["pausado"] = False
        estado["resumivel"] = False
        estado["parar_solicitado"] = False
        estado["logs"] = []
        estado["pokemons"] = []
        estado["acumulado"] = []
        estado["ranking"] = []
        estado["erro"] = ""
        estado["progresso"] = {"atual": 0, "total": 0}
        estado["modo"] = "quantidade"


def finalizar_estado():
    with trava_estado:
        estado["em_execucao"] = False


def preparar_retomada():
    with trava_estado:
        estado["em_execucao"] = True
        estado["pausado"] = False
        estado["parar_solicitado"] = False
        estado["erro"] = ""


def formatar_erro_curto(erro):
    texto = str(erro or "").replace("\r", "\n").strip()
    if not texto:
        return "erro desconhecido"
    if "Stacktrace:" in texto:
        texto = texto.split("Stacktrace:")[0].strip()
    linhas = [linha.strip() for linha in texto.splitlines() if linha.strip()]
    if not linhas:
        return "erro desconhecido"
    primeira_linha = linhas[0]
    if len(primeira_linha) > 260:
        primeira_linha = primeira_linha[:257] + "..."
    return primeira_linha


def converter_texto_em_json(texto):
    texto_limpo = str(texto or "").strip()
    if not texto_limpo:
        raise ValueError("resposta vazia")
    try:
        return json.loads(texto_limpo)
    except json.JSONDecodeError:
        inicio_objeto = texto_limpo.find("{")
        inicio_lista = texto_limpo.find("[")
        inicios = [indice for indice in [inicio_objeto, inicio_lista] if indice >= 0]
        if not inicios:
            raise
        inicio = min(inicios)
        fim_objeto = texto_limpo.rfind("}")
        fim_lista = texto_limpo.rfind("]")
        fim = max(fim_objeto, fim_lista)
        if fim <= inicio:
            raise
        trecho = texto_limpo[inicio : fim + 1]
        return json.loads(trecho)


def capturar_json_da_pagina(navegador, url, timeout_segundos):
    navegador.get(url)
    WebDriverWait(navegador, timeout_segundos).until(
        lambda driver: driver.execute_script("return document.readyState") == "complete"
    )
    erros = []
    try:
        elemento = WebDriverWait(navegador, min(timeout_segundos, 4)).until(ec.presence_of_element_located((By.TAG_NAME, "pre")))
        return converter_texto_em_json(elemento.text)
    except Exception as erro_pre:
        erros.append(f"pre: {formatar_erro_curto(erro_pre)}")
    try:
        navegador.set_script_timeout(timeout_segundos)
        resposta_fetch = navegador.execute_async_script(
            """
            const concluido = arguments[0];
            fetch(window.location.href, { cache: "no-store" })
              .then((resposta) => resposta.text().then((texto) => concluido({ ok: resposta.ok, status: resposta.status, texto: texto })))
              .catch((erro) => concluido({ ok: false, erro: String(erro) }));
            """
        )
        texto_fetch = str((resposta_fetch or {}).get("texto", "")).strip()
        if texto_fetch:
            return converter_texto_em_json(texto_fetch)
        erro_fetch = str((resposta_fetch or {}).get("erro", "")).strip()
        if erro_fetch:
            erros.append(f"fetch: {erro_fetch}")
    except Exception as erro_fetch:
        erros.append(f"fetch: {formatar_erro_curto(erro_fetch)}")
    try:
        texto_body = navegador.execute_script("return document.body ? document.body.innerText : '';")
        return converter_texto_em_json(texto_body)
    except Exception as erro_body:
        erros.append(f"body: {formatar_erro_curto(erro_body)}")
    mensagem_erro = " | ".join(erros[:3]) if erros else "não foi possível extrair o JSON"
    raise RuntimeError(mensagem_erro)


def obter_total_pokemon(navegador, timeout_segundos):
    dados = capturar_json_da_pagina(navegador, "https://pokeapi.co/api/v2/pokemon?limit=1", timeout_segundos)
    total = int(dados.get("count", 0))
    if total <= 0:
        raise RuntimeError("Não foi possível obter o total de Pokémon na PokéAPI")
    return total


def coletar_evolucoes(no):
    nomes = [no["species"]["name"]]
    for proximo in no.get("evolves_to", []):
        nomes.extend(coletar_evolucoes(proximo))
    return nomes


def criar_navegador(configuracao, registrar=True):
    navegador_escolhido = str(configuracao.get("navegador", "chrome")).lower()
    if navegador_escolhido not in navegadores_disponiveis:
        raise RuntimeError(f"Navegador inválido: {navegador_escolhido}")
    modo_headless = bool(configuracao.get("headless", True))
    largura = int(configuracao.get("largura_janela", 1700))
    altura = int(configuracao.get("altura_janela", 1100))
    try:
        if navegador_escolhido == "chrome":
            opcoes = webdriver.ChromeOptions()
            opcoes.add_argument(f"--window-size={largura},{altura}")
            opcoes.add_argument("--disable-gpu")
            opcoes.add_argument("--no-sandbox")
            if modo_headless:
                opcoes.add_argument("--headless=new")
            navegador = webdriver.Chrome(options=opcoes)
        elif navegador_escolhido == "edge":
            opcoes = webdriver.EdgeOptions()
            opcoes.add_argument(f"--window-size={largura},{altura}")
            opcoes.add_argument("--disable-gpu")
            if modo_headless:
                opcoes.add_argument("--headless=new")
            navegador = webdriver.Edge(options=opcoes)
        else:
            opcoes = webdriver.FirefoxOptions()
            opcoes.set_preference("devtools.jsonview.enabled", False)
            opcoes.add_argument(f"--width={largura}")
            opcoes.add_argument(f"--height={altura}")
            if modo_headless:
                opcoes.add_argument("-headless")
            navegador = webdriver.Firefox(options=opcoes)
        if registrar:
            registrar_log(
                f"Selenium iniciou {navegadores_disponiveis[navegador_escolhido]} "
                f"no modo {'headless' if modo_headless else 'visível'} "
                f"({largura}x{altura})"
            )
        return navegador
    except Exception as erro:
        raise RuntimeError(f"Falha ao iniciar {navegadores_disponiveis[navegador_escolhido]}: {erro}")


def validar_configuracao_selenium(configuracao):
    navegador_teste = None
    try:
        navegador_teste = criar_navegador(configuracao, registrar=False)
        timeout_teste = max(5, min(25, int(configuracao.get("timeout_segundos", 25))))
        capturar_json_da_pagina(navegador_teste, "https://pokeapi.co/api/v2/pokemon?limit=1", timeout_teste)
    finally:
        if navegador_teste:
            try:
                navegador_teste.quit()
            except Exception:
                pass


def salvar_json(pokemons, ranking, modo):
    os.makedirs("dados", exist_ok=True)
    caminho = os.path.join("dados", "pokedex.json")
    pacote = {
        "gerado_em": datetime.now().isoformat(),
        "projeto": nome_projeto,
        "versao": versao_projeto,
        "modo": modo,
        "quantidade": len(pokemons),
        "pokemons": pokemons,
        "top10_mais_fortes": ranking,
    }
    with open(caminho, "w", encoding="utf-8") as arquivo:
        json.dump(pacote, arquivo, ensure_ascii=False, indent=2)
    registrar_log(f"JSON salvo em {caminho}")


def apagar_json():
    caminho = os.path.join("dados", "pokedex.json")
    if os.path.exists(caminho):
        os.remove(caminho)
        return True
    return False


def executar_coleta(quantidade, modo, retomar=False):
    modo = modo if modo in {"quantidade", "mais_forte"} else "quantidade"
    if retomar:
        with trava_estado:
            modo = estado.get("modo", modo)
            total_alvo = int((estado.get("progresso") or {}).get("total") or quantidade)
            inicio_indice = int((estado.get("progresso") or {}).get("atual") or 0) + 1
            pokemons = list(estado.get("acumulado") or [])
        preparar_retomada()
        registrar_log(f"Retomando coleta a partir do índice {inicio_indice}")
    else:
        iniciar_estado(quantidade, modo)
        if modo == "mais_forte":
            registrar_log("Iniciando busca do Pokémon mais forte de todos os tempos")
        else:
            registrar_log(f"Iniciando coleta de {quantidade} Pokémon")
        total_alvo = quantidade
        inicio_indice = 1
        pokemons = []
    navegador = None
    try:
        with trava_estado:
            configuracao_coleta = dict(estado["configuracao"])
        navegador_escolhido = configuracao_coleta["navegador"]
        timeout_segundos = int(configuracao_coleta["timeout_segundos"])
        intervalo_ms = int(configuracao_coleta["intervalo_ms"])
        registrar_log(
            f"Navegador selecionado: {navegadores_disponiveis[navegador_escolhido]} | "
            f"timeout {timeout_segundos}s | intervalo {intervalo_ms}ms"
        )
        navegador = criar_navegador(configuracao_coleta)
        if modo == "mais_forte" and not retomar:
            total_alvo = obter_total_pokemon(navegador, timeout_segundos)
            with trava_estado:
                estado["progresso"]["total"] = total_alvo
            registrar_log(f"Total de Pokémon encontrados na PokéAPI: {total_alvo}")

        for indice in range(inicio_indice, total_alvo + 1):
            with trava_estado:
                estado["progresso"]["atual"] = indice - 1
                deve_parar = estado.get("parar_solicitado", False)
            if deve_parar:
                with trava_estado:
                    estado["em_execucao"] = False
                    estado["pausado"] = True
                    estado["resumivel"] = True
                    estado["parar_solicitado"] = False
                    estado["progresso"]["atual"] = indice - 1
                    estado["acumulado"] = pokemons
                    if modo == "mais_forte":
                        estado["pokemons"] = sorted(pokemons, key=lambda item: item["total_stats"], reverse=True)[:10]
                    else:
                        estado["pokemons"] = pokemons
                registrar_log("Coleta pausada pelo usuário")
                return
            try:
                url_pokemon = f"https://pokeapi.co/api/v2/pokemon/{indice}"
                registrar_log(f"Abrindo {url_pokemon}")
                dados_pokemon = capturar_json_da_pagina(navegador, url_pokemon, timeout_segundos)

                stats = {item["stat"]["name"]: item["base_stat"] for item in dados_pokemon["stats"]}
                total_stats = sum(stats.values())
                tipos = [item["type"]["name"] for item in dados_pokemon["types"]]
                imagem = (
                    dados_pokemon.get("sprites", {})
                    .get("other", {})
                    .get("official-artwork", {})
                    .get("front_default")
                    or dados_pokemon.get("sprites", {}).get("front_default")
                )
                evolucoes = []
                if modo == "quantidade":
                    url_especie = dados_pokemon["species"]["url"]
                    registrar_log(f"Abrindo {url_especie}")
                    dados_especie = capturar_json_da_pagina(navegador, url_especie, timeout_segundos)

                    url_evolucao = dados_especie["evolution_chain"]["url"]
                    registrar_log(f"Abrindo {url_evolucao}")
                    dados_evolucao = capturar_json_da_pagina(navegador, url_evolucao, timeout_segundos)
                    evolucoes = list(dict.fromkeys(coletar_evolucoes(dados_evolucao["chain"])))
                pokemon = {
                    "id": dados_pokemon["id"],
                    "nome": dados_pokemon["name"],
                    "tipos": tipos,
                    "stats": stats,
                    "total_stats": total_stats,
                    "evolucoes": evolucoes,
                    "imagem": imagem,
                }
                pokemons.append(pokemon)
                ranking_parcial = sorted(pokemons, key=lambda item: item["total_stats"], reverse=True)[:10]
                with trava_estado:
                    estado["ranking"] = ranking_parcial
                    estado["progresso"]["atual"] = indice
                    estado["acumulado"] = pokemons
                    if modo == "mais_forte":
                        estado["pokemons"] = ranking_parcial
                    else:
                        estado["pokemons"] = pokemons
                registrar_log(f"{indice}/{total_alvo} coletado: {pokemon['nome']} total {pokemon['total_stats']}")
                if intervalo_ms > 0:
                    time.sleep(intervalo_ms / 1000.0)
            except Exception as erro_item:
                with trava_estado:
                    estado["progresso"]["atual"] = indice
                registrar_log(f"Falha no índice {indice}: {formatar_erro_curto(erro_item)}")

        ranking = sorted(pokemons, key=lambda item: item["total_stats"], reverse=True)[:10]
        pokemons_para_saida = pokemons
        with trava_estado:
            estado["ranking"] = ranking
            estado["acumulado"] = pokemons
            estado["pausado"] = False
            estado["resumivel"] = False
            estado["parar_solicitado"] = False
            if modo == "mais_forte":
                estado["pokemons"] = ranking
                pokemons_para_saida = ranking
        salvar_json(pokemons_para_saida, ranking, modo)
        if modo == "mais_forte" and ranking:
            registrar_log(f"Pokémon mais forte encontrado: {ranking[0]['nome']} com total {ranking[0]['total_stats']}")
        registrar_log("Coleta finalizada")
    except Exception as erro:
        with trava_estado:
            estado["erro"] = formatar_erro_curto(erro)
        registrar_log(f"Erro geral: {formatar_erro_curto(erro)}")
    finally:
        finalizar_estado()
        if navegador:
            try:
                navegador.quit()
                registrar_log("Navegador Selenium encerrado")
            except Exception:
                pass


@aplicacao.route("/")
def pagina_inicial():
    return render_template(
        "dashboard/index.html",
        nome_projeto=nome_projeto,
        versao_projeto=versao_projeto,
        criador_projeto=criador_projeto,
        github_criador=github_criador,
        navegadores_disponiveis=navegadores_disponiveis,
    )

@aplicacao.route("/iniciar", methods=["POST"])
def iniciar():
    corpo = request.get_json(silent=True) or {}
    modo = str(corpo.get("modo", "quantidade")).strip().lower()
    if modo not in {"quantidade", "mais_forte"}:
        modo = "quantidade"
    try:
        quantidade = int(corpo.get("quantidade", 151))
    except (TypeError, ValueError):
        quantidade = 151
    quantidade = max(1, min(2000, quantidade))
    with trava_estado:
        if estado["em_execucao"]:
            return jsonify({"ok": False, "mensagem": "A coleta já está em execução"})
    thread = threading.Thread(target=executar_coleta, args=(quantidade, modo), daemon=True)
    thread.start()
    return jsonify({"ok": True, "mensagem": "Coleta iniciada"})


@aplicacao.route("/continuar", methods=["POST"])
def continuar():
    with trava_estado:
        if estado["em_execucao"]:
            return jsonify({"ok": False, "mensagem": "A coleta já está em execução"})
        pode_continuar = bool(estado.get("resumivel"))
        modo = estado.get("modo", "quantidade")
        total = int((estado.get("progresso") or {}).get("total") or 0)
    if not pode_continuar or total <= 0:
        return jsonify({"ok": False, "mensagem": "Não há coleta pausada para continuar"})
    thread = threading.Thread(target=executar_coleta, args=(total, modo, True), daemon=True)
    thread.start()
    return jsonify({"ok": True, "mensagem": "Coleta retomada"})


@aplicacao.route("/parar", methods=["POST"])
def parar():
    with trava_estado:
        if not estado["em_execucao"]:
            return jsonify({"ok": False, "mensagem": "Nenhuma coleta em execução para parar"})
        estado["parar_solicitado"] = True
    registrar_log("Solicitação de pausa recebida")
    return jsonify({"ok": True, "mensagem": "Pausa solicitada"})


@aplicacao.route("/configuracao", methods=["POST"])
def configurar():
    corpo = request.get_json(silent=True) or {}
    navegador = str(corpo.get("navegador", "")).strip().lower()
    if navegador not in navegadores_disponiveis:
        with trava_estado:
            configuracao_atual = dict(estado["configuracao"])
        return jsonify({"ok": False, "mensagem": "Navegador inválido", "configuracao": configuracao_atual})
    headless_bruto = corpo.get("headless", True)
    if isinstance(headless_bruto, bool):
        headless = headless_bruto
    else:
        headless = str(headless_bruto).strip().lower() in {"1", "true", "sim", "yes"}
    try:
        timeout_segundos = int(corpo.get("timeout_segundos", 25))
    except (TypeError, ValueError):
        timeout_segundos = 25
    timeout_segundos = max(5, min(120, timeout_segundos))
    try:
        largura_janela = int(corpo.get("largura_janela", 1700))
    except (TypeError, ValueError):
        largura_janela = 1700
    largura_janela = max(900, min(3000, largura_janela))
    try:
        altura_janela = int(corpo.get("altura_janela", 1100))
    except (TypeError, ValueError):
        altura_janela = 1100
    altura_janela = max(600, min(2000, altura_janela))
    try:
        intervalo_ms = int(corpo.get("intervalo_ms", 0))
    except (TypeError, ValueError):
        intervalo_ms = 0
    intervalo_ms = max(0, min(5000, intervalo_ms))
    configuracao_nova = {
        "navegador": navegador,
        "headless": headless,
        "timeout_segundos": timeout_segundos,
        "largura_janela": largura_janela,
        "altura_janela": altura_janela,
        "intervalo_ms": intervalo_ms,
    }
    with trava_estado:
        em_execucao = estado["em_execucao"]
    if not em_execucao:
        try:
            validar_configuracao_selenium(configuracao_nova)
        except Exception as erro_validacao:
            with trava_estado:
                configuracao_atual = dict(estado["configuracao"])
            return jsonify(
                {
                    "ok": False,
                    "mensagem": f"Falha ao validar {navegadores_disponiveis[navegador]}: {erro_validacao}",
                    "configuracao": configuracao_atual,
                }
            )
    with trava_estado:
        estado["configuracao"] = configuracao_nova
        estado["erro"] = ""
    registrar_log(
        "Configuração atualizada: "
        f"{navegadores_disponiveis[navegador]} | "
        f"{'headless' if headless else 'visível'} | "
        f"timeout {timeout_segundos}s | "
        f"janela {largura_janela}x{altura_janela} | "
        f"intervalo {intervalo_ms}ms"
    )
    if em_execucao:
        return jsonify(
            {
                "ok": True,
                "mensagem": "Configuração salva. A mudança será aplicada na próxima coleta.",
                "configuracao": configuracao_nova,
            }
        )
    return jsonify(
        {
            "ok": True,
            "mensagem": "Configuração salva com sucesso.",
            "configuracao": configuracao_nova,
        }
    )


@aplicacao.route("/apagar", methods=["POST"])
def apagar():
    with trava_estado:
        if estado["em_execucao"]:
            return jsonify({"ok": False, "mensagem": "Aguarde o fim da coleta para apagar"})
    try:
        removido = apagar_json()
        limpar_estado()
        registrar_log("Coleta apagada manualmente")
        if removido:
            return jsonify({"ok": True, "mensagem": "Coleta e arquivo JSON apagados"})
        return jsonify({"ok": True, "mensagem": "Coleta apagada"})
    except Exception as erro:
        return jsonify({"ok": False, "mensagem": f"Falha ao apagar: {erro}"})


@aplicacao.route("/estado")
def ler_estado():
    with trava_estado:
        copia = json.loads(json.dumps(estado, ensure_ascii=False))
    return jsonify(copia)


def abrir_interface():
    webbrowser.open("http://127.0.0.1:5000")


def iniciar_servidor():
    host = "127.0.0.1"
    porta = 5000
    flask.cli.show_server_banner = lambda *args, **kwargs: None
    logger_werkzeug = logging.getLogger("werkzeug")
    logger_werkzeug.disabled = True
    logger_werkzeug.propagate = False
    print(f"{nome_projeto} iniciado")
    print(f"Interface disponível em http://{host}:{porta}")
    print("Pressione CTRL+C para encerrar")
    threading.Timer(1.2, abrir_interface).start()
    aplicacao.run(host=host, port=porta, debug=False, use_reloader=False)


if __name__ == "__main__":
    iniciar_servidor()

