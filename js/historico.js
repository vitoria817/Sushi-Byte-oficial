const listaHistorico = document.getElementById("listaHistorico");
const semPedidos = document.getElementById("semPedidos");
const clienteId = localStorage.getItem("clienteId");

function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString("pt-BR") + " às " + data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function desenharEstrelas(nota) {
    let estrelas = "";
    for (let i = 1; i <= 5; i++) {
        estrelas += i <= nota ? "★" : "☆";
    }
    return estrelas;
}

fetch("http://localhost:3000/clientes/" + clienteId + "/historico")
    .then(resposta => resposta.json())
    .then(dados => {
        if (!dados.sucesso || dados.pedidos.length === 0) {
            semPedidos.style.display = "block";
            return;
        }

        dados.pedidos.forEach(function (pedido) {
            const card = document.createElement("div");
            card.className = "cardPedido";

            let linhasItens = "";
            pedido.itens.forEach(function (item) {
                linhasItens += `
                    <div class="linhaItemPedido">
                        <span>${item.nome} × ${item.quantidade}</span>
                        <span>R$ ${(item.preco_unitario * item.quantidade).toFixed(2)}</span>
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="cabecalhoPedido">
                    <span class="numeroPedido">#${pedido.id}</span>
                    <span class="statusPedido">${pedido.status}</span>
                </div>
                <p class="dataPedido"><i class="fas fa-clock"></i> ${formatarData(pedido.data_pedido)}</p>
                ${linhasItens}
                <div class="rodapePedido">
                    <span class="estrelasPedido">${pedido.nota ? desenharEstrelas(pedido.nota) : ""}</span>
                    <span class="totalPedido">R$ ${Number(pedido.total).toFixed(2)}</span>
                </div>
            `;
            listaHistorico.appendChild(card);
        });
    });