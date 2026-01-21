# plantao_host.py
from __future__ import annotations

import argparse
import json
import os
import socket
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, abort, jsonify, make_response, request, send_from_directory


# ==========================
# Helpers
# ==========================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_local_ips() -> list[str]:
    """Tenta descobrir IPs locais pra você testar na rede."""
    ips = set()

    # 1) hostname -> ips
    try:
        host = socket.gethostname()
        for info in socket.getaddrinfo(host, None):
            ip = info[4][0]
            if ":" not in ip and not ip.startswith("127."):
                ips.add(ip)
    except Exception:
        pass

    # 2) caminho comum pra descobrir ip “principal”
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            ips.add(ip)
    except Exception:
        pass

    return sorted(ips)


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def atomic_write_json(path: Path, data: dict) -> None:
    """Escrita atômica: salva em arquivo temporário e troca no final."""
    ensure_dir(path.parent)
    payload = json.dumps(data, ensure_ascii=False, indent=2)

    with tempfile.NamedTemporaryFile(
        "w", delete=False, dir=str(path.parent), encoding="utf-8"
    ) as tmp:
        tmp.write(payload)
        tmp.flush()
        os.fsync(tmp.fileno())
        tmp_path = Path(tmp.name)

    os.replace(str(tmp_path), str(path))


# ==========================
# Model
# ==========================
def default_model() -> dict:
    now = datetime.now()
    return {
        "colaboradores": [],
        "escala": {
            "month": now.month,
            "year": now.year,
            "monthYear": f"{now.month}/{now.year}",
            "dayOwnerIds": {},
            "dayTimes": {},
        },
        "apoioPedro": {
            "nome": "PEDRO",
            "whatsapp": "",
            "telefone": "",
            "email": "",
            "obs": "Contato de apoio caso nenhum colaborador do plantão atenda.",
        },
        "updatedAt": None,
    }


def normalize_model(data: dict) -> dict:
    """Garante as chaves que o front espera, sem quebrar se vier incompleto."""
    if not isinstance(data, dict):
        data = {}

    base = default_model()

    out = {**base, **data}

    # colaboradores
    if not isinstance(out.get("colaboradores"), list):
        out["colaboradores"] = []

    # escala
    escala = out.get("escala")
    if not isinstance(escala, dict):
        escala = {}
    escala_base = base["escala"]
    escala = {**escala_base, **escala}

    if not isinstance(escala.get("dayOwnerIds"), dict):
        escala["dayOwnerIds"] = {}
    if not isinstance(escala.get("dayTimes"), dict):
        escala["dayTimes"] = {}

    if not escala.get("month"):
        escala["month"] = datetime.now().month
    if not escala.get("year"):
        escala["year"] = datetime.now().year
    if not escala.get("monthYear"):
        escala["monthYear"] = f"{escala['month']}/{escala['year']}"

    out["escala"] = escala

    # apoioPedro
    ap = out.get("apoioPedro")
    if not isinstance(ap, dict):
        ap = {}
    ap_base = base["apoioPedro"]
    out["apoioPedro"] = {**ap_base, **ap}

    # updatedAt
    if "updatedAt" not in out:
        out["updatedAt"] = None

    return out


