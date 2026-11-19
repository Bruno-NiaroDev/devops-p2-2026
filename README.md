# Avaliação Prática de DevOps — Prova C: Cadastro de Cursos

## Integrantes do grupo

- Bruno Araujo Bezerra da Silva — RA 25001989
- Lívia Ribeiro Venezian — RA 23001001

## Arquitetura

```
              HTTP (fetch do navegador, com CORS)
┌──────────────────────────┐        ┌────────────────────────────────┐
│ VM1 - vm1-web            │ ─────► │ VM2 - vm2-api                  │
│ Docker: nginx + HTML     │        │ Docker Compose:                │
│ Formulário de cadastro   │        │  • API Node.js (Express) :3000 │
│ Link "Listar todos"      │        │  • MySQL 8.4 (volume)          │
│ porta 80                 │        │ POST /curso   GET /cursos      │
└──────────────────────────┘        └────────────────────────────────┘
OpenTofu provisiona as VMs | cloud-init prepara o Docker | Ansible implanta os serviços
```

## Estrutura do projeto

Todo o projeto fica dentro da pasta `avaliacao/`:

```
avaliacao/
├── README.md
├── iac/
│   ├── main.tf
│   └── cloud_init.yaml
├── ansible/
│   ├── playbook.yml
│   └── inventory          (gerado/atualizado pelo tofu apply)
├── app/
│   ├── Dockerfile
│   ├── index.html
│   └── cursos.html
└── api/
    ├── Dockerfile
    ├── docker-compose.yml
    ├── package.json
    └── server.js
```

| Caminho | Conteúdo |
|---|---|
| `avaliacao/iac/main.tf` | OpenTofu + provider libvirt: cria as VMs `vm1-web` (1 GB) e `vm2-api` (2 GB), ambas Ubuntu 24.04, e gera `avaliacao/ansible/inventory` com os IPs |
| `avaliacao/iac/cloud_init.yaml` | Cria o usuário `aluno` com chave SSH e instala/ativa o Docker |
| `avaliacao/ansible/inventory` | Identifica a VM1 (grupo `web`) e a VM2 (grupo `api`) |
| `avaliacao/ansible/playbook.yml` | Aguarda o cloud-init, sobe API + MySQL na VM2 e o servidor web na VM1 |
| `avaliacao/app/` | `Dockerfile` (nginx) + HTML/JS do formulário e da listagem |
| `avaliacao/api/` | `Dockerfile`, `docker-compose.yml` e a API Node.js (`server.js`) |

### API REST (VM2, porta 3000)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/curso` | Recebe `nome`, `instrutor`, `preco` (decimal) e `vagas` (inteiro) e grava no MySQL |
| GET | `/cursos` | Retorna todos os cursos em JSON |
| GET | `/health` | Verificação de saúde |

**CORS:** a API libera apenas a origem da aplicação web (`http://IP_DA_VM1`), os métodos `GET`, `POST` e `OPTIONS` (preflight) e o cabeçalho `Content-Type`. O Ansible define a origem em `api/.env` (`CORS_ORIGIN`) com o IP real da VM1.

## Pré-requisitos (host Linux)

- KVM/QEMU + libvirt com a rede `default` ativa e o pool `default`
- OpenTofu, Ansible e acesso à internet (imagem Ubuntu e imagens Docker)
- Chave SSH do laboratório:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/devops_lab -N ""
```

> As VMs usam `cpu { mode = "host-passthrough" }` no `main.tf`. Isso é necessário porque a imagem `mysql:8.4` exige uma CPU com x86-64-v2, que a CPU virtual padrão do libvirt (`qemu64`) não tem.

## Execução

Todos os comandos partem da raiz do repositório.

1. Provisionar as VMs (isso também gera `avaliacao/ansible/inventory` com os IPs):

```bash
cd avaliacao/iac
tofu init
tofu apply
tofu output
```

2. Implantar os serviços:

```bash
cd ../ansible
ansible-playbook -i inventory playbook.yml
```

No final, o playbook mostra os endereços da aplicação web e da API.

## Endereço de acesso à aplicação

Endereços do ambiente implantado no laboratório:

| Serviço | Endereço |
|---|---|
| **Aplicação web (VM1) — cadastro** | http://192.168.122.43/ |
| **Listagem de cursos (VM1)** | http://192.168.122.43/cursos.html |
| **API REST (VM2)** | http://192.168.122.160:3000/cursos |

Os IPs são atribuídos por DHCP pela rede `default` do libvirt. Se o ambiente for recriado em outra máquina, eles podem mudar: os novos endereços aparecem no `tofu output` (`vm1_web_ip` e `vm2_api_ip`) e no final da execução do playbook. Nesse caso, use:

- **Aplicação web (VM1):** `http://IP_DA_VM1/`
- **Listagem:** `http://IP_DA_VM1/cursos.html`, pelo link "Listar todos os cursos"
- **API (VM2):** `http://IP_DA_VM2:3000/cursos`

Teste rápido da API:

```bash
curl -X POST http://IP_DA_VM2:3000/curso -H "Content-Type: application/json" \
  -d '{"nome":"DevOps","instrutor":"Prof. Silva","preco":199.90,"vagas":30}'
curl http://IP_DA_VM2:3000/cursos
```

Conferir a persistência no MySQL da VM2:

```bash
ssh -i ~/.ssh/devops_lab aluno@IP_DA_VM2 \
  "cd /opt/cursos-api && docker compose exec mysql mysql -ucursos -pcursos123 cursos -e 'SELECT * FROM cursos'"
```

## Destruir o ambiente

```bash
cd avaliacao/iac
tofu destroy
```
