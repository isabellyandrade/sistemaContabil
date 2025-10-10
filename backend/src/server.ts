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

// --- NOVO MIDDLEWARE PARA VERIFICAR SE O USUÁRIO É MEMBRO DA EMPRESA ---
const verificarMembro = async (req: Request, res: Response, next: NextFunction) => {
    const uidDoUsuario = (req as any).user.uid;
    // O ID da empresa será enviado pelo frontend em um cabeçalho customizado
    const empresaId = req.headers['x-empresa-id'] as string;

    if (!empresaId) {
        return res.status(400).send({ message: 'ID da empresa não fornecido no cabeçalho X-Empresa-ID.' });
    }

    // Verifica no banco se existe um registro na "gaveta" de membros
    const snapshotMembro = await db.ref(`membros/${empresaId}/${uidDoUsuario}`).once("value");
    
    if (snapshotMembro.exists()) {
        // Se existe, anexa o ID da empresa na requisição e libera a passagem
        (req as any).empresaId = empresaId;
        next();
    } else {
        // Se não existe, bloqueia o acesso
        return res.status(403).send({ message: 'Acesso negado. Você não pertence a esta empresa.' });
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
// ===================================================
// NOVAS ROTAS PARA GERENCIAR EMPRESAS
// ===================================================

// Rota para CRIAR uma nova empresa
app.post("/api/empresas", verificarToken, async (req: Request, res: Response) => {
    const uidDoUsuario = (req as any).user.uid;
    const { nomeEmpresa } = req.body;
    if (!nomeEmpresa) return res.status(400).json({ message: "O nome da empresa é obrigatório." });

    try {
        const novaEmpresa = { nome: nomeEmpresa, proprietario_uid: uidDoUsuario };
        const refEmpresa = db.ref("empresas").push();
        await refEmpresa.set(novaEmpresa);
        const idEmpresa = refEmpresa.key;

        await db.ref(`membros/${idEmpresa}/${uidDoUsuario}`).set({ email: (req as any).user.email, funcao: "proprietario" });

        res.status(201).json({ id: idEmpresa, ...novaEmpresa });
    } catch (error) { res.status(500).json({ message: "Erro ao criar empresa." }); }
});

// Rota para LISTAR as empresas que o usuário logado participa
app.get("/api/empresas", verificarToken, async (req: Request, res: Response) => {
    const uidDoUsuario = (req as any).user.uid;
    try {
        const todasAsEmpresasSnap = await db.ref("empresas").once("value");
        const todasAsEmpresas = firebaseObjectToArray(todasAsEmpresasSnap.val());
        const minhasEmpresas = [];

        for (const empresa of todasAsEmpresas) {
            const membroSnap = await db.ref(`membros/${empresa.id}/${uidDoUsuario}`).once("value");
            if (membroSnap.exists()) {
                minhasEmpresas.push(empresa);
            }
        }
        res.status(200).json(minhasEmpresas);
    } catch (error) { res.status(500).json({ message: "Erro ao listar empresas." }); }
});

// Rota para CONVIDAR um novo membro para uma empresa
app.post("/api/empresas/membros", verificarToken, verificarMembro, async (req: Request, res: Response) => {
    const uidDoProprietario = (req as any).user.uid;
    const empresaId = (req as any).empresaId;
    const { emailConvidado } = req.body;

    if (!emailConvidado) {
        return res.status(400).json({ message: "O e-mail do convidado é obrigatório." });
    }

    try {
        // Primeiro, verificamos se quem está convidando é de fato o proprietário da empresa
        const empresaSnap = await db.ref(`empresas/${empresaId}`).once('value');
        if (empresaSnap.val().proprietario_uid !== uidDoProprietario) {
            return res.status(403).json({ message: "Apenas o proprietário pode convidar novos membros." });
        }

        // Encontra o usuário a ser convidado pelo e-mail
        const usuarioConvidado = await admin.auth().getUserByEmail(emailConvidado);
        const uidDoConvidado = usuarioConvidado.uid;

        // Adiciona o novo membro à empresa
        await db.ref(`membros/${empresaId}/${uidDoConvidado}`).set({
            email: emailConvidado,
            funcao: "membro"
        });

        res.status(200).json({ message: `Usuário ${emailConvidado} convidado com sucesso!` });

    } catch (error: any) {
        console.error("Erro ao convidar membro:", error);
        // Trata erro comum de "usuário não encontrado"
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ message: `Usuário com e-mail ${emailConvidado} não encontrado.` });
        }
        res.status(500).json({ message: "Erro interno ao convidar membro." });
    }
});

