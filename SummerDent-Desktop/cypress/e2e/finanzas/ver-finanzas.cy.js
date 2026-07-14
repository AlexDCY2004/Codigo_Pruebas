describe('Finanzas', () => {
  beforeEach(() => {
    cy.resetDatabase();
    cy.login();
  });

  it('muestra movimientos financieros', () => {
    cy.visit('/financiero');
    cy.contains('Limpieza Dental').should('be.visible');
    cy.contains('$80.00').should('be.visible');
  });

  it('filtra movimientos por fecha', () => {
    cy.visit('/financiero');
    cy.get('input[type="date"]').first().type('2026-07-15');
    cy.get('input[type="date"]').last().type('2026-07-15');
    cy.contains('Limpieza Dental').should('be.visible');
  });
});