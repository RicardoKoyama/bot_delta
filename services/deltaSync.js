const db = require('../db/db');
const { listaCompleta, detalhes } = require('./deltaApi');
const { registrarLog } = require("./logService");   // <-- ADICIONADO


function getProdutosExistentes() {
  return new Promise(resolve => {
    db.all("SELECT cod_produto FROM produtos_delta", (err, rows) => {
      if (err) return resolve([]);
      resolve(rows.map(r => r.cod_produto));
    });
  });
}

function salvarBasicos(item) {
  db.run(`
    INSERT OR REPLACE INTO produtos_delta (
      cod_produto, cod_base, nome, nome_abreviado, ean,
      prd_referencia, tamanho, marca, superficie, m2_caixa,
      cx_pallet, m2_pallet, peso_caixa, peso_pallet,
      fora_linha, url_produto, id_site, img_url, ultima_atualizacao
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `,
  [
    item.cod_produto,
    item.cod_produto.split('-')[0],
    item.dsc_item,
    item.dsc_abreviado,
    item.it_cbarra,
    item.prd_referencia || null,
    item.dsc_tamanho_produtos || null,
    item.dsc_marca || null,
    item.dsc_esp_superficie || null,
    item.prd_m2_caixa || null,
    item.prd_cx_pallet || null,
    item.prd_m2_pallet || null,
    item.it_peso_bru || null,
    item.peso_caixa || null,
    item.it_fora_linha ? 1 : 0,
    item.prd_link_produto || null,
    item.id_site || null,
    item.prd_link_img_produto || null
  ]);
}


// =====================================================================
// LISTA
// =====================================================================
async function sincronizarLista() {
  await registrarLog({
    phone: null,
    tipo: "SYNC_DELTA",
    mensagem: "Sincronizando LISTA da Delta...",
    info: {}
  });

  const lista = await listaCompleta();
  
  for (const item of lista) {
    salvarBasicos(item);
  }

  await registrarLog({
    phone: null,
    tipo: "SYNC_DELTA",
    mensagem: `Lista atualizada com ${lista.length} itens`,
    info: { total: lista.length }
  });

  return lista;
}


// =====================================================================
// DETALHES
// =====================================================================
async function sincronizarDetalhes() {
  await registrarLog({
    phone: null,
    tipo: "SYNC_DELTA",
    mensagem: "Sincronizando DETALHES (apenas itens novos)...",
    info: {}
  });

  const lista = await listaCompleta();
  const existentes = await getProdutosExistentes();

  const novos = lista.filter(p => !existentes.includes(p.cod_produto));

  await registrarLog({
    phone: null,
    tipo: "SYNC_DELTA",
    mensagem: `Foram encontrados ${novos.length} novos itens`,
    info: {}
  });

  for (const item of novos) {
    const cod = item.cod_produto;

    try {
      const det = await detalhes(cod);

      // Montar id_site
      const url = det.prd_link_produto || null;
      let id_site = null;
      if (url) {
        const match = url.match(/id=(\d+)/);
        if (match) id_site = match[1];
      }

      salvarBasicos({
        ...det,
        id_site,
        img_url: det.prd_link_img_produto
      });

      await registrarLog({
        phone: null,
        tipo: "SYNC_DELTA",
        mensagem: `Detalhes sincronizados para ${cod}`,
        info: {}
      });

      await new Promise(r => setTimeout(r, 300));

    } catch (e) {
      await registrarLog({
        phone: null,
        tipo: "SYNC_DELTA_ERRO",
        mensagem: `Erro ao sincronizar detalhes de ${cod}`,
        info: { erro: e.message }
      });
    }
  }

  await registrarLog({
    phone: null,
    tipo: "SYNC_DELTA",
    mensagem: "Sincronização de detalhes concluída!",
    info: {}
  });

  return novos;
}

module.exports = {
  sincronizarLista,
  sincronizarDetalhes
};