// --- ROTAS CONTAS ---
app.get("/api/contas", verificarToken, verificarMembro, async (req: Request, res: Response) => {
    try {
        const empresaId = (req as any).empresaId;

        // BUSCA 1: Contas que pertencem à empresa selecionada
        const snapshotEmpresa = await db.ref("contas").orderByChild('empresa_id').equalTo(empresaId).once("value");
        const contasDaEmpresa = firebaseObjectToArray(snapshotEmpresa.val());

        // BUSCA 2: Contas globais, que todos podem ver
        // (No nosso caso, usamos a etiqueta 'GLOBAL' no campo 'dono_uid')
        const snapshotGlobal = await db.ref("contas").orderByChild('dono_uid').equalTo('GLOBAL').once("value");
        const contasGlobais = firebaseObjectToArray(snapshotGlobal.val());

        // Junta as duas listas em uma só
        const contasCombinadas = [...contasGlobais, ...contasDaEmpresa];
       
        return res.status(200).json(contasCombinadas);

    } catch (error) {
        console.error("Erro ao buscar contas:", error);
        return res.status(500).json({ message: "Erro interno no servidor ao buscar contas." });
    }
});


app.post("/api/contas", verificarToken, verificarMembro, async (req: Request, res: Response) => {
  const empresaId = (req as any).empresaId; // E esta também!
  const novaConta = { ...req.body, empresa_id: empresaId };
  const ref = db.ref("contas").push();
  await ref.set(novaConta);
  res.status(201).json({ id: ref.key, ...novaConta });
});

app.delete("/api/contas/:contaId", verificarToken, verificarMembro, async (req: Request, res: Response) => {
    const empresaId = (req as any).empresaId;
    const { contaId } = req.params;

    try {
        // Primeiro, verificamos se a conta realmente pertence a esta empresa para segurança extra.
        const snapshotConta = await db.ref(`contas/${contaId}`).once('value');
        if (!snapshotConta.exists() || snapshotConta.val().empresa_id !== empresaId) {
            return res.status(404).json({ message: "Conta não encontrada ou não pertence a esta empresa." });
        }
        
        // Impede a exclusão de contas globais
        if (snapshotConta.val().dono_uid === 'GLOBAL') {
            return res.status(403).json({ message: "Contas padrão não podem ser excluídas." });
        }

        // Exclui a conta do banco de dados
        await db.ref(`contas/${contaId}`).remove();
        
        res.status(200).json({ message: "Conta excluída com sucesso." });

    } catch (error) {
        console.error("Erro ao excluir conta:", error);
        res.status(500).json({ message: "Erro interno ao excluir a conta." });
    }
});

app.put("/api/contas/:contaId", verificarToken, verificarMembro, async (req: Request, res: Response) => {
    const empresaId = (req as any).empresaId;
    const { contaId } = req.params;
    const dadosAtualizados = req.body;

    try {
        const contaRef = db.ref(`contas/${contaId}`);
        const snapshotConta = await contaRef.once('value');
        if (!snapshotConta.exists() || snapshotConta.val().empresa_id !== empresaId) {
            return res.status(404).json({ message: "Conta não encontrada ou não pertence a esta empresa." });
        }

        if (snapshotConta.val().dono_uid === 'GLOBAL') {
            return res.status(403).json({ message: "Contas padrão não podem ser editadas." });
        }
        
        // Atualiza a conta no banco de dados com os novos dados
        await contaRef.update(dadosAtualizados);

        res.status(200).json({ id: contaId, ...dadosAtualizados });

    } catch (error) {
        console.error("Erro ao editar conta:", error);
        res.status(500).json({ message: "Erro interno ao editar a conta." });
    }
});

// --- ROTAS LANÇAMENTOS ---
// --- ROTAS LANÇAMENTOS ---
app.get("/api/lancamentos", verificarToken, verificarMembro, async (req: Request, res: Response) => {
    const empresaId = (req as any).empresaId;

    // --- INÍCIO DA CORREÇÃO ---

    // 1. Busca tanto as contas da empresa quanto as contas globais
    const snapshotEmpresa = await db.ref("contas").orderByChild('empresa_id').equalTo(empresaId).once("value");
    const snapshotGlobal = await db.ref("contas").orderByChild('dono_uid').equalTo('GLOBAL').once("value");
    const lancSnap = await db.ref("lancamentos").orderByChild('empresa_id').equalTo(empresaId).once("value");

    const contasDaEmpresa = firebaseObjectToArray(snapshotEmpresa.val());
    const contasGlobais = firebaseObjectToArray(snapshotGlobal.val());
    
    // 2. Junta as duas listas de contas em uma só, criando uma lista completa
    const todasAsContas = [...contasGlobais, ...contasDaEmpresa]; 
    const lancamentos = firebaseObjectToArray(lancSnap.val());
    
    // 3. Usa a lista completa de contas para encontrar os nomes
    const lancamentosComNomes = lancamentos.map((lanc: any) => {
        const contaDebito = todasAsContas.find((c: any) => c.id === lanc.contaDebitoId);
        const contaCredito = todasAsContas.find((c: any) => c.id === lanc.contaCreditoId);
        return { ...lanc, nomeContaDebito: contaDebito?.nome_conta, nomeContaCredito: contaCredito?.nome_conta };
    });
    
    // --- FIM DA CORREÇÃO ---

    res.status(200).json(lancamentosComNomes);
});

