require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const whatsappManager = require('./services/whatsapp/WhatsAppManager');
const cron = require("node-cron");
const { sincronizarLista, sincronizarDetalhes } = require("./services/deltaSync");
const { registrarLog } = require("./services/logService");

const app = express();

const cors = require("cors");

app.use(cors({
  origin: [
    "https://www.koyamatecnologia.com.br",
    "https://koyamatecnologia.com.br",
    "https://koyamatecnologia.pages.dev"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'delta123',
  resave: false,
  saveUninitialized: true
}));

const painelRoutes = require('./routes/painel');
const usuariosRoutes = require('./routes/usuarios');
const contasRoutes = require('./routes/contas');
const produtosRoutes = require('./routes/produtos');
const logsRoutes = require('./routes/logs');
const cadastroSiteRoutes = require("./routes/cadastroSite");

app.use("/", cadastroSiteRoutes);

app.use('/', painelRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/contas', contasRoutes);
app.use('/produtos', produtosRoutes);
app.use('/logs', logsRoutes);

whatsappManager.iniciarTodas();


// =====================================================================
// 🕒 CRON: Sincronização diária da Delta (03:00)
// =====================================================================
cron.schedule("0 3 * * *", async () => {
  try {
    console.log("⏰ Executando sincronização da Delta...");

    await registrarLog({
      phone: null,
      tipo: "SYNC_DELTA",
      mensagem: "Iniciando sincronização diária da Delta",
      info: {}
    });

    const lista = await sincronizarLista();
    const detalhes = await sincronizarDetalhes();

    await registrarLog({
      phone: null,
      tipo: "SYNC_DELTA",
      mensagem: "Sincronização finalizada com sucesso",
      info: { lista: lista.length || 0 }
    });

    console.log("✔ Sincronização concluída.");
  } catch (e) {
    console.error("❌ Erro na sincronização diária:", e);

    await registrarLog({
      phone: null,
      tipo: "SYNC_DELTA_ERRO",
      mensagem: "Erro durante a sincronização da Delta",
      info: { erro: e.message }
    });
  }
});


// Porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado em http://localhost:${PORT}`);
});
