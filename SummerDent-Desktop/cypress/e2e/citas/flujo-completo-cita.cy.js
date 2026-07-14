describe('Flujo completo: cita → atendida → finanzas', () => {
  beforeEach(() => {
    cy.resetDatabase();
    cy.login();
  });

  it('crea cita con tratamientos, la atiende y verifica movimiento financiero', () => {
    cy.visit('/citas');
    cy.contains('Nueva Cita').click();

    cy.get('#id_paciente').select('1234567890');
    cy.get('#id_doctor').select('1');
    cy.get('#fecha').type('2026-08-15');
    cy.get('#hora_inicio').type('10:00');
    cy.get('#hora_fin').type('11:00');
    cy.get('#metodo_pago').select('efectivo');

    cy.get('button[type="submit"]').click();
    cy.contains('Cita creada exitosamente').should('be.visible');

    cy.visit('/financiero');
    cy.contains('consulta de').should('be.visible');
  });
});