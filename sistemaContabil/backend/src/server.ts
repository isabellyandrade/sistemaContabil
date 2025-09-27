import express, { Request, Response } from 'express';
import cors from 'cors';
//import { VercelRequest, VercelResponse } from '@vercel/node';

const app = express();

app.use(cors());
app.use(express.json());

// --- Tipos e Banco de Dados em Memória ---
interface Conta {
  id: number;
  codigo: string;
  nome_conta: string;
  grupo_contabil: 'Ativo' | 'Passivo' | 'Patrimônio Líquido';
  subgrupo1: string;
  subgrupo2: string;
}

interface Lancamento {
  id: number;
  data: string;
  historico: string;
  valor: number;
  contaDebitoId: number;
  contaCreditoId: number;
}

let contas: Conta[] = [
  { id: 1, codigo: "1.1.01.001", nome_conta: "Caixa Geral", grupo_contabil: "Ativo", subgrupo1: "Ativo Circulante", subgrupo2: "Disponibilidades" },
  { id: 2, codigo: "2.1.01.001", nome_conta: "Fornecedores Nacionais", grupo_contabil: "Passivo", subgrupo1: "Passivo Circulante", subgrupo2: "Obrigações" },
  { id: 3, codigo: "3.1.01.001", nome_conta: "Capital Social", grupo_contabil: "Patrimônio Líquido", subgrupo1: "Capital", subgrupo2: "-" },
];
let proximoContaId = 4;

let lancamentos: Lancamento[] = [];
let proximoLancamentoId = 1;

// --- ROTAS ---
app.get('/api/contas', (req: Request, res: Response) => {
  return res.status(200).json(contas);
});

app.post('/api/contas', (req: Request, res: Response) => {
  const { codigo, nome_conta, grupo_contabil, subgrupo1, subgrupo2 } = req.body;
  const novaConta: Conta = { id: proximoContaId++, codigo, nome_conta, grupo_contabil, subgrupo1, subgrupo2 };
  contas.push(novaConta);
  return res.status(201).json(novaConta);
});

app.get('/api/lancamentos', (req: Request, res: Response) => {
  const lancamentosComNomes = lancamentos.map(lanc => {
    const contaDebito = contas.find(c => c.id === lanc.contaDebitoId);
    const contaCredito = contas.find(c => c.id === lanc.contaCreditoId);
    return { ...lanc, nomeContaDebito: contaDebito?.nome_conta, nomeContaCredito: contaCredito?.nome_conta };
  });
  return res.status(200).json(lancamentosComNomes);
});

app.post('/api/lancamentos', (req: Request, res: Response) => {
  const { historico, valor, contaDebitoId, contaCreditoId } = req.body;
  const novoLancamento: Lancamento = {
    id: proximoLancamentoId++,
    data: new Date().toLocaleDateString('pt-BR'),
    historico,
    valor: parseFloat(valor),
    contaDebitoId: parseInt(contaDebitoId as string),
    contaCreditoId: parseInt(contaCreditoId as string),
  };
  lancamentos.push(novoLancamento);
  return res.status(201).json(novoLancamento);
});

app.get('/api/balancete', (req: Request, res: Response) => {
  const balancete = contas.map(conta => {
    const totalDebito = lancamentos.filter(l => l.contaDebitoId === conta.id).reduce((soma, l) => soma + l.valor, 0);
    const totalCredito = lancamentos.filter(l => l.contaCreditoId === conta.id).reduce((soma, l) => soma + l.valor, 0);

    return {
      codigo: conta.codigo,
      nome_conta: conta.nome_conta,
      totalDebito,
      totalCredito,
      saldoFinal: totalDebito - totalCredito
    }
  });

  const balanceteFiltrado = balancete.filter(item => item.totalDebito > 0 || item.totalCredito > 0);
  return res.status(200).json(balanceteFiltrado);
});

app.get('/api/balanco-patrimonial', (req: Request, res: Response) => {
  const saldos = contas.map(conta => {
    const totalDebito = lancamentos.filter(l => l.contaDebitoId === conta.id).reduce((soma, l) => soma + l.valor, 0);
    const totalCredito = lancamentos.filter(l => l.contaCreditoId === conta.id).reduce((soma, l) => soma + l.valor, 0);

    return { ...conta, saldo: totalDebito - totalCredito };
  }).filter(c => c.saldo !== 0);

  const relatorio = {
    ativo: {
      circulante: saldos.filter(c => c.subgrupo1 === 'Ativo Circulante'),
      naoCirculante: saldos.filter(c => c.subgrupo1 === 'Ativo Não Circulante'),
    },
    passivo: {
      circulante: saldos.filter(c => c.subgrupo1 === 'Passivo Circulante'),
      naoCirculante: saldos.filter(c => c.subgrupo1 === 'Passivo Não Circulante'),
    },
    patrimonioLiquido: saldos.filter(c => c.grupo_contabil === 'Patrimônio Líquido')
  };

  return res.status(200).json(relatorio);
});

// --- EXPORTAÇÃO PARA VERCEL ---
export default (req: any, res: any) => {
  app(req, res);
};