app.post("/api/lancamentos", verificarToken, verificarMembro, async (req: Request, res: Response) => {
    const empresaId = (req as any).empresaId;;
    const { historico, valor, contaDebitoId, contaCreditoId } = req.body;
    const novoLancamento = {
        data: new Date().toLocaleDateString("pt-BR"),
        historico,
        valor: parseFloat(valor),
        contaDebitoId,
        contaCreditoId,
        empresa_id: empresaId
    };
    const ref = db.ref("lancamentos").push();
    await ref.set(novoLancamento);
    res.status(201).json({ id: ref.key, ...novoLancamento });
});

app.delete("/api/lancamentos/:lancamentoId", verificarToken, verificarMembro, async (req: Request, res: Response) => {
    const empresaId = (req as any).empresaId;
    const { lancamentoId } = req.params;

    try {
        // Busca o lançamento pelo ID
        const snapshotLancamento = await db.ref(`lancamentos/${lancamentoId}`).once('value');
        const dadosLancamento = snapshotLancamento.val();

        // Verifica se o lançamento existe
        if (!snapshotLancamento.exists()) {
            return res.status(404).json({ message: "Lançamento não encontrado." });
        }

        // Verifica se o lançamento pertence à empresa do usuário
        if (dadosLancamento.empresa_id !== empresaId) {
            return res.status(403).json({ message: "Você não tem permissão para excluir este lançamento." });
        }

        // Remove o lançamento
        await db.ref(`lancamentos/${lancamentoId}`).remove();

        return res.status(200).json({ message: "Lançamento excluído com sucesso." });

    } catch (error) {
        console.error("Erro ao excluir lançamento:", error);
        return res.status(500).json({ message: "Erro interno ao excluir o lançamento." });
    }
});


// --- ROTAS DE RELATÓRIOS ---

// (Sua função groupBy deve estar definida antes desta rota)
const groupBy = (array: any[], key: string) => {
    return array.reduce((result, currentValue) => {
      const groupKey = currentValue[key] || 'Sem Subgrupo';
      if (!result[groupKey]) { result[groupKey] = []; }
      result[groupKey].push(currentValue);
      return result;
    }, {});
};

