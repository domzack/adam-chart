import asyncio
import websockets
import json
import csv
import os

# Configurações do arquivo CSV e histórico
CSV_FILE = os.path.join(os.path.dirname(__file__), 'history', 'ohlcv_COMEX_MINI_MGC1!_1.csv')

async def feed_data(websocket, path=None):
    print(f"Client connected: {websocket.remote_address}")
    try:
        if not os.path.exists(CSV_FILE):
            print(f"Error: CSV file not found at {CSV_FILE}")
            return

        with open(CSV_FILE, mode='r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                # O formato no JS espera timestamp em ms
                # OHLCV: [t, o, h, l, c, v]
                candle = [
                    int(row['timestamp']) * 1000,
                    float(row['open']),
                    float(row['high']),
                    float(row['low']),
                    float(row['close']),
                    float(row['volume'])
                ]
                
                msg = { "candle": candle }
                await websocket.send(json.dumps(msg))
                
                # Enviar um a cada 50ms para teste rápido
                await asyncio.sleep(0.05)
                
    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected: {websocket.remote_address}")
    except Exception as e:
        print(f"Error: {e}")

async def main():
    print("Starting WebSocket Server on ws://localhost:8765")
    async with websockets.serve(feed_data, "localhost", 8765):
        await asyncio.get_event_loop().create_future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
