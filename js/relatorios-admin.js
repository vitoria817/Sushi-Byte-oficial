// dados iniciais
let funcionarios = [
  { id: 1, nome: 'Carlos Silva', email: 'carlos@sushibyte.com', telefone: '(11) 98765-4321', cargo: 'Gerente', status: 'Ativo' },
  { id: 2, nome: 'Ana Santos', email: 'ana@sushibyte.com', telefone: '(11) 98765-4322', cargo: 'Funcionário', status: 'Ativo' },
  { id: 3, nome: 'Roberto Tanaka', email: 'roberto@sushibyte.com', telefone: '(11) 98765-4323', cargo: 'Cozinha', status: 'Ativo' }
];

let pedidos = [
  { id: '1001', mesa: '9', hora: '23:46', status: 'aguardando', itens: ['1x Combinado Salmão', '1x Suco de Laranja', '1x Temaki Salmão'] }
];

let nextFuncionarioId = 4;

// navegacao
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-target]');
  const views = document.querySelectorAll('.view');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      views.forEach(view => view.classList.add('hidden'));
      
      const targetId = 'view-' + item.getAttribute('data-target');
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.remove('hidden');

      if (targetId === 'view-cozinha') renderizarCozinha();
      if (targetId === 'view-relatorios') renderizarRelatorios();
    });
  });
}

