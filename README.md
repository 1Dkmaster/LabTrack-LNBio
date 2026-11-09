# LabTrack-LNBio

Aplicação web com API local em Python e banco SQLite. A interface e a API são servidas pela mesma origem; equipamentos, usuários, atividades, revisões e auditoria ficam no banco do servidor, não no `localStorage` do navegador.

## Executar no Windows

Requer Python 3.10 ou superior. Abra um terminal na pasta do projeto:

Se acabou de instalar o Python, reabra o terminal (ou o VS Code) para atualizar o `PATH`.

Inicie o servidor:

```powershell
python server.py
```

Depois, acesse <http://127.0.0.1:8000>. Na primeira abertura, a tela solicita a criação do administrador: escolha seu nome, usuário e senha. **Não existe credencial padrão.** Após criar a conta, o sistema entra automaticamente; nas próximas aberturas, use o usuário e a senha escolhidos. A senha precisa ter pelo menos 8 caracteres.

O banco é criado em `data/labtrack.sqlite3`. Use `LABTRACK_PORT` para escolher outra porta e `LABTRACK_DB_PATH` para definir o local do banco.

## Modo temporário sem login

O acesso autenticado é o padrão. O modo temporário sem login pode ser habilitado explicitamente definindo `$env:LABTRACK_AUTH_ENABLED = "0"` antes de iniciar o servidor.

- Ao registrar atividade ou revisão, informe o nome do responsável/revisor. Esses nomes são autodeclarados; a interface, os relatórios e o banco identificam esses registros explicitamente como **não autenticados**.
- Como não há identificação segura de pessoas, o sistema não consegue confirmar autoria, aplicar permissões individuais ou impedir que a mesma pessoa registre e aprove uma atividade. Uma decisão nesse modo não equivale a uma aprovação institucional e não atualiza a situação técnica oficial do equipamento.
- O modo local permite acesso aos equipamentos e às rotas operacionais a qualquer pessoa que consiga usar o navegador aberto no computador. Não exponha o servidor à rede, não use dados sensíveis e não trate os registros como evidência de identidade verificada.
- O modo sem login só inicia em um endereço loopback. O backend rejeita tentativa de configuração em endereço de rede.

## Administração de contas

No PowerShell, autenticação já está ligada por padrão. Para garantir que não está usando o modo temporário, remova a variável e inicie o servidor:

```powershell
Remove-Item Env:LABTRACK_AUTH_ENABLED -ErrorAction SilentlyContinue
python server.py
```

Na primeira execução sem administrador, use o formulário **Criar administrador** na própria página. A configuração inicial só pode ser feita localmente e apenas uma vez. Também é possível criar a conta no terminal com `python server.py create-admin`. Administradores gerenciam contas e permissões por TAG; responsáveis técnicos revisam atividades; operadores registram atividades nos equipamentos atribuídos. Senhas são armazenadas com PBKDF2-HMAC-SHA256 e salt individual, e as sessões usam cookies `HttpOnly` e `SameSite=Strict`.

O servidor determina a autoria pela sessão autenticada e impede que quem registrou a atividade a aprove. O servidor escuta apenas em `127.0.0.1` por padrão.

## Rastreabilidade

- Atividades e revisões são registros separados e não há endpoint para apagá-los. A tabela de auditoria bloqueia `UPDATE` e `DELETE` no SQLite.
- No modo autenticado, o status oficial só é atualizado quando uma atividade é aprovada. No modo temporário, as decisões ficam no histórico, mas não atualizam os dados técnicos oficiais.
- Relatórios e exportações indicam se os nomes de responsável e revisor foram autenticados.
- Endpoints principais: `/api/session`, `/api/equipment`, `/api/activities`, `/api/users` e `/api/audit`.

## Dados iniciais e compatibilidade

O banco começa com os 18 equipamentos identificados no catálogo de inventário já usado pelo projeto. Campos ausentes na planilha continuam marcados como não informados; nenhum histórico técnico fictício é inserido.

Os registros que já existiam no `localStorage` do protótipo **não são apagados nem importados automaticamente**. Essa versão anterior incluía dados demonstrativos e uma migração automática poderia transformar exemplos em registros oficiais. Faça a exportação CSV no navegador antigo e confira os dados antes de qualquer migração manual.

O nome e as TAGs do catálogo são dados de identificação, não critérios de calibração. O sistema ainda **não calcula nem aprova calibração metrológica**: limites, ensaios, incertezas e regras de decisão devem ser configurados somente a partir de procedimentos técnicos aprovados. Não use o checklist genérico como substituto desses procedimentos.

## Backup

Crie uma cópia consistente do banco, inclusive durante a execução do servidor:

```powershell
python server.py backup
```

O arquivo será salvo em `data/backups/`. Também é possível informar outro destino:

```powershell
python server.py backup C:\Backups\labtrack.sqlite3
```

Guarde os backups fora do diretório servido pela aplicação, proteja o acesso ao arquivo e teste a restauração periodicamente.

## Implantação em servidor institucional

Esta versão usa o servidor HTTP padrão do Python e foi preparada para desenvolvimento e validação em uma única instância; **não a exponha diretamente à internet nem use HTTP em produção**. Para uso por vários dispositivos na rede institucional, hospede-a em servidor administrado, atrás de proxy HTTPS, defina `LABTRACK_COOKIE_SECURE=1`, restrinja `LABTRACK_ALLOWED_HOSTS`, proteja o arquivo SQLite e configure backup e restauração.

A auditoria local não é inviolável contra alguém com acesso administrativo ao host ou ao arquivo do banco. Antes de tratar os dados como registros oficiais, a implantação deve ser revisada pela TI/segurança e pela área técnica, incluindo disponibilidade, retenção, backup, recuperação, gestão de contas e critérios metrológicos aprovados.

## Testes

Execute os testes de API com:

```powershell
python -m unittest discover -s tests -v
```
