# Correções do parecer — OS

Updates dos cadastros aceitam conexão transacional; conflitos de UUID e atributos naturais possuem mensagens distintas. O importador rejeita mesmo UUID com CPF diferente, sem sobrescrever dados. O id do veículo permanece UNIQUE NOT NULL; a PK natural existente é preservada.

Deadlines vencidos são selecionados no PostgreSQL sem a janela global de 500 agregados; regressão cobre OS antiga após 501 agregados recentes e um único comando de cancelamento. OpenAPI foi reparado em UTF-8 e imagem GHCR passa do job container para deploy por output.

O BDD acrescenta total zero: a política atual rejeita a cotação, compensa a Saga e cancela a execução sem checkout/pagamento. Cinco integrações PostgreSQL e os testes originais acompanham o gate de cobertura. Repositórios participantes preservam seus contratos; gratuidade requer decisão funcional.
