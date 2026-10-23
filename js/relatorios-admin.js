const API = 'http://localhost:3000';

// Funcionários e pedidos da cozinha vêm do banco
let funcionarios = [];
let pedidos = [];

// Último resumo carregado dos relatórios
let resumo = null;

// Nomes bonitos para o que está gravado no banco
const nomeCargo = { gerente: 'Gerente', funcionario: 'Funcionário', cozinha: 'Cozinha' };
const nomeStatus = { ativo: 'Ativo', inativo: 'Inativo' };

// Status do banco -> nome que o visual da cozinha usa
const statusDaTela = { recebido: 'aguardando', em_preparo: 'preparo', pronto: 'pronto' };

// Qual é o próximo status de cada pedido
const proximoStatus = { recebido: 'em_preparo', em_preparo: 'pronto', pronto: 'entregue' };

// Evita injetar HTML vindo do banco na tela
function escaparHTML(valor) {
  const troca = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valor ?? '').replace(/[&<>"']/g, caractere => troca[caractere]);
}

function moeda(valor) {
  return 'R$ ' + Number(valor || 0).toFixed(2).replace('.', ',');
}

// Faz a chamada ao servidor e devolve os dados (ou lança o erro com a mensagem dele)
async function chamarApi(caminho, opcoes) {
  const resposta = await fetch(API + caminho, opcoes);
  const dados = await resposta.json();

  if (!resposta.ok || !dados.sucesso) {
    throw new Error(dados.erro || 'Erro ao falar com o servidor.');
  }
  return dados;
}

function enviarJson(metodo, corpo) {
  return {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  };
}

// ---------- Navegação ----------

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

      if (targetId === 'view-funcionarios') carregarFuncionarios();
      if (targetId === 'view-cozinha') carregarPedidos();
      if (targetId === 'view-relatorios') renderizarRelatorios();
    });
  });
}

// ---------- Funcionários (banco de dados) ----------

async function carregarFuncionarios() {
  try {
    const dados = await chamarApi('/admin/funcionarios');
    funcionarios = dados.funcionarios;
    renderizarFuncionarios(document.getElementById('input-pesquisa').value);
  } catch (erro) {
    console.error('Erro ao carregar funcionários:', erro);
  }
}

function renderizarFuncionarios(filtro = '') {
  const tbody = document.getElementById('tabela-funcionarios');
  tbody.innerHTML = '';

  const filtrados = funcionarios.filter(func =>
    func.nome.toLowerCase().includes(filtro.toLowerCase())
  );

  filtrados.forEach((func) => {
    const cargo = String(func.cargo).toLowerCase();

    let cargoClass = 'badge-blue';
    if (cargo === 'gerente') cargoClass = 'badge-red';
    if (cargo === 'cozinha') cargoClass = 'badge-green';
    const statusClass = func.status === 'ativo' ? 'badge-green' : 'badge-red';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600;">${escaparHTML(func.nome)}</td>
      <td>${escaparHTML(func.email)}</td>
      <td>${escaparHTML(func.telefone || '—')}</td>
      <td><span class="badge ${cargoClass}">${escaparHTML(nomeCargo[cargo] || func.cargo)}</span></td>
      <td><span class="badge ${statusClass}">${escaparHTML(nomeStatus[func.status] || func.status)}</span></td>
      <td>
        <button class="action-btn" onclick="abrirModalEditar(${func.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn delete" onclick="removerFuncionario(${func.id})"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px;">Nenhum funcionário encontrado.</td></tr>';
  }
}

window.removerFuncionario = async function (id) {
  if (!confirm('Tem certeza que deseja excluir este funcionário?')) return;

  try {
    await chamarApi('/admin/funcionarios/' + id, { method: 'DELETE' });
    await carregarFuncionarios();
  } catch (erro) {
    alert(erro.message);
  }
};

window.abrirModalEditar = function (id) {
  const func = funcionarios.find(f => f.id === id);
  if (!func) return;

  document.getElementById('modal-titulo').innerText = 'Editar Funcionário';
  document.getElementById('btn-salvar').innerText = 'Salvar Alterações';
  document.getElementById('erro-funcionario').innerText = '';

  document.getElementById('input-id').value = func.id;
  document.getElementById('input-nome').value = func.nome;
  document.getElementById('input-email').value = func.email;
  document.getElementById('input-telefone').value = func.telefone || '';
  document.getElementById('input-cargo').value = String(func.cargo).toLowerCase();
  document.getElementById('input-status').value = func.status;

  // na edição a senha é opcional: em branco mantém a atual
  const campoSenha = document.getElementById('input-senha');
  campoSenha.value = '';
  campoSenha.required = false;
  campoSenha.placeholder = 'Deixe em branco para manter a senha atual';

  document.getElementById('modal-funcionario').classList.remove('hidden');
};

function setupModal() {
  const modal = document.getElementById('modal-funcionario');
  const btnNovo = document.getElementById('btn-novo-funcionario');
  const btnFechar = document.getElementById('btn-fechar-modal');
  const btnCancelar = document.getElementById('btn-cancelar');
  const form = document.getElementById('form-funcionario');
  const campoSenha = document.getElementById('input-senha');
  const aviso = document.getElementById('erro-funcionario');

  btnNovo.addEventListener('click', () => {
    document.getElementById('modal-titulo').innerText = 'Novo Funcionário';
    document.getElementById('btn-salvar').innerText = 'Cadastrar';
    document.getElementById('input-id').value = '';
    form.reset();
    aviso.innerText = '';

    // no cadastro a senha é obrigatória
    campoSenha.required = true;
    campoSenha.placeholder = 'Senha de acesso';

    modal.classList.remove('hidden');
  });

  const fecharModal = () => {
    modal.classList.add('hidden');
    form.reset();
    aviso.innerText = '';
  };

  btnFechar.addEventListener('click', fecharModal);
  btnCancelar.addEventListener('click', fecharModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('input-id').value;
    const dados = {
      nome: document.getElementById('input-nome').value,
      email: document.getElementById('input-email').value,
      senha: campoSenha.value,
      telefone: document.getElementById('input-telefone').value,
      cargo: document.getElementById('input-cargo').value,
      status: document.getElementById('input-status').value
    };

    try {
      if (id) await chamarApi('/admin/funcionarios/' + id, enviarJson('PUT', dados));
      else await chamarApi('/admin/funcionarios', enviarJson('POST', dados));

      fecharModal();
      await carregarFuncionarios();
    } catch (erro) {
      aviso.innerText = erro.message;
    }
  });

  document.getElementById('input-pesquisa').addEventListener('input', (e) => {
    renderizarFuncionarios(e.target.value);
  });
}

