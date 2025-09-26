document.addEventListener('DOMContentLoaded', () => {
      // CORREÇÃO PARA VERCEL: Mudando de 'http://localhost:3333/api' para o caminho relativo '/api'
      const API_URL = '/api';
      let todasAsContas = [];
    
      // Elementos de NAVEGAÇÃO
      const menuItems = document.querySelectorAll('.menu li');
      const pages = document.querySelectorAll('.page');
    
      // Elementos do DOM: Setup de Contas
      const tabelaContasCorpo = document.getElementById('tabela-contas-corpo');
      const modal = document.getElementById('modal-nova-conta');
      const btnAdicionar = document.getElementById('btnAdicionarConta');
      const btnFecharModal = document.querySelector('.close-button');
      const formNovaConta = document.getElementById('form-nova-conta');
    
      // Elementos do DOM: Livro Diário
      const formNovoLancamento = document.getElementById('form-novo-lancamento');
      const selectContaDebito = document.getElementById('conta-debito');
      const selectContaCredito = document.getElementById('conta-credito');
      const tabelaLancamentosCorpo = document.getElementById('tabela-lancamentos-corpo');
    
      // Elementos do DOM: Balanço Patrimonial
      const btnGerarBalanco = document.getElementById('btnGerarBalanco');
      const ladoAtivoDiv = document.getElementById('lado-ativo');
      const ladoPassivoPlDiv = document.getElementById('lado-passivo-pl');
    
      // --- FUNÇÃO DE NAVEGAÇÃO ---
      function showPage(pageId){pages.forEach(p=>p.classList.remove('active'));menuItems.forEach(i=>i.classList.remove('active'));document.getElementById(`page-${pageId}`)?.classList.add('active');document.querySelector(`.menu li[data-page="${pageId}"]`)?.classList.add('active')}
    
      // --- FUNÇÕES: Setup de Contas ---
      async function carregarContas(){try{const response=await fetch(`${API_URL}/contas`);todasAsContas=await response.json();tabelaContasCorpo.innerHTML='';todasAsContas.forEach(c=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${c.codigo}</td><td>${c.nome_conta}</td><td>${c.grupo_contabil}</td><td>${c.subgrupo1}</td><td>${c.subgrupo2}</td>`;tabelaContasCorpo.appendChild(tr)})}catch(e){console.error('Erro ao carregar contas:',e)}}
      function toggleModal(){modal.style.display=(modal.style.display==='block')?'none':'block'}
      formNovaConta.addEventListener('submit',async e=>{e.preventDefault();const n={codigo:document.getElementById('codigo').value,nome_conta:document.getElementById('nome_conta').value,grupo_contabil:document.getElementById('grupo_contabil').value,subgrupo1:document.getElementById('subgrupo1').value,subgrupo2:document.getElementById('subgrupo2').value};try{await fetch(`${API_URL}/contas`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(n)});formNovaConta.reset();toggleModal();await carregarContas();await popularDropdownsContas()}catch(e){console.error('Erro ao criar conta:',e)}});
      
      // --- FUNÇÕES: Livro Diário ---
      async function popularDropdownsContas(){selectContaDebito.innerHTML='<option value="">Selecione...</option>';selectContaCredito.innerHTML='<option value="">Selecione...</option>';todasAsContas.forEach(c=>{const o=`<option value="${c.id}">${c.codigo} - ${c.nome_conta}</option>`;selectContaDebito.innerHTML+=o;selectContaCredito.innerHTML+=o})}
      async function carregarLancamentos(){try{const response=await fetch(`${API_URL}/lancamentos`);const l=await response.json();tabelaLancamentosCorpo.innerHTML='';l.forEach(c=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${c.data}</td><td>${c.historico}</td><td>${c.nomeContaDebito}</td><td>${c.nomeContaCredito}</td><td>${c.valor.toFixed(2)}</td>`;tabelaLancamentosCorpo.appendChild(tr)})}catch(e){console.error('Erro ao carregar lançamentos:',e)}}
      formNovoLancamento.addEventListener('submit',async e=>{e.preventDefault();const n={contaDebitoId:document.getElementById('conta-debito').value,contaCreditoId:document.getElementById('conta-credito').value,valor:document.getElementById('valor').value,historico:document.getElementById('historico').value};try{await fetch(`${API_URL}/lancamentos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(n)});formNovoLancamento.reset();await carregarLancamentos()}catch(e){console.error('Erro ao salvar lançamento:',e)}});
    
      // --- FUNÇÕES: Balanço Patrimonial ---
      function renderizarGrupo(contas, titulo) {
        if (contas.length === 0) return { html: '', total: 0 };
        
        let totalGrupo = 0;
        let htmlContas = `<div class="balanco-grupo-titulo">${titulo}</div>`;
    
        contas.forEach(conta => {
          // No balanço, Passivo e PL têm saldos credores (negativos na nossa conta D-C), então invertemos o sinal para exibição
          const saldoExibicao = (conta.grupo_contabil === 'Ativo') ? conta.saldo : conta.saldo * -1;
          htmlContas += `
            <div class="balanco-conta">
              <span>${conta.nome_conta}</span>
              <span>${saldoExibicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          `;
          totalGrupo += saldoExibicao;
        });
        
        return { html: htmlContas, total: totalGrupo };
      }
    
      async function gerarBalancoPatrimonial() {
        try {
          const response = await fetch(`${API_URL}/balanco-patrimonial`);
          const relatorio = await response.json();
    
          // Renderiza Lado do Ativo
          const grupoAtivoCirculante = renderizarGrupo(relatorio.ativo.circulante, 'ATIVO CIRCULANTE');
          const grupoAtivoNaoCirculante = renderizarGrupo(relatorio.ativo.naoCirculante, 'ATIVO NÃO CIRCULANTE');
          const totalAtivo = grupoAtivoCirculante.total + grupoAtivoNaoCirculante.total;
          
          ladoAtivoDiv.innerHTML = `
            <div class="balanco-header">ATIVO</div>
            <div class="balanco-grupo">${grupoAtivoCirculante.html}</div>
            <div class="balanco-grupo">${grupoAtivoNaoCirculante.html}</div>
            <div class="balanco-total">
              <span>TOTAL ATIVO</span>
              <span>${totalAtivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          `;
    
          // Renderiza Lado do Passivo e PL
          const grupoPassivoCirculante = renderizarGrupo(relatorio.passivo.circulante, 'PASSIVO CIRCULANTE');
          const grupoPassivoNaoCirculante = renderizarGrupo(relatorio.passivo.naoCirculante, 'PASSIVO NÃO CIRCULANTE');
          const grupoPL = renderizarGrupo(relatorio.patrimonioLiquido, 'PATRIMÔNIO LÍQUIDO');
          const totalPassivoPL = grupoPassivoCirculante.total + grupoPassivoNaoCirculante.total + grupoPL.total;
    
          ladoPassivoPlDiv.innerHTML = `
            <div class="balanco-header">PASSIVO E PATRIMÔNIO LÍQUIDO</div>
            <div class="balanco-grupo">${grupoPassivoCirculante.html}</div>
            <div class="balanco-grupo">${grupoPassivoNaoCirculante.html}</div>
            <div class="balanco-grupo">${grupoPL.html}</div>
            <div class="balanco-total">
              <span>TOTAL PASSIVO + PL</span>
              <span>${totalPassivoPL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          `;
    
        } catch (error) {
          console.error('Erro ao gerar Balanço Patrimonial:', error);
        }
      }
    
      // --- INICIALIZAÇÃO ---
      async function inicializar() {
        menuItems.forEach(item => item.addEventListener('click', () => showPage(item.dataset.page)));
        btnAdicionar.addEventListener('click', toggleModal);
        btnFecharModal.addEventListener('click', toggleModal);
        btnGerarBalanco.addEventListener('click', gerarBalancoPatrimonial);
    
        await carregarContas();
        await popularDropdownsContas();
        await carregarLancamentos();
        showPage('setup');
      }
    
      inicializar();
    });
  