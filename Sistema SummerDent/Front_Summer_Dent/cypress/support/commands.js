// ***********************************************
// Custom Commands for SummerDent - Versión Estable
// ***********************************************

Cypress.Commands.add('login', (email = 'dc@summerDent.com', password = 'dc272004') => {
  cy.clearAllLocalStorage();
  cy.visit('/login');
  cy.url().then((url) => {
    if (url.includes('/dashboard')) return;
    cy.get('#email', { timeout: 15000 }).should('be.visible').clear().type(email);
    cy.get('#password').clear().type(password);
    cy.get('button[type="submit"]').click();
    cy.url({ timeout: 15000 }).should('include', '/dashboard');
  });
});

Cypress.Commands.add('navigateSideBar', (label) => {
  // Esperar a que cualquier modal se cierre naturalmente
  cy.get('.modal-overlay', { timeout: 10000 }).should('not.exist');
  cy.get('.nav-link').contains(label).click({ force: true });
});

Cypress.Commands.add('searchInTable', (term) => {
  cy.get('.search-input', { timeout: 10000 }).first()
    .should('be.visible')
    .clear({ force: true })
    .type(term, { force: true, delay: 20 })
    .trigger('input');
  cy.wait(1000); 
});

Cypress.Commands.add('createDoctor', (name, phone, email, specialty) => {
  cy.navigateSideBar('Odontólogos');
  cy.contains('+ Nuevo Odontólogo', { timeout: 10000 }).should('be.visible').click();
  cy.get('#nombre').clear().type(name);
  cy.get('#telefono').clear().type(phone);
  cy.get('#correo').clear().type(email);
  cy.get('#especialidad').clear().type(specialty);
  
  cy.intercept('POST', '**/api/doctores').as('postDoctor');
  cy.get('.btn-modal-save').click();
  cy.wait('@postDoctor', { timeout: 10000 });

  // Esperar a que el modal desaparezca
  cy.get('.modal-overlay', { timeout: 10000 }).should('not.exist');
});

Cypress.Commands.add('createPatient', (id, name, lastName, birthDate, phone, email) => {
  cy.navigateSideBar('Pacientes');
  cy.contains('+ Nuevo Paciente', { timeout: 10000 }).should('be.visible').click();
  cy.get('#id_cedula').clear().type(id);
  cy.get('#nombre').clear().type(name);
  cy.get('#apellido').clear().type(lastName);
  cy.get('#fecha_nacimiento').clear().type(birthDate);
  cy.get('#telefono').clear().type(phone);
  cy.get('#correo').clear().type(email);
  cy.get('#direccion').clear().type('Direccion de prueba');
  
  cy.intercept('POST', '**/api/pacientes').as('postPaciente');
  cy.get('.btn-modal-save').click();
  cy.wait('@postPaciente', { timeout: 10000 });

  cy.get('.modal-overlay', { timeout: 10000 }).should('not.exist');
});
