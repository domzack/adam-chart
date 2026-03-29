# DataCube API - Referência Completa

**Fonte:** `public/trading-vue.js` — TradingVue.js v0.10.0
**Documentação extraída diretamente do código-fonte (bundle Webpack). Nada foi inventado.**

---

## Hierarquia de Classes

```
DCEvents        (linha 17167)
  └─ DCCore     (linha 17868)
      └─ DataCube (linha 18680)
```

Todas as instâncias de `DataCube` herdam métodos de `DCCore` e `DCEvents`.

---

## Construtor

### `new DataCube(data, sett)`  — linha 18685

```js
function DataCube(data = {}, sett = {})
```

**Parâmetros:**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `data` | Object | `{}` | Estrutura de dados do gráfico |
| `sett` | Object | `{}` | Configurações opcionais |

**Inicialização interna (corpo do constructor):**

1. Cria `this.ww` = `new script_ww_api(this)` — interface do Web Worker
2. Cria `this.sett` = `sett_proxy(sett, this.ww)` — proxy que envia mudanças de settings ao WW
3. Seta `this.data` = `data`
4. Cria `this.agg` = `new AggTool(this, sett.aggregation)` — agregador de ticks
5. Cria `this.se_state` = `{}` — estado do Script Engine

**Settings padrão (def_sett, linha 18698):**

| Setting | Tipo | Padrão | Descrição |
|---------|------|--------|-----------|
| `aggregation` | Number | `100` | Intervalo de agregação de updates (ms) |
| `script_depth` | Number | `0` | 0 = executa script em todos os dados |
| `auto_scroll` | Boolean | `true` | Auto scroll ao novo candle |
| `scripts` | Boolean | `true` | Habilita scripts de overlays |
| `ww_ram_limit` | Number | `0` | Limite de RAM do Web Worker (MB) |
| `node_url` | String | `null` | URL do Node.js ao invés de WW |
| `shift_measure` | Boolean | `true` | Shift+click para medição |

---

## Propriedades

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `data` | Object | Dados originais do gráfico (acesso direto) |
| `tv` | Component | Referência ao componente `<trading-vue>`. Setado por `init_tvjs()` |
| `sett` | Object | Configurações (proxy via `sett_proxy`) |
| `se_state` | Object | Estado do Script Engine |
| `ww` | Object | Interface do Web Worker (`script_ww_api`) |
| `agg` | AggTool | Instância do agregador de ticks |
| `gldc` | Object | Mapeamento grid-layer id → DC id |
| `dcgl` | Object | Mapeamento DC id → grid-layer id |
| `loader` | Function | Callback de lazy loading (setado via `onrange()`) |
| `loading` | Boolean | Flag de carregamento |
| `last_chunk` | Array | Último range/timeframe carregado |

---

## Sistema de Query

Todos os métodos que aceitam `query` usam o mesmo padrão de resolução.

**Formato:** `lado.tipo_ou_nome.campo`

**Resolução interna** (`get_by_query`, linha 18219):

1. Split da query por `.`
2. Roteamento baseado no primeiro segmento:
   - `chart` → `chart_as_piv(tuple)`
   - `onchart` ou `offchart` → `query_search(query, tuple)`
   - `datasets` → `query_search(query, tuple)` + resolução de dados via `this.dss`
   - qualquer outro → busca em `onchart` + `offchart` simultaneamente

**Retorno de `get_by_query`:** Array de objetos `{ p, i, v }` onde:
- `p` — objeto pai (parent)
- `i` — índice ou chave
- `v` — valor atual

**Filtro de locked:** Se `chuck` não for `true`, overlays com `locked: true` são filtrados (linha 18267).

**Exemplos de query resolvidos por `query_search` (linha 18287):**

A busca compara a query contra: `x.id`, `x.name`, `x.type`, e `x.settings.$uuid`.

---

## Métodos Públicos (DataCube)

### `add(side, overlay)` — linha 18728

Adiciona um overlay reativamente.

```js
add(side, overlay)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `side` | String | `'onchart'`, `'offchart'` ou `'datasets'` |
| `overlay` | Object | Descritor do overlay |

**Retorno:** `string` — o id gerado (ex: `"onchart.Spline0"`), ou `undefined` se side inválido.

**Comportamento:** Push no array `this.data[side]`, chama `update_ids()`, retorna `overlay.id`.

**Validação:** Se `side` não for `'onchart'`, `'offchart'` nem `'datasets'`, retorna sem fazer nada.

---

### `get(query)` — linha 18740

Retorna todos os objetos que combinam com a query.

```js
get(query)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | String | Query string |

