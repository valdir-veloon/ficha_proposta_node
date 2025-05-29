require('dotenv').config()

const sql = require("mssql")
const xlsx = require('xlsx')
const fs = require('fs').promises
const { subHours, parseISO, format, addDays } = require('date-fns')

const config = require('./utils/config')
const { getToken } = require('./utils/getToken')
const { createUser } = require('./utils/createUser')
const { getAuthToken } = require('./utils/getAuthToken')
const { createNewReservation } = require('./utils/createNewReservation')
const { checkIfReservationExists } = require('./utils/checkIfReservationExists')
const { getStatusEnum } = require('./utils/statusEnum')

// async function main() {
//     try {
//         await sql.connect(config)

//         const authToken = await getAuthToken()
//         if (!authToken) {
//             console.error('Token de autenticação não encontrado.')
//             return
//         }

//         const STARTDATE = '2025-05-01'
//         const ENDDATE = '2025-05-31'
//         const LIMIT = 1500

//         let currentStart = parseISO(STARTDATE)
//         const finalDate = parseISO(ENDDATE)

//         let totalProcessado = 0
//         let processedIds = new Set()

//         while (currentStart <= finalDate) { 
//             let currentEnd = addDays(currentStart, 1) // 2 em 2 dias
//             if (currentEnd > finalDate) currentEnd = finalDate

//             const startStr = format(currentStart, 'yyyy-MM-dd')
//             const endStr = format(currentEnd, 'yyyy-MM-dd')

//             console.log(`Buscando propostas de ${startStr} até ${endStr}`)

//             const base_url = `https://api.tmjbeneficios.com.br/propostas/fgts/listar?startDate=${startStr}&endDate=${endStr}&limit=${LIMIT}`
//             const headers = {
//                 'Content-Type': 'application/json',
//                 'Authorization': 'Bearer ' + authToken
//             }
    
//             const response = await fetch(base_url, {
//                 method: 'GET',
//                 headers: headers
//             })
    
//             if (!response.ok) {
//                 console.error('Erro ao chamar a API:', response.statusText)
//                 currentStart = addDays(currentEnd, 1)
//                 continue
//             }

//             const data = await response.json()
//             const arrayData = data.data
//             for (const [index, proposta] of arrayData.entries()) {
//                 const { id } = proposta

//                  if (processedIds.has(id)) {
//                     continue
//                 }
//                 processedIds.add(id)

//                 totalProcessado++
//                 console.log(`Processando item ${index + 1} de ${arrayData.length} - de ${startStr} até ${endStr} | Total geral: ${totalProcessado}`)
    
//                 try {
//                     const {
//                         id,
//                         status,
//                         createdAt,
//                         contractURL,
//                         customer: { phoneNumber },
//                         reservation: { totalAmount, reservationId, numberOfPeriods, reservationAmount }
//                     } = proposta
    
//                     const cpf = String(proposta.customer.cpf).replace(/\D/g, '')
//                     const reservationExists = await checkIfReservationExists(reservationId, createdAt, id)
    
//                     const date = parseISO(createdAt)
//                     const newDate = subHours(date, 3)
//                     const formattedCreateAt = format(newDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    
//                     // 1. Remover todos os registros com esse reservationId
//                     await sql.query`
//                         DELETE FROM ficha_proposta.dbo.cliente
//                         WHERE retorno_numero_proposta = ${reservationId}
//                     `
    
//                     // 2. Buscar ou criar token
//                     let token = await getToken(cpf)
//                     if (!token) {
//                         token = await createUser(proposta.customer, formattedCreateAt)
//                     }
    
//                     console.log(`data to create new reservation ${STARTDATE} a ${ENDDATE}`, {
//                         index: index + 1,
//                         total: arrayData.length,
//                         reservationId, 
//                         cpf, 
//                         id, 
//                         status, 
//                         reservationExists, 
//                         contractURL
//                     })
    
//                     // 3. Inserir o registro
//                     await createNewReservation(
//                         totalProcessado,
//                         id,
//                         proposta.reservation,
//                         token,
//                         formattedCreateAt,
//                         phoneNumber,
//                         status,
//                         reservationId,
//                         contractURL
//                     )
                    
//                     console.log(`Reservation created successfully for ID: ${id}`)
    
//                 } catch (error) {
//                     console.error(`Erro ao processar item ${index + 1} (ID: ${proposta?.id}):`, error)
//                     const logMessage = `${proposta?.id}\n`
//                     await fs.appendFile('log.txt', logMessage, 'utf8')
//                 }
//             }

