describe('Dashboard', () => {
  beforeEach(() => {
    cy.resetDatabase();
    cy.login();
  });

  it('muestra el dashboard con estadísticas', () => {
    cy.visit('/dashboard');
    cy.contains('Dashboard Principal').should('be.visible');
    cy.contains('Citas de Hoy').should('be.visible');
    cy.contains('Doctores Activos').should('be.visible');
  });

  it('muestra accesos rápidos', () => {
    cy.visit('/dashboard');
    cy.contains('Pacientes').should('be.visible');
    cy.contains('Citas').should('be.visible');
    cy.contains('Doctores').should('be.visible');
    cy.contains('Tratamientos').should('be.visible');
    cy.contains('Financiero').should('be.visible');
  });

  it('navega a pacientes desde acceso rápido', () => {
    cy.visit('/dashboard');
    cy.contains('Pacientes').click();
    cy.url().should('include', '/pacientes');
  });
});