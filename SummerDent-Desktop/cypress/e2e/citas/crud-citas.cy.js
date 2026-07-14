describe('Citas CRUD', () => {
  beforeEach(() => {
    cy.resetDatabase();
    cy.login();
  });

  it('lista citas existentes', () => {
    cy.visit('/citas');
    cy.contains('Juan Pérez').should('be.visible');
  });

  it('crea una nueva cita', () => {
    cy.visit('/citas');
    cy.contains('Nueva Cita').click();

    cy.get('#id_paciente').select('1234567890');
    cy.get('#id_doctor').select('1');
    cy.get('#fecha').type('2026-08-01');
    cy.get('#hora_inicio').type('09:00');
    cy.get('#hora_fin').type('10:00');

    cy.get('button[type="submit"]').click();
    cy.contains('Cita creada exitosamente').should('be.visible');
  });

  it('cambia estado de cita a Atendida', () => {
    cy.visit('/citas');
    cy.contains('agendada').should('be.visible');
    cy.get('.action-btn--edit').first().click();
    cy.get('#estado').select('Atendida');
    cy.get('button[type="submit"]').click();
    cy.contains('Atendida').should('be.visible');
  });
});