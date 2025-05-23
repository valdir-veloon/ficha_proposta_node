const sql = require("mssql")
const config = require("./config")

async function cleanDatabase(startDate, endDate) {
    try {
        await sql.connect(config)
        
        await sql.query`
            DELETE FROM ficha_proposta.dbo.cliente
            WHERE data_cadastro BETWEEN ${startDate} AND ${endDate}
        `

        console.log("Base de dados limpa com sucesso!")
        return true
    
    } catch (err) {
        console.error("Erro ao conectar ao banco de dados:", err)
        return false
    }
}

module.exports = { cleanDatabase }