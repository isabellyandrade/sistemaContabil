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

  const selectContaDebito = document.getElementById('conta-debito');
  const selectContaCredito = document.getElementById('conta-credito');
  const filtroContaRazao = document.getElementById('filtro-conta-razao');
  const btnGerarRazao = document.getElementById('btnGerarRazao');
  const btnGerarBalanco = document.getElementById('btnGerarBalanco');

  // --- ELEMENTOS DO Balanço Patrimonial ---
  const ladoAtivoDiv = document.getElementById('lado-ativo');
  const ladoPassivoPlDiv = document.getElementById('lado-passivo-pl');
  const dataReferenciaElement = document.getElementById('data-referencia');

  // --- ELEMENTOS DO Livro Razão ---
  const resultadoRazaoDiv = document.getElementById('resultado-razao');
  const nomeContaRazaoH2 = document.getElementById('nome-conta-razao');
  const tabelaRazaoCorpo = document.getElementById('tabela-razao-corpo');
  const tabelaRazaoRodape = document.getElementById('tabela-razao-rodape');

  // --- ELEMENTOS: Livro Diário ---
  const formNovoLancamento = document.getElementById('form-novo-lancamento');
  const tabelaLancamentosCorpo = document.getElementById('tabela-lancamentos-corpo');

  // --- NAVEGAÇÃO ---
  const menuItems = document.querySelectorAll('.menu li');
  const pages = document.querySelectorAll('.page');

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
        tr.innerHTML = `
          <td>${c.codigo}</td>
          <td>${c.nome_conta}</td>
          <td>${c.grupo_contabil}</td>
          <td>${c.subgrupo1}</td>
          <td>${c.subgrupo2}</td>
        `;
        tabelaContasCorpo.appendChild(tr);
      });
    } catch (e) {
      console.error('Erro ao carregar contas:', e);
    }
  }

  formNovaConta.addEventListener('submit', async e => {
    e.preventDefault();
    const novaConta = {
      codigo: document.getElementById('codigo').value,
      nome_conta: document.getElementById('nome_conta').value,
      grupo_contabil: document.getElementById('grupo_contabil').value,
      subgrupo1: document.getElementById('subgrupo1').value,
      subgrupo2: document.getElementById('subgrupo2').value
    };

    try {
      const response = await fetchAutenticado('/contas', { 
        method: 'POST',
        body: JSON.stringify(novaConta)
      });
      if (!response.ok) throw new Error('Erro ao criar conta');
      const contaCriada = await response.json();

      todasAsContas.push(contaCriada);
      formNovaConta.reset();
      toggleModal();
      await carregarContas();
      await popularDropdownsContas();
    } catch (e) {
      console.error('Erro ao criar conta:', e);
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
          <td>${l.valor.toFixed(2)}</td>
        `;
        tabelaLancamentosCorpo.appendChild(tr);
      });
    } catch (e) {
      console.error('Erro ao carregar lançamentos:', e);
    }
  }

  formNovoLancamento.addEventListener('submit', async e => {
    e.preventDefault();
    const novoLancamento = {
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

      formNovoLancamento.reset();
      await carregarLancamentos();
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

  async function gerarBalancoPatrimonial() {
    try {
        const response = await fetchAutenticado('/balanco-patrimonial');
        const relatorio = await response.json();

        // --- Renderiza Lado do Ativo (sem mudanças) ---
        const resultadoAtivo = renderizarGrupos(relatorio.ativo, 'Ativo');
        const ladoAtivoDiv = document.getElementById('lado-ativo');
        ladoAtivoDiv.innerHTML = `
            <div class="balanco-header">ATIVO</div>
            <div class="balanco-grupo">${resultadoAtivo.html}</div>
            <div class="balanco-total">
                <span>TOTAL ATIVO</span>
                <span>${resultadoAtivo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;

        // --- Renderiza Lado Direito (agora com mais grupos) ---
        const resultadoPassivo = renderizarGrupos(relatorio.passivo, 'Passivo');
        const resultadoPL = renderizarGrupos(relatorio.patrimonioLiquido, 'Patrimônio Líquido');
        const totalPassivoPL = resultadoPassivo.total + resultadoPL.total;
        
        const conteudoPassivoPlDiv = document.getElementById('conteudo-passivo-pl');
        conteudoPassivoPlDiv.innerHTML = `
            <div class="balanco-grupo">${resultadoPassivo.html}</div>
            <div class="balanco-grupo">${resultadoPL.html}</div>
            <div class="balanco-total">
                <span>TOTAL PASSIVO + PL</span>
                <span>${totalPassivoPL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;

        // --- NOVO: Renderiza Receitas e Despesas ---
        const resultadoReceitas = renderizarGrupos(relatorio.receitas, 'Receitas');
        const ladoReceitasDiv = document.getElementById('lado-receitas');
        ladoReceitasDiv.innerHTML = `
            <div class="balanco-header">RECEITAS</div>
            <div class="balanco-grupo">${resultadoReceitas.html}</div>
            <div class="balanco-total">
                <span>TOTAL RECEITAS</span>
                <span>${resultadoReceitas.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;
        
        const resultadoDespesas = renderizarGrupos(relatorio.despesas, 'Despesas');
        const ladoDespesasDiv = document.getElementById('lado-despesas');
        ladoDespesasDiv.innerHTML = `
            <div class="balanco-header">DESPESAS</div>
            <div class="balanco-grupo">${resultadoDespesas.html}</div>
            <div class="balanco-total">
                <span>TOTAL DESPESAS</span>
                <span>${resultadoDespesas.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>`;

    } catch (error) {
        console.error('Erro ao gerar Balanço Patrimonial:', error);
    }
}

  function renderizarContas(contas, grupoPai) {
    let html = ''; let total = 0;
    contas.forEach(conta => {
      const saldoExibicao = (grupoPai === 'Ativo') ? conta.saldo : conta.saldo * -1;
      html += `<div class="balanco-conta"><span>&nbsp;&nbsp;&nbsp;&nbsp;${conta.nome_conta}</span><span>${saldoExibicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>`;
      total += saldoExibicao;
    });
    return { html, total };
  }

  function renderizarGrupos(grupos, grupoPai) {
    let html = ''; let total = 0;
    const chavesGrupos = Object.keys(grupos);
    chavesGrupos.forEach(chaveGrupo => {
      html += `<div class="balanco-grupo-titulo">${chaveGrupo}</div>`;
      const subgrupos = grupos[chaveGrupo]; const chavesSubgrupos = Object.keys(subgrupos);
      chavesSubgrupos.forEach(chaveSubgrupo => {
        if (chaveSubgrupo && chaveSubgrupo !== 'undefined' && chaveSubgrupo.trim() !== '') { html += `<div class="balanco-conta"><span>&nbsp;&nbsp;<strong>${chaveSubgrupo}</strong></span><span></span></div>`;}
        const contas = subgrupos[chaveSubgrupo];

        console.log("Variável 'contas' que será renderizada:", contas); 

        const resultadoContas = renderizarContas(contas, grupoPai);
        html += resultadoContas.html; total += resultadoContas.total;
      });
    });
    return { html, total };
  }

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


  // --- INICIALIZAÇÃO DO APLICATIVO ---
  async function inicializarApp() {
      menuItems.forEach(item => item.addEventListener('click', () => showPage(item.dataset.page)));
      btnAdicionar.addEventListener('click', toggleModal);
      btnFecharModal.addEventListener('click', toggleModal);
      btnGerarBalanco.addEventListener('click', gerarBalancoPatrimonial);
      btnGerarRazao.addEventListener('click', gerarLivroRazao);
      
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


  
