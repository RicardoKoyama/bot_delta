const { createCanvas } = require('canvas');
const fs = require('fs');

async function gerarFaturamento(periodo) {
    const file = `/tmp/fat_${Date.now()}.png`;

    const canvas = createCanvas(900, 600);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = "#FFF";
    ctx.fillRect(0, 0, 900, 600);

    ctx.fillStyle = "#000";
    ctx.font = "40px Arial";
    ctx.fillText("FATURAMENTO", 30, 70);

    ctx.font = "25px Arial";
    ctx.fillText(`Período: ${periodo}`, 30, 120);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(file, buffer);

    return file;
}

module.exports = { gerarFaturamento };
