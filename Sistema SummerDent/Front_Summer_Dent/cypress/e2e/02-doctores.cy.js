describe('Módulo de Odontólogos', () => {
  const uniqueId = Date.now().toString().slice(-4);
  const doctorName = `Doctor Especialista`;

  beforeEach(() => {
    cy.login();
    cy.visit('/doctores');
  });

  it('Debe registrar un nuevo odontólogo correctamente', () => {
    cy.intercept('POST', '**/api/doctores').as('saveRequest');
    
    cy.contains('+ Nuevo Odontólogo').click();
    cy.get('#nombre').clear().type(doctorName);
    cy.get('#telefono').clear().type('0991234568');
    cy.get('#correo').clear().type(`doctor${uniqueId}@summerdent1.com`);
    cy.get('#especialidad').clear().type('Cirugia general');
    cy.get('#estado').select('disponible');
    
    cy.get('.btn-modal-save').click();
    
    cy.wait('@saveRequest', { timeout: 10000 }).its('response.statusCode').should('eq', 201);
    
    // Verificar en la tabla
    cy.get('.modal-overlay', { timeout: 10000 }).should('not.exist');
    cy.get('.search-input').first().clear().type(doctorName);
    cy.contains(doctorName).should('be.visible');
  });

  it('Debe filtrar la tabla de odontólogos', () => {
    cy.get('.search-input').first().clear().type('InexistenteXYZ');
    cy.contains('No hay odontólogos registrados').should('be.visible');
  });
});
