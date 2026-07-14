describe('Tratamientos CRUD', () => {
  beforeEach(() => {
    cy.resetDatabase();
    cy.login();
  });

  it('lista tratamientos existentes', () => {
    cy.visit('/tratamientos');
    cy.contains('Limpieza Dental').should('be.visible');
    cy.contains('Consulta General').should('be.visible');
  });

  it('crea un nuevo tratamiento', () => {
    cy.visit('/tratamientos');
    cy.contains('Nuevo Tratamiento').click();

    cy.get('#nombre').type('Blanqueamiento');
    cy.get('#area').type('Estética');
    cy.get('#precio').type('150');
    cy.get('#descripcion').type('Blanqueamiento dental completo');

    cy.get('button[type="submit"]').click();
    cy.contains('Blanqueamiento').should('be.visible');
  });
});