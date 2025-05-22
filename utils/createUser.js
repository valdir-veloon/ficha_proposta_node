const sql = require("mssql")
const config = require("./config")
const { v4: uuidv4 } = require('uuid')

async function createUser(customer, createdAt) {
    if (!customer) return null

    try {
        await sql.connect(config)

        const token = uuidv4()
        const {
            cpf,
            name,
            uf,
            city,
            district,
            cep,
            address,
            addressNumber,
            phoneNumber,
            email
        } = customer

        const formatUf = uf.substring(0, 2).toUpperCase()

        await sql.query(`
            INSERT INTO cadastro_unico.dbo.cadastro (
                cpf, 
                nome,
                token,
                uf, 
                municipio,
                cep,
                bairro,
                logradouro,
                numero_residencia,
                telefone_whatsapp,
                email,
                data_cadastro,
                uid_empresa,
                uid_usuario,
                status,
                fgts_data_ultima_simulacao
            )
            VALUES (
                '${cpf}',
                '${name}', 
                '${token}', 
                '${formatUf}', 
                '${city}',
                '${cep}',
                '${district}',
                '${address}',
                '${addressNumber}',
                '55${phoneNumber}',
                '${email}',
                GETDATE(),
                'NEW_115348968',
                'U5AD37AE905-ACD217EAA7-5198CA33C5',
                0,
                '${createdAt}'
            )
        `)

        return token

    } catch (error) {
        console.error("Erro ao criar usuário:", error)
        return null
    }
}

module.exports = { createUser }