const fs = require("fs");
const child_process = require("child_process");
const db = require("../../../../db/db");

module.exports = async function imagemHandler(client, msg, usuario) {
    console.log("🖼️ Recebida imagem. Baixando arquivo...");

    try {
        const media = await msg.downloadMedia();
        if (!media) {
            console.log("❌ Falha ao baixar imagem.");
            return msg.reply("❌ Não consegui baixar a imagem.");
        }

        const filename = `temp_${Date.now()}.jpg`;
        const filepath = `./temp/${filename}`;

        fs.mkdirSync("./temp", { recursive: true });
        fs.writeFileSync(filepath, media.data, { encoding: "base64" });

        console.log("📸 Imagem salva em:", filepath);

        // Decodifica EAN ou QR Delta
        const qr = await decodeCodigo(filepath);
        if (!qr) {
            return msg.reply("❌ Não consegui ler nenhum código dessa imagem.");
        }

        console.log("🔍 Código lido:", qr);

        const textoHandler = require("./texto");

        // ============================================================
        // 🔥 1 — EAN (12 ou 13 dígitos)
        // ============================================================
        if (/^\d{12,13}$/.test(qr.trim())) {
            const ean = qr.trim();

            const row = await sqlGet(
                `SELECT * FROM produtos WHERE codigo_barra = ?`,
                [ean]
            );

            if (!row) {
                return msg.reply("❌ Nenhum produto encontrado para esse código de barras.");
            }

            return textoHandler(client, msg, row.codigo, usuario);
        }

        // ============================================================
        // 🔥 2 — QR Delta contendo id=XXXX
        // ============================================================
        const id = extrairIdDoQR(qr);
        if (id) {
            const row = await sqlGet(
                `SELECT * FROM produtos WHERE id_site like ?`,
                [id]
            );

            if (!row) {
                return msg.reply("❌ Nenhum produto encontrado para esse QR Code.");
            }

            return textoHandler(client, msg, row.codigo, usuario);
        }

        // ============================================================
        // 🔥 3 — Código inválido
        // ============================================================
        return msg.reply("❌ Código não reconhecido como EAN ou QR válido.");

    } catch (err) {
        console.error("❌ Erro no handler de imagem:", err);
        return msg.reply("❌ Erro ao processar a imagem.");
    }
};


// ============================================================
// Decodificação via Inlite CLI
// ============================================================
function decodeCodigo(filepath) {
    return new Promise((resolve) => {
        try {
            const path = require("path");
            const INLITE = path.join(__dirname, "../../../../inlite/bin/BarcodeReaderCLI");

            const cmd = `${INLITE} -type=qr,ean13,ean8,upca,upce,code128,code39 "${filepath}"`;
            console.log("Executando CLI:", cmd);

            const result = child_process.execSync(cmd).toString();
            console.log("🔎 Saída do BarcodeReaderCLI:\n", result);

            try {
                const json = JSON.parse(result);
                const bc = json?.sessions?.[0]?.barcodes?.[0];
                if (bc?.text) return resolve(bc.text.trim());
            } catch (_) {}

            const linhas = result.split("\n").map(l => l.trim()).filter(Boolean);
            if (linhas.length) return resolve(linhas[linhas.length - 1]);

            resolve(null);

        } catch (err) {
            console.error("❌ Erro ao decodificar:", err);
            resolve(null);
        }
    });
}

function extrairIdDoQR(texto) {
    const m = String(texto).match(/id=(\d+)/i);
    return m ? m[1] : null;
}

function sqlGet(sql, params) {
    return new Promise(resolve => {
        db.get(sql, params, (err, row) => resolve(row || null));
    });
}
