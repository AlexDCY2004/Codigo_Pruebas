import { DataTypes } from 'sequelize';
import { sequelize } from '../configuracionesDB/database.js';

export const Sede = sequelize.define(
  'Sede',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    ciudad: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    direccion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'sede',
    timestamps: false,
    underscored: true
  }
);

export default Sede;
