describe('Multi-sede', () => {
  beforeEach(() => {
    cy.resetDatabase();
    cy.login();
  });

  it('superadmin puede cambiar de sede', () => {
    cy.visit('/dashboard');
    cy.get('[data-testid="sede-selector"]').should('be.visible');
    cy.get('[data-testid="sede-selector"]').select('2');
    cy.get('[data-testid="sede-selector"]').should('have.value', '2');
  });
});