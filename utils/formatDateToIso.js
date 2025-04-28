function formatDateToISO(dateStr) {
    const [dia, mes, ano] = dateStr.split('/');
    return `${ano}-${mes}-${dia}`;
}

module.exports = { formatDateToISO };