app.get("/api/balanco-patrimonial", verificarToken, verificarMembro, async (req: Request, res: Response) => {
    try {
        const empresaId = (req as any).empresaId;

        // --- BUSCA DE DADOS (incluindo contas globais) ---
        const snapshotEmpresa = await db.ref("contas").orderByChild('empresa_id').equalTo(empresaId).once("value");
        const snapshotGlobal = await db.ref("contas").orderByChild('dono_uid').equalTo('GLOBAL').once("value");
        const lancSnap = await db.ref("lancamentos").orderByChild('empresa_id').equalTo(empresaId).once("value");

        const contasDaEmpresa = firebaseObjectToArray(snapshotEmpresa.val());
        const contasGlobais = firebaseObjectToArray(snapshotGlobal.val());
        const contas = [...contasGlobais, ...contasDaEmpresa]; // Junta as contas
        const lancamentos = firebaseObjectToArray(lancSnap.val());

        // --- CÁLCULO DE SALDOS (sem alteração) ---
        const saldos = contas.map((conta: any) => {
            const totalDebito = lancamentos.filter((l: any) => l.contaDebitoId === conta.id).reduce((s, l: any) => s + l.valor, 0);
            const totalCredito = lancamentos.filter((l: any) => l.contaCreditoId === conta.id).reduce((s, l: any) => s + l.valor, 0);
            return { ...conta, saldo: totalDebito - totalCredito };
        }).filter((c: any) => c.saldo !== 0);

        // --- AGRUPAMENTO HIERÁRQUICO (COMPLETO) ---
        const relatorioFinal = {
            ativo: {},
            passivo: {},
            patrimonioLiquido: {},
            receitas: {},
            despesas: {}
        };

        // Agrupa Ativo
        const ativoPorSubgrupo1 = groupBy(saldos.filter((c: any) => c.grupo_contabil === 'Ativo'), 'subgrupo1');
        for (const subgrupo1 in ativoPorSubgrupo1) { (relatorioFinal.ativo as any)[subgrupo1] = groupBy(ativoPorSubgrupo1[subgrupo1], 'subgrupo2'); }

        // Agrupa Passivo (LINHA QUE FALTAVA)
        const passivoPorSubgrupo1 = groupBy(saldos.filter((c: any) => c.grupo_contabil === 'Passivo'), 'subgrupo1');
        for (const subgrupo1 in passivoPorSubgrupo1) { (relatorioFinal.passivo as any)[subgrupo1] = groupBy(passivoPorSubgrupo1[subgrupo1], 'subgrupo2'); }

        // Agrupa Patrimônio Líquido (LINHA QUE FALTAVA)
        const plPorSubgrupo1 = groupBy(saldos.filter((c: any) => c.grupo_contabil === 'Patrimônio Líquido'), 'subgrupo1');
        for (const subgrupo1 in plPorSubgrupo1) { (relatorioFinal.patrimonioLiquido as any)[subgrupo1] = groupBy(plPorSubgrupo1[subgrupo1], 'subgrupo2'); }

        // Agrupa Receitas (como você já fez)
        const receitasPorSubgrupo1 = groupBy(saldos.filter((c: any) => c.grupo_contabil === 'Receitas'), 'subgrupo1');
        for (const subgrupo1 in receitasPorSubgrupo1) { (relatorioFinal.receitas as any)[subgrupo1] = groupBy(receitasPorSubgrupo1[subgrupo1], 'subgrupo2'); }

        // Agrupa Despesas (como você já fez)
        const despesasPorSubgrupo1 = groupBy(saldos.filter((c: any) => c.grupo_contabil === 'Despesas'), 'subgrupo1');
        for (const subgrupo1 in despesasPorSubgrupo1) { (relatorioFinal.despesas as any)[subgrupo1] = groupBy(despesasPorSubgrupo1[subgrupo1], 'subgrupo2'); }
        
        return res.status(200).json(relatorioFinal);

    } catch (error) {
        console.error("Erro ao gerar balanço:", error);
        return res.status(500).json({ message: "Erro interno no servidor ao gerar balanço." });
    }
});

app.get("/api/livro-razao/:contaId", verificarToken, verificarMembro, async (req: Request, res: Response) => {
    try {
        const empresaId = (req as any).empresaId;
        const contaId = req.params.contaId;

        const contasSnap = await db.ref("contas").orderByChild('empresa_id').equalTo(empresaId).once("value");
        const lancSnap = await db.ref("lancamentos").orderByChild('empresa_id').equalTo(empresaId).once("value");

        if (!contasSnap.exists()) {
            return res.status(404).json({ message: "Nenhuma conta encontrada para esta empresa." });
        }

        const contas = firebaseObjectToArray(contasSnap.val());
        const lancamentos = lancSnap.exists() ? firebaseObjectToArray(lancSnap.val()) : [];

        const contaSelecionada = contas.find((c: any) => c.id === contaId);
        if (!contaSelecionada) {
            return res.status(404).json({ message: "Conta não encontrada ou não pertence a esta empresa." });
        }

        const movimentos = lancamentos
            .filter((l: any) => l.contaDebitoId === contaId || l.contaCreditoId === contaId)
            .map((l: any) => {
                // Garante que o valor seja sempre positivo para o cálculo.
                const valorAbsoluto = Math.abs(l.valor || 0);

                return {
                    data: l.data,
                    historico: l.historico,
                    debito: l.contaDebitoId === contaId ? valorAbsoluto : 0,
                    credito: l.contaCreditoId === contaId ? valorAbsoluto : 0
                };
            });
        
        // Opcional: Ordenar os movimentos por data
        movimentos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

        const totalDebito = movimentos.reduce((s, m) => s + m.debito, 0);
        const totalCredito = movimentos.reduce((s, m) => s + m.credito, 0);

        // O cálculo do saldo final depende da natureza da conta (se é devedora ou credora)
        // Ex: Contas de Ativo/Despesa: Saldo = Débito - Crédito
        // Ex: Contas de Passivo/Receita: Saldo = Crédito - Débito
        // Para um razão geral, Débito - Crédito é o padrão.
        const saldoFinal = totalDebito - totalCredito;

        return res.status(200).json({ conta: contaSelecionada, movimentos, totalDebito, totalCredito, saldoFinal });

    } catch (error) {
        console.error("Erro ao gerar livro razão:", error);
        return res.status(500).json({ message: "Ocorreu um erro interno no servidor." });
    }
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