**Retorno:** `Array` — array de valores (`v`) dos objetos encontrados.

**Implementação:** Chama `get_by_query(query)` e mapeia para `x.v`.

---

### `get_one(query)` — linha 18748

Retorna o primeiro objeto que combina com a query.

```js
get_one(query)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | String | Query string |

**Retorno:** `Object` — o primeiro valor (`v`) encontrado, ou `undefined`.

**Implementação:** Chama `get_by_query(query)` e pega `[0]`.

---

### `set(query, data)` — linha 18756

Substitui valores reativamente.

```js
set(query, data)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | String | Query string |
| `data` | Object/Array | Novo valor |

**Retorno:** void

**Comportamento:** Para cada objeto encontrado, encontra o índice (`obj.i` ou `obj.p.indexOf(obj.v)`) e usa `this.tv.$set(obj.p, i, data)` para substituição reativa. Chama `update_ids()` no final.

---

### `merge(query, data)` — linha 18782

Mescla dados reativamente.

```js
merge(query, data)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | String | Query string |
| `data` | Object/Array | Dados a mesclar |

**Retorno:** void

**Comportamento por tipo:**

1. **Se `obj.v` é Array e `data` é Array:**
   - Se `obj.v[0]` existe e `obj.v[0].length >= 2` → trata como **timeseries**, chama `merge_ts(obj, data)` (merge por timestamp)
   - Senão → chama `merge_objects(obj, data, [])` (merge por índice)

2. **Se `obj.v` é Object** → chama `merge_objects(obj, data)`

Chama `update_ids()` no final.

---

### `del(query)` — linha 18816

Remove overlays que combinam com a query.

```js
del(query)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | String | Query string |

**Retorno:** void

**Comportamento:** Para cada objeto, encontra o índice e usa `this.tv.$delete(obj.p, i)` para remoção reativa. Chama `update_ids()` no final.

---

### `update(data)` — linha 18843

Atualiza ou adiciona data point (candle ou tick).

```js
update(data)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | Object | Objeto de update |

**Retorno:** `boolean` — `true` se um novo candle foi formado.

**Roteamento:**
- Se `data['candle']` existe → `update_candle(data)` (linha 18140)
- Senão → `update_tick(data)` (linha 18161)

**Formatos aceitos de `data`:**

```js
// Candle completo com timestamp:
{ candle: [timestamp_ms, open, high, low, close, volume] }

// Candle sem timestamp (auto):
{ candle: [open, high, low, close, volume] }

// Tick de preço:
{ price: 8800, volume: 22 }

// Com valores de overlays (query → value):
{ price: 8800, volume: 22, 'EMA': 8576, 'BB': [8955, 8522] }
{ candle: [...], 'EMA': 8576 }
```

---

### `lock(query)` — linha 18854

Bloqueia overlays de serem encontrados por queries.

```js
lock(query)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | String | Query string |

**Retorno:** void

**Comportamento:** Para cada objeto com `id` e `type`, seta `x.v.locked = true`.

---

### `unlock(query)` — linha 18866

Desbloqueia overlays para queries.

```js
unlock(query)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | String | Query string (passada com `chuck=true` para ignorar lock) |

**Retorno:** void

**Comportamento:** Para cada objeto com `id` e `type`, seta `x.v.locked = false`.

---

### `show(query)` — linha 18878

Mostra overlays.

```js
show(query)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | String | Query string |

**Retorno:** void

**Comportamento:**
- Se query é `'offchart'` ou `'onchart'` → adiciona `.` ao final
- Se query é `'.'` → vira string vazia
- Chama `this.merge(query + '.settings', { display: true })`

---

### `hide(query)` — linha 18891

Esconde overlays.

```js
hide(query)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `query` | String | Query string |

**Retorno:** void

**Comportamento:** Mesma lógica de `show()`, mas com `{ display: false }`.

---

### `onrange(callback)` — linha 18905

Registra callback para lazy loading de dados.

```js
onrange(callback)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `callback` | Function | Função chamada quando range precisa de mais dados |

**Retorno:** void

**Comportamento:**
1. Seta `this.loader = callback`
2. Após 0ms (`setTimeout`), chama `this.tv.set_loader(callback ? this : null)`

**O callback é invocado por `range_changed()` (linha 17960) com:** `(range, tf, dataCallback)`
- `range` — `[start, end]` em timestamp
- `tf` — timeframe
- `dataCallback(d)` — função para receber dados (ou retornar Promise)

---

## Métodos Internos (DCCore)

### `init_tvjs($root)` — linha 17882

