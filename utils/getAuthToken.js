export const getAuthToken = async () => {
    try {
        const base_url = 'https://api.tmjbeneficios.com.br/no-auth/authentication/login'
        const headers = {
            'Content-Type': 'application/json'
        }
        const data = {
            email: process.env.API_EMAIL,
            senha: process.env.API_PASSWORD
        }

        const response = await fetch(base_url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            console.error('Erro ao chamar a API:', response)
            return
        }
        
        const result = await response.json()
        return result?.accessToken
        
    } catch (error) {
        console.error('Erro ao obter token de autenticação:', error)
    }
}