import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

  // --- PORTEIRO DE AUTENTICAÇÃO ---
  // verifica se há um usuário logado.
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Se o usuário está logado, o app continua e chama a função principal.
            console.log("Acesso permitido para:", user.displayName);
            document.getElementById('nome-usuario').textContent = user.displayName;
            carregarMinhasEmpresas(); // <--- Inicia o aplicativo de verdade
        } else {
            // Se não há usuário, redireciona para a tela de login.
            console.log("Acesso negado. Redirecionando para login...");
            window.location.href = 'login.html';
        }
    });

    const API_URL = 'https://sistema-contabilisa.onrender.com/api'; 
    let todasAsContas = [];

  const formConvidarMembro = document.getElementById('form-convidar-membro');

  // --- NOVOS ELEMENTOS DA TELA DE EMPRESAS ---
  const telaEmpresas = document.getElementById('tela-empresas');
  const appPrincipal = document.getElementById('app-principal');
  const listaEmpresasDiv = document.getElementById('lista-empresas');
  const formNovaEmpresa = document.getElementById('form-nova-empresa');

  // --- ELEMENTOS PRINCIPAIS ---
  const tabelaContasCorpo = document.getElementById('tabela-contas-corpo');
  const modal = document.getElementById('modal-nova-conta');
  const btnAdicionar = document.getElementById('btnAdicionarConta');
  const btnFecharModal = document.querySelector('.close-button');
  const formNovaConta = document.getElementById('form-nova-conta');
  const btnEditarConta = document.getElementById('btnEditarConta');
  const btnExcluirConta = document.getElementById('btnExcluirConta');

  const selectContaDebito = document.getElementById('conta-debito');
  const selectContaCredito = document.getElementById('conta-credito');
  const filtroContaRazao = document.getElementById('filtro-conta-razao');
  const btnGerarRazao = document.getElementById('btnGerarRazao');
  const btnGerarBalanco = document.getElementById('btnGerarBalanco');

  const btnAtualizarIndicadores = document.getElementById('btnAtualizarIndicadores');
  const tbodyLiquidez = document.getElementById('tbody-liquidez');
  const tbodyRetorno = document.getElementById('tbody-retorno');

  // --- ELEMENTOS DO Balanço Patrimonial ---
  const ladoAtivoDiv = document.getElementById('lado-ativo');
  const ladoPassivoPlDiv = document.getElementById('lado-passivo-pl');
  const dataReferenciaElement = document.getElementById('data-referencia');

  // --- ELEMENTOS DO Livro Razão ---
  const resultadoRazaoDiv = document.getElementById('resultado-razao');
  const nomeContaRazaoH2 = document.getElementById('nome-conta-razao');
  const tabelaRazaoCorpo = document.getElementById('tabela-razao-corpo');
  const tabelaRazaoRodape = document.getElementById('tabela-razao-rodape');
  const btnExcluirLancamento = document.getElementById('btnExcluirLancamento');

  // --- ELEMENTOS: Livro Diário ---
  const formNovoLancamento = document.getElementById('form-novo-lancamento');
  const tabelaLancamentosCorpo = document.getElementById('tabela-lancamentos-corpo');

  // --- NAVEGAÇÃO ---
  const menuItems = document.querySelectorAll('.menu li');
  const pages = document.querySelectorAll('.page');
  // No final do seu script.js, verifique se esta linha está ativa:

  // --- FUNÇÃO AUXILIAR PARA FETCH COM AUTENTICAÇÃO ---
  async function fetchAutenticado(endpoint, options = {}) {
      const user = auth.currentUser;
      if (!user) {
          throw new Error("Usuário não autenticado.");
      }
      const token = await user.getIdToken();
      const empresaId = localStorage.getItem('empresa_id_selecionada');

      const defaultHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // <--- O CRACHÁ!
          'X-Empresa-ID': empresaId || '' // <--- ID da empresa selecionada
      };

      const finalOptions = {
          ...options,
          headers: {
              ...defaultHeaders,
              ...options.headers,
          }
      };

      const response = await fetch(`${API_URL}${endpoint}`, finalOptions);
      if (!response.ok) {
          throw new Error(`Erro na chamada API para ${endpoint}: ${response.statusText}`);
      }
      return response;
  }

  // --- LÓGICA DA NOVA TELA DE EMPRESAS ---
  async function carregarMinhasEmpresas() {
      try {
          const response = await fetchAutenticado('/empresas');
          const empresas = await response.json();

          listaEmpresasDiv.innerHTML = '';
          if (empresas.length === 0) {
              listaEmpresasDiv.innerHTML = '<p style="margin: 20px 0; color: #7f8c8d;">Você ainda não participa de nenhuma empresa.</p>';
          } else {
              empresas.forEach(empresa => {
                  const btn = document.createElement('button');
                  btn.style.cssText = "display: block; width: 100%; padding: 15px; margin-bottom: 10px; cursor: pointer; font-size: 16px;";
                  btn.textContent = empresa.nome;
                  btn.onclick = () => selecionarEmpresa(empresa.id, empresa.nome);
                  listaEmpresasDiv.appendChild(btn);
              });
          }
      } catch (error) { console.error("Erro ao carregar empresas:", error); }
  }

  formNovaEmpresa.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nomeEmpresaInput = document.getElementById('nome-nova-empresa');
      const nomeEmpresa = nomeEmpresaInput.value;
      if (!nomeEmpresa) return;

      try {
          await fetchAutenticado('/empresas', { method: 'POST', body: JSON.stringify({ nomeEmpresa }) });
          nomeEmpresaInput.value = '';
          carregarMinhasEmpresas();
      } catch (error) { console.error("Erro ao criar empresa:", error); alert('Falha ao criar empresa.'); }
  });

  function selecionarEmpresa(empresaId, nomeEmpresa) {
      localStorage.setItem('empresa_id_selecionada', empresaId);

      telaEmpresas.style.display = 'none';
      appPrincipal.style.display = 'block';

      // Atualiza o header da sidebar com o nome da empresa
      const sidebarHeader = document.querySelector('.sidebar-header h3');
      if(sidebarHeader) sidebarHeader.textContent = nomeEmpresa;

      inicializarApp();
  }

  function showPage(pageId) {
    pages.forEach(p => p.classList.remove('active'));
    menuItems.forEach(i => i.classList.remove('active'));
    document.getElementById(`page-${pageId}`)?.classList.add('active');
    document.querySelector(`.menu li[data-page="${pageId}"]`)?.classList.add('active');
  }

  // --- CONTAS ---
  async function carregarContas() {
    try {
        const response = await fetchAutenticado('/contas');
        todasAsContas = await response.json();
        tabelaContasCorpo.innerHTML = '';

        todasAsContas.forEach(c => {
            const tr = document.createElement('tr');
            // Guardamos o ID da conta diretamente na linha da tabela
            tr.dataset.contaId = c.id; 

            tr.innerHTML = `<td>${c.codigo}</td><td>${c.nome_conta}</td><td>${c.grupo_contabil}</td><td>${c.subgrupo1}</td><td>${c.subgrupo2}</td>`;
            
// Adiciona o evento de clique para selecionar/deselecionar a linha
      tr.addEventListener('click', () => {
        const linhaJaSelecionada = tr.classList.contains('selecionada');

        // Primeiro, remove a seleção de QUALQUER linha que possa estar selecionada
        const qualquerLinhaSelecionada = document.querySelector('#tabela-contas-corpo tr.selecionada');
        if (qualquerLinhaSelecionada) {
            qualquerLinhaSelecionada.classList.remove('selecionada');
        }

        // Agora, a lógica principal
        if (linhaJaSelecionada) {
            // Se a linha que clicamos JÁ ESTAVA selecionada, a gente só desabilita os botões.
            // A classe 'selecionada' já foi removida no passo anterior.
            btnEditarConta.disabled = true;
            btnExcluirConta.disabled = true;
        } else {
            // Se era uma linha nova, a gente adiciona a seleção nela e habilita os botões.
            tr.classList.add('selecionada');
            btnEditarConta.disabled = false;
            btnExcluirConta.disabled = false;
        }
      });

            tabelaContasCorpo.appendChild(tr);
        });
    } catch (e) { console.error('Erro ao carregar contas:', e); }
}

