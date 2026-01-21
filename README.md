
# Painel de Plantão

Projeto simples de **Plantão** com:

- **Frontend estático** (HTML/CSS/JS) para visualizar o responsável do dia e contatos
- **Área Admin** para cadastrar colaboradores e montar a escala do mês
- **API em Python (Flask)** que persiste os dados em um arquivo `JSON` (sem banco de dados)

---

## 📁 Estrutura do projeto

> Exemplo (ajuste conforme seu repositório):

```

/
├─ index.html
├─ admin.html
├─ css/
│  └─ styles.css
├─ js/
│  ├─ api.js
│  ├─ app.js
│  └─ admin.js
├─ assets/
│  └─ iconePlantao.png
├─ data/
│  └─ plantao.json          # criado automaticamente pela API
└─ plantao_host.py          # Host + API (tudo junto)

````

---

## ✅ Requisitos

- **Python 3.10+** (recomendado)
- Pacote:
  - `flask`

Instalação:
```bash
pip install flask
````

---

## 🚀 Rodando (Site + API no mesmo processo)

O `plantao_host.py`:

* serve os arquivos estáticos (`index.html`, `admin.html`, `css/`, `js/`, etc.)
* expõe endpoints de API em `/api/*`
* salva o estado em `data/plantao.json`

### 1) Rodar local (somente na sua máquina)

```bash
python plantao_host.py
```

Acesse:

* Painel: `http://127.0.0.1:5000/`
* Admin: `http://127.0.0.1:5000/admin.html`
* Health: `http://127.0.0.1:5000/api/health`

### 2) Rodar na rede (outras máquinas acessam)

O script roda com `0.0.0.0` (aceita conexões externas). Acesse via IP do servidor, por exemplo:

* `http://192.168.4.145:5000/`

> **Importante:** liberar a porta no Firewall (veja abaixo).

---

## 🔥 Liberar acesso externo (Firewall do Windows)

No servidor onde o Python roda, abra PowerShell **como Administrador** e execute:

```bat
netsh advfirewall firewall add rule name="Plantao 5000" dir=in action=allow protocol=TCP localport=5000
```

Teste de outra máquina:

* `http://IP_DO_SERVIDOR:5000/api/health`

Se retornar JSON com `"ok": true`, está ok ✅

---

## 🧠 Persistência sem banco (arquivo JSON)

Os dados ficam salvos em:

* `data/plantao.json`

A escrita é feita de forma **atômica** (salva em arquivo temporário e troca no final), reduzindo chance de corromper o JSON.

---

## 🔌 Rotas da API

* `GET  /api/health`
  Status do serviço.

* `GET  /api/plantao`
  Retorna o estado completo (colaboradores + escala + apoio).

* `PUT  /api/plantao`
  Salva o JSON enviado pelo frontend (atualiza `updatedAt`).

* `POST /api/plantao/reset`
  Reseta o arquivo para o modelo padrão.

* `POST /api/plantao/replace`
  Substitui o conteúdo inteiro por um JSON enviado.

---

## 🧩 Configurando o Frontend (API Base)

### Site e API na mesma origem (recomendado)

No `index.html` e `admin.html`:

```html
<script>
  window.__PLANTAO_API_BASE__ = "";
</script>
```

### Site e API em portas diferentes (ex.: IIS + API separada)

No `index.html` e `admin.html`:

```html
<script>
  window.__PLANTAO_API_BASE__ = "http://192.168....:5000";
</script>
```

> Nesse cenário, a API precisa liberar CORS (o host já pode configurar isso).

---

## 🧪 Dicas de diagnóstico

* Se abrir `http://IP:5000/` e der **Not Found**:

  * confirme se `index.html` está na mesma pasta do `plantao_host.py`
* Se o painel não carrega dados:

  * teste `http://IP:5000/api/plantao` no navegador
  * abra o Console do navegador (F12) e verifique erros de CORS / URL / porta

---
