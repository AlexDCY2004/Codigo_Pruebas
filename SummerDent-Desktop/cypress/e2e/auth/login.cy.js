describe('Login', () => {
  beforeEach(() => {
    cy.resetDatabase();
  });

  it('redirige a login si no está autenticado', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });

  it('loguea con credenciales válidas', () => {
    cy.visit('/login');
    cy.get('#email').type('admin@test.com');
    cy.get('#password').type('test123456');
    cy.get('button[type="submit"]').click();
    cy.url({ timeout: 10000 }).should('include', '/dashboard');
    cy.contains('Dashboard Principal').should('be.visible');
  });

  it('muestra error con credenciales inválidas', () => {
    cy.visit('/login');
    cy.get('#email').type('invalido@test.com');
    cy.get('#password').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    cy.contains('Credenciales inválidas').should('be.visible');
  });

  it('redirige a dashboard si ya está autenticado', () => {
    cy.login();
    cy.visit('/login');
    cy.url().should('include', '/dashboard');
  });
});