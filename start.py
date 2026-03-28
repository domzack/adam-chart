import subprocess
import sys
import os
import time
import threading
import socketserver
import http.server

# Lista para rastrear processos e threads
processes = []

def log_reader(pipe, label):
    """Lê logs de um processo pipe e exibe no console."""
    try:
        for line in iter(pipe.readline, ''):
            if line:
                print(f"[{label}] {line.strip()}")
    except Exception:
        pass

def check_python_deps():
    """Verifica e instala dependências do servidor Python."""
    try:
        import websockets
        print("[CHECK] Dependência 'websockets' encontrada.")
    except ImportError:
        ans = input("[!] Dependência 'websockets' não encontrada. Instalar agora? (s/n): ")
        if ans.lower() == 's':
            subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
        else:
            print("[!] Aviso: O WebSocket não funcionará sem 'websockets'.")

def start_ws_server():
    """Inicia o servidor WebSocket."""
    print("[INIT] Iniciando WebSocket em ws://localhost:8765...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ws_path = os.path.join(base_dir, "server", "ws_server.py")
    p = subprocess.Popen([sys.executable, ws_path], 
                         stdout=subprocess.PIPE, 
                         stderr=subprocess.STDOUT, 
                         text=True, 
                         bufsize=1)
    processes.append(p)
    threading.Thread(target=log_reader, args=(p.stdout, "WS_SERVER"), daemon=True).start()

def start_http_server():
    """Inicia um servidor HTTP simples na porta 8080."""
    PORT = 8080
    Handler = http.server.SimpleHTTPRequestHandler
    
    def serve():
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"[FRONT] Servidor Web rodando em http://localhost:{PORT}")
            httpd.serve_forever()
            
    t = threading.Thread(target=serve, daemon=True)
    t.start()
    print(f"[INIT] Servidor HTTP configurado na porta {PORT}.")

if __name__ == "__main__":
    # Garante que o script rode a partir da própria pasta
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        print("=== Adam Chart Orchestrator ===\n")
        check_python_deps()
        
        # Pergunta sobre o WebSocket
        res_ws = input("\n> Deseja iniciar o Feed WebSocket (Data Stream)? (s/n): ")
        if res_ws.lower() == 's':
            start_ws_server()
            
        # Pergunta sobre o Front-end
        res_fs = input("> Deseja iniciar o Servidor Web para abrir o Gráfico? (s/n): ")
        if res_fs.lower() == 's':
            start_http_server()
            
        print("\n" + "="*30)
        print("Tudo pronto! Pressione CTRL+C para encerrar todos os processos.")
        print("="*30 + "\n")
        
        # Mantém o script principal vivo
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n\n[SHUTDOWN] Interrupção detectada. Encerrando processos...")
        for p in processes:
            p.terminate()
            p.wait()
        print("[DONE] Todos os serviços foram parados.")
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] Ocorreu um erro inesperado: {e}")
        for p in processes:
            p.terminate()
        sys.exit(1)
