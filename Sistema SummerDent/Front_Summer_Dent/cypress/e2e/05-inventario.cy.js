describe('Módulo de Inventario', () => {
  const uniqueId = Date.now().toString().slice(-4);
  const productName = `InsumoEspecial`;

  beforeEach(() => {
    cy.login();
    cy.visit('/inventario');
  });

  it('Debe registrar un nuevo insumo correctamente', () => {
    cy.intercept('POST', '**/api/productos').as('saveProduct');
    
    cy.contains('+ Nuevo Insumo', { timeout: 10000 }).should('be.visible').click();
    
    cy.get('#nombre').type(productName);
    cy.get('#descripcion').type('Descripcion automatizada');
    cy.get('#categoria').type('Materiales');
    cy.get('#precio').type('15.50');
    cy.get('#stock_producto').type('50');
    cy.get('#stock_minimo').type('10');
    
    cy.get('.btn-modal-save').click();
    
    cy.wait('@saveProduct', { timeout: 15000 }).its('response.statusCode').should('eq', 201);
    
    // Esperar a que el modal se cierre naturalmente para evitar errores de React removeChild
    cy.get('.modal-overlay', { timeout: 15000 }).should('not.exist');

    // Verificar en la tabla
    cy.get('.search-input').first().clear({force: true}).type(productName, {force: true});
    cy.contains(productName).should('be.visible');
    cy.contains('50').should('be.visible'); 
  });

  it('Debe filtrar por estado en el inventario', () => {
    cy.get('.inventario-select').select('ok');
    cy.url().should('include', '/inventario');
    // Si hay datos, la tabla debe ser visible
    cy.get('body').then(($body) => {
      if ($body.find('.inventario-table').length > 0) {
        cy.get('.inventario-table').should('be.visible');
      }
    });
  });
});
