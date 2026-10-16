const listaDoCarrinho = document.getElementById("listaDoCarrinho");
const subtotalValor = document.getElementById("subtotalValor");
const taxaValor = document.getElementById("taxaValor");
const totalValor = document.getElementById("totalValor");
const botaoEnviarCozinha = document.getElementById("enviarCozinha");

function renderizarCarrinho() {
    const carrinho = pegarCarrinho();
    listaDoCarrinho.innerHTML = "";

    let subtotal = 0;

    carrinho.forEach(function (item) {
        subtotal += item.preco * item.quantidade;

        const linha = document.createElement("div");
        linha.className = "itemCarrinho";
        linha.innerHTML = `
            <div class="miniaturaProduto">🍱</div>
            <div class="infoProduto">
                <p class="nomeProduto">${item.nome}</p>
                <p class="precoProduto">R$ ${item.preco.toFixed(2)}</p>
            </div>
            <div class="controleQuantidade">
                <button class="diminuir" data-id="${item.id}">-</button>
                <span>${item.quantidade}</span>
                <button class="aumentar" data-id="${item.id}">+</button>
                <button class="excluir" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        listaDoCarrinho.appendChild(linha);
    });

    const taxa = subtotal * 0.10;
    const total = subtotal + taxa;

    subtotalValor.textContent = "R$ " + subtotal.toFixed(2);
    taxaValor.textContent = "R$ " + taxa.toFixed(2);
    totalValor.textContent = "R$ " + total.toFixed(2);

    document.querySelectorAll(".aumentar").forEach(function (botao) {
        botao.addEventListener("click", function () {
            alterarQuantidade(Number(botao.dataset.id), 1);
        });
    });

    document.querySelectorAll(".diminuir").forEach(function (botao) {
        botao.addEventListener("click", function () {
            alterarQuantidade(Number(botao.dataset.id), -1);
        });
    });

    document.querySelectorAll(".excluir").forEach(function (botao) {
        botao.addEventListener("click", function () {
            removerItem(Number(botao.dataset.id));
        });
    });
}

function alterarQuantidade(id, diferenca) {
    let carrinho = pegarCarrinho();

    const item = carrinho.find(function (item) {
        return item.id === id;
    });

    item.quantidade += diferenca;

    if (item.quantidade <= 0) {
        carrinho = carrinho.filter(function (item) {
            return item.id !== id;
        });
    }

    salvarCarrinho(carrinho);
    renderizarCarrinho();
}

function removerItem(id) {
    let carrinho = pegarCarrinho();
    carrinho = carrinho.filter(function (item) {
        return item.id !== id;
    });
    salvarCarrinho(carrinho);
    renderizarCarrinho();
}

botaoEnviarCozinha.addEventListener("click", function () {
    const carrinho = pegarCarrinho();

    if (carrinho.length === 0) {
        alert("Seu carrinho está vazio");
        return;
    }

    const clienteId = localStorage.getItem("clienteId");

    let subtotal = 0;
    carrinho.forEach(function (item) {
        subtotal += item.preco * item.quantidade;
    });
    const taxaServico = subtotal * 0.10;
    const total = subtotal + taxaServico;

    fetch("http://localhost:3000/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, itens: carrinho, subtotal, taxaServico, total })
    })
    .then(resposta => resposta.json())
    .then(dados => {
        if (dados.sucesso) {
            localStorage.removeItem("carrinho");
            localStorage.setItem("ultimoPedidoId", dados.pedidoId);
            window.location.href = "pedido-confirmado.html?pedido=" + dados.pedidoId;
        } else {
            alert("Erro ao enviar pedido: " + dados.erro);
        }
    })
    .catch(erro => alert("Não foi possível conectar ao servidor"));
});

renderizarCarrinho();