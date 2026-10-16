const numeroPedidoModal = document.getElementById("numeroPedidoModal");
const statusPedidoModal = document.getElementById("statusPedidoModal");
const totalPedidoModal = document.getElementById("totalPedidoModal");
const fecharModal = document.getElementById("fecharModal");
const sairTrocarMesa = document.getElementById("sairTrocarMesa");

const parametros = new URLSearchParams(window.location.search);
const pedidoId = parametros.get("pedido");

if (pedidoId) {
    fetch("http://localhost:3000/pedidos/" + pedidoId)
        .then(resposta => resposta.json())
        .then(dados => {
            if (dados.sucesso) {
                numeroPedidoModal.textContent = "#" + dados.pedido.id;
                statusPedidoModal.textContent = dados.pedido.status;
                totalPedidoModal.textContent = "R$ " + Number(dados.pedido.total).toFixed(2);
            }
        });
}

fecharModal.addEventListener("click", function () {
    window.location.href = "cardapio.html";
});

sairTrocarMesa.addEventListener("click", function () {
    localStorage.removeItem("clienteId");
    localStorage.removeItem("carrinho");
    window.location.href = "cadastroCliente.html";
});