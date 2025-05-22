const sql = require("mssql")
const config = require("./config")

async function getToken(cpf) {

    if (!cpf) return null

    try {
     
        await sql.connect(config)
        const result = await sql.query`
            SELECT token
            FROM cadastro_unico.dbo.cadastro
            WHERE cpf = ${cpf}
        `

        if (result.recordset.length === 0) return null

        const token = result.recordset[0]?.token
        
        if (!token) return null

        return token
    
    } catch (err) {
        console.error("Erro ao conectar ao banco de dados:", err)
        return null
    }
}

module.exports = { getToken }