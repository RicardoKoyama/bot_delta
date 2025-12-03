const texto = require('./texto');
const imagem = require('./imagem');

async function handleTexto(message, accountId, client) {
    return texto.process(message, accountId, client);
}

async function handleImagem(message, accountId, client) {
    return imagem.process(message, accountId, client);
}

module.exports = { handleTexto, handleImagem };
