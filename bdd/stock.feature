Feature: Estoque e revisão no ciclo distribuído da OS
  Scenario: Baixa única depois do pagamento
    Given uma OS paga em orçamento com duas peças reservadas
    When a oficina executa o reparo e entrega o veículo
    Then duas peças são baixadas uma única vez

  Scenario: Liberação das peças e reembolso se a fila falhar
    Given uma OS paga com peças reservadas cuja fila irá falhar
    When a Saga compensa a falha na fila
    Then a execução está cancelada e o pagamento está reembolsado
    And a reserva de peças foi liberada sem baixa

  Scenario: Recusa devolve a reserva e reabre diagnóstico para novo orçamento
    Given uma OS com duas peças reservadas e orçamento aguardando aprovação
    When o cliente recusa o primeiro orçamento
    Then a mesma OS permite aprovar um novo orçamento com a reserva refeita