//             currentStart = addDays(currentEnd, 1)

//             console.log(`Próxima data de início: ${format(currentStart, 'yyyy-MM-dd')}`)
//             console.log(`Próxima data de fim: ${format(currentEnd, 'yyyy-MM-dd')}`)
//         }

//         console.log(`Processamento finalizado. Total de itens processados: ${totalProcessado}`)

//     } catch (err) {
//         console.error("Erro:", err)
//         await sql.close()
//     } finally {
//         console.log('Operações realizadas e conexão encerrada com sucesso.')
//         await sql.close()
//     }

// }

// main()

// "awaitingPaymentConfirmation": 0,
//     "canceled": 3,
//     "pendingCustomer": 2,
//     "customerRefused": 1,
//     "institutionRefused": 4,
//     "pendingInstitution": 5,
//     "unblockingError": 6,
//     "undefined": 7

const status_mapping = {
    'Pagamento Confirmado': 0,
    'Recusado Cliente': 1,
    'Pendente Cliente': 2,
    'Cancelada': 3,    
    'Recusado Instituição': 4,
    'Pendente Instituição': 5,
    'Erro de Desbloqueio': 6,
    'não encontrado': 7
}

async function main() {
    try {
        await sql.connect(config)

        // 1. Ler o arquivo Excel
        const workbook = xlsx.readFile('planilha_propostas.xlsx')
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const arrayData = xlsx.utils.sheet_to_json(sheet)

        let totalProcessado = 0
        let processedIds = new Set()

        for (const [index, proposta] of arrayData.entries()) {
            const id = proposta['Código da Operação'] || proposta.id
            
            if (processedIds.has(id)) continue
            processedIds.add(id)
            totalProcessado++
            
            try {
                // Ajuste os campos conforme os nomes das colunas do seu Excel
                const status = status_mapping[proposta.Status] || 'não encontrado'
                const createdAt = proposta.Data || proposta.createdAt
                const contractURL = proposta.link_cliente || proposta.contractURL || ''
                const phoneNumber = proposta.CPF || proposta.phoneNumber
                const reservationId = proposta['Reservation ID'] || proposta.reservationId
                const reservationAmount = proposta['Valor da Reserva'] || proposta.reservationAmount
                const numberOfPeriods = proposta.numberPeriods || 1
                const originalStatus = getStatusEnum(proposta.originalStatus) || ''
                
                //  console.log({
                //      id, 
                //      status, 
                //      createdAt, 
                //      contractURL, 
                //      phoneNumber, 
                //      reservationId, 
                //      reservationAmount, 
                //      numberOfPeriods,
                //      proposta_status: proposta.Status,
                //     originalStatus
                //  })
                //  return

                // Ajuste a data para o formato ISO, se necessário
                let formattedCreateAt = createdAt
                if (typeof createdAt === 'string' && createdAt.includes('/')) {
                    // Exemplo: 01/05/2025 12:00:00
                    const [date, time] = createdAt.split(' ')
                    const [day, month, year] = date.split('/')
                    formattedCreateAt = `${year}-${month}-${day}T${time || '00:00:00.000'}Z`
                }

                // 1. Remover todos os registros com esse reservationId
                await sql.query`
                    DELETE FROM ficha_proposta.dbo.cliente
                    WHERE codigo_da_operacao = ${id}
                `

                // 2. Buscar ou criar token
                let cpf = String(phoneNumber).replace(/\D/g, '')
                let token = await getToken(cpf)
                if (!token) {
                    token = await createUser({ cpf }, formattedCreateAt)
                }

                // 3. Inserir o registro
                await createNewReservation(
                    totalProcessado,
                    id,
                    { reservationAmount, numberOfPeriods },
                    token,
                    formattedCreateAt,
                    phoneNumber,
                    proposta.originalStatus,
                    reservationId,
                    contractURL
                )

                console.log(`Reservation created successfully for ID: ${id} - ${index + 1} de ${arrayData.length}`)

            } catch (error) {
                console.error(`Erro ao processar item ${index + 1} (ID: ${id}):`, error)
                const logMessage = `${id}\n`
                await fs.appendFile('log.txt', logMessage, 'utf8')
            }
        }

        console.log(`Processamento finalizado. Total de itens processados: ${totalProcessado}`)

    } catch (err) {
        console.error("Erro:", err)
        await sql.close()
    } finally {
        console.log('Operações realizadas e conexão encerrada com sucesso.')
        await sql.close()
    }
}

main()