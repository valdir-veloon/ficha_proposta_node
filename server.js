require('dotenv').config()

const xlsx = require("xlsx")
const sql = require("mssql")
const fs = require('fs').promises
const { v4: uuidv4 } = require('uuid')
const { subHours, parseISO, format } = require('date-fns')

const config = require('./utils/config')
const { getToken } = require('./utils/getToken')
const { createUser } = require('./utils/createUser')
const { cleanDatabase } = require('./utils/cleanDatabase')
const { formatDateToISO } = require('./utils/formatDateToIso')
const { updateReservation } = require('./utils/updateReservation')
const { createNewReservation } = require('./utils/createNewReservation')
const { checkIfReservationExists } = require('./utils/checkIfReservationExists')

async function main() {
    try {
        await sql.connect(config)

        const STARTDATE = '2025-05-01'
        const ENDDATE = '2025-06-01'
        const LIMIT = 2000

        const base_url = `https://api.tmjbeneficios.com.br/propostas/fgts/listar?startDate=${STARTDATE}&endDate=${ENDDATE}&limit=${LIMIT}`
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + process.env.API_TOKEN
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

        // Se tiver dados, limpa a base na data indicada e insere os novos dados
        const cleanDatabaseResponse = await cleanDatabase(STARTDATE, ENDDATE)

        if (cleanDatabaseResponse) {

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
    
                    console.log(`reservationExists ${STARTDATE} a ${ENDDATE}`, {
                        index: index + 1,
                        total: arrayData.length,
                        reservationId, 
                        cpf, 
                        id, 
                        status, 
                        reservationExists, 
                        contractURL
                    })
    
                    if (!reservationExists) {
    
                        console.log('create reservation')
    
                        const token = await getToken(cpf)
    
                        if (!token) {
                            const tokenCreated = await createUser(proposta.customer, formattedCreateAt)
                            await createNewReservation(id, proposta.reservation, tokenCreated, formattedCreateAt, phoneNumber, status, reservationId, contractURL)
                        } else {
                            await createNewReservation(id, proposta.reservation, token, formattedCreateAt, phoneNumber, status, reservationId, contractURL)
                        }
    
                    } else {
    
                        console.log("atualiza reservationExists")
                
                        const token = await getToken(cpf)
    
                        if (!token) {
                            const tokenCreated = await createUser(proposta.customer, formattedCreateAt)
                            await updateReservation(id, reservationId, status, numberOfPeriods, reservationAmount, tokenCreated, formattedCreateAt, contractURL)
                        } else {
                            await updateReservation(id, reservationId, status, numberOfPeriods, reservationAmount, token, formattedCreateAt, contractURL)
                        }
                    }
                } catch (error) {
                    console.error(`Erro ao processar item ${index + 1} (ID: ${proposta?.id}):`, error)
                    const logMessage = `${proposta?.id}\n`
                    await fs.appendFile('log.txt', logMessage, 'utf8')
                }
            }
        } else {
            console.log("Erro ao limpar a base de dados")
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
