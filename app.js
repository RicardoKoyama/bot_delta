require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const whatsappManager = require('./services/whatsapp/WhatsAppManager');
const cron = require("node-cron");
const { sincronizarLista, sincronizarDetalhes } = require("./services/deltaSync");

const app = express();

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

app.use('/', painelRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/contas', contasRoutes);
app.use('/produtos', produtosRoutes);
app.use('/logs', logsRoutes);

whatsappManager.iniciarTodas();

cron.schedule("0 3 * * *", async () => {
  try {
    console.log("⏰ Executando sincronização da Delta...");
    await sincronizarLista();
    await sincronizarDetalhes();
    console.log("✔ Sincronização concluída.");
  } catch (e) {
    console.error("❌ Erro na sincronização diária:", e);
  }
});


// Porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado em http://localhost:${PORT}`);
});
