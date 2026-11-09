# Consultas, revisão e autenticação da Fase 4

As rotas administrativas de listagem, busca por documento, fila e tempo médio consultam PostgreSQL por critérios próprios. `GET /service-orders/:id/legacy-details` projeta os itens e valores congelados; `GET /service-orders/:id/status?view=legacy` projeta o estado público, preservando estado técnico para as situações sem equivalente no legado. Preço ainda não calculado aparece como nulo. Datas de início, fim e entrega são persistidas no avanço.

Recusa fecha a tentativa de orçamento atual, cancela execução e libera a reserva antes de receber confirmação do Billing. A mesma OS retorna a diagnóstico com `attemptId` novo para as APIs de Execution e Billing. Eventos atrasados da tentativa anterior não avançam a nova. Orçamentos rejeitados ficam no histórico.

`POST /internal/auth/customers/lookup` só é registrado com `OS_AUTH_LOOKUP_TOKEN` configurado. A Lambda usa HTTPS e token dedicado, distinto do segredo JWT. O endpoint retorna somente identidade CPF/estado ativo. Não registre CPF, token ou corpo das requisições em logs.

As ordens migradas são consultáveis e somente leitura. Não disparam eventos e não entram na fila da nova Saga. Operações legadas em curso precisam ser concluídas ou reconciliadas antes do corte.

Para exercitar a integração com o estoque, execute `npm run test:bdd:stock` com as três branches correspondentes no ambiente. O BDD padrão do PR mantém a regressão dos fluxos já publicados.

## Paginação administrativa

GET /service-orders mantém a resposta em array, com 50 registros por padrão. Use limit de 1 a 100 e offset a partir de zero. O filtro document pode ser combinado com ambos. A ordenação usa createdAt decrescente e id crescente como desempate. Ordens legadas sem data vêm ao final. Para bases grandes já existentes, provisione os índices parciais de listagem com CREATE INDEX CONCURRENTLY antes de iniciar o rollout.
