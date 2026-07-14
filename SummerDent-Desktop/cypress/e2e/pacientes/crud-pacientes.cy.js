describe('Pacientes CRUD', () => {
  beforeEach(() => {
    cy.resetDatabase();
    cy.login();
  });

  it('lista pacientes existentes', () => {
    cy.visit('/pacientes');
    cy.contains('Juan').should('be.visible');
    cy.contains('María').should('be.visible');
  });

  it('crea un nuevo paciente', () => {
    cy.visit('/pacientes');
    cy.contains('Nuevo Paciente').click();

    cy.get('#id_cedula').type('1122334455');
    cy.get('#nombre').type('Pedro');
    cy.get('#apellido').type('Ramírez');
    cy.get('#telefono').type('0955555555');
    cy.get('#correo').type('pedro@test.com');
    cy.get('#direccion').type('Calle Nueva 789');

    cy.get('button[type="submit"]').click();
    cy.contains('Pedro Ramírez').should('be.visible');
  });

  it('elimina un paciente', () => {
    cy.visit('/pacientes');
    cy.contains('Juan').should('be.visible');
    cy.get('.action-btn--delete').first().click();
    cy.contains('Eliminar').click();
    cy.contains('Juan').should('not.exist');
  });
});