describe('Módulo de Tratamientos', () => {
  const uniqueId = Date.now().toString().slice(-4);
  const treatmentName = `Tratamiento ${uniqueId}`;

  beforeEach(() => {
    cy.login();
    cy.visit('/tratamientos');
  });

  it.skip('Debe crear un nuevo tratamiento correctamente (Requiere Admin)', () => {
    cy.intercept('POST', '**/api/tratamientos').as('saveRequest');
    
    cy.contains('+ Nuevo Tratamiento').click();
    cy.get('#nombre').type(treatmentName);
    cy.get('#area').select('Ortodoncia General');
    cy.get('#precio').clear().type('120.50');
    cy.get('#descripcion').type('Limpieza profunda automatizada');
    cy.get('.btn-modal-save').click();
    
    cy.wait('@saveRequest', { timeout: 10000 }).then((interception) => {
      if (interception.response.statusCode !== 201) {
        throw new Error(`Error del servidor: ${JSON.stringify(interception.response.body)}`);
      }
    });
    
    // Verificar en la tabla
    cy.get('.search-input').first().clear().type(treatmentName);
    cy.contains(treatmentName).should('be.visible');
  });

  it('Debe validar campos obligatorios', () => {
    cy.contains('+ Nuevo Tratamiento').click();
    cy.get('.btn-modal-save').click();
    
    cy.contains('El área es obligatoria').should('be.visible');
    cy.contains('El nombre es obligatorio').should('be.visible');
    cy.contains('El precio es obligatorio').should('be.visible');
  });
});
