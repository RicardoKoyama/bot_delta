const { sincronizarDetalhes } = require('./services/deltaSync');

(async () => {
  await sincronizarDetalhes();
})();
