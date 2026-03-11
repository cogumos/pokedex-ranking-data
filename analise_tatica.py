import threading
from copy import deepcopy
from datetime import datetime

tipos_pokemon_disponiveis = [
    "normal",
    "fire",
    "water",
    "electric",
    "grass",
    "ice",
    "fighting",
    "poison",
    "ground",
    "flying",
    "psychic",
    "bug",
    "rock",
    "ghost",
    "dragon",
    "dark",
    "steel",
    "fairy",
]

estilos_estrategia_disponiveis = {
    "agressiva": "Pressao maxima",
    "equilibrada": "Cobertura balanceada",
    "segura": "Controle e consistencia",
}

prioridade_metodo_movimento = {
    "level-up": 0,
    "machine": 1,
    "tutor": 2,
    "egg": 3,
}

rotulos_classe_golpe = {
    "physical": "fisico",
    "special": "especial",
    "status": "status",
}


def criar_estrategia_vazia():
    return {
        "gerada_em": "",
        "parametros": {
            "tipo_alvo_primario": "",
            "tipo_alvo_secundario": "",
            "tipos_alvo": [],
            "estilo": "equilibrada",
            "tamanho_time": 3,
        },
        "alvo": {"tipos": [], "descricao": "Nenhum alvo definido"},
        "resumo": "",
        "time": [],
        "plano_batalha": [],
        "cobertura": [],
        "riscos": [],
        "estatisticas": {
            "pokemons_avaliados": 0,
            "candidatos_analisados": 0,
            "movimentos_analisados": 0,
            "gerado_com_selenium": False,
        },
    }


def nome_legivel(texto):
    return str(texto or "").replace("-", " ").strip().title()


def formatar_lista_humana(itens):
    valores = [str(item).strip() for item in itens if str(item).strip()]
    if not valores:
        return ""
    if len(valores) == 1:
        return valores[0]
    if len(valores) == 2:
        return f"{valores[0]} e {valores[1]}"
    return f"{', '.join(valores[:-1])} e {valores[-1]}"


def normalizar_tipo(tipo):
    valor = str(tipo or "").strip().lower()
    if valor in tipos_pokemon_disponiveis:
        return valor
    return ""


def normalizar_estilo_estrategia(estilo):
    valor = str(estilo or "").strip().lower()
    if valor in estilos_estrategia_disponiveis:
        return valor
    return "equilibrada"


def serializar_pokemon_publico(pokemon):
    return {
        "id": pokemon.get("id"),
        "nome": pokemon.get("nome"),
        "tipos": deepcopy(pokemon.get("tipos") or []),
        "stats": deepcopy(pokemon.get("stats") or {}),
        "total_stats": int(pokemon.get("total_stats") or 0),
        "evolucoes": deepcopy(pokemon.get("evolucoes") or []),
        "imagem": pokemon.get("imagem") or "",
        "papel_tatico": pokemon.get("papel_tatico") or "equilibrado",
        "fraquezas": deepcopy(pokemon.get("fraquezas") or []),
        "resistencias": deepcopy(pokemon.get("resistencias") or []),
        "imunidades": deepcopy(pokemon.get("imunidades") or []),
        "golpes_recomendados": deepcopy(pokemon.get("golpes_recomendados") or []),
        "score_estrategia": pokemon.get("score_estrategia"),
    }


