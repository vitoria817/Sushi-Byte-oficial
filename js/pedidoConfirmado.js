const parametros = new URLSearchParams(window.location.search);
const pedidoId = parametros.get("pedido");

const numeroPedidoConfirmado = document.getElementById("numeroPedidoConfirmado");
const tempoEstimadoConfirmado = document.getElementById("tempoEstimadoConfirmado");
const acompanharPedidoBotao = document.getElementById("acompanharPedidoBotao");

fetch("http://localhost:3000/pedidos/" + pedidoId)
    .then(resposta => resposta.json())
    .then(dados => {
        if (dados.sucesso) {
            numeroPedidoConfirmado.textContent = "#" + dados.pedido.id;
            tempoEstimadoConfirmado.innerHTML = `<i class="fas fa-clock"></i> Tempo estimado: ${dados.pedido.tempo_estimado_min}-${dados.pedido.tempo_estimado_max} min`;
        }
    });

acompanharPedidoBotao.href = "acompanhar-pedido.html?pedido=" + pedidoId;