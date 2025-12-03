const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
    decodeImage: async (base64) => {
        const tmpPath = `/tmp/msi_decode_${Date.now()}.jpg`;

        try {
            // Salva imagem temporária
            fs.writeFileSync(tmpPath, Buffer.from(base64, 'base64'));

            const cliPath = path.resolve(__dirname, '../../../../inlite/bin/BarcodeReaderCLI');

            const cmd = `${cliPath} -type=qr,ean13,ean8,upca,upce,code128,code39 ${tmpPath}`;

            return await new Promise((resolve) => {
                exec(cmd, (err, stdout) => {
                    fs.unlinkSync(tmpPath);

                    if (err) {
                        console.error("Erro BarcodeReaderCLI:", err);
                        return resolve(null);
                    }

                    const match = stdout.match(/(?<=Value: )(\d{8,14})/);
                    resolve(match ? match[0] : null);
                });
            });

        } catch (e) {
            return null;
        }
    }
};
