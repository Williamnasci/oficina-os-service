Feature: Ciclo distribuído de uma ordem de serviço
  Scenario: Entrega após aprovação, pagamento e reparo
    Given uma OS diagnosticada e com orçamento aprovado
    And o provedor confirma o pagamento da OS
    When a oficina executa o reparo e entrega o veículo
    Then a OS fica DELIVERED e contém sete transições no histórico

  Scenario: Compensação depois de falha na fila
    Given uma OS aprovada cujo enfileiramento irá falhar
    And o provedor confirma o pagamento da OS
    When a Saga compensa a falha na fila
    Then a execução está cancelada e o pagamento está reembolsado

  Scenario: Compensação de orçamento com total zero na política atual
    Given uma OS diagnosticada apenas com serviço de valor zero
    When a Saga trata a rejeição do orçamento de total zero
    Then a execução é cancelada sem checkout ou pagamento
