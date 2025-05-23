require('dotenv').config()

const xlsx = require("xlsx")
const sql = require("mssql")
const fs = require('fs').promises
const { v4: uuidv4 } = require('uuid')
const { subHours, parseISO, format } = require('date-fns')

const config = require('./utils/config')
const { getToken } = require('./utils/getToken')
const { createUser } = require('./utils/createUser')
const { getAuthToken } = require('./utils/getAuthToken')
const { cleanDatabase } = require('./utils/cleanDatabase')
const { formatDateToISO } = require('./utils/formatDateToIso')
const { updateReservation } = require('./utils/updateReservation')
const { createNewReservation } = require('./utils/createNewReservation')
const { checkIfReservationExists } = require('./utils/checkIfReservationExists')
const { exportDuplicatedReservationIds } = require('./utils/exportDuplicatedReservationIds')

async function main() {
    try {
        await sql.connect(config)

        const authToken = await getAuthToken()
        if (!authToken) {
            console.error('Token de autenticação não encontrado.')
            return
        }

        const STARTDATE = '2025-05-01'
        const ENDDATE = '2025-05-31'
        const LIMIT = 2000

        const base_url = `https://api.tmjbeneficios.com.br/propostas/fgts/listar?startDate=${STARTDATE}&endDate=${ENDDATE}&limit=${LIMIT}`
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authToken
        }

        const response = await fetch(base_url, {
            method: 'GET',
            headers: headers
        })

        if (!response.ok) {
            console.error('Erro ao chamar a API:', response.statusText)
            return
        }

        const data = await response.json()
        const arrayData = data.data

        for (const [index, proposta] of arrayData.entries()) {
            console.log(`Processando item ${index + 1} de ${arrayData.length}`)

            try {
                const {
                    id,
                    status,
                    createdAt,
                    contractURL,
                    customer: { phoneNumber },
                    reservation: { totalAmount, reservationId, numberOfPeriods, reservationAmount }
                } = proposta

                const cpf = String(proposta.customer.cpf).replace(/\D/g, '')
                const reservationExists = await checkIfReservationExists(reservationId, createdAt, id)

                const date = parseISO(createdAt)
                const newDate = subHours(date, 3)
                const formattedCreateAt = format(newDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")

                // 1. Remover todos os registros com esse reservationId
                await sql.query`
                    DELETE FROM ficha_proposta.dbo.cliente
                    WHERE retorno_numero_proposta = ${reservationId}
                `

                // 2. Buscar ou criar token
                let token = await getToken(cpf)
                if (!token) {
                    token = await createUser(proposta.customer, formattedCreateAt)
                }

                console.log(`data to create new reservation ${STARTDATE} a ${ENDDATE}`, {
                    index: index + 1,
                    total: arrayData.length,
                    reservationId, 
                    cpf, 
                    id, 
                    status, 
                    reservationExists, 
                    contractURL
                })

                // 3. Inserir o registro
                await createNewReservation(
                    id,
                    proposta.reservation,
                    token,
                    formattedCreateAt,
                    phoneNumber,
                    status,
                    reservationId,
                    contractURL
                )
                
                console.log(`Reservation created successfully for ID: ${id}`)

            } catch (error) {
                console.error(`Erro ao processar item ${index + 1} (ID: ${proposta?.id}):`, error)
                const logMessage = `${proposta?.id}\n`
                await fs.appendFile('log.txt', logMessage, 'utf8')
            }
        }

    } catch (err) {
        console.error("Erro:", err)
        await sql.close()
    } finally {
        console.log('Operações realizadas e conexão encerrada com sucesso.')
        await sql.close()
    }

}

main()