formNovaConta.addEventListener('submit', async e => {
  e.preventDefault();
  const contaIdEdicao = document.getElementById('conta-id-edicao').value;

  const dadosConta = {
      codigo: document.getElementById('codigo').value,
      nome_conta: document.getElementById('nome_conta').value,
      grupo_contabil: document.getElementById('grupo_contabil').value,
      subgrupo1: document.getElementById('subgrupo1').value,
      subgrupo2: document.getElementById('subgrupo2').value
  };

  try {
      let response;
      if (contaIdEdicao) {
          // Se tem um ID, estamos editando (método PUT)
          response = await fetchAutenticado(`/contas/${contaIdEdicao}`, { 
              method: 'PUT',
              body: JSON.stringify(dadosConta)
          });
      } else {
          // Se não tem ID, estamos adicionando (método POST)
          response = await fetchAutenticado('/contas', { 
              method: 'POST',
              body: JSON.stringify(dadosConta)
          });
      }

      if (!response.ok) throw new Error('Erro ao salvar a conta');

      formNovaConta.reset();
      toggleModal();
      await carregarContas();
      await popularDropdownsContas();
      // Desabilita os botões após a ação
      btnEditarConta.disabled = true;
      btnExcluirConta.disabled = true;

  } catch (e) {
      console.error('Erro ao salvar conta:', e);
      alert('Não foi possível salvar a conta.');
  }
});

  // --- LANÇAMENTOS ---
  async function carregarLancamentos() {
    try {
      const response = await fetchAutenticado('/lancamentos');
      const lancamentos = await response.json();
      tabelaLancamentosCorpo.innerHTML = '';

      lancamentos.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${l.data}</td>
          <td>${l.historico}</td>
          <td>${l.nomeContaDebito}</td>
          <td>${l.nomeContaCredito}</td>
          <td>${(typeof l.valor === 'number' ? l.valor.toFixed(2) : '0.00')}</td>        `;
        tabelaLancamentosCorpo.appendChild(tr);
        tr.dataset.lancamentoId = l.id; // Armazena o ID do lançamento

        tr.addEventListener('click', () => {
          // Desmarca outra seleção anterior
          const linhaSelecionadaAnterior = document.querySelector('#tabela-lancamentos-corpo tr.selecionada');
          if (linhaSelecionadaAnterior) {
              linhaSelecionadaAnterior.classList.remove('selecionada');
          }

          // Marca a linha atual como selecionada
          tr.classList.add('selecionada');

          // Habilita o botão de excluir
          btnExcluirLancamento.disabled = false;
        });
      });
    } catch (e) {
      console.error('Erro ao carregar lançamentos:', e);
    }
  }

formNovoLancamento.addEventListener('submit', async e => {
    e.preventDefault();
    
    const dataSelecionada = document.getElementById('data-lancamento').value; // Formato YYYY-MM-DD

    const novoLancamento = {
        data: dataSelecionada, // Agora enviamos a data escolhida!
        contaDebitoId: document.getElementById('conta-debito').value,
        contaCreditoId: document.getElementById('conta-credito').value,
        valor: document.getElementById('valor').value,
        historico: document.getElementById('historico').value
    };

    try {
        const response = await fetchAutenticado('/lancamentos', {
            method: 'POST',
            body: JSON.stringify(novoLancamento)
        });
        if (!response.ok) throw new Error('Erro ao salvar lançamento');

        // Limpa o form mas mantém a data de hoje para agilizar
        formNovoLancamento.reset();
        document.getElementById('data-lancamento').value = new Date().toISOString().split('T')[0];
        
        await carregarLancamentos();
        alert("Lançamento salvo com sucesso!");
    } catch (e) {
        console.error('Erro ao salvar lançamento:', e);
        alert('Não foi possível salvar o lançamento.');
    }
});

  async function gerarLivroRazao() {
    const contaId = filtroContaRazao.value;
    if (!contaId) {
      alert('Por favor, selecione uma conta para gerar o razão.');
      return;
    }

    try {
      const response = await fetchAutenticado(`/livro-razao/${contaId}`);
      const dadosRazao = await response.json();

      if (!response.ok) throw new Error('Erro ao buscar dados do razão.');
      
      nomeContaRazaoH2.textContent = `Razão da Conta: ${dadosRazao.conta.codigo} - ${dadosRazao.conta.nome_conta}`;
      tabelaRazaoCorpo.innerHTML = ''; // Limpa a tabela
      
      let saldoCorrente = 0; // Variável para calcular o saldo a cada linha
      
      // Cria uma linha <tr> para cada movimento da conta
      dadosRazao.movimentos.forEach(mov => {
        saldoCorrente += mov.credito - mov.debito;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${mov.data}</td>
          <td>${mov.historico}</td>
          <td>${mov.debito > 0 ? mov.debito.toFixed(2) : '-'}</td>
          <td>${mov.credito > 0 ? mov.credito.toFixed(2) : '-'}</td>
          <td>${saldoCorrente.toFixed(2)}</td>
        `;
        tabelaRazaoCorpo.appendChild(tr);
      });

      // Cria o rodapé da tabela com os totais
      tabelaRazaoRodape.innerHTML = `
        <tr>
          <td colspan="2">TOTAIS DO PERÍODO</td>
          <td>${dadosRazao.totalDebito.toFixed(2)}</td>
          <td>${dadosRazao.totalCredito.toFixed(2)}</td>
          <td><strong>${dadosRazao.saldoFinal.toFixed(2)}</strong></td>
        </tr>
      `;

      // Mostra a div de resultados que estava escondida
      resultadoRazaoDiv.style.display = 'block';

    } catch(error) {
      console.error('Erro ao gerar Livro Razão:', error);
      alert('Não foi possível gerar o relatório do Livro Razão.');
    }
  }

  function calcularTotalArvore(grupos) {
      let total = 0;
      if (!grupos) return 0;

      Object.keys(grupos).forEach(grupo => {
          const subgrupos = grupos[grupo];
          Object.keys(subgrupos).forEach(subgrupo => {
              const contas = subgrupos[subgrupo];
              if (Array.isArray(contas)) {
                  contas.forEach(c => {
                      // Soma o valor absoluto para garantir o totalizador positivo
                      total += Math.abs(c.saldo); 
                  });
              }
          });
      });
      return total;
  }

