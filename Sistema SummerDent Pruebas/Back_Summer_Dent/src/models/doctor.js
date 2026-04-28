import { DataTypes } from 'sequelize';
import { sequelize } from '../configuracionesDB/database.js';

const estadosPermitidos = ['disponible', 'no disponible', 'eventual'];

export const Doctor = sequelize.define(
    'Doctor',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombre: {
            type: DataTypes.STRING(64),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'El nombre es obligatorio' },
                len: {
                    args: [2, 64],
                    msg: 'El nombre debe tener entre 2 y 64 caracteres'
                }
            }
        },
        telefono: {
            type: DataTypes.STRING(11),
            allowNull: true,
            validate: {
                len: {
                    args: [0, 11],
                    msg: 'El teléfono no puede exceder 11 caracteres'
                }
            }
        },
        correo: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
            set(value) {
                this.setDataValue('correo', value ? String(value).trim().toLowerCase() : value);
            },
            validate: {
                isEmail: { msg: 'El formato del correo no es válido' },
                notEmpty: { msg: 'El correo es obligatorio' },
                len: {
                    args: [5, 64],
                    msg: 'El correo debe tener entre 5 y 64 caracteres'
                }
            }
        },
        especialidad: {
            type: DataTypes.STRING(64),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'La especialidad es obligatoria' },
                len: {
                    args: [2, 64],
                    msg: 'La especialidad debe tener entre 2 y 64 caracteres'
                }
            }
        },
        estado: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'disponible',
            validate: {
                isIn: {
                    args: [estadosPermitidos],
                    msg: 'Estado inválido. Debe ser: disponible, no disponible o eventual'
                }
            }
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    },
    {
        tableName: 'doctor',
        timestamps: false,
        underscored: true
    }
);

export default Doctor;
