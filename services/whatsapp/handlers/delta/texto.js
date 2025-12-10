// texto.js — consulta DELTA e monta mensagem de resposta formatada
const db = require('../../../../db/db');
const deltaApi = require('../../../deltaApi');
const { MessageMedia } = require('whatsapp-web.js');
const { registrarLog } = require("../../../logService");

// ============================================================
// Helpers de SQLite
// ============================================================
function sqlGet(sql, params) {
    return new Promise(resolve => {
        db.get(sql, params, (err, row) => resolve(row || null));
    });
}

function sqlAll(sql, params) {
    return new Promise(resolve => {
        db.all(sql, params, (err, rows) => resolve(rows || []));
    });
}

// ============================================================
// Formatação do estoque
// ============================================================
function formatarEstoque(valor) {
    if (valor === undefined || valor === null) return "0";

    const num = Number(valor);
    if (isNaN(num)) return valor;

    return num.toLocaleString("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

// ============================================================
// Handler principal
// ============================================================
module.exports = async function textoHandler(client, msg, body, usuario) {

    const termo = (body || "").trim().toLowerCase();

    // Lote detectado pelo imagem.js
    const loteDetectado = msg._data?.loteDetectado || null;

    // -------------------------------------------------------------------------
    // MONTAR MENSAGEM CUSTOMIZADA
    // -------------------------------------------------------------------------
    async function montarMensagem(det) {

        const estoqueFmt = formatarEstoque(det.sdo_saldo_estoque);

        let textoBase =
            `📌 *${det.dsc_item}*\n\n` +
            `*Referência:* ${det.cod_produto}\n` +
            `*Estoque disponível:* ${estoqueFmt} m²\n` +
            `*Tamanho:* ${det.dsc_tamanho_produtos}\n` +
            `*Superfície:* ${det.dsc_esp_superficie}\n` +
            `*Marca:* ${det.dsc_marca}\n` +
            `*m² por Caixa:* ${det.prd_m2_caixa}\n\n` +
            `${det.prd_link_produto}`;

        if (loteDetectado) {
            textoBase += `\n\n🔸 *Lote detectado:* ${loteDetectado}`;
        }

        if (usuario.id_mensagem) {
            const row = await sqlGet(
                "SELECT texto FROM mensagem_whatsapp WHERE id = ?",
                [usuario.id_mensagem]
            );
            if (row?.texto) return aplicarTemplate(row.texto, det, estoqueFmt, loteDetectado);
        }

        const padrao = await sqlGet(
            "SELECT texto FROM mensagem_whatsapp WHERE padrao = 1 LIMIT 1",
            []
        );
        if (padrao?.texto) {
            return aplicarTemplate(padrao.texto, det, estoqueFmt, loteDetectado);
        }

        return textoBase;
    }

    // -------------------------------------------------------------------------
    // TEMPLATE
    // -------------------------------------------------------------------------
    function aplicarTemplate(txt, d, estoqueFmt, lote) {
        let t = txt
            .replace(/{{nome}}/gi, d.dsc_item || "")
            .replace(/{{referencia}}/gi, d.cod_produto || "")
            .replace(/{{tamanho}}/gi, d.dsc_tamanho_produtos || "")
            .replace(/{{superficie}}/gi, d.dsc_esp_superficie || "")
            .replace(/{{marca}}/gi, d.dsc_marca || "")
            .replace(/{{m2_caixa}}/gi, d.prd_m2_caixa || "")
            .replace(/{{link}}/gi, d.prd_link_produto || "")
            .replace(/{{estoque}}/gi, estoqueFmt || "0");

        if (lote) {
            t += `\n\n🔸 *Lote detectado:* ${lote}`;
        }

        return t;
    }

    // -------------------------------------------------------------------------
    // RESPONDER PRODUTO
    // -------------------------------------------------------------------------
    async function responderProduto(row) {
        try {
            const tokenUsuario = usuario.token || null;
            const det = await deltaApi.detalhes(row.codigo, tokenUsuario);

            const texto = await montarMensagem(det);

            try {
                if (det.prd_link_img_produto) {
                    const media = await MessageMedia.fromUrl(det.prd_link_img_produto, { unsafeMime: true });
                    await client.sendMessage(msg.from, media, { caption: texto });
                } else {
                    await msg.reply(texto);
                }
            } catch {
                await msg.reply(texto);
            }

            registrarLog({
                telefone: msg.from.replace(/\D/g, ""),
                tipo: "consulta",
                mensagem: body,
                info: { termo: body }
            });

        } catch (e) {
            console.error("❌ Erro API Delta:", e);
            await msg.reply("❌ Erro ao consultar API.");
        }
    }

    // -------------------------------------------------------------------------
    // NOVA FUNÇÃO: BUSCAR POR URL DO PRODUTO (QR DELTA)
    // -------------------------------------------------------------------------
    async function buscarPorURL(url) {

        const idMatch = url.match(/id=(\d+)/i);
        if (!idMatch) return null;

        const id = idMatch[1]; // Ex: 782

        // Tenta achar pelo campo url_produto
        const row = await sqlGet(
            "SELECT * FROM produtos WHERE url_produto LIKE ? OR codigo = ? LIMIT 1",
            [`%${id}%`, id]
        );

        return row;
    }

    // -------------------------------------------------------------------------
    // 1) Se o termo for uma URL, tentamos buscar por ela
    // -------------------------------------------------------------------------
    if (termo.startsWith("http")) {
        const row = await buscarPorURL(termo);
        if (row) return responderProduto(row);

        return msg.reply("❌ Produto não encontrado para este QR Code.");
    }

    // -------------------------------------------------------------------------
    // 2) BUSCAS NORMAIS
    // -------------------------------------------------------------------------

    async function buscarPorReferencia(ref) {
        const row = await sqlGet(
            "SELECT * FROM produtos WHERE codigo = ?",
            [ref]
        );
        if (!row) return msg.reply("❌ Referência não encontrada.");
        return responderProduto(row);
    }

    async function buscarPorEAN(ean) {
        const row = await sqlGet(
            "SELECT * FROM produtos WHERE codigo_barra = ?",
            [ean]
        );
        if (!row) return msg.reply("❌ Nenhum produto encontrado para esse EAN.");
        return responderProduto(row);
    }

    async function buscarPorNome(nome) {
        const lista = await sqlAll(
            "SELECT codigo, nome FROM produtos WHERE nome LIKE ? LIMIT 10",
            [`%${nome}%`]
        );

        if (!lista.length) return msg.reply("❌ Nenhum produto encontrado.");

        if (lista.length === 1) return buscarPorReferencia(lista[0].codigo);

        let texto = "📦 *Produtos encontrados:*\n\n";
        lista.forEach((p, i) => texto += `${i + 1}. *${p.codigo}* — ${p.nome}\n`);

        return msg.reply(texto);
    }

    // EAN 13
    if (/^\d{13}$/.test(termo)) {
        return buscarPorEAN(termo);
    }

    // 1234-A
    if (/^\d{3,5}-[a-zA-Z]$/.test(termo)) {
        return buscarPorReferencia(termo.toUpperCase());
    }

    // Número puro
    if (/^\d{3,5}$/.test(termo)) {
        const lista = await sqlAll(
            "SELECT codigo, nome FROM produtos WHERE codigo LIKE ? LIMIT 10",
            [`${termo}%`]
        );

        if (!lista.length) return msg.reply("❌ Nenhum produto encontrado.");

        if (lista.length === 1) return buscarPorReferencia(lista[0].codigo);

        let texto = "📦 *Produtos encontrados:*\n\n";
        lista.forEach((p, i) => texto += `${i + 1}. *${p.codigo}* — ${p.nome}\n`);

        return msg.reply(texto);
    }

    // Nome
    return buscarPorNome(termo);
};
