import os, json, uuid, requests
from flask import Flask, render_template, request, jsonify, redirect, abort

app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')
CLIENTS_FILE   = "clients.json"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "alpha@2024")

def load_clients():
    if not os.path.exists(CLIENTS_FILE): return {}
    with open(CLIENTS_FILE) as f: return json.load(f)

def save_clients(data):
    with open(CLIENTS_FILE, "w") as f: json.dump(data, f, indent=2, ensure_ascii=False)

@app.route("/")
def index(): return redirect("/admin")

@app.route("/manifest.json")
def manifest():
    return jsonify({"name":"Alpha Dashboard","short_name":"Alpha","start_url":"/","display":"standalone","background_color":"#0d0d0d","theme_color":"#F5A623","icons":[]})

@app.route("/admin", methods=["GET","POST"])
def admin():
    if request.method == "POST":
        if request.form.get("senha") != ADMIN_PASSWORD:
            return render_template("admin.html", autenticado=False, erro="Senha incorreta.", clientes={})
        return render_template("admin.html", autenticado=True, clientes=load_clients(), erro=None, sucesso=None)
    return render_template("admin.html", autenticado=False, erro=None, clientes={})

@app.route("/admin/add", methods=["POST"])
def add_client():
    if request.form.get("senha") != ADMIN_PASSWORD: abort(403)
    nome    = request.form.get("nome","").strip()
    api_key = request.form.get("api_key","").strip()
    periodo = request.form.get("periodo","last_30d")
    if not nome or not api_key:
        return render_template("admin.html", autenticado=True, clientes=load_clients(),
                               erro="Nome e API Key são obrigatórios.", sucesso=None)
    clients = load_clients()
    token   = uuid.uuid4().hex
    clients[token] = {"nome": nome, "api_key": api_key, "periodo": periodo}
    save_clients(clients)
    return render_template("admin.html", autenticado=True, clientes=clients, erro=None,
                           sucesso=f"Cliente '{nome}' criado!")

@app.route("/admin/delete/<token>", methods=["POST"])
def delete_client(token):
    if request.form.get("senha") != ADMIN_PASSWORD: abort(403)
    clients = load_clients()
    clients.pop(token, None)
    save_clients(clients)
    return render_template("admin.html", autenticado=True, clientes=clients, erro=None, sucesso="Cliente removido.")

@app.route("/c/<token>")
def dashboard(token):
    clients = load_clients()
    if token not in clients: abort(404)
    c = clients[token]
    return render_template("app.html", nome=c["nome"], token=token, periodo=c["periodo"])

@app.route("/api/data/<token>")
def api_data(token):
    clients = load_clients()
    if token not in clients: return jsonify({"error": "Link inválido"}), 404
    c      = clients[token]
    preset = request.args.get("date_preset","")
    df     = request.args.get("date_from","")
    dt     = request.args.get("date_to","")
    fields = "date,campaign,account_status,spend,impressions,reach,clicks,purchases,purchase_roas,cost_per_conversion"
    params = {"api_key": c["api_key"], "fields": fields}
    if df and dt:
        params["date_from"] = df
        params["date_to"]   = dt
    else:
        params["date_preset"] = preset or c["periodo"]
    try:
        r = requests.get("https://connectors.windsor.ai/facebook",
                         params=params, timeout=30, headers={"User-Agent":"Windsor/1.0"})
        r.raise_for_status()
        return jsonify(r.json())
    except requests.exceptions.HTTPError as e:
        return jsonify({"error": f"Erro Windsor.ai {e.response.status_code}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 503

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
