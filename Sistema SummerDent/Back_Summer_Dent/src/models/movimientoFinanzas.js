import { DataTypes } from 'sequelize';
import { sequelize } from '../configuracionesDB/database.js';
import Doctor from './doctor.js';

export const MovimientoFinanzas = sequelize.define(
  'MovimientoFinanzas',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_perfil: {
      type: DataTypes.UUID,
      allowNull: true
    },
    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    id_doctor: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: { msg: 'El id_doctor debe ser un entero' }
      }
    },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: {
          args: [['ingreso', 'egreso']],
          msg: "El tipo debe ser 'ingreso' o 'egreso'"
        }
      }
    },
    monto: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
      validate: {
        isDecimal: { msg: 'El monto debe ser un número' }
      }
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metodo_pago: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: { isIn: { args: [['efectivo','transferencia','tarjeta']], msg: 'metodo_pago inválido' } }
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'movimiento_finanzas',
    timestamps: false,
    underscored: true
  }
);

// Asociaciones: movimiento_finanzas puede apuntar a un doctor
MovimientoFinanzas.belongsTo(Doctor, { foreignKey: 'id_doctor', as: 'doctor' });
Doctor.hasMany(MovimientoFinanzas, { foreignKey: 'id_doctor', as: 'movimientos_financieros' });

import Sede from './sede.js';
MovimientoFinanzas.belongsTo(Sede, { foreignKey: 'sede_id', as: 'sede' });
Sede.hasMany(MovimientoFinanzas, { foreignKey: 'sede_id', as: 'movimientos' });

export default MovimientoFinanzas;
