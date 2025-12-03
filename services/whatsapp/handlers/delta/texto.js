const db = require('../../../db/db');
const deltaApi = require('../../deltaApi');
const { MessageMedia } = require('whatsapp-web.js');
const { registrarLog } = require("../../logService");

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

module.exports = async function textoHandler(client, msg, body, usuario) {

    const termo = (body || "").trim().toLowerCase();

    // -------------------------------------------------------------------------
    // GERA MENSAGEM CUSTOMIZADA
    // -------------------------------------------------------------------------
    async function montarMensagem(det) {

        // Template customizado do usuário
        if (usuario.id_mensagem) {
            const row = await sqlGet(
                "SELECT texto FROM mensagem_whatsapp WHERE id = ?",
                [usuario.id_mensagem]
            );
            if (row?.texto) return aplicarTemplate(row.texto, det);
        }

        // Template padrão
        const padrao = await sqlGet(
            "SELECT texto FROM mensagem_whatsapp WHERE padrao = 1 LIMIT 1",
            []
        );
        if (padrao?.texto) return aplicarTemplate(padrao.texto, det);

        // Sem template → monta texto simples
        return (
            `📌 *${det.dsc_item}*\n\n` +
            `*Referência:* ${det.cod_produto}\n` +
            `*Tamanho:* ${det.dsc_tamanho_produtos}\n` +
            `*Superfície:* ${det.dsc_esp_superficie}\n` +
            `*Marca:* ${det.dsc_marca}\n` +
            `*m² por Caixa:* ${det.prd_m2_caixa}\n\n` +
            `${det.prd_link_produto}`
        );
    }

    // -------------------------------------------------------------------------
    // APLICA PLACEHOLDERS DO TEMPLATE
    // -------------------------------------------------------------------------
    function aplicarTemplate(txt, d) {
        return txt
            .replace(/{{nome}}/gi, d.dsc_item || "")
            .replace(/{{referencia}}/gi, d.cod_produto || "")
            .replace(/{{tamanho}}/gi, d.dsc_tamanho_produtos || "")
            .replace(/{{superficie}}/gi, d.dsc_esp_superficie || "")
            .replace(/{{marca}}/gi, d.dsc_marca || "")
            .replace(/{{m2_caixa}}/gi, d.prd_m2_caixa || "")
            .replace(/{{link}}/gi, d.prd_link_produto || "");
    }

    // -------------------------------------------------------------------------
    // ENVIA PRODUTO
    // -------------------------------------------------------------------------
    async function responderProduto(row) {
        try {
            const tokenUsuario = usuario.token || null;

            // Detalhes via API Delta (sempre puxa atual)
            const det = await deltaApi.detalhes(row.codigo, tokenUsuario);

            console.log(det);

            const texto = await montarMensagem(det);

            // Tenta enviar com imagem
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
    // BUSCAS
    // -------------------------------------------------------------------------

    async function buscarPorReferencia(ref) {
        console.log('Referencia buscada ', ref);
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

    // Referência só número (ex: 2225)
    if (/^\d{3,5}$/.test(termo)) {
        const lista = await sqlAll(
            "SELECT codigo, nome FROM produtos WHERE codigo LIKE ? LIMIT 10",
            [`${termo}%`]
        );

        if (!lista.length)
            return msg.reply("❌ Nenhum produto encontrado.");

        if (lista.length === 1)
            return buscarPorReferencia(lista[0].codigo);

        let texto = "📦 *Produtos encontrados:*\n\n";
        lista.forEach((p, i) => {
            texto += `${i + 1}. *${p.codigo}* — ${p.nome}\n`;
        });

        return msg.reply(texto);
    }

    // Nome
    return buscarPorNome(termo);
};
