import asyncio
import websockets
import json
import csv
import os

CSV_FILE = os.path.join(os.path.dirname(__file__), "history", "history.csv")


async def feed_data(websocket, path=None):
    print(f"Client connected: {websocket.remote_address}")
    try:
        if not os.path.exists(CSV_FILE):
            print(f"Error: CSV file not found at {CSV_FILE}")
            return

        # Lê todos os candles de uma vez
        candles = []
        with open(CSV_FILE, mode="r") as file:
            reader = csv.DictReader(file)
            for row in reader:
                candles.append(
                    {
                        "t": int(row["timestamp"]) * 1000,
                        "o": float(row["open"]),
                        "h": float(row["high"]),
                        "l": float(row["low"]),
                        "c": float(row["close"]),
                        "v": float(row["volume"]),
                    }
                )

        print(f"[WS] Enviando {len(candles)} candles...")

        # Envia em chunks de 500
        chunk_size = 500
        for i in range(0, len(candles), chunk_size):
            chunk = candles[i : i + chunk_size]
            msg = {
                "type": "history_chunk",
                "data": chunk,
                "total": len(candles),
                "current": min(i + chunk_size, len(candles)),
            }
            await websocket.send(json.dumps(msg))
            await asyncio.sleep(0.02)

        # Sinaliza fim do histórico
        await websocket.send(json.dumps({"type": "history_complete", "symbol": "MGC"}))
        print(f"[WS] Histórico enviado: {len(candles)} candles")

    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected: {websocket.remote_address}")
    except Exception as e:
        print(f"Error: {e}")


async def main():
    print(f"Starting WebSocket Server on ws://localhost:8765")
    print(f"CSV: {CSV_FILE}")
    async with websockets.serve(feed_data, "localhost", 8765):
        await asyncio.get_event_loop().create_future()


if __name__ == "__main__":
    asyncio.run(main())
