const db = require('../../../db/db');
const deltaApi = require('../../deltaApi');
const { MessageMedia } = require('whatsapp-web.js');
const { registrarLog } = require("../../logService");

module.exports = async function textoHandler(client, msg, body, usuario) {

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

    // --------------------------------------------------
    // MENSAGEM CUSTOMIZADA
    // --------------------------------------------------
    async function obterMensagemCustomizada(usuario, det) {

        let mensagem = null;

        if (usuario.id_mensagem) {
            const row = await sqlGet(
                "SELECT mensagem FROM mensagem_whatsapp WHERE id = ?",
                [usuario.id_mensagem]
            );
            if (row?.mensagem) mensagem = row.mensagem;
        }

        if (!mensagem) {
            const row = await sqlGet(
                "SELECT mensagem FROM mensagem_whatsapp WHERE padrao = 1 LIMIT 1",
                []
            );
            if (row?.mensagem) mensagem = row.mensagem;
        }

        if (!mensagem) {
            mensagem =
                `📌 *${det.nome}*\n\n` +
                `*Referência:* ${det.codigo}\n` +
                `*Tamanho:* ${det.tamanho}\n` +
                `*Superfície:* ${det.superficie}\n` +
                `*Marca:* ${det.marca}\n` +
                `*m² por Caixa:* ${det.m2_caixa}\n\n` +
                `${det.url_produto}`;
        }

        return mensagem
          .replace(/{{nome}}/gi, det.nome || "")
          .replace(/{{referencia}}/gi, det.codigo || "")
          .replace(/{{tamanho}}/gi, det.tamanho || "")
          .replace(/{{superficie}}/gi, det.superficie || "")
          .replace(/{{marca}}/gi, det.marca || "")
          .replace(/{{m2_caixa}}/gi, det.m2_caixa || "")
          .replace(/{{link}}/gi, det.url_produto || "");
    }


    // --------------------------------------------------
    // ENVIA PRODUTO
    // --------------------------------------------------
    async function responderProduto(client, msg, row) {
        try {
            const tokenUsuario = usuario.token || null;

            const det = await deltaApi.detalhes(row.codigo, tokenUsuario);

            const texto = await obterMensagemCustomizada(usuario, det);

            try {
                const media = await MessageMedia.fromUrl(det.imagem_url, { unsafeMime: true });

                await client.sendMessage(msg.from, media, { caption: texto });

                registrarLog({
                    telefone: msg.from.replace(/\D/g, ""),
                    tipo: "consulta",
                    mensagem: body,
                    info: { termo: body }
                });

            } catch {
                return msg.reply(texto);
            }

        } catch (e) {
            console.error("Erro API Delta:", e);
            return msg.reply("❌ Erro ao consultar a API.");
        }
    }



    // --------------------------------------------------
    // BUSCAS ATUAIS
    // --------------------------------------------------
    async function buscarPorCodigo(cod) {
        const row = await sqlGet(
            "SELECT * FROM produtos WHERE codigo = ?",
            [cod]
        );
        if (!row) return msg.reply("❌ Produto não encontrado.");
        return responderProduto(client, msg, row);
    }

    async function buscarPorReferencia(ref) {
        const row = await sqlGet(
            "SELECT * FROM produtos WHERE codigo = ?",
            [ref]
        );
        if (!row) return msg.reply("❌ Referência não encontrada.");
        return responderProduto(client, msg, row);
    }

    async function buscarPorEAN(ean) {
        const row = await sqlGet(
            "SELECT * FROM produtos WHERE codigo_barra = ?",
            [ean]
        );
        if (!row) return msg.reply("❌ Nenhum produto encontrado para esse EAN.");
        return responderProduto(client, msg, row);
    }

    async function buscarPorNome(nome) {
        const lista = await sqlAll(
            "SELECT codigo, nome_abreviado FROM produtos WHERE nome_abreviado LIKE ? LIMIT 10",
            [`%${nome}%`]
        );

        if (!lista.length) return msg.reply("❌ Nenhum produto encontrado.");

        if (lista.length === 1) return buscarPorReferencia(lista[0].codigo);

        let texto = "📦 Produtos encontrados:\n\n";
        lista.forEach((p, i) => texto += `${i + 1}. *${p.codigo}* — ${p.nome_abreviado}\n`);

        return msg.reply(texto);
    }

    // --------------------------------------------------
    // DECISOR
    // --------------------------------------------------
    const termo = body.toLowerCase();

    if (termo.startsWith("cd ")) {
        return buscarPorCodigo(termo.replace("cd ", "").trim());
    }

    if (/^\d{13}$/.test(termo)) {
        return buscarPorEAN(termo);
    }

    if (/^\d{3,5}-[a-zA-Z]$/.test(termo)) {
        return buscarPorReferencia(termo.toUpperCase());
    }

    if (/^\d{3,5}$/.test(termo)) {
        return buscarPorReferencia(termo);
    }

    return buscarPorNome(termo);
};
