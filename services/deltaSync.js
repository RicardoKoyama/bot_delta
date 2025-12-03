const db = require('../db/db');
const deltaApi = require('./deltaApi');

// =============== HELPERS DE MAPA ===============

// Mapeia um item da LISTA (listaCompleta) para os campos básicos da tabela produtos
function mapListaToProduto(item) {
  return {
    codigo:        item.cod_produto || null,
    referencia:    item.prd_referencia || null,
    nome:          item.dsc_item || null,
    nome_abreviado: item.dsc_abreviado || null,
    codigo_barra:  item.it_cbarra || null,
    tamanho:       item.dsc_tamanho_produtos || null,
    marca:         item.dsc_marca || null,
    superficie:    item.dsc_esp_superficie || null,
    m2_caixa:      item.prd_m2_caixa != null ? Number(item.prd_m2_caixa) : null,
    peso_caixa:    item.peso_caixa != null ? Number(item.peso_caixa) : null,
    caixas_pallet: item.prd_cx_pallet != null ? Number(item.prd_cx_pallet) : null,
    m2_pallet:     item.prd_m2_pallet != null ? Number(item.prd_m2_pallet) : null,
    peso_pallet:   item.peso_pallet != null ? Number(item.peso_pallet) : null,
    fora_linha:    item.it_fora_linha ? 1 : 0,
    url_produto:   item.prd_link_produto || null,
    id_site:       item.id_site != null ? Number(item.id_site) : null,
    imagem_url:    item.prd_link_img_produto || null
  };
}

// Mapeia um item de DETALHES (detalhes(codigo)) para os mesmos campos
function mapDetalhesToProduto(det) {
  return {
    referencia:    det.prd_referencia || null,
    nome:          det.dsc_item || null,
    nome_abreviado: det.dsc_abreviado || null,
    codigo_barra:  det.it_cbarra || null,
    tamanho:       det.dsc_tamanho_produtos || null,
    marca:         det.dsc_marca || null,
    superficie:    det.dsc_esp_superficie || null,
    m2_caixa:      det.prd_m2_caixa != null ? Number(det.prd_m2_caixa) : null,
    peso_caixa:    det.peso_caixa != null ? Number(det.peso_caixa) : null,
    caixas_pallet: det.prd_cx_pallet != null ? Number(det.prd_cx_pallet) : null,
    m2_pallet:     det.prd_m2_pallet != null ? Number(det.prd_m2_pallet) : null,
    peso_pallet:   det.peso_pallet != null ? Number(det.peso_pallet) : null,
    fora_linha:    det.it_fora_linha ? 1 : 0,
    url_produto:   det.prd_link_produto || null,
    id_site:       det.id_site != null ? Number(det.id_site) : null,
    imagem_url:    det.prd_link_img_produto || null
  };
}

// =============== SALVAR LISTA ===============

