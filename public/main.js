// No local do user (public/trading-vue.js), o objeto é injetado como TradingVueLib
const { DataCube } = window.TradingVueLib || window.TradingVue || {}

new Vue({
    el: '#app',
    data: {
        chart: new DataCube({
            chart: { type: 'Candles', tf: '1m', data: [] },
            onchart: [], offchart: []
        }),
        ohlcvBase: [], // Dados originais de 1m
        indexBased: false,

        currentTimeframe: 1,
        availableTfs: [1, 5, 15, 60, 240, 1440],
        width: window.innerWidth,
        height: window.innerHeight - 50 // Compensação para a toolbar
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
        const ws = new WebSocket('ws://127.0.0.1:8765')

        ws.onopen = () => console.log('Feed WebSocket conectado')

        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data)
            if (!msg.candle) return

            this.ohlcvBase.push(msg.candle)

            if (this.currentTimeframe === 1) {
                // Para os primeiros 10 pontos, usamos .set() para garantir sincronia do Worker
                // Depois usamos .update() para performance
                if (this.ohlcvBase.length < 10) {
                    this.chart.set('chart.data', this.ohlcvBase)
                } else {
                    try {
                        this.chart.update(msg)
                    } catch (err) {
                        this.chart.set('chart.data', this.ohlcvBase)
                    }
                }
            } else {
                const aggregated = this.aggregateCandles(this.ohlcvBase, this.currentTimeframe)
                this.chart.set('chart.data', aggregated)
            }
        }
    },
    watch: {
        // Ao trocar o modo de Gaps, forçamos um refresh completo dos dados
        // Isso evita o erro 'unshift' no Internal Worker do TradingVue
        indexBased() {
            const data = this.currentTimeframe === 1
                ? this.ohlcvBase
                : this.aggregateCandles(this.ohlcvBase, this.currentTimeframe)
            this.chart.set('chart.data', data)
        }
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.onResize)
    },
    methods: {
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
            this.chart.set('chart.tf', label) // Sincroniza o TF para o modo IB
            const aggregated = this.aggregateCandles(this.ohlcvBase, tf)
            this.chart.set('chart.data', aggregated)
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
