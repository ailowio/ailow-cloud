# Ambiente Windows (WSL2 + Docker Desktop) — Ailow Cloud

> Máquina de referência: VAIO Positivo `VJFE59F11X-B1011H` (AMD Ryzen 7 5700U).  
> Serve para qualquer Windows 10/11 Pro com Docker Desktop no backend WSL2.

## Por que existe este doc

Em 2026-11-11/12 o install do WSL2:

1. abria sozinho no login (Docker Desktop ainda estava em `HKCU\...\Run` apesar de `AutoStart: false` nas settings);
2. ao aceitar o install, o Windows reiniciava para o firmware/BIOS e **travava** se a virtualização AMD não estivesse clara;
3. bloqueava o `docker compose` local (pendência do diário em `docs/plano-execucao.md`).

Isto **não danifica o hardware**. O risco é só travar no POST/BIOS → segurar o botão de ligar ~10–15 s e ligar de novo.

## Gate rápido (antes de Compose ou S07+)

```powershell
# 1) Git do app (L-0010): tem de ser o repo do ailow-cloud
git -C D:\apps\ailow-cloud rev-parse --show-toplevel   # D:/apps/ailow-cloud
git -C D:\apps\ailow-cloud status -sb                   # NÃO pode ser "No commits yet"

# 2) WSL2
wsl -l -v                                              # Ubuntu  Running/Stopped, VERSION 2

# 3) Docker engine (não só o cliente)
docker info                                            # sem erro de npipe/dockerDesktopLinuxEngine

# 4) Segredo no lugar certo (SEC-01: não cat / não cole o conteúdo)
Test-Path D:\apps\ailow-cloud\.env                     # True
git -C D:\apps\ailow-cloud check-ignore -v .env        # .gitignore:... .env

# 5) Portas livres (L-0012)
netstat -ano | findstr ":54329 :3000 :5173"
```

## BIOS (AMD) — o que editar se o install mandar para o firmware

Entrar com **F2** (ou Del). Alterar **só**:

| Item | Valor | Onde costuma aparecer |
|------|-------|------------------------|
| **SVM Mode** (AMD SVM / Secure Virtual Machine) | **Enabled** | Advanced → CPU / AMD CBS |
| **IOMMU** (se existir) | Enabled | Advanced / AMD |
| **NX Mode** / Execute Disable (se existir) | Enabled | Security / CPU |

Salvar: **F10 → Yes**. Não mexer em Secure Boot, boot order, SATA, senhas.

Aviso conhecido e **não bloqueante** depois do install:

`wsl: Falha ao detectar suporte à virtualização aninhada, erro: ERROR_INVALID_DATA`

Nested virt importa para VM-dentro-de-WSL. WSL2 + Ubuntu + Docker Desktop no dia a dia do Ailow Cloud funcionam sem isso.

## WSL2 — estado esperado

Pacote: WSL **3.0.5** (ou mais novo). Distro padrão: **Ubuntu** em versão **2**.

```powershell
wsl --status
wsl --version
wsl -l -v
wsl -d Ubuntu -- echo ok
```

Atualizar (quando já instalado):

```powershell
wsl --update
```

**Não** reativar o Docker no login do Windows enquanto o WSL estiver quebrado: isso reabre o prompt `wsl.exe` sozinho. Preferir abrir o Docker Desktop sob demanda.

## Docker Desktop

- Backend: **WSL2** (`EngineTypeWindows: wsl2`).
- Autostart: manter **desligado** (`settings-store.json` → `AutoStart: false`) **e** sem entrada `Docker Desktop` em `HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`.
- Aceitar os termos na primeira abertura da UI.

```powershell
# Subir o app (na raiz do repo; precisa do .env ao lado do compose.yaml)
cd D:\apps\ailow-cloud
docker compose up --build
curl http://127.0.0.1:3000/health
```

Caminho sem Docker (dev diário): `npm run dev:db` → `dev:seed` (1ª vez) → `dev:api` → `dev:web` — ver README.

## Arquivo de ambiente

- Lugar certo: `D:\apps\ailow-cloud\.env` (Compose lê ao lado de `compose.yaml`).
- **Nunca** versionar, ler em chat ou colar conteúdo (SEC-01). Só nomes em `.env.example`.
- Obrigatórias para Compose: `POSTGRES_PASSWORD`, `AUTH_PEPPER` (≥ 32).

## Se travar de novo

1. Power 10–15 s → liga.
2. Se cair na BIOS sozinho: confira SVM Enabled → F10.
3. No Windows: `wsl -l -v` e `docker info` antes de `compose up`.
4. Se o prompt do WSL voltar no login: remova `Docker Desktop` da chave Run (como acima).
