const db = require('../db/db');
const { listaCompleta, detalhes } = require('./deltaApi');
const { registrarLog } = require("./logService");

//
// Buscar produtos já existentes no banco
//
function getProdutosExistentes() {
  return new Promise(resolve => {
    db.all("SELECT codigo FROM produtos", (err, rows) => {
      if (err) return resolve([]);
      resolve(rows.map(r => r.codigo));
    });
  });
}

//
// Salvar produto no banco
//
function salvarProduto(item) {
  db.run(`
    INSERT OR REPLACE INTO produtos (
      codigo,
      referencia,
      nome,
      nome_abreviado,
      codigo_barra,
      tamanho,
      marca,
      superficie,
      m2_caixa,
      peso_caixa,
      caixas_pallet,
      m2_pallet,
      peso_pallet,
      fora_linha,
      url_produto,
      id_site,
      imagem_url,
      atualizado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `,
    [
      item.cod_produto,
      item.prd_referencia || null,
      item.dsc_item || null,
      item.dsc_abreviado || null,
      item.it_cbarra || null,
      item.dsc_tamanho_produtos || null,
      item.dsc_marca || null,
      item.dsc_esp_superficie || null,
      item.prd_m2_caixa || null,
      item.it_peso_bru || null,
      item.prd_cx_pallet || null,
      item.prd_m2_pallet || null,
      item.peso_caixa || null,
      item.it_fora_linha ? 1 : 0,
      item.prd_link_produto || null,
      item.id_site || null,
      item.prd_link_img_produto || null
    ]
  );
}

//
// Sincronizar LISTA
//
async function sincronizarLista() {
  await registrarLog({
    telefone: null,
    tipo: "SYNC_DELTA",
    mensagem: "Sincronizando LISTA da Delta...",
    info: {}
  });

  console.log('Sincronizando LISTA da Delta...')

  const lista = await listaCompleta();

  for (const item of lista) {
    salvarProduto(item);
  }

  await registrarLog({
    telefone: null,
    tipo: "SYNC_DELTA",
    mensagem: `Lista atualizada com ${lista.length} itens`,
    info: { total: lista.length }
  });

  return lista;
}

async function sincronizarDetalhes() {
  await registrarLog({
    telefone: null,
    tipo: "SYNC_DELTA",
    mensagem: "Sincronizando DETALHES...",
    info: {}
  });

  console.log('Sincronizando DETALHES da Delta...');

  // Buscar produtos que ainda NÃO têm detalhes
  const incompletos = await new Promise(resolve => {
    db.all(`
      SELECT codigo FROM produtos
      WHERE tamanho IS NULL
         OR marca IS NULL
         OR superficie IS NULL
         OR url_produto IS NULL
         OR imagem_url IS NULL
    `, (err, rows) => resolve(rows || []));
  });

  console.log(`Produtos com detalhes faltando: ${incompletos.length}`);

  if (!incompletos.length) {
    console.log("Nenhum detalhe pendente para sincronizar.");
    return [];
  }

  for (const row of incompletos) {
    const cod = row.codigo;

    try {
      const det = await detalhes(cod);

      let id_site = null;
      if (det.prd_link_produto) {
        const match = det.prd_link_produto.match(/id=(\d+)/);
        if (match) id_site = match[1];
      }

      salvarProduto({
        ...det,
        id_site,
        prd_link_img_produto: det.prd_link_img_produto
      });

      await registrarLog({
        telefone: null,
        tipo: "SYNC_DELTA",
        mensagem: `Detalhes sincronizados para ${cod}`,
        info: {}
      });

      await new Promise(r => setTimeout(r, 350));

    } catch (e) {
      await registrarLog({
        telefone: null,
        tipo: "SYNC_DELTA_ERRO",
        mensagem: `Erro ao sincronizar ${cod}`,
        info: { erro: e.message }
      });
    }
  }

  return incompletos;
}



module.exports = {
  sincronizarLista,
  sincronizarDetalhes
};
