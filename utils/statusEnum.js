const StatusEnum = {
    "awaitingPaymentConfirmation": 0,
    "canceled": 3,
    "pendingCustomer": 2,
    "customerRefused": 1,
    "institutionRefused": 4,
    "pendingInstitution": 5,
    "unblockingError": 6,
    "undefined": 7
}

function getStatusEnum(status) {
    return StatusEnum[status] ?? 7
}

module.exports = { 
    StatusEnum, 
    getStatusEnum 
}