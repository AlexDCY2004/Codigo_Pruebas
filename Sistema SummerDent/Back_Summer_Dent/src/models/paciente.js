import { DataTypes } from 'sequelize';
import { sequelize } from '../configuracionesDB/database.js';

export const Paciente = sequelize.define(
    'Paciente',
    {
        id_cedula: {
            type: DataTypes.STRING(11),
            primaryKey: true,
            allowNull: false,
            validate: {
                notEmpty: { msg: 'La cédula no puede estar vacía' },
                len: {
                    args: [6, 11],
                    msg: 'La cédula debe tener entre 6 y 11 caracteres'
                }
            }
        },
        nombre: {
            type: DataTypes.STRING(64),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'El nombre no puede estar vacío' }
            }
        },
        apellido: {
            type: DataTypes.STRING(64),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'El apellido no puede estar vacío' }
            }
        },
        fecha_nacimiento: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            validate: {
                isDate: { msg: 'La fecha de nacimiento no es válida' }
            }
        },
        telefono: {
            type: DataTypes.STRING(11),
            allowNull: true
        },
        correo: {
            type: DataTypes.STRING(64),
            allowNull: true,
            validate: {
                isEmail: { msg: 'El formato del correo no es válido' }
            }
        },
        direccion: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    },
    {
        tableName: 'paciente',
        timestamps: false
    }
);

export default Paciente;
