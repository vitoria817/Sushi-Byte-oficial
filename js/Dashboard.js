const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : window.location.origin;
let produtosChart = null;
let pedidosHoraChart = null;

const moeda = valor => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
}).format(Number(valor) || 0);

function mostrarMensagem(texto) {
  const el = document.getElementById("mensagem");
  el.textContent = texto;
  el.classList.add("visible");
}

function esconderMensagem() {
  document.getElementById("mensagem").classList.remove("visible");
}

async function buscarJSON(caminho) {
  const resposta = await fetch(`${API_BASE}${caminho}`);
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok || dados.sucesso === false) {
    throw new Error(dados.erro || `Falha ao consultar ${caminho}`);
  }
  return dados;
}

async function carregarResumo() {
  const dados = await buscarJSON("/dashboard/resumo");
  document.getElementById("faturamento").textContent = moeda(dados.faturamento_dia);
  document.getElementById("pedidos").textContent = Number(dados.pedidos_dia || 0).toLocaleString("pt-BR");
  document.getElementById("ticketMedio").textContent = moeda(dados.ticket_medio);
}

async function carregarProdutos() {
  const dados = await buscarJSON("/dashboard/produtos-mais-vendidos");
  const produtos = dados.produtos || [];
  const canvas = document.getElementById("produtosChart");
  document.getElementById("semProdutos").hidden = produtos.length > 0;
  canvas.style.display = produtos.length ? "block" : "none";

  if (produtosChart) produtosChart.destroy();
  if (!produtos.length) return;

  produtosChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: produtos.map(p => p.nome),
      datasets: [{
        label: "Unidades vendidas",
        data: produtos.map(p => Number(p.quantidade_vendida) || 0),
        backgroundColor: ["#ff6947", "#ff936f", "#e9a58d", "#bd8b78", "#8b6d66"],
        borderRadius: 7,
        maxBarThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.x} unidade(s)` } }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: "#9aa8bd" },
          grid: { color: "rgba(154,168,189,.12)" },
          border: { display: false }
        },
        y: {
          ticks: { color: "#d9e0ea", font: { size: 11 } },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });
}

async function carregarPedidosPorHora() {
  const dados = await buscarJSON("/dashboard/pedidos-por-hora");
  const registros = dados.pedidos || [];
  const labels = Array.from({ length: 24 }, (_, hora) => `${String(hora).padStart(2, "0")}h`);
  const porHora = new Array(24).fill(0);
  registros.forEach(item => {
    const hora = Number(item.hora);
    if (Number.isInteger(hora) && hora >= 0 && hora <= 23) porHora[hora] = Number(item.quantidade) || 0;
  });

  const canvas = document.getElementById("pedidosHoraChart");
  const total = porHora.reduce((soma, valor) => soma + valor, 0);
  document.getElementById("semPedidosHora").hidden = total > 0;
  canvas.style.display = total ? "block" : "none";
  if (pedidosHoraChart) pedidosHoraChart.destroy();
  if (!total) return;

  pedidosHoraChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Pedidos",
        data: porHora,
        backgroundColor: "rgba(255, 105, 71, .78)",
        borderColor: "#ff6947",
        borderWidth: 1,
        borderRadius: 5,
        maxBarThickness: 24
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} pedido(s)` } }
      },
      scales: {
        x: { ticks: { color: "#9aa8bd", maxRotation: 0, autoSkip: true }, grid: { display: false }, border: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0, color: "#9aa8bd" }, grid: { color: "rgba(154,168,189,.12)" }, border: { display: false } }
      }
    }
  });
}

async function carregarEstoque() {
  const dados = await buscarJSON("/dashboard/estoque-baixo");
  const itens = dados.itens || [];
  document.getElementById("totalEstoqueBaixo").textContent = itens.length.toLocaleString("pt-BR");
  document.getElementById("contadorAlertas").textContent = itens.length;

  const lista = document.getElementById("listaEstoque");
  if (!itens.length) {
    lista.innerHTML = '<div class="empty-state">Nenhum ingrediente abaixo do mínimo. Tudo certo!</div>';
    return;
  }

  lista.innerHTML = itens.map(item => {
    const quantidade = Number(item.quantidade);
    const minimo = Number(item.quantidade_minima);
    return `<div class="stock-item">
      <div>
        <span class="stock-name">${escaparHTML(item.nome)}</span>
        <span class="stock-quantity">Atual: ${formatarQuantidade(quantidade)} · Mínimo: ${formatarQuantidade(minimo)}</span>
      </div>
      <span class="stock-badge">Estoque baixo</span>
    </div>`;
  }).join("");
}

function formatarQuantidade(valor) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(valor);
}

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[caractere]);
}

async function carregarDashboard() {
  esconderMensagem();
  document.getElementById("atualizarBtn").disabled = true;
  try {
    const resultados = await Promise.allSettled([
      carregarResumo(),
      carregarProdutos(),
      carregarEstoque(),
      carregarPedidosPorHora()
    ]);
    const falhas = resultados.filter(r => r.status === "rejected");
    if (falhas.length) {
      console.error("Falha ao atualizar dashboard:", falhas.map(f => f.reason));
      mostrarMensagem("Algumas informações não carregaram. Confira se o servidor está rodando e tente atualizar.");
    }
  } catch (erro) {
    console.error(erro);
    mostrarMensagem("Não foi possível carregar o dashboard. Confira a conexão com o servidor.");
  } finally {
    document.getElementById("atualizarBtn").disabled = false;
  }
}

function configurarAcesso() {
  const cargo = sessionStorage.getItem("usuarioCargo");
  if (cargo !== "gerente") {
    alert("Acesso permitido somente para gerente. Faça login novamente.");
    window.location.replace("cadastroAdministrativo.html");
    return false;
  }

  const nome = sessionStorage.getItem("usuarioNome") || "Gerente";
  document.getElementById("nomeGerente").textContent = nome;
  document.querySelector(".user-avatar").textContent = nome.trim().charAt(0).toUpperCase() || "G";

  document.getElementById("sairBtn").addEventListener("click", () => {
    sessionStorage.removeItem("usuarioNome");
    sessionStorage.removeItem("usuarioCargo");
    window.location.href = "selecao-acesso.html";
  });

  document.getElementById("atualizarBtn").addEventListener("click", carregarDashboard);

  document.querySelectorAll(".future-link").forEach(botao => {
    botao.addEventListener("click", () => {
      const pagina = botao.dataset.page;
      mostrarMensagem(`A tela de ${pagina} ainda precisa ser integrada ao projeto.`);
    });
  });

  const agora = new Date();
  document.getElementById("dataAtual").textContent = agora.toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric"
  });
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  if (configurarAcesso()) carregarDashboard();
});
