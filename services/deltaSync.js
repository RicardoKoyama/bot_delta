const db = require('../db/db');
const deltaApi = require('./deltaApi');

// ======================
// SALVA PRODUTO BÁSICO
// ======================
function salvarProdutoBasico(item) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO produtos (
        codigo,
        id_site,
        slug,
        atualizado_em
      )
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(codigo) DO UPDATE SET
        id_site = excluded.id_site,
        slug = excluded.slug,
        atualizado_em = CURRENT_TIMESTAMP
      `,
      [
        item.cod_produto,
        item.id_site || null,
        item.prd_link_produto || null
      ],
      err => err ? reject(err) : resolve()
    );
  });
}


// ======================
// SINCRONIZA LISTA
// ======================
async function sincronizarLista() {
  console.log("🔄 Sincronizando LISTA da Delta...");

  const lista = await deltaApi.listaCompleta();
  let total = 0;

  for (const item of lista) {
    await salvarProdutoBasico(item);
    total++;
  }

  console.log(`✅ Lista sincronizada: ${total} produtos.`);
  return total;
}


// ======================
// BUSCA PRODUTOS SEM DETALHES
// ======================
function getProdutosSemDetalhes() {
  return new Promise(resolve => {
    db.all(
      `
      SELECT codigo FROM produtos
      WHERE nome IS NULL
         OR nome = ''
         OR referencia IS NULL
         OR referencia = ''
         OR tamanho IS NULL
         OR tamanho = ''
         OR codigo_barra IS NULL
         OR codigo_barra = ''
      `,
      (err, rows) => resolve(rows?.map(r => r.codigo) || [])
    );
  });
}


// ======================
// ATUALIZA DETALHES
// ======================
function salvarDetalhes(cod, det) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE produtos SET
        referencia = ?,
        nome = ?,
        nome_abreviado = ?,
        marca = ?,
        tamanho = ?,
        superficie = ?,
        codigo_barra = ?,
        m2_caixa = ?,
        id_site = COALESCE(id_site, ?),
        link_produto = ?,
        link_imagem = ?,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE codigo = ?
      `,
      [
        det.prd_referencia,
        det.dsc_item,
        det.dsc_abreviado,
        det.dsc_marca,
        det.dsc_tamanho_produtos,
        det.dsc_esp_superficie,
        det.it_cbarra,
        det.prd_m2_caixa,
        det.id_site || null,
        det.prd_link_produto,
        det.prd_link_img_produto,
        cod
      ],
      err => err ? reject(err) : resolve()
    );
  });
}


// ======================
// SINCRONIZA DETALHES
// ======================
async function sincronizarDetalhes() {
  const pendentes = await getProdutosSemDetalhes();

  if (!pendentes.length) {
    console.log("ℹ Nenhum produto pendente de detalhes.");
    return 0;
  }

  console.log(`🔍 Detalhando ${pendentes.length} produtos...`);

  let ok = 0;

  for (const cod of pendentes) {
    try {
      const det = await deltaApi.detalhes(cod);
      await salvarDetalhes(cod, det);
      ok++;
      console.log(`✔ ${cod} atualizado`);
    } catch (err) {
      console.error(`❌ Erro ao sincronizar ${cod}:`, err.message);
    }
  }

  console.log(`🎯 Detalhes atualizados: ${ok}`);
  return ok;
}

module.exports = {
  sincronizarLista,
  sincronizarDetalhes
};
