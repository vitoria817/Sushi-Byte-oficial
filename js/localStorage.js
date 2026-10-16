function pegarCarrinho() {
    const dados = localStorage.getItem("carrinho");
    return dados ? JSON.parse(dados) : [];
}

function salvarCarrinho(carrinho) {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}