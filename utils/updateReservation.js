const sql = require("mssql");
const config = require("./config");
const StatusEnum = require("./statusEnum");

async function updateReservation(id, reservationId, status, numberOfPeriods, totalAmount, token, createdAt) {
    try {
        await sql.connect(config)

        await sql.query`
            UPDATE ficha_proposta.dbo.cliente
            SET 
                codigo_da_operacao = ${id}, 
                prazo = ${numberOfPeriods},
                retorno_valor_liberado = ${totalAmount},
                valor_digitacao = ${totalAmount}, 
                status_acompanhamento = ${StatusEnum[status]},
                token_cadastro = ${token},
                data_cadastro = ${createdAt},
                data_update = GETDATE()
            WHERE retorno_numero_proposta = ${reservationId}
        `;
    
    } catch (err) {
        console.error("Erro:", err)
        await sql.close()
    }
}

module.exports = { updateReservation };