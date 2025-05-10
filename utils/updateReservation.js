const sql = require("mssql");
const config = require("./config");
const StatusEnum = require("./statusEnum");
const fs = require("fs").promises;
const { format } = require('date-fns');

async function updateReservation(id, reservationId, status, numberOfPeriods, totalAmount, token, createdAt, contractURL) {
    const formattedDate = format(new Date(), 'dd-MM-yyyy');

    try {
        await sql.connect(config)

        const statusMessage = `Atualizando reserva com status: ${reservationId} - ${status} (${StatusEnum[status]})\n`;
        await fs.appendFile(`log-status-${formattedDate}.txt`, statusMessage, "utf8");

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
                data_update = GETDATE(),
                link_cliente = ${contractURL}
            WHERE retorno_numero_proposta = ${reservationId}
        `;
    
    } catch (err) {
        console.error("Erro:", err)
        
        const errorMessage = `Erro ao atualizar reserva: ${err.message}\n`;
        await fs.appendFile(`log-status-${formattedDate}.txt`, errorMessage, "utf8");

        await sql.close()
    }
}

module.exports = { updateReservation };