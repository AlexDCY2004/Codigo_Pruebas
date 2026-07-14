Cypress.Commands.add('login', (email = 'admin@test.com', password = 'test123456') => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('#email').type(email);
    cy.get('#password').type(password);
    cy.get('button[type="submit"]').click();
    cy.url({ timeout: 10000 }).should('include', '/dashboard');
  });
});

Cypress.Commands.add('resetDatabase', () => {
  cy.task('seedDatabase').then((result) => {
    if (result.error) {
      throw new Error(`Error al seedear la base de datos: ${result.error}`);
    }
  });
});

Cypress.Commands.add('getBySel', (selector, ...args) => {
  return cy.get(`[data-testid="${selector}"]`, ...args);
});