# ==========================
# App Factory
# ==========================
def create_app(site_dir: Path, db_file: Path) -> Flask:
    app = Flask(__name__)
    write_lock = threading.Lock()

    def read_db() -> dict:
        ensure_dir(db_file.parent)
        if not db_file.exists():
            return default_model()

        try:
            with db_file.open("r", encoding="utf-8") as f:
                raw = json.load(f)
                return normalize_model(raw)
        except Exception:
            d = default_model()
            d["_warning"] = "Arquivo JSON inválido/ilegível. Reiniciado em branco."
            return d

    # --- CORS simples (pra frontend em outra porta/origem) ---
    @app.after_request
    def add_cors_headers(resp):
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, PUT, POST, DELETE, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return resp

    # ==========================
    # API
    # ==========================
    @app.get("/api/health")
    def api_health():
        return jsonify({"ok": True, "time": now_iso()}), 200

    @app.route("/api/plantao", methods=["OPTIONS"])
    def api_options():
        return make_response("", 204)

    @app.get("/api/plantao")
    def api_get_plantao():
        data = normalize_model(read_db())
        return jsonify(data), 200

    @app.put("/api/plantao")
    def api_put_plantao():
        if not request.is_json:
            return jsonify({"error": "Body precisa ser JSON"}), 400

        incoming = request.get_json(silent=True)
        if incoming is None:
            return jsonify({"error": "JSON inválido"}), 400

        with write_lock:
            data = normalize_model(incoming)
            data["updatedAt"] = now_iso()
            atomic_write_json(db_file, data)

        return jsonify(data), 200

    @app.post("/api/plantao/replace")
    def api_replace_plantao():
        if not request.is_json:
            return jsonify({"error": "Body precisa ser JSON"}), 400

        incoming = request.get_json(silent=True)
        if incoming is None:
            return jsonify({"error": "JSON inválido"}), 400

        with write_lock:
            data = normalize_model(incoming)
            data["updatedAt"] = now_iso()
            atomic_write_json(db_file, data)

        return jsonify(data), 200

    @app.post("/api/plantao/reset")
    def api_reset_plantao():
        with write_lock:
            blank = default_model()
            blank["updatedAt"] = now_iso()
            atomic_write_json(db_file, blank)
        return jsonify(blank), 200

    # ==========================
    # Site (static)
    # ==========================
    @app.get("/favicon.ico")
    def favicon():
        return make_response("", 204)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_site(path: str):
        # nunca servir /api por aqui
        if path.startswith("api/") or path == "api":
            abort(404)

        if path == "":
            path = "index.html"

        target = site_dir / path
        if target.is_file():
            return send_from_directory(site_dir, path)

        abort(404)

    return app


# ==========================
# Main
# ==========================
def main():
    parser = argparse.ArgumentParser(
        description="Disdal Plantão - Host (site) + API (JSON) em um único script"
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("PLANTAO_HOST", "0.0.0.0"),
        help="Host para bind (default 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PLANTAO_PORT", "5000")),
        help="Porta (default 5000)",
    )
    parser.add_argument(
        "--site-dir",
        default=os.environ.get("PLANTAO_SITE_DIR", ""),
        help="Pasta do site (onde fica index.html). Default: pasta do script.",
    )
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("PLANTAO_DATA_DIR", ""),
        help="Pasta do banco JSON. Default: <site-dir>/data",
    )

    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    site_dir = Path(args.site_dir).resolve() if args.site_dir else script_dir

    data_dir = Path(args.data_dir).resolve() if args.data_dir else (site_dir / "data")
    db_file = data_dir / "plantao.json"

    # validação básica
    if not (site_dir / "index.html").exists():
        print(f"❌ index.html não encontrado em: {site_dir}")
        print("➡️ Coloque o plantao_host.py na mesma pasta do index.html")
        print("   ou rode assim:")
        print('   python plantao_host.py --site-dir "C:\\caminho\\do\\site"')
        return

    ensure_dir(data_dir)

    app = create_app(site_dir=site_dir, db_file=db_file)

    print("========================================")
    print(" Disdal Plantão - HOST + API (PORTÁTIL)")
    print("========================================")
    print(f"Site dir: {site_dir}")
    print(f"DB file : {db_file}")
    print("")
    print("Rotas principais:")
    print("  GET  /                  -> index.html")
    print("  GET  /admin.html         -> admin")
    print("  GET  /api/health         -> teste rápido")
    print("  GET  /api/plantao        -> dados")
    print("  PUT  /api/plantao        -> salva dados")
    print("  POST /api/plantao/reset")
    print("  POST /api/plantao/replace")
    print("")
    print(f"Rodando em: http://{args.host}:{args.port}")
    print("Acessos prováveis na rede:")
    print(f"  http://127.0.0.1:{args.port}")
    for ip in list_local_ips():
        print(f"  http://{ip}:{args.port}")
    print("========================================")

    # threaded=True ajuda quando vários usuários acessam ao mesmo tempo (modo teste)
    app.run(host=args.host, port=args.port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
