"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const admin = __importStar(require("firebase-admin"));
// --- INICIALIZAÇÃO DO FIREBASE ADMIN ---
try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    }
    else {
        serviceAccount = require("../serviceAccountKey.json");
    }
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://contabilisa-4be6e-default-rtdb.firebaseio.com"
    });
    console.log(' Credenciais do Firebase carregadas com sucesso!');
}
catch (error) {
    console.error("ERRO CRÍTICO ao carregar credenciais do Firebase.", error);
    process.exit(1);
}
const db = admin.database();
console.log(' Conexão com o Firebase Realtime Database bem-sucedida!');
const app = (0, express_1.default)();
// --- CONFIGURAÇÕES GERAIS E MIDDLEWARES ---
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// --- FUNÇÃO "PORTEIRO" (MIDDLEWARE) PARA VERIFICAR O TOKEN ---
const verificarToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Acesso negado. Nenhum token fornecido.' });
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    }
    catch (error) {
        return res.status(403).send({ message: 'Token inválido.' });
    }
};
// --- FUNÇÃO AUXILIAR PARA FORMATAR RESPOSTA DO FIREBASE ---
const firebaseObjectToArray = (snapshotVal) => {
    if (!snapshotVal)
        return [];
    return Object.entries(snapshotVal).map(([id, data]) => ({ id, ...data }));
};
// ===================================================
// ROTAS DA API (TODAS PROTEGIDAS E COM LÓGICA MULTI-USUÁRIO)
// ===================================================
// --- ROTAS CONTAS ---
app.get("/api/contas", verificarToken, async (req, res) => {
    const uidDoDono = req.user.uid;
    const snapshot = await db.ref("contas").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    res.status(200).json(firebaseObjectToArray(snapshot.val()));
});
app.post("/api/contas", verificarToken, async (req, res) => {
    const uidDoDono = req.user.uid;
    const novaConta = { ...req.body, dono_uid: uidDoDono };
    const ref = db.ref("contas").push();
    await ref.set(novaConta);
    res.status(201).json({ id: ref.key, ...novaConta });
});
// --- ROTAS LANÇAMENTOS ---
app.get("/api/lancamentos", verificarToken, async (req, res) => {
    const uidDoDono = req.user.uid;
    const contasSnap = await db.ref("contas").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    const lancSnap = await db.ref("lancamentos").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    const contas = firebaseObjectToArray(contasSnap.val());
    const lancamentos = firebaseObjectToArray(lancSnap.val());
    const lancamentosComNomes = lancamentos.map((lanc) => {
        const contaDebito = contas.find((c) => c.id === lanc.contaDebitoId);
        const contaCredito = contas.find((c) => c.id === lanc.contaCreditoId);
        return { ...lanc, nomeContaDebito: contaDebito?.nome_conta, nomeContaCredito: contaCredito?.nome_conta };
    });
    res.status(200).json(lancamentosComNomes);
});
app.post("/api/lancamentos", verificarToken, async (req, res) => {
    const uidDoDono = req.user.uid;
    const { historico, valor, contaDebitoId, contaCreditoId } = req.body;
    const novoLancamento = {
        data: new Date().toLocaleDateString("pt-BR"),
        historico,
        valor: parseFloat(valor),
        contaDebitoId,
        contaCreditoId,
        dono_uid: uidDoDono
    };
    const ref = db.ref("lancamentos").push();
    await ref.set(novoLancamento);
    res.status(201).json({ id: ref.key, ...novoLancamento });
});
// --- ROTAS DE RELATÓRIOS ---
app.get("/api/balanco-patrimonial", verificarToken, async (req, res) => {
    const uidDoDono = req.user.uid;
    const contasSnap = await db.ref("contas").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    const lancSnap = await db.ref("lancamentos").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    const contas = firebaseObjectToArray(contasSnap.val());
    const lancamentos = firebaseObjectToArray(lancSnap.val());
    const saldos = contas.map((conta) => {
        const totalDebito = lancamentos.filter((l) => l.contaDebitoId === conta.id).reduce((s, l) => s + l.valor, 0);
        const totalCredito = lancamentos.filter((l) => l.contaCreditoId === conta.id).reduce((s, l) => s + l.valor, 0);
        return { ...conta, saldo: totalDebito - totalCredito };
    }).filter((c) => c.saldo !== 0);
    const relatorio = {
        ativo: { circulante: saldos.filter(c => c.subgrupo1 === "Ativo Circulante"), naoCirculante: saldos.filter(c => c.subgrupo1 === "Ativo Não Circulante") },
        passivo: { circulante: saldos.filter(c => c.subgrupo1 === "Passivo Circulante"), naoCirculante: saldos.filter(c => c.subgrupo1 === "Passivo Não Circulante") },
        patrimonioLiquido: saldos.filter(c => c.grupo_contabil === "Patrimônio Líquido"),
    };
    return res.status(200).json(relatorio);
});
app.get("/api/livro-razao/:contaId", verificarToken, async (req, res) => {
    const uidDoDono = req.user.uid;
    const contaId = req.params.contaId;
    const contasSnap = await db.ref("contas").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    const lancSnap = await db.ref("lancamentos").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    const contas = firebaseObjectToArray(contasSnap.val());
    const lancamentos = firebaseObjectToArray(lancSnap.val());
    const contaSelecionada = contas.find((c) => c.id === contaId);
    if (!contaSelecionada)
        return res.status(404).json({ message: "Conta não encontrada ou não pertence a este usuário." });
    const movimentos = lancamentos
        .filter((l) => l.contaDebitoId === contaId || l.contaCreditoId === contaId)
        .map((l) => ({ data: l.data, historico: l.historico, debito: l.contaDebitoId === contaId ? l.valor : 0, credito: l.contaCreditoId === contaId ? l.valor : 0 }));
    const totalDebito = movimentos.reduce((s, m) => s + m.debito, 0);
    const totalCredito = movimentos.reduce((s, m) => s + m.credito, 0);
    return res.status(200).json({ conta: contaSelecionada, movimentos, totalDebito, totalCredito, saldoFinal: totalDebito - totalCredito });
});
// ===================================================
// SERVIR O FRONTEND VEM POR ÚLTIMO
// ===================================================
const frontendPath = path_1.default.join(__dirname, '../../frontend');
app.use(express_1.default.static(frontendPath));
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'index.html'));
});
// ===================================================
// INICIALIZAÇÃO DO SERVIDOR
// ===================================================
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend rodando na porta ${PORT}`);
});
