const db = require('../db/db');
const { listaCompleta, detalhes } = require('./deltaApi');

async function sincronizarLista() {
  console.log("🔄 Carregando lista completa da DELTA...");

  const lista = await listaCompleta();
  console.log(`✔ Lista carregada: ${lista.length} produtos`);

  // Aqui, se quiser, já grava algo simples (cod_produto, nome) no banco:
  for (const item of lista) {
    db.run(`
      INSERT OR REPLACE INTO produtos_delta (
        cod_produto, cod_base, nome, nome_abreviado, estoque, ean, ultima_atualizacao
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    [
      item.cod_produto,
      item.cod_produto.split('-')[0],
      item.dsc_item,
      item.dsc_abreviado,
      item.sdo_saldo_estoque,
      item.it_cbarra
    ]);
  }

  console.log("🎉 Sincronização da LISTA básica concluída!");
  return lista; // se quiser reutilizar depois
}

async function sincronizarDetalhes() {
  console.log("🔄 Carregando DETALHES por produto...");

  const lista = await listaCompleta();
  console.log(`✔ Lista carregada: ${lista.length} produtos`);

  for (const item of lista) {
    const cod = item.cod_produto;

    await new Promise(resolve => setTimeout(resolve, 300)); // delay

    try {
      const det = await detalhes(cod);

      const url = det.prd_link_produto || null;
      let id_site = null;
      if (url) {
        const match = url.match(/id=(\d+)/);
        if (match) id_site = match[1];
      }

      db.run(`
        INSERT OR REPLACE INTO produtos_delta (
          cod_produto, cod_base, prd_referencia,
          nome, nome_abreviado, ean, estoque,
          tamanho, marca, superficie, m2_caixa,
          cx_pallet, m2_pallet, peso_caixa,
          peso_pallet, fora_linha, url_produto,
          id_site, img_url, ultima_atualizacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      [
        det.cod_produto,
        det.cod_produto.split('-')[0],
        det.prd_referencia,
        det.dsc_item,
        det.dsc_abreviado,
        det.it_cbarra,
        det.sdo_saldo_estoque,
        det.dsc_tamanho_produtos,
        det.dsc_marca,
        det.dsc_esp_superficie,
        det.prd_m2_caixa,
        det.prd_cx_pallet,
        det.prd_m2_pallet,
        det.it_peso_bru,
        det.peso_caixa,
        det.it_fora_linha ? 1 : 0,
        det.prd_link_produto,
        id_site,
        det.prd_link_img_produto
      ]);

      console.log(`✔ Detalhes de ${cod} atualizados`);

    } catch (e) {
      console.log(`❌ Falha ao sincronizar detalhes de ${cod}: ${e.message}`);
    }
  }

  console.log("🎉 Sincronização de DETALHES concluída!");
}

module.exports = {
  sincronizarLista,
  sincronizarDetalhes
};
