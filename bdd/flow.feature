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