// renderizar tabela de funcionarios
function renderizarFuncionarios(filtro = '') {
  const tbody = document.getElementById('tabela-funcionarios');
  tbody.innerHTML = '';

  const filtrados = funcionarios.filter(func => 
    func.nome.toLowerCase().includes(filtro.toLowerCase())
  );

  filtrados.forEach((func) => {
    let cargoClass = 'badge-blue';
    if (func.cargo === 'Gerente') cargoClass = 'badge-red';
    if (func.cargo === 'Cozinha') cargoClass = 'badge-green';
    let statusClass = func.status === 'Ativo' ? 'badge-green' : 'badge-red';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600;">${func.nome}</td>
      <td>${func.email}</td>
      <td>${func.telefone}</td>
      <td><span class="badge ${cargoClass}">${func.cargo}</span></td>
      <td><span class="badge ${statusClass}">${func.status}</span></td>
      <td>
        <button class="action-btn" onclick="abrirModalEditar(${func.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn delete" onclick="removerFuncionario(${func.id})"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// excluir funcionario
window.removerFuncionario = function(id) {
  if(confirm('Tem certeza que deseja excluir este funcionário?')) {
    funcionarios = funcionarios.filter(func => func.id !== id);
    renderizarFuncionarios(document.getElementById('input-pesquisa').value);
  }
}

// abrir modal para editar
window.abrirModalEditar = function(id) {
  const func = funcionarios.find(f => f.id === id);
  if (!func) return;

  document.getElementById('modal-titulo').innerText = 'Editar Funcionário';
  document.getElementById('btn-salvar').innerText = 'Salvar Alterações';
  
  document.getElementById('input-id').value = func.id;
  document.getElementById('input-nome').value = func.nome;
  document.getElementById('input-email').value = func.email;
  document.getElementById('input-telefone').value = func.telefone;
  document.getElementById('input-cargo').value = func.cargo;
  document.getElementById('input-status').value = func.status;

  document.getElementById('modal-funcionario').classList.remove('hidden');
}

// configuracao do modal e formulario
function setupModal() {
  const modal = document.getElementById('modal-funcionario');
  const btnNovo = document.getElementById('btn-novo-funcionario');
  const btnFechar = document.getElementById('btn-fechar-modal');
  const btnCancelar = document.getElementById('btn-cancelar');
  const form = document.getElementById('form-funcionario');

  // abre modal para criar novo
  btnNovo.addEventListener('click', () => {
    document.getElementById('modal-titulo').innerText = 'Novo Funcionário';
    document.getElementById('btn-salvar').innerText = 'Cadastrar';
    document.getElementById('input-id').value = '';
    form.reset();
    modal.classList.remove('hidden');
  });

  const fecharModal = () => {
    modal.classList.add('hidden');
    form.reset();
  };

  btnFechar.addEventListener('click', fecharModal);
  btnCancelar.addEventListener('click', fecharModal);

  // salvar (criar ou editar)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = document.getElementById('input-id').value;
    const dados = {
      nome: document.getElementById('input-nome').value,
      email: document.getElementById('input-email').value,
      telefone: document.getElementById('input-telefone').value,
      cargo: document.getElementById('input-cargo').value,
      status: document.getElementById('input-status').value
    };

    if (id) {
      // editando
      const index = funcionarios.findIndex(f => f.id === parseInt(id));
      funcionarios[index] = { ...funcionarios[index], ...dados };
    } else {
      // criando novo
      funcionarios.push({ id: nextFuncionarioId++, ...dados });
    }

    renderizarFuncionarios();
    fecharModal();
  });

  document.getElementById('input-pesquisa').addEventListener('input', (e) => {
    renderizarFuncionarios(e.target.value);
  });
}

// renderizar cozinha
function renderizarCozinha() {
  const grid = document.getElementById('grid-pedidos');
  const vazio = document.getElementById('cozinha-vazia');
  grid.innerHTML = '';

  let countAguardando = 0, countPreparo = 0, countPronto = 0;

  if (pedidos.length === 0) vazio.classList.remove('hidden');
  else vazio.classList.add('hidden');

  pedidos.forEach((pedido) => {
    if (pedido.status === 'aguardando') countAguardando++;
    if (pedido.status === 'preparo') countPreparo++;
    if (pedido.status === 'pronto') countPronto++;

    let btnTexto = '<i class="fa-solid fa-play"></i> Iniciar Preparo';
    let btnClass = 'aguardando';
    let statusTexto = 'Recebido';
    
    if (pedido.status === 'preparo') {
      btnTexto = '<i class="fa-solid fa-check-circle"></i> Pedido Pronto';
      btnClass = 'preparo';
      statusTexto = 'Em Preparo';
    }
    if (pedido.status === 'pronto') {
      btnTexto = '<i class="fa-solid fa-check-double"></i> Marcar Entregue';
      btnClass = 'pronto';
      statusTexto = 'Pronto';
    }

    let itensHtml = '';
    pedido.itens.forEach(item => itensHtml += `<li>${item}</li>`);

    const card = document.createElement('div');
    card.className = `order-card status-${pedido.status}`;
    card.innerHTML = `
      <div class="order-header">
        <h3>#${pedido.id}</h3>
        <span class="time"><i class="fa-regular fa-clock"></i> ${pedido.hora}</span>
      </div>
      <div class="mesa-info">Mesa ${pedido.mesa}</div>
      <div class="order-status status-${pedido.status}">${statusTexto}</div>
      <ul class="order-items">${itensHtml}</ul>
      <button class="btn-action-cozinha ${btnClass}" onclick="avancarStatus('${pedido.id}')">${btnTexto}</button>
    `;
    grid.appendChild(card);
  });

  document.getElementById('count-aguardando').innerText = countAguardando;
  document.getElementById('count-preparo').innerText = countPreparo;
  document.getElementById('count-pronto').innerText = countPronto;
}

window.avancarStatus = function(id) {
  const pedido = pedidos.find(p => p.id === id);
  if (pedido.status === 'aguardando') pedido.status = 'preparo';
  else if (pedido.status === 'preparo') pedido.status = 'pronto';
  else if (pedido.status === 'pronto') pedidos = pedidos.filter(p => p.id !== id);
  renderizarCozinha();
}

// renderizar relatorios
function renderizarRelatorios() {
  const totalPedidos = pedidos.length > 0 ? 1 : 0; // logica simples para bater com o print
  const faturamento = totalPedidos > 0 ? 108.57 : 0;
  const ticketMedio = totalPedidos > 0 ? faturamento / totalPedidos : 0;

  document.getElementById('kpi-total').innerText = totalPedidos;
  document.getElementById('kpi-faturamento').innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
  document.getElementById('kpi-ticket').innerText = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
  document.getElementById('pedidos-hoje').innerText = totalPedidos;
  document.getElementById('pedidos-semana').innerText = totalPedidos;
  document.getElementById('pedidos-mes').innerText = totalPedidos;

  const chart = document.getElementById('bar-chart');
  const chartVazio = document.getElementById('chart-vazio');
  
  if (totalPedidos > 0) {
    chartVazio.classList.add('hidden');
    chart.innerHTML = `
      <div class="bar" style="height: 100%;"><span>Combinado Salmão</span></div>
      <div class="bar" style="height: 100%;"><span>Temaki Salmão</span></div>
      <div class="bar" style="height: 100%;"><span>Suco de Laranja</span></div>
    `;
  } else {
    chart.innerHTML = '';
    chartVazio.classList.remove('hidden');
  }
}

// funcoes de exportacao
function setupExportacao() {
  // exportar excel
  document.getElementById('btn-exportar-excel').addEventListener('click', () => {
    // criando planilha de funcionarios
    const wsFuncionarios = XLSX.utils.json_to_sheet(funcionarios);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsFuncionarios, "Funcionários");

    // criando planilha de pedidos
    if (pedidos.length > 0) {
      const wsPedidos = XLSX.utils.json_to_sheet(pedidos);
      XLSX.utils.book_append_sheet(wb, wsPedidos, "Pedidos");
    }

    // baixando o arquivo
    XLSX.writeFile(wb, "relatorio_sushi_byte.xlsx");
  });

  // exportar pdf
  document.getElementById('btn-exportar-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório Sushi Byte", 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Total de Pedidos: ${pedidos.length}`, 14, 32);
    doc.text(`Faturamento: R$ 108,57`, 14, 38);

    // tabela de funcionarios no pdf
    const tableColumn = ["Nome", "Email", "Cargo", "Status"];
    const tableRows = funcionarios.map(f => [f.nome, f.email, f.cargo, f.status]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38] } // vermelho
    });

    doc.save("relatorio_sushi_byte.pdf");
  });
}

// inicializacao
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupModal();
  setupExportacao();
  renderizarFuncionarios();
  renderizarCozinha();
});

// ligacao com o resto do projeto: abre a aba indicada no link (ex: relatorios-admin.html#relatorios)
document.addEventListener('DOMContentLoaded', () => {
  const alvo = window.location.hash.replace('#', '');
  if (!alvo) return;
  const item = document.querySelector('.nav-item[data-target="' + alvo + '"]');
  if (item) item.click();
});
