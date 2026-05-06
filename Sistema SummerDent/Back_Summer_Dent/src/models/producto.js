import { DataTypes } from 'sequelize';
import { sequelize } from '../configuracionesDB/database.js';

export const Producto = sequelize.define(
    'Producto',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombre: {
            type: DataTypes.STRING(150),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'El nombre del producto es obligatorio' },
                len: {
                    args: [2, 150],
                    msg: 'El nombre debe tener entre 2 y 150 caracteres'
                }
            }
        },
        descripcion: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        categoria: {
            type: DataTypes.STRING(100),
            allowNull: true,
            validate: {
                len: {
                    args: [0, 100],
                    msg: 'La categoría no puede exceder 100 caracteres'
                }
            }
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
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    },
    {
        tableName: 'producto',
        timestamps: false,
        underscored: true
    }
);

export default Producto;
