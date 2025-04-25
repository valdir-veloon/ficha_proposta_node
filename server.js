const fs = require('fs').promises
const xlsx = require("xlsx")
const sql = require("mssql")
const { v4: uuidv4 } = require('uuid');
const { subHours, parseISO, format } = require('date-fns');

const config = {
    user: "sa",
    password: "k1NLiH#_YsB8Y98r6DE",
    server: "46.21.150.142",
    database: "homol_hub",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
}

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
            "Aguardando Confirmação de Pagamento": 0,
            "Cancelada": 3,
            "Pendente Cliente": 2,
            "Recusado Cliente": 1,
            "Recusado Instituição": 4,
            "Pendente Instituição": 5
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

            const valorLiberadoFloat = parseFloat(String(valor_liberado).replace(/\./g, '').replace(',', '.'))
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

function formatDateToISO(dateStr) {
    const [dia, mes, ano] = dateStr.split('/');
    return `${ano}-${mes}-${dia}`;
}

async function getToken(cpf) {

    if (!cpf) return null

    try {
     
        await sql.connect(config)
        const result = await sql.query`
            SELECT token
            FROM cadastro_unico.dbo.cadastro
            WHERE cpf = ${cpf}
        `;

        if (result.recordset.length === 0) return null

        const token = result.recordset[0]?.token
        
        if (!token) return null

        return token
    
    } catch (err) {
        console.error("Erro ao conectar ao banco de dados:", err)
        return null
    }
}

async function checkIfReservationExists(reservationId, id) {
    try {
        await sql.connect(config)
        const result = await sql.query`
            SELECT *
                FROM ficha_proposta.dbo.cliente_tmp
            WHERE retorno_numero_proposta = ${reservationId} or codigo_da_operacao = ${id}
        `;

        return result.recordset[0]
    } catch (err) {
        console.error("Erro ao conectar ao banco de dados:", err)
        return false;
    }
}

async function createUser(customer, createdAt) {
    if (!customer) return null

    try {
        await sql.connect(config)

        const token = uuidv4()
        const {
            cpf,
            name,
            uf,
            city,
            district,
            cep,
            address,
            addressNumber,
            phoneNumber,
            email
        } = customer

        const formatUf = uf.substring(0, 2).toUpperCase();

        await sql.query(`
            INSERT INTO cadastro_unico.dbo.cadastro (
                cpf, 
                nome,
                token,
                uf, 
                municipio,
                cep,
                bairro,
                logradouro,
                numero_residencia,
                telefone_whatsapp,
                email,
                data_cadastro,
                uid_empresa,
                uid_usuario,
                status,
                fgts_data_ultima_simulacao
            )
            VALUES (
                '${cpf}',
                '${name}', 
                '${token}', 
                '${formatUf}', 
                '${city}',
                '${cep}',
                '${district}',
                '${address}',
                '${addressNumber}',
                '55${phoneNumber}',
                '${email}',
                GETDATE(),
                'NEW_115348968',
                'U5AD37AE905-ACD217EAA7-5198CA33C5',
                0,
                '${createdAt}'
            )
        `);

        return token

    } catch (error) {
        console.error("Erro ao criar usuário:", error)
        return null
    }
}

const StatusEnum = {
    "awaitingPaymentConfirmation": 0,
    "canceled": 3,
    "pendingCustomer": 2,
    "customerRefused": 1,
    "institutionRefused": 4,
    "pendingInstitution": 5
};
  

async function createNewReservation(id, reservation, token, createdAt, phoneNumber, status, reservationId=null) {

    if (!reservation) return null

    try {
        await sql.connect(config)
        const token_ficha = uuidv4()

        const {
            totalAmount,
            numberOfPeriods
        } = reservation

        const totalAmountFloat = parseFloat(String(totalAmount).replace(/\./g, '').replace(',', '.'))

        await sql.query(`
            INSERT INTO ficha_proposta.dbo.cliente_tmp (
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

async function updateReservation(id, reservationId, status, numberOfPeriods, totalAmount, token, createdAt) {
    try {
        await sql.connect(config)

        const totalAmountFloat = parseFloat(String(totalAmount).replace(/\./g, '').replace(',', '.'))

        await sql.query`
            UPDATE ficha_proposta.dbo.cliente_tmp
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

async function update_cliente_database() {
    try {
        await sql.connect(config)

        const STARTDATE = '2025-02-01'
        const ENDDATE = '2025-02-28'
        const LIMIT = 1500

        const base_url = `https://api.tmjbeneficios.com.br/propostas/fgts/listar?startDate=${STARTDATE}&endDate=${ENDDATE}&limit=${LIMIT}`
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyZW5hbi5zb3VzYUB2ZWxvb24uY29tLmJyIiwiaWQiOjIwLCJub21lIjoiUmVuYW4gU291c2EiLCJpZHRpcG91c3VhcmlvIjoxLCJpZGVtcHJlc2EiOjEsIm5vbWVlbXByZXNhIjoiQ0FSVE9TIFNPQ0lFREFERSBERSBDUkVESVRPIERJUkVUTyBTLkEuIiwiYXBlbGlkb2VtcHJlc2EiOiJDQVJUT1MgU0NEIiwibm9oYXNjb21wYW55IjpmYWxzZSwiaWF0IjoxNzQ1Mjg2MDQwLCJleHAiOjE3NDYxNTAwNDB9.U1NeVkyPQe6EvjmHtPwPJuRL1DLUsx89FQmOTYoTHbo'
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
            
                    // Atualizar a reserva existente
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
