// No local do user (public/trading-vue.js), o objeto é injetado como TradingVueLib
const { DataCube } = window.TradingVueLib || window.TradingVue || {}

new Vue({
    el: '#app',
    data: {
        chart: new DataCube({
            chart: { type: 'Candles', tf: '1m', data: [] },
            onchart: [], offchart: []
        }),
        ohlcvBase: [], // Dados originais de 1m (backup para agregação de timeframes)
        indexBased: false,

        currentTimeframe: 1,
        availableTfs: [1, 5, 15, 60, 240, 1440],
        width: window.innerWidth,
        height: window.innerHeight - 50, // Compensação para a toolbar
        ws: null,
        connectionStatus: 'disconnected'
    },
    mounted() {
        window.addEventListener('resize', this.onResize)

        // Adiciona overlay vazio (ex: EMA)
        this.chart.add('onchart', {
            type: 'Spline',
            name: 'EMA',
            data: []
        })

        // Inicia WebSocket
        this.connectWebSocket()
    },
    watch: {
        // Ao trocar o modo de Gaps, forçamos um refresh completo dos dados
        indexBased() {
            if (this.currentTimeframe !== 1) {
                const aggregated = this.aggregateCandles(this.ohlcvBase, this.currentTimeframe)
                this.chart.set('chart.data', aggregated)
            }
        }
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.onResize)
    },
    methods: {
        connectWebSocket() {
            const ws = new WebSocket('ws://127.0.0.1:8765')
            this.ws = ws

            ws.onopen = () => {
                console.log('[ADAM-CHART] Feed WebSocket conectado')
                this.connectionStatus = 'connected'
            }

            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data)

                // ===== Formato adam-feed (Streamer) =====
                if (msg.type) {
                    this.handleFeedMessage(msg)
                    return
                }

                // ===== Formato legado (ws_server.py local do adam-chart) =====
                if (msg.candle) {
                    this.handleLegacyCandle(msg.candle)
                    return
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

        /**
         * Processa mensagens do adam-feed (Streamer).
         * Usa DataCube.merge() para histórico e DataCube.update() para tempo real.
         * O DataCube cuida da reatividade/render automaticamente.
         */
        handleFeedMessage(msg) {
            console.log(msg.type)
            switch (msg.type) {
                case 'history_loaded':
                // console.log(msg)
                case 'history_chunk':
                    if (msg.data && Array.isArray(msg.data)) {
                        // console.log(`[ADAM-CHART] Recebido ${msg.type}: ${msg.data.length} candles (${msg.current || '?'}/${msg.total || '?'})`)

                        // Converte de {t, o, h, l, c, v} para [t*1000, o, h, l, c, v]
                        const candles = msg.data.map(item => [
                            item.t * 1000,  // Timestamp em ms
                            item.o, item.h, item.l, item.c, item.v
                        ])

                        // Salva no backup para agregação
                        for (const c of candles) {
                            this.ohlcvBase.push(c)
                        }
                        this.ohlcvBase.sort((a, b) => a[0] - b[0])

                        if (this.currentTimeframe === 1) {
                            // DataCube.merge combina por timestamp automaticamente
                            this.chart.merge('chart.data', candles)
                        } else {
                            const aggregated = this.aggregateCandles(this.ohlcvBase, this.currentTimeframe)
                            this.chart.set('chart.data', aggregated)
                        }
                    }
                    break

                case 'candle_update':
                    if (msg.data && Array.isArray(msg.data)) {
                        for (const item of msg.data) {
                            const candle = [
                                item.t * 1000,
                                item.o, item.h, item.l, item.c, item.v
                            ]

                            // Atualiza backup local
                            const lastIdx = this.ohlcvBase.length - 1
                            if (lastIdx >= 0 && this.ohlcvBase[lastIdx][0] === candle[0]) {
                                this.ohlcvBase[lastIdx] = candle
                            } else {
                                this.ohlcvBase.push(candle)
                            }

                            if (this.currentTimeframe === 1) {
                                // DataCube.update() sabe atualizar/criar candle automaticamente
                                this.chart.update({ candle: candle })
                            } else {
                                const aggregated = this.aggregateCandles(this.ohlcvBase, this.currentTimeframe)
                                this.chart.set('chart.data', aggregated)
                            }
                        }
                    }
                    break

                case 'history_complete':
                    console.log(`[ADAM-CHART] Histórico completo recebido para ${msg.symbol}`)
                    break

                case 'history_not_found':
                    console.log(`[ADAM-CHART] ${msg.message}`)
                    break

                default:
                    console.log(`[ADAM-CHART] Mensagem desconhecida: ${msg.type}`)
            }
        },

        /**
         * Processa candles no formato legado do ws_server.py local.
         * Formato: [t, o, h, l, c, v] (timestamp já em ms)
         */
        handleLegacyCandle(candle) {
            this.ohlcvBase.push(candle)

            if (this.currentTimeframe === 1) {
                // DataCube.update() cuida de tudo: insere ou atualiza, render automático
                this.chart.update({ candle: candle })
            } else {
                const aggregated = this.aggregateCandles(this.ohlcvBase, this.currentTimeframe)
                this.chart.set('chart.data', aggregated)
            }
        },

        goToEnd() {
            if (this.ohlcvBase.length === 0) return

            const visibleData = this.currentTimeframe === 1
                ? this.ohlcvBase
                : this.aggregateCandles(this.ohlcvBase, this.currentTimeframe)

            if (visibleData.length === 0) return

            const lastTimestamp = visibleData[visibleData.length - 1][0]
            this.chart.goto(lastTimestamp)
            console.log(`[ADAM-CHART] Navegou para o último candle: ${new Date(lastTimestamp).toLocaleString()}`)
        },

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
            this.currentTimeframe = tf
            const label = this.tfLabel(tf)
            this.chart.set('chart.tf', label)

            if (tf === 1) {
                // Volta para 1m: usa merge para restaurar a base completa
                this.chart.set('chart.data', this.ohlcvBase.slice())
            } else {
                const aggregated = this.aggregateCandles(this.ohlcvBase, tf)
                this.chart.set('chart.data', aggregated)
            }
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
