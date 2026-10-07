# Migração dos cadastros originais

A extração de código é acompanhada por exportação consistente e importação transacional dos clientes/veículos existentes. Os UUIDs, vínculo, estado ativo/inativo, contatos e datas são preservados. A importação usa somente o banco dono do OS Service; o runtime não consulta o banco do monólito.

## Exportar e verificar

No workspace da Fase 4, `scripts/export-identities.mjs` lê as tabelas Prisma originais `Customer`/`Vehicle` em uma transação `REPEATABLE READ READ ONLY`. `SOURCE_DATABASE_URL` identifica explicitamente a origem. O arquivo de destino deve ser novo; a exportação não substitui um arquivo existente e imprime apenas as contagens. Use o diretório local `Fase 4/private-data`, ignorado pelo Git, para snapshots com dados pessoais.

```powershell
$env:SOURCE_DATABASE_URL='<conexão da origem>'
node 'Fase 4/scripts/export-identities.mjs' 'Fase 4/private-data/identity-snapshot.json'
```

No repositório OS, após inicializar o esquema pelo serviço e compilar, indique explicitamente o destino e execute a simulação:

```powershell
npm ci
npm run build
$env:DATABASE_URL='<conexão do banco OS de destino>'
node scripts/import-identities.mjs '<caminho do snapshot>'
```

Sem `--commit`, a ferramenta valida o snapshot, executa as inserções na transação e faz **ROLLBACK**. O resumo distingue cadastros que seriam criados dos já idênticos. Valida versão, UUIDs, datas, CPF/CNPJ, placas, unicidade e vínculo antes de conectar. Conflitos entre documento/placa/UUID ou dados divergentes no destino abortam toda a operação; não sobrescreve cadastros do destino.

Para aplicar um snapshot previamente verificado:

```powershell
node scripts/import-identities.mjs '<caminho do snapshot>' --commit
```

A aplicação repetida de um snapshot idêntico informa os cadastros como inalterados. IDs sintéticos `customer-<documento>` do protótipo conflitam com UUIDs originais e exigem resolução explícita em um destino adequado.

## Garantias e alcance

Testes PostgreSQL verificam que simulação não deixa cadastros, aplicação preserva identidades/inatividade/datas, repetição é idempotente e um conflito de veículo reverte também clientes recém-inseridos. O CI inclui as quatro integrações do OS no gate de cobertura quando `TEST_DATABASE_URL` está definido. Testes unitários rejeitam snapshots inválidos antes de conectar ao banco.

A ferramenta foi executada apenas com dados sintéticos nos testes. O exportador passou em integração com as tabelas/colunas do esquema original e recusa substituir snapshots; ainda requer validação no banco real da Fase 3. Antes do corte, estabeleça uma janela de consistência para as escritas da origem, compare contagens e registros exportados/importados e conclua a migração de catálogo, estoque e ordens. A ferramenta cobre somente cadastros; não migra OS ou snapshots financeiros nem altera o gateway.