// ---------- Cozinha (pedidos reais do banco) ----------

async function carregarPedidos() {
  try {
    const dados = await chamarApi('/admin/pedidos/cozinha');

    pedidos = dados.pedidos.map(pedido => ({
      id: pedido.id,
      mesa: pedido.mesa,
      status: pedido.status,
      hora: new Date(pedido.data_pedido).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      itens: pedido.itens
    }));

    renderizarCozinha();
  } catch (erro) {
    console.error('Erro ao carregar pedidos da cozinha:', erro);
  }
}

function renderizarCozinha() {
  const grid = document.getElementById('grid-pedidos');
  const vazio = document.getElementById('cozinha-vazia');
  grid.innerHTML = '';

  let countAguardando = 0, countPreparo = 0, countPronto = 0;

  if (pedidos.length === 0) vazio.classList.remove('hidden');
  else vazio.classList.add('hidden');

  pedidos.forEach((pedido) => {
    const statusTela = statusDaTela[pedido.status];

    if (statusTela === 'aguardando') countAguardando++;
    if (statusTela === 'preparo') countPreparo++;
    if (statusTela === 'pronto') countPronto++;

    let btnTexto = '<i class="fa-solid fa-play"></i> Iniciar Preparo';
    let btnClass = 'aguardando';
    let statusTexto = 'Recebido';

    if (statusTela === 'preparo') {
      btnTexto = '<i class="fa-solid fa-check-circle"></i> Pedido Pronto';
      btnClass = 'preparo';
      statusTexto = 'Em Preparo';
    }
    if (statusTela === 'pronto') {
      btnTexto = '<i class="fa-solid fa-check-double"></i> Marcar Entregue';
      btnClass = 'pronto';
      statusTexto = 'Pronto';
    }

    let itensHtml = '';
    pedido.itens.forEach(item => itensHtml += `<li>${escaparHTML(item)}</li>`);

    const card = document.createElement('div');
    card.className = `order-card status-${statusTela}`;
    card.innerHTML = `
      <div class="order-header">
        <h3>#${pedido.id}</h3>
        <span class="time"><i class="fa-regular fa-clock"></i> ${pedido.hora}</span>
      </div>
      <div class="mesa-info">Mesa ${pedido.mesa}</div>
      <div class="order-status status-${statusTela}">${statusTexto}</div>
      <ul class="order-items">${itensHtml}</ul>
      <button class="btn-action-cozinha ${btnClass}" onclick="avancarStatus(${pedido.id})">${btnTexto}</button>
    `;
    grid.appendChild(card);
  });

  document.getElementById('count-aguardando').innerText = countAguardando;
  document.getElementById('count-preparo').innerText = countPreparo;
  document.getElementById('count-pronto').innerText = countPronto;
}

// Passa o pedido para a próxima etapa e grava no banco
window.avancarStatus = async function (id) {
  const pedido = pedidos.find(p => p.id === id);
  if (!pedido) return;

  const novoStatus = proximoStatus[pedido.status];

  try {
    await chamarApi('/admin/pedidos/' + id + '/status', enviarJson('PATCH', { status: novoStatus }));
    await carregarPedidos();
  } catch (erro) {
    console.error('Erro ao avançar status:', erro);
    alert('Erro ao atualizar o pedido: ' + erro.message);
  }
};

// ---------- Relatórios (dados reais do banco) ----------

async function carregarResumo() {
  resumo = await chamarApi('/admin/relatorios');
}