Chamado pelo componente TradingVue uma única vez.

```js
init_tvjs($root)
```

**Comportamento:**
1. Seta `this.tv = $root`
2. Chama `this.init_data()`
3. Chama `this.update_ids()`
4. Configura watcher em `.settings` → `on_settings()`
5. Configura watcher em `$uuid` changes → `on_ids_changed()`
6. Configura watcher em `datasets` → `dataset_Dataset.watcher`

---

### `init_data()` — linha 17913

Normaliza a estrutura de dados.

**Comportamento:**
- Se `chart` não existe em `this.data` → cria com `type: 'Candles'`, `data: this.data.ohlcv || []`
- Se `onchart` não existe → cria como `[]`
- Se `offchart` não existe → cria como `[]`
- Se `chart.settings` não existe → cria como `{}`
- Remove `this.data.ohlcv` (legado)
- Se `datasets` não existe → cria como `[]`
- Inicializa proxies de datasets em `this.dss`

---

### `update_ids()` — linha 18064

Gera IDs para todos os overlays e constrói mapeamentos.

**Comportamento:**
- Seta `this.data.chart.id = "chart.{type}"`
- Para cada overlay em `onchart`: gera `id = "onchart.{type}{count}"`, gera `name` se não exist, cria `settings` se não exist
- Para cada overlay em `offchart`: gera `id = "offchart.{type}{count}"`, mesma lógica, considera `grid.id` para grids
- Preenche `this.gldc` (grid→DC) e `this.dcgl` (DC→grid)

---

### `update_candle(data)` — linha 18140

Processa update de candle.

```js
update_candle(data)
```

**Parâmetros:**
- `data` — objeto com `data['candle']` (array)

**Retorno:** `boolean` — `true` se novo candle (`t >= t_next`)

**Comportamento:**
1. Pega último candle de `this.data.chart.data`
2. Calcula `tf` de `this.tv.$refs.chart.interval_ms`
3. Se candle tem >= 6 elementos → usa `candle[0]` como timestamp
4. Senão → calcula timestamp automático baseado em `now` e `tf`
5. Chama `this.agg.push('ohlcv', candle)` — AggTool
6. Chama `this.update_overlays(data, t, tf)`
7. Retorna `t >= t_next`

---

### `update_tick(data)` — linha 18161

Processa update de tick de preço.

```js
update_tick(data)
```

**Parâmetros:**
- `data` — objeto com `data['price']` e opcionalmente `data['volume']`

**Retorno:** `boolean` — `true` se novo candle

**Comportamento:**
1. Se `t >= t_next` → cria novo candle `[t, tick, tick, tick, tick, volume]`, faz push em `ohlcv`, chama `scroll_to(t)`
2. Senão → atualiza último candle: `H = max(tick, H)`, `L = min(tick, L)`, `C = tick`, `V += volume`
3. Chama `this.agg.push('ohlcv', ...)` em ambos os casos
4. Chama `this.update_overlays(data, t, tf)`
5. Retorna `t >= t_next`

---

### `update_overlays(data, t, tf)` — linha 18193

Atualiza todos os overlays com valores de um data point.

```js
update_overlays(data, t, tf)
```

**Comportamento:**
- Itera keys de `data`
- Ignora: `'price'`, `'volume'`, `'candle'`, `'t'`
- Se key inclui `'datasets.'` → `this.agg.push(k, data[k], tf)`
- Senão: transforma valor em array `[t, ...valores]`, adiciona `.data` ao path se não existir, chama `this.agg.push(k, [t, ...val], tf)`

---

### `get_by_query(query, chuck)` — linha 18219

Resolve query string em objetos do DataCube.

```js
get_by_query(query, chuck)
```

**Retorno:** `Array` de `{ p, i, v }`

**Comportamento:**
1. Split da query por `.`
2. Roteia por `tuple[0]`:
   - `'chart'` → `chart_as_piv(tuple)`
   - `'onchart'`/`'offchart'` → `query_search(query, tuple)`
   - `'datasets'` → `query_search(query, tuple)` + resolve dados via `this.dss`
   - default → busca em onchart + offchart
3. Filtra: `!(x.v || {}).locked || chuck`

---

### `chart_as_piv(tuple)` — linha 18273

Resolve query de chart.

**Retorno:** `[{ p, i, v }]`

- Se `tuple[1]` existe (ex: `'data'`) → `p = this.data.chart, i = field, v = chart[field]`
- Senão → `p = this.data, i = 'chart', v = this.data.chart`

---

### `query_search(query, tuple)` — linha 18287