function salvarProdutoLista(item) {
  const p = mapListaToProduto(item);
  if (!p.codigo) return Promise.resolve(); // ignora registros sem código

  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO produtos (
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
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now','localtime'))
      ON CONFLICT(codigo) DO UPDATE SET
        referencia     = COALESCE(excluded.referencia, referencia),
        nome           = COALESCE(excluded.nome, nome),
        nome_abreviado = COALESCE(excluded.nome_abreviado, nome_abreviado),
        codigo_barra   = COALESCE(excluded.codigo_barra, codigo_barra),
        tamanho        = COALESCE(excluded.tamanho, tamanho),
        marca          = COALESCE(excluded.marca, marca),
        superficie     = COALESCE(excluded.superficie, superficie),
        m2_caixa       = COALESCE(excluded.m2_caixa, m2_caixa),
        peso_caixa     = COALESCE(excluded.peso_caixa, peso_caixa),
        caixas_pallet  = COALESCE(excluded.caixas_pallet, caixas_pallet),
        m2_pallet      = COALESCE(excluded.m2_pallet, m2_pallet),
        peso_pallet    = COALESCE(excluded.peso_pallet, peso_pallet),
        fora_linha     = COALESCE(excluded.fora_linha, fora_linha),
        url_produto    = COALESCE(excluded.url_produto, url_produto),
        id_site        = COALESCE(excluded.id_site, id_site),
        imagem_url     = COALESCE(excluded.imagem_url, imagem_url),
        atualizado_em  = datetime('now','localtime')
      `,
      [
        p.codigo,
        p.referencia,
        p.nome,
        p.nome_abreviado,
        p.codigo_barra,
        p.tamanho,
        p.marca,
        p.superficie,
        p.m2_caixa,
        p.peso_caixa,
        p.caixas_pallet,
        p.m2_pallet,
        p.peso_pallet,
        p.fora_linha,
        p.url_produto,
        p.id_site,
        p.imagem_url
      ],
      err => (err ? reject(err) : resolve())
    );
  });
}

async function sincronizarLista() {
  console.log('🔄 Sincronizando LISTA da Delta...');
  const lista = await deltaApi.listaCompleta();

  let total = 0;
  for (const item of lista) {
    await salvarProdutoLista(item);
    total++;
  }

  console.log(`✅ Lista sincronizada: ${total} produtos.`);
  return total;
}

// =============== BUSCA PRODUTOS SEM DETALHE ===============

function getProdutosSemDetalhes() {
  return new Promise(resolve => {
    db.all(
      `
      SELECT codigo 
      FROM produtos
      WHERE 
        nome IS NULL OR nome = ''
        OR referencia IS NULL OR referencia = ''
        OR tamanho IS NULL OR tamanho = ''
        OR codigo_barra IS NULL OR codigo_barra = ''
        OR imagem_url IS NULL OR imagem_url = ''
      `,
      (err, rows) => {
        if (err) {
          console.error('Erro ao buscar produtos sem detalhes:', err);
          return resolve([]);
        }
        resolve(rows.map(r => r.codigo));
      }
    );
  });
}

// =============== SALVAR DETALHES ===============

function salvarDetalhes(codigo, det) {
  const p = mapDetalhesToProduto(det);

  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE produtos SET
        referencia     = COALESCE(?, referencia),
        nome           = COALESCE(?, nome),
        nome_abreviado = COALESCE(?, nome_abreviado),
        codigo_barra   = COALESCE(?, codigo_barra),
        tamanho        = COALESCE(?, tamanho),
        marca          = COALESCE(?, marca),
        superficie     = COALESCE(?, superficie),
        m2_caixa       = COALESCE(?, m2_caixa),
        peso_caixa     = COALESCE(?, peso_caixa),
        caixas_pallet  = COALESCE(?, caixas_pallet),
        m2_pallet      = COALESCE(?, m2_pallet),
        peso_pallet    = COALESCE(?, peso_pallet),
        fora_linha     = COALESCE(?, fora_linha),
        url_produto    = COALESCE(?, url_produto),
        id_site        = COALESCE(?, id_site),
        imagem_url     = COALESCE(?, imagem_url),
        atualizado_em  = datetime('now','localtime')
      WHERE codigo = ?
      `,
      [
        p.referencia,
        p.nome,
        p.nome_abreviado,
        p.codigo_barra,
        p.tamanho,
        p.marca,
        p.superficie,
        p.m2_caixa,
        p.peso_caixa,
        p.caixas_pallet,
        p.m2_pallet,
        p.peso_pallet,
        p.fora_linha,
        p.url_produto,
        p.id_site,
        p.imagem_url,
        codigo
      ],
      err => (err ? reject(err) : resolve())
    );
  });
}

async function sincronizarDetalhes() {
  const pendentes = await getProdutosSemDetalhes();

  if (!pendentes.length) {
    console.log('ℹ Nenhum produto pendente de detalhes.');
    return 0;
  }

  console.log(`🔍 Sincronizando DETALHES de ${pendentes.length} produtos...`);
  let ok = 0;

  for (const cod of pendentes) {
    try {
      const det = await deltaApi.detalhes(cod);
      await salvarDetalhes(cod, det);
      ok++;
      console.log(`✔ Detalhes atualizados para ${cod}`);
    } catch (err) {
      console.error(`❌ Erro ao detalhar ${cod}:`, err.message);
    }
  }

  console.log(`🎯 Total de produtos detalhados: ${ok}`);
  return ok;
}

module.exports = {
  sincronizarLista,
  sincronizarDetalhes
};
