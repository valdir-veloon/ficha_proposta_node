const sql = require("mssql")
const fs = require("fs").promises 
const config = require("./config")
const { v4: uuidv4 } = require('uuid')
const { format } = require('date-fns')
const StatusEnum = require("./statusEnum")

async function createNewReservation(
    id, 
    reservation, 
    token, 
    createdAt, 
    phoneNumber, 
    status, 
    reservationId=null, 
    contractURL=null
) {

    if (!reservation) return null

    const formattedDate = format(new Date(), 'dd-MM-yyyy')

    try {
        await sql.connect(config)
        const token_ficha = uuidv4()

        const {
            reservationAmount,
            numberOfPeriods
        } = reservation

        const statusMessage = `Criando reserva com status: ${reservationId} - ${status} (${StatusEnum[status]})\n`
        await fs.appendFile(`log-status-${formattedDate}.txt`, statusMessage, "utf8")

        await sql.query(`
            INSERT INTO ficha_proposta.dbo.cliente (
                codigo_da_operacao,
                uid_empresa,
                token_cadastro,
                uid_usuario,
                valor_digitacao,
                codigo_banco_digitacao,
                retorno_numero_proposta,
                retorno_valor_liberado,
                prazo,
                usuario_digitacao,
                convenio,
                tipo_operacao,
                token,
                chat_bot,
                session_bot,
                telefone_bot,
                data_cadastro,
                status_acompanhamento,
                status_digitacao,
                link_cliente
            )
            VALUES (
                '${id}',
                'NEW_115348968',
                '${token}',
                'U5AD37AE905-ACD217EAA7-5198CA33C5',
                ${reservationAmount},
                '324',
                '${reservationId}',
                ${reservationAmount},
                ${numberOfPeriods},
                'U5AD37AE905-ACD217EAA7-5198CA33C5',
                'FGTS',
                'NOVO',
                '${token_ficha}',
                1,
                null,
                '55${phoneNumber}',
                '${createdAt}',
                ${StatusEnum[status]},
                0,
                '${contractURL}'
            )
        `)

        return true

    } catch (err) {
        console.error("Erro ao criar reserva:", err)
        
        const errorMessage = `Erro ao atualizar reserva: ${err.message}\n`
        await fs.appendFile(`log-status-${formattedDate}.txt`, statusMessage, "utf8")

        return null
    }
}

module.exports = { createNewReservation }