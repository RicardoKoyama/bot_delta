const db = require('../../../db/db');
const axios = require('axios');
const deltaApi = require('../../deltaApi');
const { MessageMedia } = require('whatsapp-web.js');
const { registrarLog } = require("../../logService");

module.exports = async function textoHandler(client, msg, body, usuario) {

    // ================================
    // FUNÇÕES DE BANCO
    // ================================
    function sqlGet(sql, params) {
        return new Promise(resolve => {
            db.get(sql, params, (err, row) => {
                resolve(row || null);
            });
        });
    }

    function sqlAll(sql, params) {
        return new Promise(resolve => {
            db.all(sql, params, (err, rows) => {
                resolve(rows || []);
            });
        });
    }

    // ================================
    // BUSCAR MENSAGEM PERSONALIZADA
    // ================================
    async function obterMensagemCustomizada(usuario, det) {

        let mensagem = null;

        // 1 – se o usuário tem id_mensagem, tenta buscar
        if (usuario.id_mensagem) {
            const row = await sqlGet(
                "SELECT mensagem FROM mensagem_whatsapp WHERE id = ?",
                [usuario.id_mensagem]
            );

            if (row && row.mensagem) {
                mensagem = row.mensagem;
            }
        }

        // 2 – se não tiver, busca padrão
        if (!mensagem) {
            const rowPadrao = await sqlGet(
                "SELECT mensagem FROM mensagem_whatsapp WHERE padrao = 1 LIMIT 1",
                []
            );

            if (rowPadrao && rowPadrao.mensagem) {
                mensagem = rowPadrao.mensagem;
            }
        }

        // 3 – se não tiver nada nem padrão, usa texto fixo atual
        if (!mensagem) {
            mensagem =
                `📌 *${det.dsc_item}*\n\n` +
                `*Referência:* ${det.cod_produto}\n` +
                `*Tamanho:* ${det.dsc_tamanho_produtos}\n` +
                `*Superfície:* ${det.dsc_esp_superficie}\n` +
                `*Marca:* ${det.dsc_marca}\n` +
                `*Estoque:* ${det.sdo_saldo_estoque}\n` +
                `*m² por Caixa:* ${det.prd_m2_caixa}\n\n` +
                `${det.prd_link_produto}`;
        }

        // 4 – substituição de variáveis dentro da mensagem
        mensagem = mensagem
            .replace(/{{nome}}/gi, det.dsc_item || "")
            .replace(/{{referencia}}/gi, det.cod_produto || "")
            .replace(/{{tamanho}}/gi, det.dsc_tamanho_produtos || "")
            .replace(/{{superficie}}/gi, det.dsc_esp_superficie || "")
            .replace(/{{marca}}/gi, det.dsc_marca || "")
            .replace(/{{estoque}}/gi, det.sdo_saldo_estoque || "")
            .replace(/{{m2_caixa}}/gi, det.prd_m2_caixa || "")
            .replace(/{{link}}/gi, det.prd_link_produto || "");

        return mensagem;
    }


    // ================================
    // RESPOSTA DO PRODUTO
    // ================================
    async function responderProduto(client, msg, row) {
        try {

            // 👇 pega o token do usuário (ou null)
            const tokenUsuario = usuario.token || null;

            // 👇 consulta API Delta com o token dele
            const det = await deltaApi.detalhes(row.cod_produto, tokenUsuario);

            // 👇 gera texto da mensagem (personalizada ou padrão)
            const texto = await obterMensagemCustomizada(usuario, det);

            try {
                const media = await MessageMedia.fromUrl(det.prd_link_img_produto, { unsafeMime: true });

                registrarLog({
                    phone: msg.from.replace(/\D/g, ""),
                    tipo: "consulta_texto",
                    mensagem: body,
                    info: { termo: body }
                });

                await client.sendMessage(msg.from, media, {
                    caption: texto
                });

            } catch (imgErr) {
                console.log("Erro ao carregar imagem:", imgErr.message);
                return msg.reply(texto); // fallback sem imagem
            }

        } catch (e) {
            console.error("Erro na API Delta:", e.message);
            return msg.reply("❌ Erro ao consultar produto na API.");
        }
    }


    // ================================
    // BUSCAS (CD, REF, EAN, NOME)
    // ================================
    async function buscarPorCodigo(client, msg, cod) {
        const row = await sqlGet(`
            SELECT * FROM produtos_delta 
            WHERE cod_base = ? OR cod_produto = ?`,
            [cod, cod]
        );

        if (!row) return msg.reply("❌ Nenhum produto encontrado.");
        return responderProduto(client, msg, row);
    }

    async function buscarPorReferencia(client, msg, ref) {
        ref = ref.trim().toUpperCase();
        if (!ref.includes('-')) ref += "-A";

        let row = await sqlGet(`
            SELECT * FROM produtos_delta 
            WHERE cod_produto = ?`, [ref]);

        if (!row) {
            const base = ref.split('-')[0];
            row = await sqlGet(
                "SELECT * FROM produtos_delta WHERE cod_produto LIKE ? LIMIT 1",
                [`${base}-%`]
            );
        }

        if (!row) return msg.reply("❌ Referência não encontrada.");
        return responderProduto(client, msg, row);
    }

    async function buscarPorEAN(client, msg, ean) {
        const row = await sqlGet(
            "SELECT * FROM produtos_delta WHERE it_cbarra = ?",
            [ean]
        );

        if (!row) return msg.reply("❌ Nenhum produto encontrado.");
        return responderProduto(client, msg, row);
    }

    async function buscarPorNome(client, msg, nome) {
        const lista = await sqlAll(`
            SELECT cod_produto, nome_abreviado 
            FROM produtos_delta
            WHERE nome_abreviado LIKE ?
            LIMIT 10
        `, [`%${nome}%`]);

        if (!lista.length) return msg.reply("❌ Nenhum produto encontrado.");
        if (lista.length === 1) return buscarPorReferencia(client, msg, lista[0].cod_produto);

        let texto = "📦 Produtos encontrados:\n\n";
        lista.forEach((p, i) => texto += `${i + 1}. *${p.cod_produto}* — ${p.nome_abreviado}\n`);

        return msg.reply(texto);
    }


    // ================================
    // DECISÃO DA BUSCA
    // ================================
    const termo = body.toLowerCase();

    if (termo.startsWith("cd ")) {
        return buscarPorCodigo(client, msg, termo.replace("cd ", "").trim());
    }

    if (/^\d{3,5}-[a-zA-Z]$/.test(termo)) {
        return buscarPorReferencia(client, msg, termo.toUpperCase());
    }

    if (/^\d{13}$/.test(termo)) {
        return buscarPorEAN(client, msg, termo);
    }

    if (/^\d{3,5}$/.test(termo)) {
        return buscarPorReferencia(client, msg, termo);
    }

    return buscarPorNome(client, msg, termo);
};
