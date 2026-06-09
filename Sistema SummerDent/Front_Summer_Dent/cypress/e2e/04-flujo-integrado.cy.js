describe('Flujo Integrado: Doctor -> Paciente -> Cita', () => {
  const uniqueId = Date.now().toString().slice(-4);
  // El front elimina números en nombres y apellidos. Usamos letras únicas.
  const doctorName = `Doctor Juan Perez`; 
  const patientName = `Paciente Integrado`;
  const patientLastName = `Test`;
  
  // Generar cédula válida
  const generateValidCedula = () => {
    const provincia = '17';
    const tercerDigito = Math.floor(Math.random() * 6).toString(); // 0 a 5
    const resto = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const base = provincia + tercerDigito + resto;
    
    const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let res = parseInt(base[i]) * coef[i];
      if (res >= 10) res -= 9;
      sum += res;
    }
    const check = (sum % 10 === 0) ? 0 : 10 - (sum % 10);
    return base + check;
  };

  const patientId = generateValidCedula();

  before(() => {
    cy.login();
    // No creamos tratamiento porque jp@summerDent.com no tiene permisos de admin
    cy.createDoctor(doctorName, '0990001111', `doc_${uniqueId}@test.com`, 'Ortodoncia');
    cy.createPatient(patientId, patientName, patientLastName, '1988-10-10', '0998887777', `pat_${uniqueId}@test.com`);
  });

  beforeEach(() => {
    cy.login();
    cy.visit('/citas');
  });

  it('Debe agendar una cita vinculando todos los elementos creados', () => {
    cy.intercept('POST', '**/api/citas').as('saveCita');
    
    cy.contains('+ Nueva Cita').click();
    
    // 1. Seleccionar Paciente
    cy.get('#id_paciente').focus().type(patientName, { delay: 50 });
    cy.wait(1500);
    // Buscamos la opción que tenga el nombre del paciente
    cy.get('.searchable-option', { timeout: 10000 }).contains(patientName).first().trigger('mousedown', { which: 1 });
    
    // 2. Seleccionar Doctor
    cy.get('#id_doctor').focus().type(doctorName, { delay: 50 });
    cy.wait(1500);
    cy.get('.searchable-option', { timeout: 10000 }).contains(doctorName).first().trigger('mousedown', { which: 1 });
    
    // 3. Fecha y Hora (Mañana a las 10:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    cy.get('#fecha').type(dateStr).blur();
    cy.get('#hora_inicio').type('10:00');
    cy.get('#hora_fin').type('11:00');
    
    // 4. Seleccionar un tratamiento existente
    cy.get('#tratamientos').click();
    cy.wait(1000);
    cy.get('.tratamientos-selector-item', { timeout: 10000 }).should('exist').first().click({ force: true });
    cy.get('.btn-secondary').contains('Cerrar').click();
    
    // 5. Guardar
    cy.get('.btn-modal-save').click();
    
    cy.wait('@saveCita', { timeout: 20000 }).its('response.statusCode').should('eq', 201);
    
    // Verificar en la tabla de citas
    cy.get('.search-input').first().clear({ force: true }).type(patientName, { force: true, delay: 50 });
    cy.contains(patientName).should('be.visible');
  });

  it('Debe validar que la fecha no sea anterior a hoy', () => {
    cy.contains('+ Nueva Cita').click();
    
    const pastDate = '2020-01-01'; // Fecha claramente pasada
    
    // Escribir la fecha inválida
    cy.get('#fecha').type(pastDate);
    
    // Intentar guardar para disparar la validación
    cy.get('.btn-modal-save').click({ force: true });
    
    // Buscar el texto de error de forma global para evitar fallos por selectores anidados
    cy.contains('La fecha no puede ser anterior a hoy', { timeout: 10000 }).should('be.visible');
  });
});
