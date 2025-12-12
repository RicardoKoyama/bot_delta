// texto.js — consulta DELTA e monta mensagem com preço (m² / palete)
const db = require('../../../../db/db');
const deltaApi = require('../../../deltaApi');
const { MessageMedia } = require('whatsapp-web.js');
const { registrarLog } = require("../../../logService");

async function resolverTelefone(msg) {
  const rawId = (msg.from || '').split('@')[0].trim();

  // tenta resolver via whatsapp_lid_map
  const row = await sqlGet(
    'SELECT telefone FROM whatsapp_lid_map WHERE lid = ? LIMIT 1',
    [rawId]
  );

  if (row?.telefone) return row.telefone;

  // fallback: dígitos
  return rawId.replace(/\D/g, "");
}


// ============================================================
// Helpers SQLite
// ============================================================
function sqlGet(sql, params = []) {
  return new Promise(resolve => {
    db.get(sql, params, (err, row) => resolve(row || null));
  });
}

function sqlAll(sql, params = []) {
  return new Promise(resolve => {
    db.all(sql, params, (err, rows) => resolve(rows || []));
  });
}

// ============================================================
// Formatação
// ============================================================
function formatarNumero(valor) {
  if (valor === undefined || valor === null) return null;
  const n = Number(valor);
  if (isNaN(n)) return null;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ============================================================
// Buscar preço do produto para o usuário
// ============================================================
async function buscarPrecoProduto(telefone, codigoProduto) {
  if (!telefone) return null;

  // Resolve cliente do usuário
  const user = await sqlGet(
    "SELECT cliente_id FROM usuarios WHERE telefone = ? LIMIT 1",
    [telefone]
  );

  if (!user?.cliente_id) return null;

  // Resolve tabela de preço do cliente
  const tabela = await sqlGet(
    `
    SELECT tp.id, tp.codigo
    FROM clientes c
    JOIN tabelas_preco tp ON tp.id = c.tabela_preco_id
    WHERE c.id = ?
    LIMIT 1
    `,
    [user.cliente_id]
  );

  if (!tabela) return null;

  // Busca preço do produto
  const preco = await sqlGet(
    `
    SELECT preco_m2, preco_m2_palete
    FROM produtos_preco
    WHERE tabela_preco_id = ?
      AND codigo_produto = ?
    LIMIT 1
    `,
    [tabela.id, codigoProduto]
  );

  if (!preco) return null;

  return {
    tabela: tabela.codigo,
    preco_m2: preco.preco_m2,
    preco_m2_palete: preco.preco_m2_palete
  };
}

// ============================================================
// Handler principal
// ============================================================
module.exports = async function textoHandler(client, msg, body, usuario) {

  const termo = (body || "").trim().toLowerCase();
  const telefone = await resolverTelefone(msg);


  // -------------------------------------------------------------------------
  // Monta mensagem
  // -------------------------------------------------------------------------
  async function montarMensagem(det, precoInfo) {

    let texto =
      `📌 *${det.dsc_item}*\n\n` +
      `*Referência:* ${det.cod_produto}\n` +
      `*Tamanho:* ${det.dsc_tamanho_produtos}\n` +
      `*Superfície:* ${det.dsc_esp_superficie}\n` +
      `*Marca:* ${det.dsc_marca}\n` +
      `*Caixa:* ${det.prd_m2_caixa} m²\n` + 
      `*Palete:* ${det.prd_m2_pallet} m²\n`;
      

    // ----------------------------
    // Bloco de preço
    // ----------------------------
    if (precoInfo?.preco_m2) {
      texto += `*Valor Fracionado* - R$ ${formatarNumero(precoInfo.preco_m2)} / m²\n`;

      if (precoInfo.preco_m2_palete) {
        texto += `*Valor Palete Fechado* - R$ ${formatarNumero(precoInfo.preco_m2_palete)} / m²\n`;
      }
    }

    texto += `\n🔗 ${det.prd_link_produto}`;

    return texto;
  }

  // -------------------------------------------------------------------------
  // Responder produto
  // -------------------------------------------------------------------------
  async function responderProduto(row) {
    console.log("New Texto.js");
    try {
      const det = await deltaApi.detalhes(row.codigo);

      // Busca preço (opcional)
      const precoInfo = await buscarPrecoProduto(telefone, row.codigo);

      const texto = await montarMensagem(det, precoInfo);

      try {
        if (det.prd_link_img_produto) {
          const media = await MessageMedia.fromUrl(
            det.prd_link_img_produto,
            { unsafeMime: true }
          );
          await client.sendMessage(msg.from, media, { caption: texto });
        } else {
          await msg.reply(texto);
        }
      } catch {
        await msg.reply(texto);
      }

      registrarLog({
        telefone,
        tipo: "consulta",
        mensagem: body,
        info: { produto: row.codigo }
      });

    } catch (e) {
      console.error("❌ Erro API Delta:", e);
      await msg.reply("❌ Erro ao consultar produto.");
    }
  }

  // -------------------------------------------------------------------------
  // BUSCA POR URL (QR DELTA)
  // -------------------------------------------------------------------------
  async function buscarPorURL(url) {
    const idMatch = url.match(/id=(\d+)/i);
    if (!idMatch) return null;

    const id = idMatch[1];

    return await sqlGet(
      "SELECT * FROM produtos WHERE url_produto LIKE ? OR codigo = ? LIMIT 1",
      [`%${id}%`, id]
    );
  }

  // -------------------------------------------------------------------------
  // FLUXOS DE BUSCA
  // -------------------------------------------------------------------------
  if (termo.startsWith("http")) {
    const row = await buscarPorURL(termo);
    if (row) return responderProduto(row);
    return msg.reply("❌ Produto não encontrado.");
  }

  if (/^\d{13}$/.test(termo)) {
    const row = await sqlGet(
      "SELECT * FROM produtos WHERE codigo_barra = ?",
      [termo]
    );
    if (row) return responderProduto(row);
    return msg.reply("❌ Produto não encontrado.");
  }

  if (/^\d{3,5}-[a-z]$/i.test(termo)) {
    const row = await sqlGet(
      "SELECT * FROM produtos WHERE codigo = ?",
      [termo.toUpperCase()]
    );
    if (row) return responderProduto(row);
    return msg.reply("❌ Produto não encontrado.");
  }

  if (/^\d{3,5}$/.test(termo)) {
    const lista = await sqlAll(
      "SELECT codigo, nome FROM produtos WHERE codigo LIKE ? LIMIT 10",
      [`${termo}%`]
    );

    if (!lista.length) return msg.reply("❌ Produto não encontrado.");

    if (lista.length === 1) {
      const row = await sqlGet(
        "SELECT * FROM produtos WHERE codigo = ?",
        [lista[0].codigo]
      );
      return responderProduto(row);
    }

    let texto = "📦 *Produtos encontrados:*\n\n";
    lista.forEach((p, i) => {
      texto += `${i + 1}. *${p.codigo}* — ${p.nome}\n`;
    });

    return msg.reply(texto);
  }

  // Nome
  const lista = await sqlAll(
    "SELECT codigo, nome FROM produtos WHERE nome LIKE ? LIMIT 10",
    [`%${termo}%`]
  );

  if (!lista.length) return msg.reply("❌ Produto não encontrado.");

  if (lista.length === 1) {
    const row = await sqlGet(
      "SELECT * FROM produtos WHERE codigo = ?",
      [lista[0].codigo]
    );
    return responderProduto(row);
  }

  let texto = "📦 *Produtos encontrados:*\n\n";
  lista.forEach((p, i) => {
    texto += `${i + 1}. *${p.codigo}* — ${p.nome}\n`;
  });

  return msg.reply(texto);
};