async function renderizarRelatorios() {
  try {
    await carregarResumo();
  } catch (erro) {
    console.error('Erro ao carregar relatórios:', erro);
    return;
  }

  document.getElementById('kpi-total').innerText = resumo.total_pedidos;
  document.getElementById('kpi-faturamento').innerText = moeda(resumo.faturamento);
  document.getElementById('kpi-ticket').innerText = moeda(resumo.ticket_medio);
  document.getElementById('pedidos-hoje').innerText = resumo.pedidos_hoje;
  document.getElementById('pedidos-semana').innerText = resumo.pedidos_semana;
  document.getElementById('pedidos-mes').innerText = resumo.pedidos_mes;

  // Formas de pagamento registradas no caixa
  const pagamentos = resumo.pagamentos || {};
  document.getElementById('pag-pix').innerText = pagamentos.pix || 0;
  document.getElementById('pag-credito').innerText = pagamentos.credito || 0;
  document.getElementById('pag-debito').innerText = pagamentos.debito || 0;
  document.getElementById('pag-dinheiro').innerText = pagamentos.dinheiro || 0;

  const chart = document.getElementById('bar-chart');
  const chartVazio = document.getElementById('chart-vazio');

  if (resumo.produtos.length === 0) {
    chart.innerHTML = '';
    chartVazio.classList.remove('hidden');
    return;
  }

  chartVazio.classList.add('hidden');

  // A barra maior tem 100% de altura, as outras ficam proporcionais
  const maior = Math.max(...resumo.produtos.map(p => p.quantidade));

  chart.innerHTML = resumo.produtos.map(produto => {
    const altura = Math.max(8, (produto.quantidade / maior) * 100);
    return `<div class="bar" style="height: ${altura}%;" title="${produto.quantidade} vendido(s)"><span>${escaparHTML(produto.nome)}</span></div>`;
  }).join('');
}

// ---------- Exportação ----------

function setupExportacao() {
  document.getElementById('btn-exportar-excel').addEventListener('click', async () => {
    await carregarResumo();
    await carregarFuncionarios();

    const pagamentos = resumo.pagamentos || {};
    const wb = XLSX.utils.book_new();

    const resumoLinhas = [{
      'Total de pedidos': resumo.total_pedidos,
      'Faturamento (R$)': resumo.faturamento,
      'Ticket médio (R$)': resumo.ticket_medio,
      'Pedidos hoje': resumo.pedidos_hoje,
      'Pedidos na semana': resumo.pedidos_semana,
      'Pedidos no mês': resumo.pedidos_mes,
      'Pagos em PIX': pagamentos.pix || 0,
      'Pagos no crédito': pagamentos.credito || 0,
      'Pagos no débito': pagamentos.debito || 0,
      'Pagos em dinheiro': pagamentos.dinheiro || 0
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoLinhas), 'Resumo');

    const maisVendidos = resumo.produtos.map(p => ({ Produto: p.nome, 'Quantidade vendida': p.quantidade }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(maisVendidos), 'Mais vendidos');

    // a senha nunca vai para o arquivo
    const listaFuncionarios = funcionarios.map(f => ({
      Nome: f.nome,
      Email: f.email,
      Telefone: f.telefone || '',
      Cargo: nomeCargo[String(f.cargo).toLowerCase()] || f.cargo,
      Status: nomeStatus[f.status] || f.status
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(listaFuncionarios), 'Funcionários');

    XLSX.writeFile(wb, 'relatorio_sushi_byte.xlsx');
  });

  document.getElementById('btn-exportar-pdf').addEventListener('click', async () => {
    await carregarResumo();

    const pagamentos = resumo.pagamentos || {};
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Relatório Sushi Byte', 14, 22);

    doc.setFontSize(11);
    doc.text(`Total de Pedidos: ${resumo.total_pedidos}`, 14, 32);
    doc.text(`Faturamento: ${moeda(resumo.faturamento)}`, 14, 38);
    doc.text(`Ticket médio: ${moeda(resumo.ticket_medio)}`, 14, 44);
    doc.text(
      `Pagamentos - PIX: ${pagamentos.pix || 0} | Crédito: ${pagamentos.credito || 0} | ` +
      `Débito: ${pagamentos.debito || 0} | Dinheiro: ${pagamentos.dinheiro || 0}`,
      14, 50
    );

    doc.autoTable({
      head: [['Produto', 'Quantidade vendida']],
      body: resumo.produtos.map(p => [p.nome, p.quantidade]),
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38] } // vermelho
    });

    doc.save('relatorio_sushi_byte.pdf');
  });
}

// ---------- Inicialização ----------

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupModal();
  setupExportacao();
  carregarFuncionarios();
  carregarPedidos();

  // A cozinha atualiza sozinha a cada 10 segundos
  setInterval(carregarPedidos, 10000);

  // Abre a aba indicada no link (ex: relatorios-admin.html#relatorios)
  const alvo = window.location.hash.replace('#', '');
  if (!alvo) return;
  const item = document.querySelector('.nav-item[data-target="' + alvo + '"]');
  if (item) item.click();
});