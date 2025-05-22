const sql = require("mssql")
const config = require("./config")
const { subHours, parseISO, format } = require('date-fns')

async function checkIfReservationExists(reservationId, createdAt, id) {
    try {

        const date = parseISO(createdAt)
        const newDate = subHours(date, 3)
        const formattedCreateAt = format(newDate, "yyyy-MM-dd HH:mm")

        await sql.connect(config)
        const result = await sql.query`
            SELECT *
                FROM ficha_proposta.dbo.cliente
            WHERE (retorno_numero_proposta = ${reservationId} 
                AND FORMAT(data_cadastro, 'yyyy-MM-dd HH:mm') = ${formattedCreateAt})
        `
        return result.recordset[0]
    } catch (err) {
        console.error("Erro ao conectar ao banco de dados:", err)
        return false
    }
}

module.exports = { checkIfReservationExists }