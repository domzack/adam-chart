# 📊 Adam Real-Time Chart (TradingVue + WebSocket)

Uma solução completa e organizada para visualização de dados financeiros (OHLCV) em tempo real. O projeto utiliza **Vue.js** com a poderosa biblioteca **TradingVueLib** e um servidor **WebSocket em Python** para streaming de dados históricos de alta frequência.

---

## 🚀 Funcionalidades Utama

- **Gráfico de Trading Profissional:** Interface fluida baseada em trading-vue-js.
- **WebSocket Streaming:** Alimentação de dados em tempo real (milissegundos) via Python.
- **Navegação de Timeframes:** Alterne entre 1m, 5m, 15m, 1h, 4h e 1D.
- **Agregação Inteligente:** Transforma automaticamente dados de 1 minuto em timeframes maiores sem perda de dados.
- **Orquestrador Automático:** Script centralizado para controle de dependências e inicialização de servidores.

---

## 📁 Estrutura do Projeto

```text
adam-chart/
├── index.html          # Ponto de entrada (HTML5)
├── start.py            # Orquestrador Python (Central de Comando)
├── public/             # Recursos Estáticos
│   ├── main.js         # Lógica Vue & WebSocket
│   ├── style.css       # Layout e Toolbar
│   ├── vue.js          # Framework Principal
│   └── trading-vue.js  # Biblioteca de Gráficos
├── server/             # Camada de Dados (Backend)
│   ├── ws_server.py    # Servidor WebSocket
│   └── history/        # Pasta contendo dados históricos (CSV)
└── README.md           # Documentação
```

---

## 🛠️ Como Iniciar (Rápido)

O projeto inclui um **Orquestrador Inteligente** que cuida de tudo para você.

1.  **Requisitos:** Tenha o Python 3.7+ instalado.
2.  **Execute o Start:**
    ```powershell
    python start.py
    ```
3.  **Siga as instruções no console:**
    - O script verificará se o pacote `websockets` está instalado.
    - Perguntará se deseja iniciar o **WebSocket Feed** (envio de dados).
    - Perguntará se deseja iniciar o **Servidor Web** (visualização no navegador em `http://localhost:8080`).

---

## 🧠 Lógica de Agregação de Dados

O projeto foi construído para ser resiliente. Enquanto o WebSocket envia candles de 1 minuto, o front-end mantém um banco de dados local (`ohlcvBase`). 

Ao trocar para, por exemplo, o timeframe de **15m**, o sistema:
1.  Agrupa os candles de 1m em blocos de 15 minutos.
2.  Calcula o Open (do primeiro), High (máximo), Low (mínimo), Close (do último) e Volume (soma).
3.  Atualiza o gráfico instantaneamente sem destruir o histórico base.

---

## 🔧 Configurações Avançadas

- **Velocidade do Feed:** No arquivo `server/ws_server.py`, você pode ajustar o `asyncio.sleep(0.05)` para simular dados mais rápidos ou lentos.
- **Portas:** Por padrão, o WebSocket usa a porta **8765** e o Servidor Web a porta **8080**.

---

## 📦 Publicando no GitHub

Para subir este projeto para o seu GitHub, use os comandos abaixo:

1.  Crie um novo repositório no seu GitHub.
2.  No seu computador (dentro da pasta `adam-chart`):
    ```bash
    git init
    git add .
    git commit -m "Initial commit: Organized Real-Time Trading Chart"
    git branch -M main
    git remote add origin https://github.com/SEU_USUARIO/NOME_REPO.git
    git push -u origin main
    ```

---
Desenvolvido com carinho para o projeto **Adam-Vue**.
