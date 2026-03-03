# pokedex-ranking-data

Projeto em Python com Selenium + Flask para coleta de dados da PokéAPI e exibição em uma interface web temática de Pokédex.

![Identidade visual do projeto](assets/readme.svg)

## Visão geral

O sistema inicia um servidor Flask local, abre a interface no navegador, executa a coleta em segundo plano com Selenium e atualiza a tela em tempo real com:

- progresso da coleta
- logs de execução
- cards dos Pokémon coletados
- ranking Top 10 por soma de stats

Também permite pausar, continuar, apagar coleta e configurar parâmetros de execução do Selenium diretamente pela interface.

## Funcionalidades

- Coleta de dados na PokéAPI usando Selenium
- Extração de tipo, stats, imagem e cadeia de evolução
- Dois modos de coleta:
  - quantidade de Pokémon
  - busca do Pokémon mais forte de todos os tempos
- Ranking automático Top 10 mais fortes
- Persistência em `dados/pokedex.json`
- Tela de configuração para:
  - navegador (`chrome`, `edge`, `firefox`)
  - modo headless/visual
  - timeout por página
  - largura e altura da janela
  - intervalo entre requisições
- Pausa e retomada de coleta sem perder progresso
- Carta 3D de Pokémon com frente dinâmica e verso em `assets/card.jpg`
- Menu de contexto personalizado e suporte a arrastar/soltar para abrir carta
- Abertura animada temática com Pokébola

## Arquitetura do projeto

### Backend

- `pokedex_ranking_data.py` concentra:
  - servidor Flask
  - controle de estado global da coleta
  - rotas HTTP
  - fluxo de coleta Selenium
  - persistência JSON

### Frontend

- Template HTML em `templates/dashboard/index.html`
- CSS modular em:
  - `assets/css/dashboard`
  - `assets/css/configuracao`
  - `assets/css/card`
- JavaScript modular em:
  - `assets/js/dashboard`
  - `assets/js/configuracao`
  - `assets/js/card`

### Persistência

- Arquivo gerado em `dados/pokedex.json` com:
  - metadados da execução
  - lista de Pokémon coletados
  - top 10 mais fortes

## Estrutura de pastas

```text
pokedex-ranking-data/
├── assets/
│   ├── card.jpg
│   ├── favicon.png
│   ├── readme.svg
│   ├── css/
│   │   ├── card/carta.css
│   │   ├── configuracao/configuracao.css
│   │   └── dashboard/
│   │       ├── base.css
│   │       └── dashboard.css
│   └── js/
│       ├── card/carta_3d.js
│       ├── configuracao/configuracao.js
│       └── dashboard/
│           ├── dashboard.js
│           └── estado.js
├── dados/
│   └── pokedex.json
├── templates/
│   └── dashboard/index.html
├── pokedex_ranking_data.py
├── requirements.txt
└── README.md
```

## Fluxo de execução

1. Usuário executa `pokedex_ranking_data.py`.
2. Flask sobe em `http://127.0.0.1:5000`.
3. Frontend consulta `GET /estado` periodicamente.
4. Ao iniciar coleta, backend cria uma thread dedicada.
5. Selenium percorre endpoints da PokéAPI e atualiza o estado em memória.
6. Frontend renderiza progresso, ranking, logs e cards em tempo real.
7. Ao finalizar, backend grava `dados/pokedex.json`.

![Diagrama do fluxo Selenium](assets/diagrama_selenium.svg)

## API local

### `GET /`

Retorna a interface da Pokédex.

### `GET /estado`

Retorna o estado atual da aplicação:

- execução (`em_execucao`, `pausado`, `resumivel`)
- progresso (`atual`, `total`)
- logs
- lista de Pokémon
- ranking
- configuração atual

### `POST /iniciar`

Inicia uma nova coleta.

Payload:

```json
{
  "modo": "quantidade",
  "quantidade": 151
}
```

`modo` pode ser `quantidade` ou `mais_forte`.

### `POST /parar`

Solicita pausa da coleta em andamento.

### `POST /continuar`

Retoma uma coleta pausada.

### `POST /apagar`

Limpa o estado da coleta e remove `dados/pokedex.json` (quando existir).

### `POST /configuracao`

Atualiza a configuração de execução do Selenium.

Payload:

```json
{
  "navegador": "chrome",
  "headless": true,
  "timeout_segundos": 25,
  "largura_janela": 1700,
  "altura_janela": 1100,
  "intervalo_ms": 0
}
```

## Formato do JSON gerado

Exemplo simplificado de `dados/pokedex.json`:

```json
{
  "gerado_em": "2026-03-02T16:00:00.000000",
  "projeto": "pokedex-ranking-data",
  "versao": "2.0.0",
  "modo": "quantidade",
  "quantidade": 151,
  "pokemons": [],
  "top10_mais_fortes": []
}
```

## Requisitos

- Python 3.10+
- Navegador instalado:
  - Google Chrome
  - Microsoft Edge
  - Mozilla Firefox
- Dependências Python em `requirements.txt`

## Instalação e execução

### Windows (PowerShell)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
py .\pokedex_ranking_data.py
```

### Linux/macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 pokedex_ranking_data.py
```

Ao executar:

- o servidor local sobe em `http://127.0.0.1:5000`
- a interface é aberta automaticamente no navegador
- mensagens de inicialização aparecem em português no terminal

## Configurações e limites validados

No backend, os seguintes limites são aplicados:

- `quantidade`: `1` até `2000`
- `timeout_segundos`: `5` até `120`
- `largura_janela`: `900` até `3000`
- `altura_janela`: `600` até `2000`
- `intervalo_ms`: `0` até `5000`

## Solução de problemas

- Erro ao iniciar navegador no Selenium:
  - confirme se o navegador selecionado está instalado
  - teste outro navegador na tela de configuração
- Coleta muito lenta:
  - reduza quantidade
  - use modo headless
  - ajuste `intervalo_ms` para `0`
- Porta `5000` em uso:
  - encerre o processo que está usando a porta
  - ou altere host/porta em `iniciar_servidor()`

