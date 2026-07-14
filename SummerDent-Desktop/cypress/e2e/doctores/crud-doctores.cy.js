describe('Doctores CRUD', () => {
  beforeEach(() => {
    cy.resetDatabase();
    cy.login();
  });

  it('lista doctores existentes', () => {
    cy.visit('/doctores');
    cy.contains('Dr. Carlos López').should('be.visible');
    cy.contains('Dra. Ana Martínez').should('be.visible');
  });

  it('crea un nuevo doctor', () => {
    cy.visit('/doctores');
    cy.contains('Nuevo Doctor').click();

    cy.get('#nombre').type('Dr. Test Nuevo');
    cy.get('#telefono').type('0944444444');
    cy.get('#correo').type('nuevo@test.com');
    cy.get('#especialidad').type('Endodoncia');

    cy.get('button[type="submit"]').click();
    cy.contains('Dr. Test Nuevo').should('be.visible');
  });
});