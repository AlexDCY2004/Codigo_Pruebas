import { DataTypes } from 'sequelize';
import { sequelize } from '../configuracionesDB/database.js';

const ALLOWED_AREAS = [
  'Odontología General',
  'Ortodoncia',
  'Ortopedia',
  'Cirugía Odontológica',
  'Endodoncia',
  'Prótesis Removible Valplast o Flexible',
  'Acrílicas'
];

export const Tratamiento = sequelize.define(
  'Tratamiento',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    area: {
      type: DataTypes.STRING(64),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'El área no puede estar vacía' },
        isIn: {
          args: [ALLOWED_AREAS],
          msg: `El área debe ser una de: ${ALLOWED_AREAS.join(', ')}`
        }
      }
    },
    nombre: {
      type: DataTypes.STRING(64),
      allowNull: false,
      validate: { notEmpty: { msg: 'El nombre no puede estar vacío' } }
    },
    precio: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
      validate: { isDecimal: { msg: 'El precio debe ser un número' } }
    },
    descripcion: {
      type: DataTypes.STRING(300),
      allowNull: true
    },
    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { isInt: { msg: 'sede_id debe ser un entero' } }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'tratamiento',
    timestamps: false
  }
);

export default Tratamiento;

import Sede from './sede.js';
Tratamiento.belongsTo(Sede, { foreignKey: 'sede_id', as: 'sede' });
Sede.hasMany(Tratamiento, { foreignKey: 'sede_id', as: 'tratamientos_sede' });
