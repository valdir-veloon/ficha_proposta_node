const sql = require("mssql");
const config = require("./config");

async function createNewReservation(id, reservation, token, createdAt, phoneNumber, status, reservationId=null) {

    if (!reservation) return null

    try {
        await sql.connect(config)
        const token_ficha = uuidv4()

        const {
            totalAmount,
            numberOfPeriods
        } = reservation

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
                status_digitacao
            )
            VALUES (
                '${id}',
                'NEW_115348968',
                '${token}',
                'U5AD37AE905-ACD217EAA7-5198CA33C5',
                ${totalAmount},
                '324',
                '${reservationId}',
                ${totalAmount},
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
                0
            )
        `);

        return true

    } catch (err) {
        console.error("Erro ao criar reserva:", err)
        return null
    }
}

module.exports = { createNewReservation }