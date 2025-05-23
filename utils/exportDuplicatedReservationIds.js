const xlsx = require('xlsx');
const fs = require('fs');

function exportDuplicatedReservationIds(arrayData) {
    // 1. Contar os reservationId
    const countMap = {};
    arrayData.forEach(item => {
        const reservationId = item.reservation?.reservationId;
        if (reservationId) {
            countMap[reservationId] = (countMap[reservationId] || 0) + 1;
        }
    });

    // 2. Filtrar os que aparecem mais de uma vez
    const duplicatedIds = Object.keys(countMap).filter(id => countMap[id] > 1);

    // 3. Pegar os objetos completos dos duplicados
    const duplicatedRows = arrayData.filter(item =>
        duplicatedIds.includes(item.reservation?.reservationId)
    );

    // 4. Montar dados para exportar
    const exportData = duplicatedRows.map(item => ({
        reservationId: item.reservation?.reservationId,
        customerName: item.customerName,
        status: item.status,
        createdAt: item.createdAt,
        // Adicione outros campos que quiser exportar
    }));

    // 5. Criar a planilha
    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Duplicados');

    // 6. Salvar arquivo
    xlsx.writeFile(wb, 'reservationIds_duplicados.xlsx');
}

module.exports = { exportDuplicatedReservationIds };