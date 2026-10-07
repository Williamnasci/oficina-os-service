# Extração de clientes e veículos da Fase 3

Origem: `Williamnasci/oficina-api`, módulos `customers` e `vehicles`. Entidades, value objects, ports, DTOs e onze casos de uso foram extraídos do código existente. A única adaptação nesses arquivos foi o sufixo `.js` dos imports ESM. Os quinze arquivos de testes originais mantêm suas 46 verificações; os mocks recebem o import explícito de `jest` para ESM. [Manifesto de origem e hashes](identity-extraction.json).

O OS Service usa esses casos de uso em `POST/GET/PATCH/DELETE /customers` e `/vehicles`, incluindo consulta por documento, CPF/CNPJ, placas antigas/Mercosul, contatos opcionais, UUIDs, normalização e desativação lógica. Os cadastros continuam restritos a `admin`, como nos controllers originais. DTO inválido retorna 400; regra de domínio, 422; ausência, 404; duplicidade, 409. PATCH/DELETE retornam 204.

Os adapters PostgreSQL substituem os repositórios Prisma e mantêm seus contratos. Não acessam o banco do monólito. Na abertura da OS, a resolução do cadastro usa a mesma conexão/transação da OS, inbox e outbox, com locks por documento e placa. Preserva as regras extraídas de `OpenServiceOrderUseCase`: rejeitar cliente inativo, veículo inativo e veículo de outro proprietário. Quando o cadastro já existe, a OS utiliza seu snapshot persistido, sem sobrescrevê-lo com dados enviados na requisição.

## Migração e limites

`migrateIdentity` adapta o esquema do protótipo distribuído, preservando IDs, vínculo e datas existentes, e acrescenta ID único de veículo. Pode ser executada novamente. Não importa automaticamente os dados da Fase 3. Clientes criados no protótipo com ID `customer-<documento>` permanecem com esse ID; um backfill explícito deve resolver esses IDs antes de expor dados do protótipo em operações que exigem UUID. Os novos cadastros usam UUID.

Esta extração não conclui a migração de `service-orders`: catálogo, estoque, cálculos, revisão após recusa, consultas operacionais, estados públicos e autenticação CPF ainda precisam de extração/regressão. A API e os dados originais permanecem preservados.

## Verificação

`npm run test:cov` executa os 24 testes nativos de domínio/adapters/HTTP/Saga e os 46 testes originais sobre os módulos compilados. A cobertura inclui todos os arquivos de `src`, exceto o bootstrap `main.mjs`, sem excluir os módulos extraídos. Resultado local: 94,88% de linhas; 96,15% de branches; 97,84% de funções. LCOV e resumo JSON são publicados como artefatos do CI.

`TEST_DATABASE_URL=... npm run test:integration` usa banco de teste separado: abertura concorrente reutiliza o mesmo cliente/veículo; tentativas com proprietário incorreto ou cadastro inativo não gravam OS, inbox ou outbox; cadastro criado antes da rejeição também sofre rollback. A integração verifica persistência, deduplicação e restart. O CI mantém BDD distribuído e deploy em Kubernetes Kind.
