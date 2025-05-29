const sql = require("mssql")
const fs = require("fs").promises 
const config = require("./config")
const { v4: uuidv4 } = require('uuid')
const { format } = require('date-fns')
const StatusEnum = require("./statusEnum")

async function createNewReservation(
    totalProcessado,
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

        const status_acompanhamento = StatusEnum.getStatusEnum(status)

        const statusMessage = `Criando reserva com status: ${reservationId} - ${status} (${status_acompanhamento})\n`
        await fs.appendFile(`log-status-${formattedDate}.txt`, statusMessage, "utf8")

        const valorReservationAmount = Number(reservationAmount) || 0

        console.log('insert create reservation: ', {
            totalProcessado,
            id,
            valorReservationAmount,
            numberOfPeriods,
            reservationId,
            status,
            status_acompanhamento,
            contractURL,
            token_ficha,
            phoneNumber,
            createdAt
        })

        // Remover o id para rodar no banco de dados de produção, colocando o totalProcessado em dev

        await sql.query(`
            INSERT INTO ficha_proposta.dbo.cliente (
                id,
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
                '${totalProcessado}',
                '${id}',
                'NEW_115348968',
                '${token}',
                'U5AD37AE905-ACD217EAA7-5198CA33C5',
                ${valorReservationAmount},
                '324',
                '${reservationId}',
                ${valorReservationAmount},
                ${numberOfPeriods},
                'U5AD37AE905-ACD217EAA7-5198CA33C5',
                'FGTS',
                'NOVO',
                '${token_ficha}',
                1,
                null,
                '55${phoneNumber}',
                '${createdAt}',
                ${status_acompanhamento},
                0,
                '${contractURL}'
            )
        `)

        return true

    } catch (err) {
        console.error("Erro ao criar reserva:", err)
        const errorMessage = `Erro ao criar reserva: ${err.message}\n`
        await fs.appendFile(`log-status-${formattedDate}.txt`, errorMessage, "utf8")
        return null
    }
}

module.exports = { createNewReservation }