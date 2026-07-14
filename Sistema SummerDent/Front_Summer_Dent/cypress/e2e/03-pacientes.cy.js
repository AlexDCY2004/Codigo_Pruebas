describe('Módulo de Pacientes', () => {
  const uniqueId = Date.now().toString().slice(-4);
  // El front elimina números en nombres y apellidos.
  const patientName = `Paciente Pedro`;
  const lastName = `Test`;

  // Algoritmo módulo 10 para cédula válida
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

  beforeEach(() => {
    cy.login();
    cy.visit('/pacientes');
  });

  it('Debe registrar un nuevo paciente con cédula validada', () => {
    cy.intercept('POST', '**/api/pacientes').as('saveRequest');
    
    cy.contains('+ Nuevo Paciente').click();
    cy.get('#id_cedula').type(patientId);
    cy.get('#nombre').type(patientName);
    cy.get('#apellido').type(lastName);
    cy.get('#fecha_nacimiento').type('1995-05-15');
    cy.get('#telefono').type('0987654321');
    cy.get('#correo').type(`pacienteP${uniqueId}@gmail.com`);
    cy.get('#direccion').type('Calle La lomas');
    
    cy.get('.btn-modal-save').click();
    
    cy.wait('@saveRequest', { timeout: 10000 }).then((interception) => {
      if (interception.response.statusCode !== 201) {
        throw new Error(`Error del servidor: ${JSON.stringify(interception.response.body)}`);
      }
    });
    
    // Verificar en la tabla usando cédula que es única
    cy.get('.search-input').first().clear().type(patientId);
    cy.contains(patientName).should('be.visible');
  });

  it('Debe validar cédula ecuatoriana incorrecta', () => {
    cy.contains('+ Nuevo Paciente').click();
    cy.get('#id_cedula').type('1721522430'); // Cédula inválida
    cy.get('.btn-modal-save').click(); // Submit para ver errores
    
    cy.contains('La cédula ingresada no es válida').should('be.visible');
  });
});