Busca overlays em um array por id, name, type ou $uuid.

**Comportamento:**
- `side = tuple[0]` (ex: `'onchart'`)
- `path = tuple[1]` (ex: `'Spline'`)
- `field = tuple[2]` (ex: `'data'`)
- Filtra `this.data[side]` onde: `x.id === query || x.id.includes(path) || x.name === query || x.name.includes(path) || query.includes(x.settings.$uuid)`
- Se `field` existe → retorna `[{ p: x, i: field, v: x[field] }]`
- Senão → retorna `[{ p: this.data[side], i: indexOf(x), v: x }]`

---

### `merge_objects(obj, data, new_obj = {})` — linha 18317

Merge reativo de objetos.

**Comportamento:**
1. Cria novo objeto (`new_obj`)
2. `Object.assign(new_obj, obj.v)` — copia dados atuais
3. `Object.assign(new_obj, data)` — sobrescreve com novos dados
4. `this.tv.$set(obj.p, obj.i, new_obj)` — aplica reativamente

---

### `merge_ts(obj, data)` — linha 18332

Merge de timeseries por timestamp.

**Comportamento:**
1. Calcula ranges: `r1 = [obj.v[0][0], obj.v[last][0]]`, `r2 = [data[0][0], data[last][0]]`
2. Calcula overlap: `o = [max(r1[0], r2[0]), min(r1[1], r2[1])]`
3. Se overlap existe (`o[1] >= o[0]`):
   - Chama `ts_overlap()` para encontrar segmentos e dados merged
   - Faz splice nos arrays originais
   - Chama `combine()` para juntar dst + overlap + src
4. Senão: `combine(obj.v, [], data)` — sem overlap, apenas concatena

---

### `ts_overlap(arr1, arr2, range)` — linha 18378

Encontra segmentos sobrepostos por timestamp.

**Retorno:** `{ od, d1, d2 }`
- `od` — array merged dos dados sobrepostos (ordenado por timestamp)
- `d1` — `[startIndex, count]` do segmento em arr1
- `d2` — `[startIndex, count]` do segmento em arr2

**Comportamento:**
- Filtra elementos dentro do range
- Cria mapa de timestamp → dados
- Ordena chaves
- Retorna dados merged e índices dos segmentos

---

### `combine(dst, o, src)` — linha 18416

Combina destination + overlap + source.

**Retorno:** Array combinado

**Casos:**
- `src` está contido em `dst` → retorna `dst` com overlap aplicado
- `src` vem depois de `dst` → `dst.push(...o, ...src)` (ou `concat` se > 100k)
- `src` vem antes de `dst` → `src.push(...o, ...dst)` (ou `concat` se > 100k)

---

### `fast_merge(data, point, main = true)` — linha 18464

Merge rápido de um único data point.

```js
fast_merge(data, point, main)
```

**Comportamento:**
- Se `data` é vazio ou `point[0] > last_t` → push + auto-scroll se `main=true`
- Se `point[0] === last_t` → `this.tv.$set(data, data.length-1, point)` se `main`, senão assignment direto

---

### `scroll_to(t)` — linha 18489

Auto-scroll para um timestamp.

**Comportamento:**
- Se cursor está locked → retorna
- Calcula offset `d = range[1] - last_candle[0]`
- Se `d > 0` → `this.tv.goto(t + d)`

---

### `range_changed(range, tf, check = false)` — linha 17960

**Async.** Chamado pelo TradingVue quando o range visual muda.

**Comportamento:**
1. Se não tem `this.loader` → retorna
2. Se não está `this.loading` e `range[0] < first_candle`:
   - Seta `this.loading = true`
   - Pausa 250ms
   - Chama `this.loader(range, tf, callback)` — aceita Promise ou callback
   - Se retornar Promise, aguarda e chama `chunk_loaded(result)`
3. Salva `this.last_chunk = [range, tf]`

---

### `chunk_loaded(data)` — linha 18043

Processa dados carregados pelo loader.

**Comportamento:**
- Se `data` é Array → `this.merge('chart.data', data)`
- Se `data` é Object → itera keys e faz `this.merge(k, data[k])` para cada
- Seta `this.loading = false`
- Se `this.last_chunk` existe → re-chama `range_changed()`

---

## Classe: `AggTool` (linha 18523)

Agregador de ticks. Bufferiza updates antes de aplicar no chart.

### Constructor

```js
new AggTool(dc, int = 100)
```

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `dc` | DataCube | — | Referência ao DataCube |
| `int` | Number | `100` | Intervalo de agregação (ms) |

