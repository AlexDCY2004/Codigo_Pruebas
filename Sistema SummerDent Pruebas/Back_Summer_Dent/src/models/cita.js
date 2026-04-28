import { DataTypes } from 'sequelize';
import { sequelize } from '../configuracionesDB/database.js';
import Doctor from './doctor.js';
import Paciente from './paciente.js';
import Tratamiento from './tratamiento.js';

const ESTADOS_CITA = ['pendiente', 'confirmada', 'Atendida', 'cancelada'];

export const Cita = sequelize.define(
  'Cita',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_paciente: {
      type: DataTypes.STRING(11),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'El id_paciente es obligatorio' },
        len: { args: [1, 11], msg: 'id_paciente no puede exceder 11 caracteres' }
      }
    },
    id_doctor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { isInt: { msg: 'El id_doctor debe ser un entero' } }
    },
    id_tratamiento: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { isInt: { msg: 'El id_tratamiento debe ser un entero' } }
    },
    id_perfil: {
      type: DataTypes.UUID,
      allowNull: true
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: { isDate: { msg: 'La fecha no es válida' } }
    },
    hora_inicio: {
      type: DataTypes.TIME,
      allowNull: false
    },
    hora_fin: {
      type: DataTypes.TIME,
      allowNull: false
    },
    precio: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        isDecimal: { msg: 'El precio debe ser un número' },
        min: { args: [0], msg: 'El precio no puede ser negativo' }
      }
    },
    estado: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pendiente',
      validate: {
        isIn: { args: [ESTADOS_CITA], msg: 'Estado de cita inválido' }
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'cita',
    timestamps: false,
    underscored: true
  }
);

// Asociaciones
// Cita pertenece a Doctor, Paciente y Tratamiento
Cita.belongsTo(Doctor, { foreignKey: 'id_doctor', as: 'doctor' });
Doctor.hasMany(Cita, { foreignKey: 'id_doctor', as: 'citas' });

Cita.belongsTo(Paciente, { foreignKey: 'id_paciente', as: 'paciente' });
Paciente.hasMany(Cita, { foreignKey: 'id_paciente', as: 'citas' });

Cita.belongsTo(Tratamiento, { foreignKey: 'id_tratamiento', as: 'tratamiento' });
Tratamiento.hasMany(Cita, { foreignKey: 'id_tratamiento', as: 'citas' });

export default Cita;
