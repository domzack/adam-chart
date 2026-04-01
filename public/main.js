// ═══════════════ Imports ═══════════════
const { DataCube } = window.TradingVueLib || window.TradingVue || {}

// ═══════════════ App ═══════════════
new Vue({
    el: '#app',
    data: {
        chart: {},            // DataCube criado após receber histórico
        ohlcvBase: [],        // Backup 1m para agregação
        historyBuffer: [],    // Buffer para histórico antes do DC criar
        historyReady: false,  // true quando DC criado com dados
        indexBased: false,
        currentTimeframe: 1,
        availableTfs: [1, 5, 15, 60, 240, 1440],
        width: window.innerWidth,
        height: window.innerHeight - 50,
        ws: null,
        connectionStatus: 'disconnected'
    },

    mounted() {
        window.addEventListener('resize', this.onResize)
        this.connectWebSocket()
    },

    beforeDestroy() {
        window.removeEventListener('resize', this.onResize)
        if (this.ws) this.ws.close()
    },

    watch: {
        indexBased() {
            if (this.historyReady) {
                const data = this.currentTimeframe === 1
                    ? this.ohlcvBase.slice()
                    : this.aggregateCandles(this.ohlcvBase, this.currentTimeframe)
                this.initDataCube(data, this.currentTimeframe)
            }
        }
    },

    methods: {
        // ═══════════════ DataCube ═══════════════

        /**
         * Cria o DataCube com dados.
         * Segue o padrão oficial: DC criado DEPOIS de ter dados.
         */
        initDataCube(candles, tf) {
            const label = this.tfLabel(tf)
            this.chart = new DataCube({
                chart: { type: 'Candles', tf: label, data: candles },
                onchart: [{
                    type: 'Spline',
                    name: 'EMA',
                    data: []
                }],
                offchart: []
            }, {
                aggregation: 100,
                auto_scroll: true,
                scripts: false
            })

            // Conecta DataCube ao componente TradingVue
            this.chart.init_tvjs(this.$refs.tvjs)

            // ═══════ Lazy loading ao rolar para trás ═══════
            this.chart.onrange(this.onRangeLoad)

            this.historyReady = true
            window.dc = this.chart
            window.tv = this.$refs.tvjs
        },

        // ═══════════════ OHLCV Base ═══════════════

        pushToBase(candle) {
            const lastIdx = this.ohlcvBase.length - 1
            if (lastIdx >= 0 && this.ohlcvBase[lastIdx][0] === candle[0]) {
                this.ohlcvBase[lastIdx] = candle
            } else {
                this.ohlcvBase.push(candle)
            }
        },

        // ═══════════════ WebSocket ═══════════════

        connectWebSocket() {
            const ws = new WebSocket('ws://127.0.0.1:8765')
            this.ws = ws

            ws.onopen = () => {
                console.log('[ADAM-CHART] Feed WebSocket conectado')
                this.connectionStatus = 'connected'
            }

            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data)
                if (msg.type) {
                    this.handleFeedMessage(msg)
                    return
                }
                if (msg.candle) {
                    this.handleLegacyCandle(msg.candle)
                }
            }

            ws.onclose = () => {
                console.log('[ADAM-CHART] WebSocket desconectado. Reconectando em 3s...')
                this.connectionStatus = 'disconnected'
                setTimeout(() => this.connectWebSocket(), 3000)
            }

            ws.onerror = (err) => {
                console.error('[ADAM-CHART] Erro no WebSocket:', err)
            }
        },

        // ═══════════════ Feed Handler ═══════════════

        handleFeedMessage(msg) {
            switch (msg.type) {
                case 'history_chunk':
                case 'history_loaded':
                    if (!msg.data || !Array.isArray(msg.data)) return

                    for (const item of msg.data) {
                        this.historyBuffer.push([item.t, item.o, item.h, item.l, item.c, item.v])
                        this.pushToBase([item.t, item.o, item.h, item.l, item.c, item.v])
                    }
                    console.log(`[ADAM-CHART] ${msg.type}: +${msg.data.length} (buffer: ${this.historyBuffer.length})`)

                    // Último chunk? Cria DataCube
                    if (msg.current && msg.total && msg.current >= msg.total) {
                        this.ohlcvBase.sort((a, b) => a[0] - b[0])
                        this.historyBuffer.sort((a, b) => a[0] - b[0])
                        this.initDataCube(this.historyBuffer, this.currentTimeframe)
                        this.historyBuffer = []
                        console.log(`[ADAM-CHART] Histórico completo: ${this.ohlcvBase.length} candles`)
                    }
                    break

                case 'history_complete':
                    this.ohlcvBase.sort((a, b) => a[0] - b[0])
                    this.historyBuffer.sort((a, b) => a[0] - b[0])
                    this.initDataCube(this.historyBuffer, this.currentTimeframe)
                    this.historyBuffer = []
                    console.log(`[ADAM-CHART] Histórico completo: ${this.ohlcvBase.length} candles carregados`)
                    break

                case 'candle_update':
                    if (msg.data && Array.isArray(msg.data)) {
                        for (const item of msg.data) {
                            const candle = [item.t, item.o, item.h, item.l, item.c, item.v]
                            this.pushToBase(candle)

                            if (this.historyReady) {
                                if (this.currentTimeframe === 1) {
                                    this.chart.update({ candle: candle })
                                } else {
                                    const agg = this.aggregateCandles(this.ohlcvBase, this.currentTimeframe)
                                    this.chart.update({ candle: agg[agg.length - 1] })
                                }
                            } else {
                                this.historyBuffer.push(candle)
                            }
                        }
                    }
                    break

                case 'history_complete':
                    this.historyBuffer = []
                    console.log(`[ADAM-CHART] Histórico completo: ${msg.symbol}`)
                    break

                case 'history_not_found':
                    console.log(`[ADAM-CHART] ${msg.message}`)
                    break

                case 'range_response':
                    this.handleRangeResponse(msg)
                    break

                default:
                    console.log(`[ADAM-CHART] Mensagem desconhecida: ${msg.type}`)
            }
        },

        handleLegacyCandle(candle) {
            this.pushToBase(candle)
            if (this.historyReady) {
                this.chart.update({ candle: candle })
            }
        },

        // ═══════════════ Lazy Loading (onrange) ═══════════════

        /**
         * Chamado pelo DataCube quando o usuário rola o gráfico
         * para uma região sem dados carregados.
         *
         * @param {Array} range - [start, end] em timestamp (ms)
         * @param {string} tf - timeframe label (ex: "1m")
         * @param {Function} dataCallback - chamar com os dados para fazer merge automático
         */
        onRangeLoad(range, tf, dataCallback) {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.warn('[ADAM-CHART] WebSocket não conectado, impossível carregar mais dados')
                return
            }

            const data = this.chart.get_one('chart.data')
            if (!data || data.length === 0) return

            const earliestTs = data[0][0]
            const latestTs = data[data.length - 1][0]

            // Usuário rolou para trás — pedir dados mais antigos
            if (range[0] < earliestTs) {
                console.log(`[ADAM-CHART] onrange: pedindo histórico antes de ${new Date(earliestTs).toISOString()}`)
                this._pendingRangeCallback = dataCallback
                this.ws.send(JSON.stringify({
                    type: 'request_range',
                    before: earliestTs,
                    after: range[0],
                    timeframe: this.currentTimeframe
                }))
            }
            // Usuário rolou para frente além dos dados (raro, mas possível)
            else if (range[1] > latestTs) {
                console.log(`[ADAM-CHART] onrange: pedindo dados depois de ${new Date(latestTs).toISOString()}`)
                this._pendingRangeCallback = dataCallback
                this.ws.send(JSON.stringify({
                    type: 'request_range',
                    before: range[1],
                    after: latestTs,
                    timeframe: this.currentTimeframe
                }))
            }
        },

        /**
         * Processa resposta do backend ao request_range.
         * Faz merge no ohlcvBase e chama dataCallback para o DataCube.
         */
        handleRangeResponse(msg) {
            if (!msg.data || !Array.isArray(msg.data) || msg.data.length === 0) {
                console.log('[ADAM-CHART] request_range: sem dados para o range solicitado')
                this._pendingRangeCallback = null
                return
            }

            const candles = msg.data.map(d => [d.t, d.o, d.h, d.l, d.c, d.v])

            // Atualiza ohlcvBase com os novos dados
            for (const c of candles) {
                this.pushToBase(c)
            }
            this.ohlcvBase.sort((a, b) => a[0] - b[0])

            console.log(`[ADAM-CHART] request_range: +${candles.length} candles merged (base: ${this.ohlcvBase.length})`)

            // Passa dados ao DataCube — ele faz o merge automaticamente
            if (this._pendingRangeCallback) {
                this._pendingRangeCallback(candles)
                this._pendingRangeCallback = null
            }
        },

        // ═══════════════ Navegação ═══════════════

        goToEnd() {
            if (this.ohlcvBase.length === 0) return
            this.$refs.tvjs.goto(this.ohlcvBase[this.ohlcvBase.length - 1][0])
        },

        navigateTo(timestamp) {
            this.$refs.tvjs.goto(timestamp)
        },

        setRange(t1, t2) {
            this.$refs.tvjs.setRange(t1, t2)
        },

        getRange() {
            return this.$refs.tvjs.getRange()
        },

        // ═══════════════ Timeframes ═══════════════

        onResize() {
            this.width = window.innerWidth
            this.height = window.innerHeight - 50
        },

        tfLabel(tf) {
            if (tf < 60) return tf + 'm'
            if (tf < 1440) return (tf / 60) + 'h'
            return (tf / 1440) + 'D'
        },

        changeTimeframe(tf) {
            if (!this.historyReady) return
            this.currentTimeframe = tf

            const data = tf === 1
                ? this.ohlcvBase.slice()
                : this.aggregateCandles(this.ohlcvBase, tf)

            this.initDataCube(data, tf)
        },

        aggregateCandles(data, tfMinutes) {
            if (tfMinutes <= 1) return data.slice()

            const tfMs = tfMinutes * 60 * 1000
            const aggregated = []
            let currentBucket = null

            for (let i = 0; i < data.length; i++) {
                const candle = data[i]
                const ts = candle[0]
                const bucketStart = Math.floor(ts / tfMs) * tfMs

                if (!currentBucket || currentBucket.start !== bucketStart) {
                    if (currentBucket) aggregated.push(currentBucket.candle)
                    currentBucket = {
                        start: bucketStart,
                        candle: [bucketStart, candle[1], candle[2], candle[3], candle[4], candle[5]]
                    }
                } else {
                    currentBucket.candle[2] = Math.max(currentBucket.candle[2], candle[2])
                    currentBucket.candle[3] = Math.min(currentBucket.candle[3], candle[3])
                    currentBucket.candle[4] = candle[4]
                    currentBucket.candle[5] += candle[5]
                }
            }

            if (currentBucket) aggregated.push(currentBucket.candle)
            return aggregated
        }
    }
})
