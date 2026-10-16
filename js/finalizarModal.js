const fundoModalFinalizar = document.getElementById("fundoModalFinalizar");
const fecharModalFinalizar = document.getElementById("fecharModalFinalizar");
const continuarComprandoModal = document.getElementById("continuarComprandoModal");
const sairTrocarMesaModal = document.getElementById("sairTrocarMesaModal");
const linkFinalizar = document.querySelector('a[href="finalizar.html"]');

if (linkFinalizar) {
    linkFinalizar.addEventListener("click", function (evento) {
        evento.preventDefault();
        abrirModalFinalizar();
    });
}

function abrirModalFinalizar() {
    const pedidoIdAberto = localStorage.getItem("ultimoPedidoId");

    if (!pedidoIdAberto) {
        alert("Nenhum pedido em andamento");
        return;
    }

    fetch("http://localhost:3000/pedidos/" + pedidoIdAberto)
        .then(resposta => resposta.json())
        .then(dados => {
            if (dados.sucesso) {
                document.getElementById("numeroPedidoModal").textContent = "#" + dados.pedido.id;
                document.getElementById("statusPedidoModal").textContent = dados.pedido.status;
                document.getElementById("totalPedidoModal").textContent = "R$ " + Number(dados.pedido.total).toFixed(2);
                fundoModalFinalizar.style.display = "flex";
            }
        });
}

fecharModalFinalizar.addEventListener("click", function () {
    fundoModalFinalizar.style.display = "none";
});

continuarComprandoModal.addEventListener("click", function () {
    fundoModalFinalizar.style.display = "none";
});

sairTrocarMesaModal.addEventListener("click", function () {
    localStorage.removeItem("clienteId");
    localStorage.removeItem("carrinho");
    localStorage.removeItem("ultimoPedidoId");
    window.location.href = "cadastroCliente.html";
});