**Propriedades:**
- `this.symbols` — `{}` — buffer de updates por símbolo
- `this.int` — intervalo em ms
- `this.dc` — referência ao DataCube
- `this.st_id` — id do timeout
- `this.data_changed` — flag

### `push(sym, upd, tf)` — linha 18541

Adiciona update ao buffer.

**Comportamento:**
- Se não tem `st_id` → agenda `update()` via `setTimeout`
- Se não existe símbolo no buffer → cria novo entry `{ upd, t, data: [] }`
- Se `upd[0] >= old.upd[0] + tf` e não é dataset → refina o anterior (`refine()`), cria novo entry
- Senão → atualiza entry existente
- Se é dataset → push no array `data`

### `update()` — linha 18583

Loop de aplicação do buffer.

**Comportamento:**
- Para cada símbolo no buffer:
  - `'ohlcv'` → `this.dc.fast_merge(data, upd)` em `chart.data`
  - dataset → `update_ds()`
  - outro → `this.dc.fast_merge(data, upd, false)` no overlay
- Envia para WW via `this.dc.ww.just('update-data', out)` se `data_changed`
- Reagenda `setTimeout(() => this.update(), this.int)`

### `refine(sym, upd)` — linha 18623

Finaliza data point anterior.

**Comportamento:**
- `'ohlcv'` → `fast_merge` em `chart.data`
- outro → `fast_merge` no overlay com `main=false`

### `update_ds(sym, out)` — linha 18635

Processa updates de datasets.

### `clear()` — linha 18645

Reseta `this.symbols = {}`.

---

## Classe: `sett_proxy` (linha 18501)

Proxy que intercepta leitura/escrita de `this.sett` e envia mudanças ao Web Worker.

```js
sett_proxy(sett, ww)
```

- **get** → retorna `sett[k]`
- **set** → `sett[k] = v`, envia `ww.just('update-dc-settings', sett)`

---

## Eventos Customizados (`DCEvents.on_custom_event`, linha 17246)

O DataCube escuta eventos emitidos por overlays e tools via `custom-event`.

| Evento | Handler | Descrição |
|--------|---------|-----------|
| `register-tools` | `register_tools(args)` | Registra ferramentas de desenho |
| `exec-script` | `exec_script(args)` | Executa script de um overlay no WW |
| `exec-all-scripts` | `exec_all_scripts()` | Re-executa todos os scripts |
| `data-len-changed` | `data_changed(args)` | Dados do chart mudaram, re-envia ao WW |
| `tool-selected` | — | Seleciona tool, seta `this.data.tool` |
| `grid-mousedown` | `grid_mousedown(args)` | Click no grid, cria tool ou RangeTool |
| `drawing-mode-off` | `drawing_mode_off()` | Sai do modo desenho |
| `change-settings` | `change_settings(args)` | Aplica settings via `merge()` |
| `range-changed` | `scripts_onrange(r)` | Re-executa scripts com `execOnRange` |
| `scroll-lock` | `on_scroll_lock(flag)` | Lock/unlock scroll |
| `object-selected` | `object_selected(args)` | Seleciona/deseleciona objeto |
| `remove-tool` | `system_tool('Remove')` | Remove tool selecionada |
| `before-destroy` | `before_destroy()` | Cleanup antes de destruir |

---

## Eventos do Web Worker (`DCEvents.ww.onevent`, linha 17175)

| Tipo de evento | Handler | Descrição |
|----------------|---------|-----------|
| `request-data` | — | WW solicita dados. Envia via `upload-data` |
| `overlay-data` | `on_overlay_data(data)` | WW retorna dados calculados para overlays |
| `overlay-update` | `on_overlay_update(data)` | WW envia update incremental para overlays |
| `data-uploaded` | — | Confirma upload, reseta `_data_uploading` |
| `engine-state` | — | Atualiza `this.se_state` |
| `modify-overlay` | `modify_overlay(data)` | WW modifica campos de um overlay |

---

## Referências de ID

### Formato de IDs gerados por `update_ids()`

- Chart: `"chart.{type}"` (ex: `"chart.Candles"`)
- Onchart: `"onchart.{type}{count}"` (ex: `"onchart.Spline0"`)
- Offchart: `"offchart.{type}{count}"` (ex: `"offchart.RSI1"`)

### Formato grid-layer ID

- `"g{gridId}_{type}_{count}"` (ex: `"g0_Spline_0"`, `"g1_RSI_0"`)

### Mapeamentos

- `this.gldc[gridLayerId]` → DC id
- `this.dcgl[dcId]` → grid-layer id
