require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const whatsappManager = require('./services/whatsapp/WhatsAppManager');

const app = express();

// Configurações padrão
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Sessão simples para login
app.use(session({
  secret: process.env.SESSION_SECRET || 'delta123',
  resave: false,
  saveUninitialized: true
}));

// Rotas principais (vamos criar já já)
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

// Iniciar clientes
whatsappManager.iniciarTodas();

// Porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado em http://localhost:${PORT}`);
});