async function gerarBalancoPatrimonial() {
    // 1. Capturar os valores dos inputs de data
    const dataAtual = document.getElementById('data-balanco-atual').value;
    const dataAnterior = document.getElementById('data-balanco-anterior').value;

    if (!dataAtual) {
        alert("Por favor, selecione a data do balanço.");
        return;
    }

    try {
        // 2. Montar a URL com Query Parameters (?data=...&comparacao=...)
        const params = new URLSearchParams({
            data: dataAtual,
            comparacao: dataAnterior
        });

        // 3. Fazer a requisição ao backend (agora filtrando por data)
        const response = await fetchAutenticado(`/balanco-patrimonial?${params.toString()}`);
        const relatorio = await response.json();

        // 4. Calcular Totais Base para a Análise Vertical (AV)
        // Precisamos saber o total do grupo ANTES de desenhar as linhas individuais
        const totalAtivoBase = calcularTotalArvore(relatorio.ativo);
        const totalPassivoBase = calcularTotalArvore(relatorio.passivo); 
        const totalPLBase = calcularTotalArvore(relatorio.patrimonioLiquido);
        
        // A base da AV do Passivo geralmente é o (Total Passivo + PL)
        const totalPassivoEPLBase = totalPassivoBase + totalPLBase; 

        // 5. Definir o HTML do cabeçalho das colunas
        const headerCols = `
            <div class="balanco-header-cols">
                <span>Conta</span>
                <span>Saldo</span>
                <span>AV%</span>
                <span>AH%</span>
            </div>`;

        // --- RENDERIZAÇÃO: Lado do Ativo ---
        const resultadoAtivo = renderizarGrupos(relatorio.ativo, 'Ativo', totalAtivoBase);
        const ladoAtivoDiv = document.getElementById('lado-ativo');
        
        ladoAtivoDiv.innerHTML = `
            <div class="balanco-header">ATIVO</div>
            ${headerCols}
            <div class="balanco-grupo">${resultadoAtivo.html}</div>
            <div class="balanco-total">
                <span>TOTAL ATIVO</span>
                <span>${resultadoAtivo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;

        // --- RENDERIZAÇÃO: Lado Passivo e PL ---
        const resultadoPassivo = renderizarGrupos(relatorio.passivo, 'Passivo', totalPassivoEPLBase);
        const resultadoPL = renderizarGrupos(relatorio.patrimonioLiquido, 'Patrimônio Líquido', totalPassivoEPLBase);
        const totalPassivoPL = resultadoPassivo.total + resultadoPL.total;
        
        const conteudoPassivoPlDiv = document.getElementById('conteudo-passivo-pl');
        conteudoPassivoPlDiv.innerHTML = `
            ${headerCols}
            <div class="balanco-grupo">${resultadoPassivo.html}</div>
            <div class="balanco-grupo">${resultadoPL.html}</div>
            <div class="balanco-total">
                <span>TOTAL PASSIVO + PL</span>
                <span>${totalPassivoPL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;

        // --- RENDERIZAÇÃO: Receitas e Despesas (DRE) ---
        const totalReceitasBase = calcularTotalArvore(relatorio.receitas);
        // Evita divisão por zero se não houver receitas
        const baseDRE = totalReceitasBase > 0 ? totalReceitasBase : 1;

        const resultadoReceitas = renderizarGrupos(relatorio.receitas, 'Receitas', baseDRE);
        const ladoReceitasDiv = document.getElementById('lado-receitas');
        ladoReceitasDiv.innerHTML = `
            <div class="balanco-header">RECEITAS</div>
            ${headerCols}
            <div class="balanco-grupo">${resultadoReceitas.html}</div>
            <div class="balanco-total">
                <span>TOTAL RECEITAS</span>
                <span>${resultadoReceitas.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;
        
        const resultadoDespesas = renderizarGrupos(relatorio.despesas, 'Despesas', baseDRE);
        const ladoDespesasDiv = document.getElementById('lado-despesas');
        ladoDespesasDiv.innerHTML = `
            <div class="balanco-header">DESPESAS</div>
            ${headerCols}
            <div class="balanco-grupo">${resultadoDespesas.html}</div>
            <div class="balanco-total">
                <span>TOTAL DESPESAS</span>
                <span>${resultadoDespesas.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;

    } catch (error) {
        console.error('Erro ao gerar Balanço Patrimonial:', error);
        alert('Erro ao gerar o balanço. Verifique o console para mais detalhes.');
    }
}

  function renderizarContas(contas, grupoPai, totalBase) {
    let html = ''; 
    let total = 0;

    contas.forEach(conta => {
      // 1. Ajuste do sinal (Ativo/Despesa = Positivo, Passivo/Receita = Invertido visualmente)
      let saldoExibicao = conta.saldo;
      if (grupoPai !== 'Ativo' && grupoPai !== 'Despesas') {
           saldoExibicao = conta.saldo * -1;
      }

      // 2. Cálculo da Análise Vertical (AV)
      let av = 0;
      if (totalBase > 0) av = (saldoExibicao / totalBase) * 100;

      // 3. Cálculo da Análise Horizontal (AH)
      let ah = 0; // <--- AQUI ESTAVA O PROBLEMA: Precisamos declarar ela antes!
      let textoAh = '-';
      
      const saldoAnteriorBruto = conta.saldo_anterior || 0; 
      const saldoAnterior = (grupoPai === 'Ativo' || grupoPai === 'Despesas') ? saldoAnteriorBruto : saldoAnteriorBruto * -1;
      
      // Lógica Matemática da AH
      if (saldoAnterior !== 0) {
          ah = ((saldoExibicao - saldoAnterior) / Math.abs(saldoAnterior)) * 100;
          textoAh = ah.toFixed(1) + '%';
      } else if (saldoExibicao !== 0) {
          // Se antes era 0 e agora tem valor, consideramos "Crescimento infinito/Novo"
          ah = 100; // Definimos positivo para ficar verde
          textoAh = '<span style="font-size:0.7em; color:blue; font-weight:bold;">NOVO</span>';
      }
      
      // 4. Definição das Cores (Vermelho/Verde)
      let classeAh = '';
      // Só aplica cor se houver alguma variação ou saldo
      if (saldoAnterior !== 0 || saldoExibicao !== 0) {
          classeAh = ah < -0.01 ? 'text-red' : (ah > 0.01 ? 'text-green' : '');
      }

      html += `
      <div class="balanco-conta">
        <span>&nbsp;&nbsp;&nbsp;&nbsp;${conta.nome_conta}</span>
        <span>${saldoExibicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        <span style="color: #7f8c8d; font-size: 0.8em;">${av.toFixed(1)}%</span>
        <span class="${classeAh}" style="font-size: 0.8em;">${textoAh}</span>
      </div>`;
      
      total += saldoExibicao;
    });
    return { html, total };
}

  function renderizarGrupos(grupos, grupoPai, totalBase) {
    let html = ''; 
    let totalCalculado = 0;
    const chavesGrupos = Object.keys(grupos);
    
    chavesGrupos.forEach(chaveGrupo => {
      html += `<div class="balanco-grupo-titulo">${chaveGrupo}</div>`;
      const subgrupos = grupos[chaveGrupo]; 
      const chavesSubgrupos = Object.keys(subgrupos);
      
      chavesSubgrupos.forEach(chaveSubgrupo => {
        if (chaveSubgrupo && chaveSubgrupo !== 'undefined' && chaveSubgrupo.trim() !== '') { 
            // Note que aqui adicionei spans vazios para manter o grid alinhado nos títulos de subgrupo
            html += `<div class="balanco-conta" style="background-color: #fafafa;"><span>&nbsp;&nbsp;<strong>${chaveSubgrupo}</strong></span><span></span><span></span><span></span></div>`;
        }
        const contas = subgrupos[chaveSubgrupo];

        // Passamos o totalBase adiante
        const resultadoContas = renderizarContas(contas, grupoPai, totalBase);
        html += resultadoContas.html; 
        totalCalculado += resultadoContas.total;
      });
    });
    return { html, total: totalCalculado };
  }

  function definirDatasPadrao() {
    const hoje = new Date();
    
    // Data Atual: Hoje
    const dataAtualFormatada = hoje.toISOString().split('T')[0];
    document.getElementById('data-balanco-atual').value = dataAtualFormatada;

    // Data Anterior: 1 mês atrás (padrão para análise mensal)
    const mesPassado = new Date();
    mesPassado.setMonth(mesPassado.getMonth() - 1);
    const dataAnteriorFormatada = mesPassado.toISOString().split('T')[0];
    document.getElementById('data-balanco-anterior').value = dataAnteriorFormatada;
}

const hojeISO = new Date().toISOString().split('T')[0];
document.getElementById('data-lancamento').value = hojeISO;

  function toggleModal() {
    modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
  }

  async function popularDropdownsContas() {
    selectContaDebito.innerHTML = '<option value="">Selecione...</option>';
    selectContaCredito.innerHTML = '<option value="">Selecione...</option>';
    filtroContaRazao.innerHTML = '<option value="">Selecione uma conta...</option>';

    todasAsContas.forEach(c => {
      const option = `<option value="${c.id}">${c.codigo} - ${c.nome_conta}</option>`;
      selectContaDebito.innerHTML += option;
      selectContaCredito.innerHTML += option;
      filtroContaRazao.innerHTML += option;
    });
  }

  function abrirModalParaNovaConta() {
    // 1. Reseta o formulário para limpar todos os campos de input
    formNovaConta.reset(); 

    // 2. Garante que o campo oculto de ID de edição esteja vazio
    document.getElementById('conta-id-edicao').value = ''; 

    // 3. Restaura o título original do modal para "Adicionar"
    document.getElementById('modal-nova-conta').querySelector('h2').textContent = 'Adicionar Nova Conta';

    // 4. Finalmente, abre o modal
    toggleModal();
}

function definirDatasDREPadrao() {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const formatarData = (data) => data.toISOString().split('T')[0];

    document.getElementById('data-dre-inicio').value = formatarData(primeiroDiaMes);
    document.getElementById('data-dre-fim').value = formatarData(hoje);
}

// Adicione esta função no seu script.js
async function gerarDRE() {
    const dataInicio = document.getElementById('data-dre-inicio').value;
    const dataFim = document.getElementById('data-dre-fim').value;

    if (!dataInicio || !dataFim) {
        alert("Por favor, selecione as datas de início e fim do período.");
        return;
    }

    try {
        const params = new URLSearchParams({
            inicio: dataInicio,
            fim: dataFim
        });

        const response = await fetchAutenticado(`/dre?${params.toString()}`);
        const relatorioDRE = await response.json();
        
        // Reutilizamos a lógica de calcularTotalArvore (que só soma os saldos)
        const totalReceitas = calcularTotalArvore(relatorioDRE.receitas);
        const totalDespesas = calcularTotalArvore(relatorioDRE.despesas);

        // A base da AV da DRE é o Total de Receitas (Receita Bruta/Líquida)
        const baseDRE = totalReceitas > 0 ? totalReceitas : 1; 
        
        // A DRE é um relatório mais simples (sem AH)
        const headerCols = `
            <div class="balanco-header-cols">
                <span>Conta</span>
                <span class="dre-col-saldo">Valor</span>
                <span class="dre-col-av">AV%</span>
            </div>`;

        // 1. RENDERIZAR RECEITAS (Valores de receitas são negativos no saldo, mas positivos no DRE)
        const resultadoReceitas = renderizarGruposDRE(relatorioDRE.receitas, 'Receitas', baseDRE);
        document.getElementById('dre-receitas').innerHTML = `
            ${headerCols}
            ${resultadoReceitas.html}
            <div class="dre-subtotal">
                <span>TOTAL RECEITAS</span>
                <span class="dre-col-saldo">${Math.abs(resultadoReceitas.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;

        // 2. RENDERIZAR DESPESAS
        const resultadoDespesas = renderizarGruposDRE(relatorioDRE.despesas, 'Despesas', baseDRE);
        document.getElementById('dre-despesas').innerHTML = `
            ${headerCols}
            ${resultadoDespesas.html}
            <div class="dre-subtotal">
                <span>TOTAL DESPESAS</span>
                <span class="dre-col-saldo">${resultadoDespesas.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;

        // 3. CALCULAR E RENDERIZAR RESULTADO FINAL
        const lucroOuPrejuizo = Math.abs(resultadoReceitas.total) - resultadoDespesas.total;
        
        const classeResultado = lucroOuPrejuizo >= 0 ? 'dre-lucro' : 'dre-prejuizo';
        const textoResultado = lucroOuPrejuizo >= 0 ? 'LUCRO LÍQUIDO' : 'PREJUÍZO LÍQUIDO';

        document.getElementById('dre-resultado-final').innerHTML = `
            <div class="${classeResultado}">
                <span>${textoResultado}</span>
                <span>${Math.abs(lucroOuPrejuizo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;

    } catch (error) {
        console.error('Erro ao gerar DRE:', error);
        alert('Erro ao gerar a DRE. Verifique o console para mais detalhes.');
    }
}

// 4. Conectar a função ao botão na inicialização
document.getElementById('btnGerarDRE').addEventListener('click', gerarDRE);

// 5. Crie a função de renderização específica para DRE (REUTILIZANDO renderizarGrupos e renderizarContas)
// Reutilizaremos o renderizarContas, mas vamos adaptar o renderizarGrupos para não esperar o AH
function renderizarGruposDRE(grupos, grupoPai, totalBase) {
    let html = '';
    let totalCalculado = 0;
    
    // Converte de Objeto para Array de chaves (Subgrupos 1)
    const subgrupos1 = Object.keys(grupos).sort();

    subgrupos1.forEach(subgrupo1Key => {
        html += `<h4 class="subgrupo-header">${subgrupo1Key}</h4>`;
        
        const subgrupos2 = grupos[subgrupo1Key];
        const subgrupos2Keys = Object.keys(subgrupos2).sort();

        subgrupos2Keys.forEach(subgrupo2Key => {
            if (subgrupo2Key !== 'Sem Subgrupo') {
                 html += `<h5 class="subgrupo-header">${subgrupo2Key}</h5>`;
            }
            
            const contas = subgrupos2[subgrupo2Key];
            const resultadoContas = renderizarContasDRE(contas, grupoPai, totalBase);
            html += resultadoContas.html;
            totalCalculado += resultadoContas.total;
        });
    });

    return { html, total: totalCalculado };
}

// 6. Crie a função de renderização de contas (Cópia simplificada da Balanço, sem AH)
function renderizarContasDRE(contas, grupoPai, totalBase) {
    let html = '';
    let total = 0;

    contas.forEach(conta => {
      // 1. Ajuste do sinal (DRE: Receita é Positivo visualmente, Despesa é Positivo visualmente)
      // O saldo de Receita é NEGATIVO no banco, invertemos para positivo.
      let saldoExibicao = conta.saldo;
      if (grupoPai === 'Receitas') {
           saldoExibicao = conta.saldo * -1; // Inverte o saldo de Receita para ser Positivo na DRE
      }
      // O saldo de Despesa já é positivo, mantém.

      // 2. Cálculo da Análise Vertical (AV)
      let av = 0;
      if (totalBase > 0) av = (saldoExibicao / totalBase) * 100;

      html += `
      <div class="dre-conta">
        <span>&nbsp;&nbsp;&nbsp;&nbsp;${conta.nome_conta}</span>
        <span class="dre-col-saldo">${saldoExibicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        <span class="dre-col-av" style="color: #7f8c8d; font-size: 0.8em;">${av.toFixed(1)}%</span>
      </div>`;
      
      total += saldoExibicao;
    });
    return { html, total };
}

async function gerarIndicadores() {
    try {
        const response = await fetchAutenticado('/indicadores');
        const dados = await response.json();
        const v = dados.valores; // Atalho para os valores brutos

        // Função auxiliar para formatar moeda
        const fmt = (n) => n.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        const pct = (n) => (n * 100).toFixed(2) + '%'; // Formata porcentagem

        // Preenche Liquidez
        tbodyLiquidez.innerHTML = `
            <tr>
                <td><strong>Imediata</strong></td>
                <td>Disp. / Pass. Circ.</td>
                <td>${fmt(v.disponivel)} / ${fmt(v.passivoCirculante)}</td>
                <td class="resultado-final">${dados.liquidez.imediata.toFixed(2)}</td>
            </tr>
            <tr>
                <td><strong>Seca</strong></td>
                <td>(Ativo Circ. - Est.) / Pass. Circ.</td>
                <td>(${fmt(v.ativoCirculante)} - ${fmt(v.estoques)}) / ${fmt(v.passivoCirculante)}</td>
                <td class="resultado-final">${dados.liquidez.seca.toFixed(2)}</td>
            </tr>
            <tr>
                <td><strong>Corrente</strong></td>
                <td>Ativo Circ. / Pass. Circ.</td>
                <td>${fmt(v.ativoCirculante)} / ${fmt(v.passivoCirculante)}</td>
                <td class="resultado-final">${dados.liquidez.corrente.toFixed(2)}</td>
            </tr>
            <tr>
                <td><strong>Geral</strong></td>
                <td>(AC + RLP) / (PC + PNC)</td>
                <td>${fmt(v.ativoCirculante + v.realizavelLongoPrazo)} / ${fmt(v.passivoTotal)}</td>
                <td class="resultado-final">${dados.liquidez.geral.toFixed(2)}</td>
            </tr>
        `;

        // Preenche Retorno
        tbodyRetorno.innerHTML = `
            <tr>
                <td><strong>ROA</strong></td>
                <td>Lucro Líq. / Ativo Total</td>
                <td>${fmt(v.lucroLiquido)} / ${fmt(v.ativoTotal)}</td>
                <td class="resultado-final">${pct(dados.retorno.roa)}</td>
            </tr>
             <tr>
                <td><strong>ROI</strong></td>
                <td>Ganho / Investimento</td>
                <td>${fmt(v.ganhoInvestimento)} / ${fmt(v.custoInvestimento)}</td>
                <td class="resultado-final">${pct(dados.retorno.roi)}</td>
            </tr>
             <tr>
                <td><strong>ROE</strong></td>
                <td>Lucro Líq. / Patr. Líq.</td>
                <td>${fmt(v.lucroLiquido)} / ${fmt(v.patrimonioLiquido)}</td>
                <td class="resultado-final">${pct(dados.retorno.roe)}</td>
            </tr>
        `;

    } catch (error) {
        console.error("Erro ao carregar indicadores:", error);
        alert("Erro ao calcular indicadores.");
    }
}

  // --- INICIALIZAÇÃO DO APLICATIVO ---
  async function inicializarApp() {
      menuItems.forEach(item => item.addEventListener('click', () => showPage(item.dataset.page)));
      btnAdicionar.addEventListener('click', abrirModalParaNovaConta);
      btnFecharModal.addEventListener('click', toggleModal);
      btnGerarBalanco.addEventListener('click', gerarBalancoPatrimonial);
      btnGerarRazao.addEventListener('click', gerarLivroRazao);
      btnAtualizarIndicadores.addEventListener('click', gerarIndicadores);

      definirDatasPadrao();
      definirDatasDREPadrao();

      if (formConvidarMembro) {
        formConvidarMembro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email-convite');
            const emailConvidado = emailInput.value;
            if (!emailConvidado) return;

            try {
                const response = await fetchAutenticado('/empresas/membros', {
                    method: 'POST',
                    body: JSON.stringify({ emailConvidado })
                });
                const resultado = await response.json();
                alert(resultado.message); // Exibe a mensagem de sucesso ou erro
                emailInput.value = '';
            } catch (error) {
                console.error("Erro ao convidar membro:", error);
                alert("Falha ao convidar membro. Verifique o e-mail e tente novamente.");
            }
        });
    }

    // Lógica para o botão de logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            signOut(auth).catch(error => console.error("Erro no logout:", error));
            // O 'onAuthStateChanged' vai detectar o logout e fazer o redirecionamento
        });
    }

    btnEditarConta.addEventListener('click', () => {
      const linhaSelecionada = document.querySelector('#tabela-contas-corpo tr.selecionada');
      if (!linhaSelecionada) {
          alert('Por favor, selecione uma conta para editar.');
          return;
      }

      const contaId = linhaSelecionada.dataset.contaId;
      const contaParaEditar = todasAsContas.find(c => c.id === contaId);

      if (contaParaEditar) {
          // Preenche o modal com os dados da conta para edição
          document.getElementById('modal-nova-conta').querySelector('h2').textContent = 'Editar Conta Contábil';
          document.getElementById('conta-id-edicao').value = contaParaEditar.id;
          document.getElementById('codigo').value = contaParaEditar.codigo;
          document.getElementById('nome_conta').value = contaParaEditar.nome_conta;
          document.getElementById('grupo_contabil').value = contaParaEditar.grupo_contabil;
          document.getElementById('subgrupo1').value = contaParaEditar.subgrupo1;
          document.getElementById('subgrupo2').value = contaParaEditar.subgrupo2;
          toggleModal();
      }
  });

  btnExcluirConta.addEventListener('click', async () => {
      const linhaSelecionada = document.querySelector('#tabela-contas-corpo tr.selecionada');
      if (!linhaSelecionada) {
          alert('Por favor, selecione uma conta para excluir.');
          return;
      }
      
      const contaId = linhaSelecionada.dataset.contaId;
      const contaParaExcluir = todasAsContas.find(c => c.id === contaId);

      if (contaParaExcluir && confirm(`Tem certeza que deseja excluir a conta "${contaParaExcluir.nome_conta}"?`)) {
          try {
              await fetchAutenticado(`/contas/${contaId}`, { method: 'DELETE' });
              await carregarContas();
              await popularDropdownsContas();
              btnEditarConta.disabled = true;
              btnExcluirConta.disabled = true;
          } catch (e) {
              console.error("Erro ao excluir conta:", e);
              alert("Não foi possível excluir a conta. Verifique se ela não está sendo usada em algum lançamento.");
          }
      }
  });


  btnExcluirLancamento.addEventListener('click', async () => {
    const linhaSelecionada = document.querySelector('#tabela-lancamentos-corpo tr.selecionada');
    if (!linhaSelecionada) {
        alert('Por favor, selecione um lançamento para excluir.');
        return;
    }
  
    const lancamentoId = linhaSelecionada.dataset.lancamentoId;
  
    if (confirm('Tem certeza que deseja excluir este lançamento?')) {
      try {
        await fetchAutenticado(`/lancamentos/${lancamentoId}`, {
          method: 'DELETE'
        });
  
        // Atualiza a lista após exclusão
        await carregarLancamentos();
        btnExcluirLancamento.disabled = true;
  
      } catch (error) {
        console.error('Erro ao excluir lançamento:', error);
        alert('Não foi possível excluir o lançamento.');
      }
    }
  });  

    
    await carregarContas();
    await popularDropdownsContas();
    await carregarLancamentos();
    showPage('dashboard');

    if (dataReferenciaElement) {
        const hoje = new Date();
        dataReferenciaElement.textContent = hoje.toLocaleDateString('pt-BR');
    }
  }
});


  