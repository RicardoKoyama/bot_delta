const { sincronizarLista } = require('./services/deltaSync');

(async () => {
  await sincronizarLista();
})();