class AnaliseTatica:
    def __init__(self, capturar_json_callback):
        self.capturar_json = capturar_json_callback
        self.trava_cache = threading.Lock()
        self.cache_tipos = {}
        self.cache_golpes = {}

    def prioridade_metodo_aprendizado(self, metodo):
        return prioridade_metodo_movimento.get(str(metodo or "").strip().lower(), 99)

    def montar_catalogo_movimentos(self, lista_movimentos, limite=14):
        catalogo = []
        vistos = set()
        for item in lista_movimentos or []:
            movimento = item.get("move") or {}
            nome = str(movimento.get("name") or "").strip().lower()
            url = str(movimento.get("url") or "").strip()
            if not nome or not url or nome in vistos:
                continue
            melhor = None
            for detalhe in item.get("version_group_details") or []:
                metodo = str(((detalhe.get("move_learn_method") or {}).get("name")) or "").strip().lower()
                nivel = int(detalhe.get("level_learned_at") or 0)
                grupo_versao = str(((detalhe.get("version_group") or {}).get("name")) or "").strip().lower()
                marcador = (
                    self.prioridade_metodo_aprendizado(metodo),
                    0 if grupo_versao == "scarlet-violet" else 1,
                    -nivel,
                    nome,
                )
                if melhor is None or marcador < melhor["marcador"]:
                    melhor = {
                        "metodo": metodo or "desconhecido",
                        "nivel": nivel,
                        "grupo_versao": grupo_versao,
                        "marcador": marcador,
                    }
            if melhor is None:
                melhor = {
                    "metodo": "desconhecido",
                    "nivel": 0,
                    "grupo_versao": "",
                }
            vistos.add(nome)
            catalogo.append(
                {
                    "nome": nome,
                    "url": url,
                    "metodo": melhor["metodo"],
                    "nivel": melhor["nivel"],
                    "grupo_versao": melhor["grupo_versao"],
                }
            )
        catalogo.sort(
            key=lambda movimento: (
                self.prioridade_metodo_aprendizado(movimento.get("metodo")),
                0 if movimento.get("grupo_versao") == "scarlet-violet" else 1,
                -int(movimento.get("nivel") or 0),
                movimento.get("nome") or "",
            )
        )
        return catalogo[:limite]

    def obter_dados_tipo(self, navegador, tipo, timeout_segundos):
        tipo_normalizado = normalizar_tipo(tipo)
        if not tipo_normalizado:
            raise RuntimeError(f"Tipo invalido: {tipo}")
        with self.trava_cache:
            cache_existente = self.cache_tipos.get(tipo_normalizado)
        if cache_existente:
            return deepcopy(cache_existente)
        if navegador is None:
            raise RuntimeError(f"Cache de tipo ausente para {tipo_normalizado}")
        dados_tipo = self.capturar_json(
            navegador,
            f"https://pokeapi.co/api/v2/type/{tipo_normalizado}",
            timeout_segundos,
        )
        relacoes = dados_tipo.get("damage_relations") or {}
        resumo = {
            "nome": tipo_normalizado,
            "double_damage_to": [item["name"] for item in relacoes.get("double_damage_to") or []],
            "half_damage_to": [item["name"] for item in relacoes.get("half_damage_to") or []],
            "no_damage_to": [item["name"] for item in relacoes.get("no_damage_to") or []],
            "double_damage_from": [item["name"] for item in relacoes.get("double_damage_from") or []],
            "half_damage_from": [item["name"] for item in relacoes.get("half_damage_from") or []],
            "no_damage_from": [item["name"] for item in relacoes.get("no_damage_from") or []],
        }
        with self.trava_cache:
            self.cache_tipos[tipo_normalizado] = resumo
        return deepcopy(resumo)

    def obter_dados_golpe(self, navegador, movimento, timeout_segundos):
        if isinstance(movimento, dict):
            url = str(movimento.get("url") or "").strip()
            nome_referencia = str(movimento.get("nome") or movimento.get("name") or "").strip().lower()
        else:
            texto = str(movimento or "").strip()
            url = texto if texto.startswith("http") else ""
            nome_referencia = "" if url else texto.lower()
        if not url and not nome_referencia:
            raise RuntimeError("Movimento invalido")
        with self.trava_cache:
            cache_existente = self.cache_golpes.get(url) or self.cache_golpes.get(nome_referencia)
        if cache_existente:
            return deepcopy(cache_existente)
        if navegador is None:
            raise RuntimeError("Cache de golpe ausente")
        if not url:
            url = f"https://pokeapi.co/api/v2/move/{nome_referencia}"
        dados_golpe = self.capturar_json(navegador, url, timeout_segundos)
        efeito_curto = ""
        for entrada in dados_golpe.get("effect_entries") or []:
            if ((entrada.get("language") or {}).get("name")) == "en":
                efeito_curto = str(entrada.get("short_effect") or entrada.get("effect") or "").replace("\n", " ").strip()
                break
        nome_golpe = str(dados_golpe.get("name") or nome_referencia or "").strip().lower()
        resumo = {
            "nome": nome_golpe,
            "tipo": str(((dados_golpe.get("type") or {}).get("name")) or "").strip().lower(),
            "classe": str(((dados_golpe.get("damage_class") or {}).get("name")) or "status").strip().lower(),
            "poder": dados_golpe.get("power"),
            "precisao": dados_golpe.get("accuracy"),
            "pp": dados_golpe.get("pp"),
            "prioridade": int(dados_golpe.get("priority") or 0),
            "efeito_curto": efeito_curto,
        }
        with self.trava_cache:
            self.cache_golpes[url] = resumo
            if nome_golpe:
                self.cache_golpes[nome_golpe] = resumo
        return deepcopy(resumo)

    def calcular_multiplicadores_defensivos(self, tipos_pokemon, navegador, timeout_segundos):
        multiplicadores = {tipo: 1.0 for tipo in tipos_pokemon_disponiveis}
        for tipo_defensor in tipos_pokemon or []:
            dados_tipo = self.obter_dados_tipo(navegador, tipo_defensor, timeout_segundos)
            for tipo in dados_tipo["double_damage_from"]:
                multiplicadores[tipo] *= 2.0
            for tipo in dados_tipo["half_damage_from"]:
                multiplicadores[tipo] *= 0.5
            for tipo in dados_tipo["no_damage_from"]:
                multiplicadores[tipo] *= 0.0
        return multiplicadores

    def montar_perfil_defensivo(self, tipos_pokemon, navegador, timeout_segundos):
        multiplicadores = self.calcular_multiplicadores_defensivos(tipos_pokemon, navegador, timeout_segundos)
        fraquezas = [tipo for tipo, valor in sorted(multiplicadores.items(), key=lambda item: (-item[1], item[0])) if valor > 1]
        resistencias = [tipo for tipo, valor in sorted(multiplicadores.items(), key=lambda item: (item[1], item[0])) if 0 < valor < 1]
        imunidades = [tipo for tipo, valor in sorted(multiplicadores.items(), key=lambda item: item[0]) if valor == 0]
        return {
            "multiplicadores_defensivos": multiplicadores,
            "fraquezas": fraquezas,
            "resistencias": resistencias,
            "imunidades": imunidades,
        }

    def calcular_multiplicador_ofensivo(self, tipo_ataque, tipos_alvo, navegador, timeout_segundos):
        tipo_normalizado = normalizar_tipo(tipo_ataque)
        tipos_defensores = [normalizar_tipo(tipo) for tipo in tipos_alvo or [] if normalizar_tipo(tipo)]
        if not tipo_normalizado or not tipos_defensores:
            return 1.0
        dados_tipo = self.obter_dados_tipo(navegador, tipo_normalizado, timeout_segundos)
        multiplicador = 1.0
        for tipo_defensor in tipos_defensores:
            if tipo_defensor in dados_tipo["no_damage_to"]:
                return 0.0
            if tipo_defensor in dados_tipo["double_damage_to"]:
                multiplicador *= 2.0
            elif tipo_defensor in dados_tipo["half_damage_to"]:
                multiplicador *= 0.5
        return multiplicador

    def classificar_papel_tatico(self, stats):
        hp = int(stats.get("hp", 0))
        ataque = int(stats.get("attack", 0))
        defesa = int(stats.get("defense", 0))
        ataque_especial = int(stats.get("special-attack", 0))
        defesa_especial = int(stats.get("special-defense", 0))
        velocidade = int(stats.get("speed", 0))
        volume = hp + defesa + defesa_especial
        melhor_ataque = max(ataque, ataque_especial)
        if velocidade >= 110 and melhor_ataque >= 95:
            return "sweeper veloz"
        if ataque_especial >= ataque + 20 and ataque_especial >= 105:
            return "artilharia especial"
        if ataque >= ataque_especial + 20 and ataque >= 105:
            return "atacante fisico"
        if volume >= 290 and velocidade <= 90:
            return "tanque"
        if velocidade >= 95 and volume >= 240:
            return "pivot agil"
        if hp >= 95 and max(defesa, defesa_especial) >= 90:
            return "suporte resistente"
        return "equilibrado"

    def criar_resumo_pokemon(self, dados_pokemon, evolucoes, navegador, timeout_segundos):
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
        perfil_defensivo = self.montar_perfil_defensivo(tipos, navegador, timeout_segundos)
        return {
            "id": dados_pokemon["id"],
            "nome": dados_pokemon["name"],
            "tipos": tipos,
            "stats": stats,
            "total_stats": total_stats,
            "evolucoes": evolucoes,
            "imagem": imagem,
            "papel_tatico": self.classificar_papel_tatico(stats),
            "movimentos_catalogo": self.montar_catalogo_movimentos(dados_pokemon.get("moves") or []),
            "golpes_recomendados": [],
            "score_estrategia": None,
            **perfil_defensivo,
        }

    def descrever_multiplicador(self, multiplicador):
        if multiplicador == 0:
            return "sem efeito"
        if multiplicador >= 4:
            return "muito forte"
        if multiplicador > 1:
            return "super eficaz"
        if multiplicador < 1:
            return "resistido"
        return "neutro"

    def pontuar_golpe(self, pokemon, golpe, tipos_alvo, estilo, navegador, timeout_segundos):
        stats = pokemon.get("stats") or {}
        classe = str(golpe.get("classe") or "status").strip().lower()
        poder_original = golpe.get("poder")
        poder = int(poder_original) if poder_original is not None else (55 if classe != "status" else 0)
        precisao_original = golpe.get("precisao")
        precisao = int(precisao_original) if precisao_original is not None else 100
        pp = int(golpe.get("pp") or 0)
        prioridade = int(golpe.get("prioridade") or 0)
        tipo_golpe = normalizar_tipo(golpe.get("tipo"))
        velocidade = int(stats.get("speed", 0))
        ataque = int(stats.get("attack", 0))
        ataque_especial = int(stats.get("special-attack", 0))
        stab = 1.25 if tipo_golpe and tipo_golpe in (pokemon.get("tipos") or []) else 1.0
        multiplicador_alvo = self.calcular_multiplicador_ofensivo(tipo_golpe, tipos_alvo, navegador, timeout_segundos) if tipo_golpe else 1.0

        if classe == "physical":
            estatistica_relevante = ataque
        elif classe == "special":
            estatistica_relevante = ataque_especial
        else:
            estatistica_relevante = max(ataque, ataque_especial)

        consistencia = precisao / 100.0
        if classe == "status":
            score = 18 + consistencia * 12 + pp * 0.4
            if prioridade > 0:
                score += 8
            if estilo == "segura":
                score += 8
            elif estilo == "agressiva":
                score -= 4
        else:
            score = poder * consistencia * stab * max(0.25, multiplicador_alvo)
            score *= 1.0 + (estatistica_relevante / 190.0)
            if estilo == "agressiva":
                score *= 1.16 + (velocidade / 650.0)
            elif estilo == "segura":
                score *= 0.98 + min(0.22, pp / 180.0)
            else:
                score *= 1.05 + min(0.12, velocidade / 900.0) + min(0.08, pp / 220.0)
            if prioridade > 0:
                score += 14
            if poder >= 90:
                score += 6
        descricao_tipo = tipo_golpe or "normal"
        descricao = (
            f"{rotulos_classe_golpe.get(classe, classe)} | "
            f"{nome_legivel(descricao_tipo)} | "
            f"{self.descrever_multiplicador(multiplicador_alvo)}"
        )
        return {
            "nome": golpe.get("nome") or "",
            "nome_exibicao": nome_legivel(golpe.get("nome") or ""),
            "tipo": descricao_tipo,
            "classe": rotulos_classe_golpe.get(classe, classe),
            "poder": poder if classe != "status" else 0,
            "precisao": precisao,
            "pp": pp,
            "prioridade": prioridade,
            "multiplicador_alvo": round(float(multiplicador_alvo), 2),
            "score": round(float(score), 1),
            "descricao": descricao,
            "efeito_curto": golpe.get("efeito_curto") or "",
        }

    def construir_golpes_fallback(self, pokemon, tipos_alvo, estilo, navegador, timeout_segundos):
        golpes = []
        ataque = int((pokemon.get("stats") or {}).get("attack", 0))
        ataque_especial = int((pokemon.get("stats") or {}).get("special-attack", 0))
        classe_fallback = "physical" if ataque >= ataque_especial else "special"
        for tipo in pokemon.get("tipos") or []:
            golpe_base = {
                "nome": f"{tipo}-burst",
                "tipo": tipo,
                "classe": classe_fallback,
                "poder": 70,
                "precisao": 100,
                "pp": 15,
                "prioridade": 0,
                "efeito_curto": "Fallback tatico construido pela analise local.",
            }
            golpes.append(self.pontuar_golpe(pokemon, golpe_base, tipos_alvo, estilo, navegador, timeout_segundos))
        return golpes

    def avaliar_candidato_base(self, pokemon, tipos_alvo, estilo, navegador, timeout_segundos, prioridade_manual=False, ordem_prioridade=0):
        stats = pokemon.get("stats") or {}
        hp = int(stats.get("hp", 0))
        ataque = int(stats.get("attack", 0))
        defesa = int(stats.get("defense", 0))
        ataque_especial = int(stats.get("special-attack", 0))
        defesa_especial = int(stats.get("special-defense", 0))
        velocidade = int(stats.get("speed", 0))
        bulk = hp + defesa + defesa_especial
        ofensivo = max(ataque, ataque_especial)

        score = float(pokemon.get("total_stats", 0)) * 0.34 + ofensivo * 0.88 + velocidade * 0.42
        if estilo == "agressiva":
            score += ofensivo * 0.55 + velocidade * 0.38 + max(0, pokemon.get("total_stats", 0) - 500) * 0.08
        elif estilo == "segura":
            score += bulk * 0.48 + hp * 0.20 + len(pokemon.get("resistencias") or []) * 7 + len(pokemon.get("imunidades") or []) * 10
        else:
            score += bulk * 0.29 + ofensivo * 0.39 + velocidade * 0.18 + len(pokemon.get("resistencias") or []) * 5

        multiplicadores_stab = []
        for tipo in pokemon.get("tipos") or []:
            multiplicadores_stab.append(self.calcular_multiplicador_ofensivo(tipo, tipos_alvo, navegador, timeout_segundos))
        melhor_stab = max(multiplicadores_stab) if multiplicadores_stab else 1.0
        media_stab = sum(multiplicadores_stab) / len(multiplicadores_stab) if multiplicadores_stab else 1.0
        if tipos_alvo:
            score += melhor_stab * 32 + media_stab * 12
        else:
            score += len(set(pokemon.get("tipos") or [])) * 8

        excesso_fraquezas = max(0, len(pokemon.get("fraquezas") or []) - len(pokemon.get("resistencias") or []))
        score -= excesso_fraquezas * 4
        if estilo == "agressiva" and velocidade < 70:
            score -= 12
        if estilo == "segura" and bulk < 220:
            score -= 14
        if prioridade_manual:
            score += 155 + max(0, 18 - ordem_prioridade * 3)

        razoes = []
        if prioridade_manual:
            razoes.append("Prioridade manual definida na tela de estrategia.")
        if melhor_stab > 1:
            razoes.append(f"STAB de {formatar_lista_humana(nome_legivel(tipo) for tipo in pokemon.get('tipos') or [])} pressiona o alvo.")
        razoes.append(f"Papel tatico: {pokemon.get('papel_tatico', 'equilibrado')}.")
        if velocidade >= 95:
            razoes.append("Velocidade boa para abrir a rotacao.")
        elif bulk >= 280:
            razoes.append("Volume defensivo alto para segurar trocas.")
        return {
            "pokemon": pokemon,
            "score_base": round(score, 2),
            "prioridade_manual": bool(prioridade_manual),
            "razoes_base": razoes[:3],
        }

    def enriquecer_candidato_com_golpes(self, candidato, tipos_alvo, estilo, navegador, timeout_segundos):
        pokemon = candidato["pokemon"]
        movimentos_catalogo = list(pokemon.get("movimentos_catalogo") or [])[:8]
        golpes_avaliados = []
        movimentos_analisados = 0

        for movimento in movimentos_catalogo:
            try:
                dados_golpe = self.obter_dados_golpe(navegador, movimento, timeout_segundos)
                movimentos_analisados += 1
                golpes_avaliados.append(
                    self.pontuar_golpe(pokemon, dados_golpe, tipos_alvo, estilo, navegador, timeout_segundos)
                )
            except Exception:
                continue

        if not golpes_avaliados:
            golpes_avaliados = self.construir_golpes_fallback(pokemon, tipos_alvo, estilo, navegador, timeout_segundos)

        golpes_ordenados = sorted(
            golpes_avaliados,
            key=lambda golpe: (
                -float(golpe.get("score") or 0),
                -float(golpe.get("multiplicador_alvo") or 0),
                -(golpe.get("poder") or 0),
                golpe.get("nome") or "",
            ),
        )
        golpes_recomendados = []
        tipos_usados = set()
        for golpe in golpes_ordenados:
            if len(golpes_recomendados) >= 4:
                break
            tipo_golpe = str(golpe.get("tipo") or "")
            if tipo_golpe and tipo_golpe in tipos_usados and len(golpes_recomendados) < 2 and len(golpes_ordenados) > 1:
                continue
            golpes_recomendados.append(golpe)
            if tipo_golpe:
                tipos_usados.add(tipo_golpe)
        if len(golpes_recomendados) < 4:
            for golpe in golpes_ordenados:
                if len(golpes_recomendados) >= 4:
                    break
                if golpe not in golpes_recomendados:
                    golpes_recomendados.append(golpe)

        score_golpes = 0.0
        for indice, golpe in enumerate(golpes_recomendados):
            score_golpes += float(golpe.get("score") or 0) * (0.28 if indice < 2 else 0.14)
        score_final = float(candidato["score_base"]) + score_golpes + len({golpe["tipo"] for golpe in golpes_recomendados}) * 4
        melhor_golpe = golpes_recomendados[0] if golpes_recomendados else None

        razoes = list(candidato.get("razoes_base") or [])
        if melhor_golpe:
            razoes.append(
                f"Melhor golpe sugerido: {melhor_golpe['nome_exibicao']} ({melhor_golpe['descricao']})."
            )
        if (pokemon.get("fraquezas") or []) and estilo == "segura":
            razoes.append(
                f"Fraquezas para vigiar: {formatar_lista_humana(nome_legivel(tipo) for tipo in (pokemon.get('fraquezas') or [])[:3])}."
            )
        return {
            "id": pokemon.get("id"),
            "nome": pokemon.get("nome"),
            "tipos": list(pokemon.get("tipos") or []),
            "papel_tatico": pokemon.get("papel_tatico") or "equilibrado",
            "imagem": pokemon.get("imagem"),
            "total_stats": int(pokemon.get("total_stats") or 0),
            "fraquezas": list(pokemon.get("fraquezas") or []),
            "resistencias": list(pokemon.get("resistencias") or []),
            "imunidades": list(pokemon.get("imunidades") or []),
            "multiplicadores_defensivos": deepcopy(pokemon.get("multiplicadores_defensivos") or {}),
            "prioridade_manual": bool(candidato.get("prioridade_manual")),
            "score_estrategia": round(float(score_final), 1),
            "golpes_recomendados": golpes_recomendados,
            "razoes": razoes[:4],
            "movimentos_analisados": movimentos_analisados,
        }

    def selecionar_time_estrategico(self, candidatos, tamanho_time, estilo):
        selecionados = []
        restantes = list(candidatos)
        contagem_tipos = {}
        contagem_papeis = {}
        tipos_golpes = set()
        while restantes and len(selecionados) < tamanho_time:
            melhor_indice = 0
            melhor_score = None
            for indice, candidato in enumerate(restantes):
                score = float(candidato.get("score_estrategia") or 0)
                novos_tipos = sum(1 for tipo in candidato.get("tipos") or [] if contagem_tipos.get(tipo, 0) == 0)
                novos_golpes = len({golpe.get("tipo") for golpe in candidato.get("golpes_recomendados") or []} - tipos_golpes)
                papel = candidato.get("papel_tatico") or ""
                score += novos_tipos * 7 + novos_golpes * 4
                if candidato.get("prioridade_manual"):
                    score += 120
                if contagem_papeis.get(papel, 0) == 0:
                    score += 8
                score -= sum(contagem_tipos.get(tipo, 0) * 9 for tipo in candidato.get("tipos") or [])
                if estilo == "segura":
                    score += len(candidato.get("resistencias") or []) * 1.5 + len(candidato.get("imunidades") or []) * 3
                if melhor_score is None or score > melhor_score:
                    melhor_score = score
                    melhor_indice = indice
            escolhido = restantes.pop(melhor_indice)
            escolhido["score_escolha"] = round(float(melhor_score or 0), 1)
            selecionados.append(escolhido)
            for tipo in escolhido.get("tipos") or []:
                contagem_tipos[tipo] = contagem_tipos.get(tipo, 0) + 1
            for golpe in escolhido.get("golpes_recomendados") or []:
                tipos_golpes.add(golpe.get("tipo"))
            papel = escolhido.get("papel_tatico") or ""
            contagem_papeis[papel] = contagem_papeis.get(papel, 0) + 1
        return selecionados

    def ordenar_time_para_plano(self, time_estrategico, estilo):
        if not time_estrategico:
            return []
        membros = list(time_estrategico)
        if estilo == "agressiva":
            abertura = max(
                membros,
                key=lambda membro: (
                    int(((membro.get("golpes_recomendados") or [{}])[0]).get("score") or 0),
                    int(membro.get("total_stats") or 0),
                ),
            )
        elif estilo == "segura":
            abertura = max(
                membros,
                key=lambda membro: (
                    len(membro.get("resistencias") or []) + len(membro.get("imunidades") or []) * 2,
                    int(membro.get("total_stats") or 0),
                ),
            )
        else:
            abertura = max(membros, key=lambda membro: float(membro.get("score_escolha") or 0))
        membros.remove(abertura)
        finalizador = None
        if membros:
            finalizador = max(
                membros,
                key=lambda membro: (
                    float(membro.get("score_estrategia") or 0),
                    float(((membro.get("golpes_recomendados") or [{}])[0]).get("score") or 0),
                ),
            )
            membros.remove(finalizador)
        membros.sort(key=lambda membro: float(membro.get("score_escolha") or 0), reverse=True)
        ordenado = [abertura] + membros
        if finalizador is not None:
            ordenado.append(finalizador)
        for indice, membro in enumerate(ordenado, start=1):
            membro["slot"] = indice
        return ordenado

    def construir_plano_batalha(self, time_estrategico, tipos_alvo, estilo):
        if not time_estrategico:
            return []
        abertura = time_estrategico[0]
        finalizador = time_estrategico[-1]
        cobertura = sorted({nome_legivel(golpe.get("tipo")) for membro in time_estrategico for golpe in membro.get("golpes_recomendados") or [] if golpe.get("tipo")})
        alvo_texto = formatar_lista_humana(nome_legivel(tipo) for tipo in tipos_alvo) if tipos_alvo else "alvos variados"
        plano = [f"Abra com {nome_legivel(abertura.get('nome'))} para impor o ritmo inicial contra {alvo_texto}."]
        if len(time_estrategico) > 1:
            plano.append(
                f"Rode entre {formatar_lista_humana(nome_legivel(membro.get('nome')) for membro in time_estrategico[1:-1]) or nome_legivel(finalizador.get('nome'))} para preservar cobertura ofensiva."
            )
        if finalizador:
            melhor_golpe = ((finalizador.get("golpes_recomendados") or [{}])[0]).get("nome_exibicao") or "o melhor golpe disponivel"
            plano.append(
                f"Guarde {nome_legivel(finalizador.get('nome'))} como finalizador e priorize {melhor_golpe} nas janelas decisivas."
            )
        if cobertura:
            plano.append(f"Cobertura ofensiva priorizada: {formatar_lista_humana(cobertura[:5])}.")
        if estilo == "segura":
            plano.append("Evite trocar em cadeia quando duas fraquezas coletivas estiverem expostas.")
        elif estilo == "agressiva":
            plano.append("Mantenha a pressao e troque apenas para preservar o melhor multiplicador de dano.")
        else:
            plano.append("Equilibre dano e trocas para manter cobertura ativa em todos os slots.")
        return plano[:4]

    def construir_cobertura_time(self, time_estrategico, tipos_alvo):
        if not time_estrategico:
            return []
        membros_super_efetivos = sum(
            1 for membro in time_estrategico if max((float(golpe.get("multiplicador_alvo") or 0) for golpe in membro.get("golpes_recomendados") or []), default=1.0) > 1
        )
        tipos_golpes = sorted(
            {
                nome_legivel(golpe.get("tipo"))
                for membro in time_estrategico
                for golpe in membro.get("golpes_recomendados") or []
                if golpe.get("tipo")
            }
        )
        papeis = sorted({str(membro.get("papel_tatico") or "").strip() for membro in time_estrategico if str(membro.get("papel_tatico") or "").strip()})
        linhas = []
        if tipos_alvo:
            linhas.append(
                f"{membros_super_efetivos} de {len(time_estrategico)} slots tem golpe super eficaz contra {formatar_lista_humana(nome_legivel(tipo) for tipo in tipos_alvo)}."
            )
        else:
            linhas.append(f"Cobertura geral montada com {len(tipos_golpes)} tipos ofensivos distintos.")
        if tipos_golpes:
            linhas.append(f"Tipos ofensivos do plano: {formatar_lista_humana(tipos_golpes[:6])}.")
        if papeis:
            linhas.append(f"Papeis taticos presentes: {formatar_lista_humana(papeis[:5])}.")
        return linhas[:3]

    def construir_riscos_time(self, time_estrategico):
        if not time_estrategico:
            return []
        contagem_fraquezas = {}
        for membro in time_estrategico:
            for tipo, multiplicador in (membro.get("multiplicadores_defensivos") or {}).items():
                if float(multiplicador) > 1:
                    contagem_fraquezas[tipo] = contagem_fraquezas.get(tipo, 0) + 1
        riscos = []
        limite_coletivo = max(2, len(time_estrategico) // 2)
        for tipo, quantidade in sorted(contagem_fraquezas.items(), key=lambda item: (-item[1], item[0])):
            if quantidade >= limite_coletivo:
                riscos.append(f"{quantidade} membros ficam pressionados por ataques do tipo {nome_legivel(tipo)}.")
        if not riscos:
            riscos.append("A composicao nao mostra uma fraqueza coletiva dominante.")
        return riscos[:3]

    def testar_estrategia(self, estrategia):
        time_estrategico = list(estrategia.get("time") or [])
        if not time_estrategico:
            raise RuntimeError("Nao ha time montado para testar.")

        tipos_golpes = {
            golpe.get("tipo")
            for membro in time_estrategico
            for golpe in membro.get("golpes_recomendados") or []
            if golpe.get("tipo")
        }
        multiplicadores = [
            float(golpe.get("multiplicador_alvo") or 1)
            for membro in time_estrategico
            for golpe in membro.get("golpes_recomendados") or []
        ]
        media_score = sum(float(membro.get("score_estrategia") or 0) for membro in time_estrategico) / max(1, len(time_estrategico))
        risco_penalidade = len(estrategia.get("riscos") or []) * 6
        preferidos = len((estrategia.get("preferencias") or {}).get("priorizados_encontrados") or [])
        super_efetivos = sum(1 for valor in multiplicadores if valor > 1)
        cobertura = min(100, round(len(tipos_golpes) * 12 + super_efetivos * 2))
        ofensiva = min(100, round(media_score * 0.42 + max(multiplicadores or [1]) * 12))
        consistencia = min(
            100,
            round(
                42
                + sum(len(membro.get("resistencias") or []) for membro in time_estrategico) * 2.5
                + sum(len(membro.get("imunidades") or []) for membro in time_estrategico) * 4
                - risco_penalidade
            ),
        )
        sinergia = min(100, round(38 + len({membro.get("papel_tatico") for membro in time_estrategico}) * 9 + len(tipos_golpes) * 4))
        execucao = min(100, round(36 + preferidos * 5 + len(time_estrategico) * 7 + media_score * 0.14))
        valor_estrategia = max(0, min(100, round((ofensiva * 0.34) + (consistencia * 0.24) + (sinergia * 0.22) + (execucao * 0.20))))

        if valor_estrategia >= 88:
            classificacao = "elite"
        elif valor_estrategia >= 74:
            classificacao = "forte"
        elif valor_estrategia >= 58:
            classificacao = "funcional"
        else:
            classificacao = "instavel"

        personagens = []
        for membro in time_estrategico:
            melhor_golpe = (membro.get("golpes_recomendados") or [{}])[0]
            valor_personagem = max(
                0,
                min(
                    100,
                    round(
                        float(membro.get("score_estrategia") or 0) * 0.52
                        + float(melhor_golpe.get("score") or 0) * 0.18
                        + len(membro.get("resistencias") or []) * 3
                        + len(membro.get("imunidades") or []) * 5
                    ),
                ),
            )
            personagens.append(
                {
                    "slot": membro.get("slot"),
                    "id": membro.get("id"),
                    "nome": membro.get("nome"),
                    "imagem": membro.get("imagem") or "",
                    "papel_tatico": membro.get("papel_tatico") or "equilibrado",
                    "valor_tatico": valor_personagem,
                    "prioridade_manual": bool(membro.get("prioridade_manual")),
                    "melhor_golpe": {
                        "nome": melhor_golpe.get("nome_exibicao") or melhor_golpe.get("nome") or "",
                        "tipo": melhor_golpe.get("tipo") or "",
                        "score": melhor_golpe.get("score") or 0,
                        "multiplicador_alvo": melhor_golpe.get("multiplicador_alvo") or 1,
                    },
                    "leitura": (
                        f"{nome_legivel(membro.get('nome'))} entrega pressao {valor_personagem}/100 "
                        f"com {melhor_golpe.get('nome_exibicao') or melhor_golpe.get('nome') or 'golpe principal'}."
                    ),
                }
            )

        cenarios = [
            {
                "nome": "Pressao inicial",
                "valor": max(0, min(100, round(ofensiva * 0.72 + execucao * 0.28))),
                "leitura": "Mede como o plano comeca a luta e impone o primeiro ritmo.",
            },
            {
                "nome": "Trocas longas",
                "valor": max(0, min(100, round(consistencia * 0.68 + sinergia * 0.32))),
                "leitura": "Mostra se o time aguenta respostas, resistencias e rotacoes.",
            },
            {
                "nome": "Fechamento",
                "valor": max(0, min(100, round(ofensiva * 0.48 + execucao * 0.52))),
                "leitura": "Avalia a capacidade de finalizar depois da abertura e das trocas.",
            },
        ]

        recomendacoes = []
        if cobertura < 62:
            recomendacoes.append("Amplie a variedade de tipos ofensivos ou priorize outro capturado com cobertura secundaria.")
        if consistencia < 58:
            recomendacoes.append("O teste detectou fragilidade defensiva; inclua um perfil mais resistente entre os preferidos.")
        if preferidos == 0:
            recomendacoes.append("Marque alguns capturados como prioridade para testar variacoes mais dirigidas do plano.")
        if not recomendacoes:
            recomendacoes.append("O plano passou no teste tatico com boa cobertura e pode ser refinado apenas por matchup especifico.")

        return {
            "rodado_em": datetime.now().isoformat(),
            "valor_estrategia": valor_estrategia,
            "classificacao": classificacao,
            "metricas": {
                "ofensiva": ofensiva,
                "consistencia": consistencia,
                "sinergia": sinergia,
                "execucao": execucao,
                "cobertura": cobertura,
            },
            "cenarios": cenarios,
            "personagens": personagens,
            "recomendacoes": recomendacoes[:3],
        }

    def gerar_estrategia(self, pokemons, tipo_alvo_primario, tipo_alvo_secundario, estilo, tamanho_time, navegador, timeout_segundos, ids_prioritarios=None):
        tipos_alvo = []
        for tipo in [tipo_alvo_primario, tipo_alvo_secundario]:
            tipo_normalizado = normalizar_tipo(tipo)
            if tipo_normalizado and tipo_normalizado not in tipos_alvo:
                tipos_alvo.append(tipo_normalizado)
        estilo_normalizado = normalizar_estilo_estrategia(estilo)
        tamanho_normalizado = max(3, min(6, int(tamanho_time or 3)))
        prioridades = []
        for item in ids_prioritarios or []:
            try:
                pokemon_id = int(item)
            except (TypeError, ValueError):
                continue
            if pokemon_id not in prioridades:
                prioridades.append(pokemon_id)
        mapa_prioridades = {pokemon_id: indice for indice, pokemon_id in enumerate(prioridades)}
        candidatos_base = []
        movimentos_analisados = 0
        for pokemon in pokemons:
            pokemon_id = int(pokemon.get("id") or 0)
            candidatos_base.append(
                self.avaliar_candidato_base(
                    pokemon,
                    tipos_alvo,
                    estilo_normalizado,
                    navegador,
                    timeout_segundos,
                    prioridade_manual=pokemon_id in mapa_prioridades,
                    ordem_prioridade=mapa_prioridades.get(pokemon_id, 99),
                )
            )
        candidatos_base.sort(key=lambda item: float(item.get("score_base") or 0), reverse=True)
        limite_candidatos = min(len(candidatos_base), max(8, tamanho_normalizado * 4))
        candidatos_enriquecidos = []
        for candidato in candidatos_base[:limite_candidatos]:
            enriquecido = self.enriquecer_candidato_com_golpes(
                candidato,
                tipos_alvo,
                estilo_normalizado,
                navegador,
                timeout_segundos,
            )
            movimentos_analisados += int(enriquecido.pop("movimentos_analisados", 0) or 0)
            candidatos_enriquecidos.append(enriquecido)

        time_bruto = self.selecionar_time_estrategico(candidatos_enriquecidos, tamanho_normalizado, estilo_normalizado)
        time_ordenado = self.ordenar_time_para_plano(time_bruto, estilo_normalizado)
        descricao_alvo = formatar_lista_humana(nome_legivel(tipo) for tipo in tipos_alvo) if tipos_alvo else "cobertura geral"
        estrategia = {
            "gerada_em": datetime.now().isoformat(),
            "parametros": {
                "tipo_alvo_primario": tipos_alvo[0] if len(tipos_alvo) > 0 else "",
                "tipo_alvo_secundario": tipos_alvo[1] if len(tipos_alvo) > 1 else "",
                "tipos_alvo": tipos_alvo,
                "estilo": estilo_normalizado,
                "tamanho_time": tamanho_normalizado,
            },
            "alvo": {"tipos": tipos_alvo, "descricao": descricao_alvo},
            "resumo": f"Time {estilos_estrategia_disponiveis[estilo_normalizado].lower()} montado com {len(time_ordenado)} capturados para enfrentar {descricao_alvo}.",
            "preferencias": {
                "ids_prioritarios": prioridades,
                "priorizados_encontrados": [
                    {
                        "id": item.get("id"),
                        "nome": item.get("nome"),
                        "imagem": item.get("imagem") or "",
                        "papel_tatico": item.get("papel_tatico") or "equilibrado",
                    }
                    for item in time_ordenado
                    if int(item.get("id") or 0) in mapa_prioridades
                ],
            },
            "teste": None,
            "time": [
                {
                    "slot": item.get("slot"),
                    "id": item.get("id"),
                    "nome": item.get("nome"),
                    "tipos": deepcopy(item.get("tipos") or []),
                    "papel_tatico": item.get("papel_tatico") or "equilibrado",
                    "imagem": item.get("imagem") or "",
                    "total_stats": int(item.get("total_stats") or 0),
                    "prioridade_manual": bool(item.get("prioridade_manual")),
                    "score_estrategia": item.get("score_estrategia"),
                    "score_escolha": item.get("score_escolha"),
                    "fraquezas": deepcopy(item.get("fraquezas") or []),
                    "resistencias": deepcopy(item.get("resistencias") or []),
                    "imunidades": deepcopy(item.get("imunidades") or []),
                    "razoes": deepcopy(item.get("razoes") or []),
                    "golpes_recomendados": deepcopy(item.get("golpes_recomendados") or []),
                }
                for item in time_ordenado
            ],
            "plano_batalha": self.construir_plano_batalha(time_ordenado, tipos_alvo, estilo_normalizado),
            "cobertura": self.construir_cobertura_time(time_ordenado, tipos_alvo),
            "riscos": self.construir_riscos_time(time_ordenado),
            "estatisticas": {
                "pokemons_avaliados": len(pokemons),
                "candidatos_analisados": len(candidatos_enriquecidos),
                "movimentos_analisados": movimentos_analisados,
                "gerado_com_selenium": True,
            },
        }
        return estrategia
