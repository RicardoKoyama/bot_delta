const sacTexto = require('./texto');

module.exports = {
  async handleTexto(message, accountId, client) {
    return sacTexto.process(message, accountId, client);
  }
};
