const sql = require("mssql");
const config = require("./config");

async function checkIfReservationExists(reservationId, id) {
    try {
        await sql.connect(config)
        const result = await sql.query`
            SELECT *
                FROM ficha_proposta.dbo.cliente
            WHERE retorno_numero_proposta = ${reservationId} or codigo_da_operacao = ${id}
        `;

        return result.recordset[0]
    } catch (err) {
        console.error("Erro ao conectar ao banco de dados:", err)
        return false;
    }
}

module.exports = { checkIfReservationExists };