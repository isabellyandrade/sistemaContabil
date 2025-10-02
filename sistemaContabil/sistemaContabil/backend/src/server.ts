import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import * as admin from 'firebase-admin';

// --- INICIALIZAÇÃO DO FIREBASE ADMIN ---
try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else {
        serviceAccount = require("../serviceAccountKey.json");
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://contabilisa-4be6e-default-rtdb.firebaseio.com"
    });
    console.log(' Credenciais do Firebase carregadas com sucesso!');
} catch (error) {
    console.error("ERRO CRÍTICO ao carregar credenciais do Firebase.", error);
    process.exit(1);
}

const db = admin.database();
console.log(' Conexão com o Firebase Realtime Database bem-sucedida!');

const app = express();

// --- CONFIGURAÇÕES GERAIS E MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- FUNÇÃO "PORTEIRO" (MIDDLEWARE) PARA VERIFICAR O TOKEN ---
const verificarToken = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Acesso negado. Nenhum token fornecido.' });
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        (req as any).user = decodedToken;
        next();
    } catch (error) {
        return res.status(403).send({ message: 'Token inválido.' });
    }
};

// --- FUNÇÃO AUXILIAR PARA FORMATAR RESPOSTA DO FIREBASE ---
const firebaseObjectToArray = (snapshotVal: object | null): any[] => {
    if (!snapshotVal) return [];
    return Object.entries(snapshotVal).map(([id, data]) => ({ id, ...data }));
};


// ===================================================
// ROTAS DA API (TODAS PROTEGIDAS E COM LÓGICA MULTI-USUÁRIO)
// ===================================================

// --- ROTAS CONTAS ---
app.get("/api/contas", verificarToken, async (req: Request, res: Response) => {
    const uidDoDono = (req as any).user.uid;
    const snapshot = await db.ref("contas").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    res.status(200).json(firebaseObjectToArray(snapshot.val()));
});

app.post("/api/contas", verificarToken, async (req: Request, res: Response) => {
    const uidDoDono = (req as any).user.uid;
    const novaConta = { ...req.body, dono_uid: uidDoDono };
    const ref = db.ref("contas").push();
    await ref.set(novaConta);
    res.status(201).json({ id: ref.key, ...novaConta });
});

// --- ROTAS LANÇAMENTOS ---
app.get("/api/lancamentos", verificarToken, async (req: Request, res: Response) => {
    const uidDoDono = (req as any).user.uid;
    const contasSnap = await db.ref("contas").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    const lancSnap = await db.ref("lancamentos").orderByChild('dono_uid').equalTo(uidDoDono).once("value");

    const contas = firebaseObjectToArray(contasSnap.val());
    const lancamentos = firebaseObjectToArray(lancSnap.val());
    
    const lancamentosComNomes = lancamentos.map((lanc: any) => {
        const contaDebito = contas.find((c: any) => c.id === lanc.contaDebitoId);
        const contaCredito = contas.find((c: any) => c.id === lanc.contaCreditoId);
        return { ...lanc, nomeContaDebito: contaDebito?.nome_conta, nomeContaCredito: contaCredito?.nome_conta };
    });
    res.status(200).json(lancamentosComNomes);
});

app.post("/api/lancamentos", verificarToken, async (req: Request, res: Response) => {
    const uidDoDono = (req as any).user.uid;
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

app.get("/api/balanco-patrimonial", verificarToken, async (req: Request, res: Response) => {
    const uidDoDono = (req as any).user.uid;
    const contasSnap = await db.ref("contas").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    const lancSnap = await db.ref("lancamentos").orderByChild('dono_uid').equalTo(uidDoDono).once("value");

    const contas = firebaseObjectToArray(contasSnap.val());
    const lancamentos = firebaseObjectToArray(lancSnap.val());

    const saldos = contas.map((conta: any) => {
        const totalDebito = lancamentos.filter((l: any) => l.contaDebitoId === conta.id).reduce((s, l: any) => s + l.valor, 0);
        const totalCredito = lancamentos.filter((l: any) => l.contaCreditoId === conta.id).reduce((s, l: any) => s + l.valor, 0);
        return { ...conta, saldo: totalDebito - totalCredito };
    }).filter((c: any) => c.saldo !== 0);

    const relatorio = {
        ativo: { circulante: saldos.filter(c => c.subgrupo1 === "Ativo Circulante"), naoCirculante: saldos.filter(c => c.subgrupo1 === "Ativo Não Circulante") },
        passivo: { circulante: saldos.filter(c => c.subgrupo1 === "Passivo Circulante"), naoCirculante: saldos.filter(c => c.subgrupo1 === "Passivo Não Circulante") },
        patrimonioLiquido: saldos.filter(c => c.grupo_contabil === "Patrimônio Líquido"),
    };
    return res.status(200).json(relatorio);
});

app.get("/api/livro-razao/:contaId", verificarToken, async (req: Request, res: Response) => {
    const uidDoDono = (req as any).user.uid;
    const contaId = req.params.contaId;

    const contasSnap = await db.ref("contas").orderByChild('dono_uid').equalTo(uidDoDono).once("value");
    const lancSnap = await db.ref("lancamentos").orderByChild('dono_uid').equalTo(uidDoDono).once("value");

    const contas = firebaseObjectToArray(contasSnap.val());
    const lancamentos = firebaseObjectToArray(lancSnap.val());

    const contaSelecionada = contas.find((c: any) => c.id === contaId);
    if (!contaSelecionada) return res.status(404).json({ message: "Conta não encontrada ou não pertence a este usuário." });

    const movimentos = lancamentos
        .filter((l: any) => l.contaDebitoId === contaId || l.contaCreditoId === contaId)
        .map((l: any) => ({ data: l.data, historico: l.historico, debito: l.contaDebitoId === contaId ? l.valor : 0, credito: l.contaCreditoId === contaId ? l.valor : 0 }));
    
    const totalDebito = movimentos.reduce((s, m) => s + m.debito, 0);
    const totalCredito = movimentos.reduce((s, m) => s + m.credito, 0);

    return res.status(200).json({ conta: contaSelecionada, movimentos, totalDebito, totalCredito, saldoFinal: totalDebito - totalCredito });
});

// ===================================================
// SERVIR O FRONTEND VEM POR ÚLTIMO
// ===================================================
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ===================================================
// INICIALIZAÇÃO DO SERVIDOR
// ===================================================
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend rodando na porta ${PORT}`);
});