import { DataTypes } from 'sequelize';
import { sequelize } from '../configuracionesDB/database.js';
import Producto from './producto.js';

export const Inventario = sequelize.define(
  'Inventario',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_producto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: { msg: 'El id_producto debe ser un entero' }
      }
    },
    id_perfil: {
      type: DataTypes.UUID,
      allowNull: true
    },
    stock_producto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'El stock no puede ser negativo' }
      }
    },
    stock_minimo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'El stock mínimo no puede ser negativo' }
      }
    },
    precio: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        isDecimal: { msg: 'El precio debe ser un número' },
        min: { args: [0], msg: 'El precio no puede ser negativo' }
      }
    },
    fecha_actualizacion: {
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
    tableName: 'inventario',
    timestamps: false,
    underscored: true
  }
);

// Asociaciones: Inventario pertenece a Producto (fk: id_producto)
Inventario.belongsTo(Producto, { foreignKey: 'id_producto', as: 'producto' });
Producto.hasMany(Inventario, { foreignKey: 'id_producto', as: 'inventarios' });

export default Inventario;
