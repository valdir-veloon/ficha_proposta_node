require('dotenv').config()

const fs = require('fs').promises
const xlsx = require("xlsx")
const sql = require("mssql")
const { v4: uuidv4 } = require('uuid');
const { subHours, parseISO, format } = require('date-fns');

const config = require('./utils/config');
const { getToken } = require('./utils/getToken');
const { formatDateToISO } = require('./utils/formatDateToIso');
const { checkIfReservationExists } = require('./utils/checkIfReservationExists');
const { updateReservation } = require('./utils/updateReservation');
const { createNewReservation } = require('./utils/createNewReservation');
const { createUser } = require('./utils/createUser');

// Trecho referente ao processamento da planilha Excel gerada pela Cartos
async function main() {
    try {
        await sql.connect(config);

        const workbook = xlsx.readFile("propostas_fgts2.xlsx")
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = xlsx.utils.sheet_to_json(worksheet)

        // Filtra apenas linhas com mês 04 em 'data_da_solicitacao'
        const dadosAbril = data.filter(row => {
            const dataStr = row.data_da_solicitacao
            if (!dataStr || typeof dataStr !== 'string') return false
            const [dia, mes, ano] = dataStr.split('/')
            return mes === '04'
        });

        const StatusEnum = {
            "awaitingPaymentConfirmation": 0,
            "canceled": 3,
            "pendingCustomer": 2,
            "customerRefused": 1,
            "institutionRefused": 4,
            "pendingInstitution": 5,
            "unblockingError": 6,
        };

        /* UPDATE
        for (const row of data) {

            const { documento, valor_liberado, status_da_ccb } = row;
            const result = await sql.query`
                SELECT cpf, token
                FROM cadastro_unico.dbo.cadastro
                WHERE cpf = ${documento}
            `;

            if (result.recordset.length === 0) {
                const logMessage = `${documento}\n`
                await fs.appendFile('log.txt', logMessage, 'utf8')
                console.log(`Documento não encontrado para ${documento}`)
                continue
            }

            const response = result.recordset[0]
            const valorLiberadoFloat = parseFloat(valor_liberado.replace(',', '.'))

            await sql.query`
                UPDATE ficha_proposta.dbo.cliente
                SET valor_digitacao = ${valorLiberadoFloat}, retorno_valor_liberado = ${valorLiberadoFloat}, status_acompanhamento = ${StatusEnum[status_da_ccb]}
                WHERE token_cadastro = ${response.token}
            `;

            console.log(`Atualizado ${documento} com valor ${valorLiberadoFloat} e status acompanhamento ${StatusEnum[status_da_ccb]}`)
        }
        */

        // INSERT
        await sql.query(`TRUNCATE TABLE ficha_proposta.dbo.cliente`);
        console.log('Tabela truncada com sucesso');

        // 3. INSERT linha a linha
        for (const row of data) {

            const {
                codigo_da_operacao,
                documento,
                valor_liberado,
                instituicao,
                status_da_ccb,
                data_da_solicitacao,
                prazo
            } = row;

            const token_ficha = uuidv4();

            const result = await sql.query`
                SELECT token
                FROM cadastro_unico.dbo.cadastro
                WHERE cpf = ${documento}
            `;

            if (result.recordset.length === 0) {
                const logMessage = `${documento}\n`
                await fs.appendFile('log.txt', logMessage, 'utf8')
                console.log(`Documento não encontrado para ${documento}`)
                continue
            }

            const dataISO = formatDateToISO(data_da_solicitacao);

            await sql.query(`
                    INSERT INTO ficha_proposta.dbo.cliente (
                        codigo_da_operacao, 
                        status_acompanhamento, 
                        uid_empresa, 
                        token_cadastro, 
                        valor_digitacao,
                        codigo_banco_digitacao,
                        convenio,
                        token,
                        usuario_digitacao,
                        uid_usuario,
                        tipo_operacao,
                        chat_bot,
                        prazo,
                        retorno_valor_liberado,
                        data_cadastro
                    )
                    VALUES (
                        '${codigo_da_operacao}',
                        ${StatusEnum[status_da_ccb]}, 
                        'NEW_115348968', 
                        '${result.recordset[0].token}', 
                        ${valor_liberado},
                        '${instituicao}',
                        'FGTS',
                        '${token_ficha}',
                        'U5AD37AE905-ACD217EAA7-5198CA33C5',
                        'U5AD37AE905-ACD217EAA7-5198CA33C5',
                        'NOVO',
                        '1',
                        ${prazo},
                        ${valor_liberado},
                        '${dataISO}'
                    )
            `);

            console.log(`Inserido documento ${documento}`);

        }

        console.log('Inserção finalizada com sucesso!');
        sql.close();
    } catch (err) {
        console.error("Erro:", err)
        await sql.close()
    }
}

async function update_cliente_database() {
    try {
        await sql.connect(config)

        const STARTDATE = '2025-05-01'
        const ENDDATE = '2025-05-31'
        const LIMIT = 2000

        const base_url = `https://api.tmjbeneficios.com.br/propostas/fgts/listar?startDate=${STARTDATE}&endDate=${ENDDATE}&limit=${LIMIT}`
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + process.env.API_TOKEN
        }

        const response = await fetch(base_url, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            console.error('Erro ao chamar a API:', response.statusText);
            return;
        }

        const data = await response.json();
        const arrayData = data.data

        for (const [index, proposta] of arrayData.entries()) {
            console.log(`Processando item ${index + 1} de ${arrayData.length}`);

            try {
                const {
                    id,
                    status,
                    createdAt,
                    customer: { phoneNumber },
                    reservation: { totalAmount, reservationId, numberOfPeriods }
                } = proposta

                const cpf = String(proposta.customer.cpf).replace(/\D/g, '');
                const reservationExists = await checkIfReservationExists(reservationId, id)

                const date = parseISO(createdAt);
                const newDate = subHours(date, 3);
                const formattedCreateAt = format(newDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")

                console.log(`reservationExists ${STARTDATE} a ${ENDDATE}`, {
                    index: index + 1,
                    total: arrayData.length,
                    reservationId, 
                    cpf, 
                    id, 
                    status, 
                    reservationExists, 
                })

                if (!reservationExists) {

                    console.log('create reservation')

                    const token = await getToken(cpf)

                    if (!token) {
                        const tokenCreated = await createUser(proposta.customer, formattedCreateAt)
                        await createNewReservation(id, proposta.reservation, tokenCreated, formattedCreateAt, phoneNumber, status, reservationId)
                    } else {
                        await createNewReservation(id, proposta.reservation, token, formattedCreateAt, phoneNumber, status, reservationId)
                    }

                } else {

                    console.log("atualiza reservationExists")
            
                    const token = await getToken(cpf)

                    if (!token) {
                        const tokenCreated = await createUser(proposta.customer, formattedCreateAt)
                        await updateReservation(id, reservationId, status, numberOfPeriods, totalAmount, tokenCreated, formattedCreateAt)
                    } else {
                        await updateReservation(id, reservationId, status, numberOfPeriods, totalAmount, token, formattedCreateAt)
                    }
                }
            } catch (error) {
                console.error(`Erro ao processar item ${index + 1} (ID: ${proposta?.id}):`, error);
                const logMessage = `${proposta?.id}\n`
                await fs.appendFile('log.txt', logMessage, 'utf8')
            }
        }

    } catch (err) {
        console.error("Erro:", err)
        await sql.close()
    } finally {
        console.log('Operações realizadas e conexão encerrada com sucesso.');
        await sql.close();
    }

}

update_cliente_database()

//main()
