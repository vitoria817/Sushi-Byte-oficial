const parametros = new URLSearchParams(window.location.search);
const pedidoId = parametros.get("pedido");

const numeroPedidoValor = document.getElementById("numeroPedidoValor");
const tempoEstimado = document.getElementById("tempoEstimado");
const timelineStatus = document.getElementById("timelineStatus");
const botoesFinaisAcompanhar = document.getElementById("botoesFinaisAcompanhar");

const etapas = [
    { chave: "recebido", titulo: "Pedido recebido", descricao: "Seu pedido foi recebido pelo funcionário" },
    { chave: "em_preparo", titulo: "Em preparo", descricao: "Sendo preparado na cozinha" },
    { chave: "pronto", titulo: "Pronto", descricao: "Pedido pronto, a caminho da mesa" },
    { chave: "entregue", titulo: "Entregue", descricao: "Pedido chegou na sua mesa — bom apetite!" },
    { chave: "conta_fechada", titulo: "Conta fechada", descricao: "Pagamento confirmado. Obrigado pela visita!" }
];

function buscarStatus() {
    fetch("http://localhost:3000/pedidos/" + pedidoId)
        .then(resposta => resposta.json())
        .then(dados => {
            if (!dados.sucesso) return;

            numeroPedidoValor.textContent = dados.pedido.id;
            tempoEstimado.textContent = "Tempo estimado: " + dados.pedido.tempo_estimado_min + "-" + dados.pedido.tempo_estimado_max + " min";
            desenharTimeline(dados.pedido.status);

            if (dados.pedido.status === "conta_fechada") {
                botoesFinaisAcompanhar.style.display = "block";
            } else {
                botoesFinaisAcompanhar.style.display = "none";
            }
        });
}

function desenharTimeline(statusAtual) {
    const indiceAtual = etapas.findIndex(function (etapa) {
        return etapa.chave === statusAtual;
    });

    timelineStatus.innerHTML = "";

    etapas.forEach(function (etapa, indice) {
        const linha = document.createElement("div");
        linha.className = "etapaTimeline";
        if (indice < indiceAtual) linha.classList.add("concluida");
        if (indice === indiceAtual) linha.classList.add("atual");
        linha.innerHTML = `
            <p class="tituloEtapa">${etapa.titulo}</p>
            <p class="descricaoEtapa">${etapa.descricao}</p>
        `;
        timelineStatus.appendChild(linha);
    });
}

buscarStatus();
setInterval(buscarStatus, 5000);