# jsMyAdmin

Administrador de MySQL no navegador, inspirado no phpMyAdmin e feito com Next.js e Bun. Você entra com as credenciais do próprio servidor MySQL e gerencia bancos, tabelas, dados e usuários, sem instalar nada no servidor do banco.

A interface está em português do Brasil e tem tema claro e escuro.

## Funcionalidades

- **Conexão:** login por campos ou por URL (`mysql://usuario:senha@host:3306/banco?ssl=true`), com banco padrão opcional e SSL/TLS.
- **Dados:** navegação paginada com ordenação e filtro `WHERE`, edição direto na grade, inserção e exclusão de linhas.
- **Estrutura:** edição de colunas, índices e chaves estrangeiras, além da definição da tabela.
- **Console SQL:** editor com destaque de sintaxe, várias instruções por execução, histórico local e execução com `Ctrl/Cmd + Enter`.
- **Bancos:** criação e exclusão, collation padrão e listagem de rotinas, triggers e eventos.
- **Tabelas:** renomear ou mover, alterar opções (engine, collation, comentário), manutenção (`CHECK`, `ANALYZE`, `OPTIMIZE`, `REPAIR`, `CHECKSUM`), esvaziar e excluir.
- **Importação e exportação:** importa arquivos `.sql` e exporta em SQL (banco ou tabela), CSV ou JSON (tabela).
- **Servidor:** status, variáveis, engines e charsets, processos com opção de encerrar, usuários e privilégios.

## Requisitos

- [Bun](https://bun.sh) 1.4.4 ou [Docker](https://docs.docker.com/get-docker/). O acesso ao banco usa `Bun.SQL`, então o app não roda em Node.js.
- Um servidor MySQL acessível a partir de onde o app estiver rodando.

## Desenvolvimento

```bash
bun install
bun dev
```

Abra <http://localhost:3000> e faça login no seu servidor MySQL. Em desenvolvimento, nenhuma variável de ambiente é obrigatória.

| Comando         | O que faz                    |
| --------------- | ---------------------------- |
| `bun dev`       | Servidor de desenvolvimento  |
| `bun run build` | Build de produção            |
| `bun run lint`  | ESLint                       |

## Produção com Docker

Crie o `.env` com a chave da sessão e suba o container:

```bash
echo "SESSION_SECRET=$(openssl rand -base64 32)" > .env
docker compose up -d --build
```

O app fica em `127.0.0.1:3000`, de propósito acessível só pela própria máquina. Para expor na rede, coloque um proxy reverso com TLS na frente (Caddy, Nginx etc.) que envie o cabeçalho `X-Forwarded-Proto`.

Para conectar a um MySQL na mesma máquina, use `host.docker.internal` como host no login. O MySQL precisa aceitar conexões vindas da rede do Docker, não só de `127.0.0.1`.

## Configuração

| Variável              | Obrigatória             | Descrição |
| --------------------- | ----------------------- | --------- |
| `SESSION_SECRET`      | Sim, em produção        | Chave que criptografa o cookie de sessão. Sem ela, o app gera uma chave aleatória a cada início e todas as sessões caem no restart. O `docker-compose.yml` não sobe sem essa variável. |
| `MYSQL_ALLOWED_HOSTS` | Não, mas recomendada    | Hosts MySQL permitidos no login, separados por vírgula. Vazia, permite qualquer host. |
| `COOKIE_SECURE`       | Não                     | `true` força o atributo `Secure` no cookie e qualquer outro valor o desativa. Sem a variável, ele segue o protocolo da requisição, incluindo `X-Forwarded-Proto`. |

## Segurança

O jsMyAdmin não tem usuários próprios: quem entra pode fazer tudo o que o usuário MySQL informado no login pode fazer, inclusive executar SQL arbitrário.

- **Credenciais:** ficam no navegador, em um cookie `HttpOnly` e `SameSite=Strict` criptografado com AES-GCM. O app não as grava em disco.
- **Exposição:** não publique o app sem TLS, ou a senha do MySQL trafega em texto puro no login.
- **Hosts permitidos:** defina `MYSQL_ALLOWED_HOSTS` em qualquer instalação pública. Sem ela, qualquer visitante pode usar o servidor do app para abrir conexões com outros hosts, inclusive na sua rede interna.
- **Força bruta:** o login não limita tentativas. Em instalações públicas, restrinja o acesso no proxy reverso (VPN, lista de IPs ou autenticação básica).
- **Privilégios:** prefira usuários MySQL com o mínimo de privilégios necessário em vez de `root`.

## Limitações

- A importação envia o arquivo inteiro de uma vez ao servidor, então arquivos muito grandes podem falhar. Ela roda os comandos em sequência e para no primeiro erro, sem desfazer os anteriores.
- O histórico do console SQL fica no `localStorage` do navegador e não acompanha o usuário em outros dispositivos.

## Estrutura do projeto

```text
app/(app)/    Páginas autenticadas (servidor, banco, tabela, console SQL)
app/api/      Rotas de login, logout, consulta e exportação
app/login/    Tela de login
components/   Interface (views, abas de tabela, componentes shadcn/ui em ui/)
lib/          Conexão com o MySQL, sessão, parser de URL e utilitários de SQL
proxy.ts      Redireciona para /login quem não tem cookie de sessão
```

Principais tecnologias: Next.js 16, React 19, Bun, Tailwind CSS 4, shadcn/ui, AG Grid, CodeMirror e SWR.
