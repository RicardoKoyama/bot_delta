const db = require('../../../../db/db');
const deltaApi = require('../../../deltaApi');
const { MessageMedia } = require('whatsapp-web.js');
const { registrarLog } = require("../../../logService");

async function responder(client, msg, texto) {
  return client.sendMessage(
    msg.from,
    texto,
    { sendSeen: false }
  );
}

async function resolverTelefone(msg) {
  const rawId = (msg.from || '').split('@')[0].trim();

  const row = await sqlGet(
    'SELECT telefone FROM whatsapp_lid_map WHERE lid = ? LIMIT 1',
    [rawId]
  );

  if (row?.telefone) return row.telefone;

  return rawId.replace(/\D/g, "");
}

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

function formatarNumero(valor) {
  if (valor === undefined || valor === null) return null;
  const n = Number(valor);
  if (isNaN(n)) return null;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function buscarPrecoProduto(telefone, codigoProduto) {
  if (!telefone) return null;

  const user = await sqlGet(
    "SELECT cliente_id FROM usuarios WHERE telefone = ? LIMIT 1",
    [telefone]
  );

  if (!user?.cliente_id) return null;

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

module.exports = async function textoHandler(client, msg, body, usuario) {

  const termo = (body || "").trim().toLowerCase();
  const telefone = await resolverTelefone(msg);

  const usuarioAtivo = await sqlGet(
    `
    SELECT id
    FROM usuarios
    WHERE telefone = ?
      AND ativo = 1
    LIMIT 1
    `,
    [telefone]
  );

  if (!usuarioAtivo) {
    return responder(client, msg,
      "⚠️ Seu acesso está inativo. Por favor, entre em contato com nosso suporte 14 99665-5659"
    );
  }

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
      `*Palete:* ${det.prd_m2_pallet} m²\n` + 
      `*Estoque:* ${det.sdo_saldo_estoque} m²\n\n`;
      
    if (precoInfo?.preco_m2) {
      texto += `*Valor Fracionado* - R$ ${formatarNumero(precoInfo.preco_m2)} / m²\n`;

      if (precoInfo.preco_m2_palete) {
        texto += `*Valor Palete Fechado* - R$ ${formatarNumero(precoInfo.preco_m2_palete)} / m²\n`;
      }
    }

    texto += `\n🔗 ${det.prd_link_produto}`;

    return texto;
  }

  async function responderProduto(row) {
    try {
      const det = await deltaApi.detalhes(row.codigo);

      const precoInfo = await buscarPrecoProduto(telefone, row.codigo);

      const texto = await montarMensagem(det, precoInfo);

      let enviouImagem = false;

      if (det.prd_link_img_produto && det.prd_link_img_produto.startsWith('http')) {
        try {
          const media = await MessageMedia.fromUrl(
            det.prd_link_img_produto,
            {
              unsafeMime: true,
              timeout: 15000
            }
          );

          await client.sendMessage(
            msg.from,
            media,
            { caption: texto, sendSeen: false }
          );

          enviouImagem = true;
        } catch (err) {
          console.warn(
            '⚠️ Falha ao enviar imagem do produto:',
            det.prd_link_img_produto,
            err.message
          );
        }
      }

      if (!enviouImagem) {
        await responder(client, msg, texto
        );
      }

      registrarLog({
        telefone,
        tipo: "consulta",
        mensagem: body,
        info: { produto: row.codigo }
      });

    } catch (e) {
      console.error("❌ Erro API Delta:", e);
      await responder(client, msg,"❌ Erro ao consultar produto.");
    }
  }

  async function buscarPorURL(url) {
    const idMatch = url.match(/id=(\d+)/i);
    if (!idMatch) return null;

    const id = idMatch[1];

    return await sqlGet(
      "SELECT * FROM produtos WHERE url_produto LIKE ? OR codigo = ? LIMIT 1",
      [`%${id}%`, id]
    );
  }

  if (termo.startsWith("http")) {
    const row = await buscarPorURL(termo);
    if (row) return responderProduto(row);
    return responder(client, msg,"❌ Produto não encontrado.");
  }

  if (/^\d{13}$/.test(termo)) {
    const row = await sqlGet(
      "SELECT * FROM produtos WHERE codigo_barra = ?",
      [termo]
    );
    if (row) return responderProduto(row);
    return responder(client, msg, "❌ Produto não encontrado.");
  }

  if (/^\d{3,5}-[a-z]$/i.test(termo)) {
    const row = await sqlGet(
      "SELECT * FROM produtos WHERE codigo = ?",
      [termo.toUpperCase()]
    );
    if (row) return responderProduto(row);
    return responder(client, msg, "❌ Produto não encontrado.");
  }

  if (/^\d{3,5}$/.test(termo)) {
    const lista = await sqlAll(
      "SELECT codigo, nome FROM produtos WHERE codigo LIKE ? LIMIT 10",
      [`${termo}%`]
    );

    if (!lista.length) return responder(client, msg, "❌ Produto não encontrado.");

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

    return responder(client, msg, texto);
  }

  const lista = await sqlAll(
    "SELECT codigo, nome FROM produtos WHERE nome LIKE ? LIMIT 10",
    [`%${termo}%`]
  );

  if (!lista.length) return responder(client, msg, "❌ Produto não encontrado.");

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

  return responder(client, msg, texto);
};
