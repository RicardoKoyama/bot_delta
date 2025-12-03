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
// 🔎 Busca apenas os produtos que ainda NÃO têm detalhes
function getProdutosSemDetalhes() {
  return new Promise(resolve => {
    db.all(
      `
      SELECT codigo
      FROM produtos
      WHERE 
        (tamanho IS NULL OR tamanho = '')
        OR (codigo_barra IS NULL OR codigo_barra = '')
        OR (nome_abreviado IS NULL OR nome_abreviado = '')
      `,
      (err, rows) => {
        if (err) {
          console.error("Erro ao buscar produtos sem detalhes:", err);
          return resolve([]);
        }
        resolve(rows.map(r => r.codigo));
      }
    );
  });
}

async function sincronizarDetalhes() {
  const codigos = await getProdutosSemDetalhes();

  if (!codigos.length) {
    console.log("Nenhum produto pendente de detalhes.");
    await registrarLog({
      tipo: "SYNC_DELTA_DETALHES",
      mensagem: "Nenhum produto pendente de detalhes",
      info: { quantidade: 0 }
    });
    return 0;
  }

  console.log(`Sincronizando DETALHES da Delta para ${codigos.length} produtos...`);

  let atualizados = 0;

  for (const cod of codigos) {
    try {
      const det = await detalhes(cod);

      // Ajusta os campos conforme o que a API retorna
      // (ajusta os nomes conforme seu JSON real)
      const {
        referencia,
        nome,
        nome_abreviado,
        codigo_barra,
        tamanho
      } = det;

      await new Promise((resolve, reject) => {
        db.run(
          `
          UPDATE produtos
          SET referencia = ?, nome = ?, nome_abreviado = ?, codigo_barra = ?, tamanho = ?
          WHERE codigo = ?
          `,
          [referencia, nome, nome_abreviado, codigo_barra, tamanho, cod],
          function (err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      atualizados++;

      await registrarLog({
        tipo: "SYNC_DELTA_DETALHE_OK",
        mensagem: `Detalhes sincronizados para ${cod}`,
        info: { codigo: cod }
      });

    } catch (e) {
      console.error(`Erro ao detalhar ${cod}:`, e.message);

      await registrarLog({
        tipo: "SYNC_DELTA_ERRO",
        mensagem: `Erro ao sincronizar ${cod}`,
        info: { erro: e.message }
      });
    }
  }

  console.log(`Detalhes atualizados para ${atualizados} produtos.`);
  return atualizados;
}


module.exports = {
  sincronizarLista,
  sincronizarDetalhes
};
