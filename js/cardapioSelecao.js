// Cardápio: este arquivo serve a tela do administrador e a tela do cliente.
// Se a página tem o botão "+ Novo produto", é o administrador.

let produtos = [];

const API_CARDAPIO = "http://localhost:3000";

const listaDeProdutos = document.getElementById("listaDeProdutos");
const campoBusca = document.getElementById("BuscarItem");
const botoesCategoria = document.querySelectorAll(".opcoesDoCardapio button");

let categoriaAtual = "combinados";
let textoBuscaAtual = "";

const modoAdmin = document.getElementById("botaoNovoProduto") !== null;


// ========================================
// NORMALIZAR CATEGORIAS
// ========================================

function normalizarCategoria(categoria) {
    const nome = categoria
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const categorias = {
        "combinado": "combinados",
        "combinados": "combinados",

        "sushi": "sushi",
        "sushis": "sushi",

        "temaki": "temakis",
        "temakis": "temakis",

        "bebida": "bebidas",
        "bebidas": "bebidas",

        "bandeja": "bandejas",
        "bandejas": "bandejas",

        "sashimi": "sashimi",
        "sashimis": "sashimi"
    };

    return categorias[nome] || nome;
}


// ========================================
// ADICIONAR AO CARRINHO (cliente)
// ========================================

function adicionarAoCarrinho(produto) {
    const carrinho = pegarCarrinho();

    const itemExistente = carrinho.find(function (item) {
        return Number(item.id) === Number(produto.id);
    });

    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            quantidade: 1
        });
    }

    salvarCarrinho(carrinho);
}


// ========================================
// TELA DO ADMINISTRADOR
// ========================================

function desenharProdutosAdmin(lista) {
    listaDeProdutos.innerHTML = "";

    if (lista.length === 0) {
        listaDeProdutos.innerHTML = "<p>Nenhum produto encontrado nesta categoria.</p>";
        return;
    }

    lista.forEach(function (produto) {
        const card = document.createElement("div");
        card.className = "produto-card";

        card.innerHTML = `
            <h3></h3>

            <p class="descricaoProduto"></p>

            <p class="precoProduto"></p>

            <div class="acoesProduto">
                <button type="button" class="botaoEditarProduto">
                    <i class="fa-solid fa-pen"></i>
                    Editar
                </button>

                <button type="button" class="botaoDisponivelProduto">
                    <i class="fa-solid fa-circle-check"></i>
                    ${produto.disponivel_manual === true ? "Disponível" : "Indisponível"}
                </button>
            </div>

            <p class="estadoEstoque"></p>
        `;

        card.querySelector("h3").textContent = `${produto.icone || "🍣"} ${produto.nome}`;
        card.querySelector(".descricaoProduto").textContent = produto.descricao || "";
        card.querySelector(".precoProduto").textContent =
            `R$ ${produto.preco.toFixed(2).replace(".", ",")}`;

        const botaoEditar = card.querySelector(".botaoEditarProduto");
        const botaoDisponivel = card.querySelector(".botaoDisponivelProduto");
        const estadoEstoque = card.querySelector(".estadoEstoque");

        // Ligado pelo gerente, mas o estoque não cobre os ingredientes
        if (produto.disponivel_manual === true && produto.disponivel_venda !== true) {
            estadoEstoque.textContent = "Indisponível para venda: verifique o estoque.";
            estadoEstoque.style.color = "#fbbf24";
        }

        if (produto.disponivel_manual !== true) {
            botaoDisponivel.classList.add("indisponivel");
        }

        // Editar: abre o formulário (definido em cardapio-admin-novo-produto.js)
        botaoEditar.addEventListener("click", function () {
            abrirModalEdicao(produto);
        });

        // Liga e desliga o produto no cardápio
        botaoDisponivel.addEventListener("click", async function () {
            const novoEstado = produto.disponivel_manual !== true;

            try {
                const resposta = await fetch(
                    `${API_CARDAPIO}/admin/produtos/${produto.id}/disponibilidade`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ disponivel: novoEstado })
                    }
                );

                const dados = await resposta.json();

                if (!resposta.ok || !dados.sucesso) {
                    throw new Error(dados.erro || "Não foi possível alterar a disponibilidade.");
                }

                await carregarProdutos();

            } catch (erro) {
                console.error("Erro ao alterar disponibilidade:", erro);
                alert("Não foi possível alterar a disponibilidade: " + erro.message);
            }
        });

        listaDeProdutos.appendChild(card);
    });
}


// ========================================
// TELA DO CLIENTE
// ========================================

// O visual do cartão do cliente fica aqui para não depender do CSS do administrador
function injetarEstiloCliente() {
    if (document.getElementById("estiloCardapioCliente")) return;

    const estilo = document.createElement("style");
    estilo.id = "estiloCardapioCliente";
    estilo.textContent = `
        #listaDeProdutos.modoCliente {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 20px;
        }
        .cartaoCliente {
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 20px;
            overflow: hidden;
        }
        .cartaoCliente .imagemCartao {
            height: 200px;
            background: #1e293b;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 72px;
        }
        .cartaoCliente .corpoCartao {
            padding: 16px;
        }
        .cartaoCliente h3 {
            margin: 0 0 4px;
            font-size: 18px;
            color: #ffffff;
        }
        .cartaoCliente .descricaoCartao {
            margin: 0 0 16px;
            color: #94a3b8;
            font-size: 14px;
        }
        .cartaoCliente .rodapeCartao {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .cartaoCliente .precoCartao {
            color: #e60012;
            font-weight: 700;
            font-size: 20px;
        }
        .cartaoCliente .botaoAdicionar {
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: #e60012;
            color: #ffffff;
            font-size: 24px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(estilo);
}

function desenharProdutosCliente(lista) {
    listaDeProdutos.innerHTML = "";

    if (lista.length === 0) {
        listaDeProdutos.innerHTML = "<p>Nenhum produto encontrado nesta categoria.</p>";
        return;
    }

    lista.forEach(function (produto) {
        const card = document.createElement("div");
        card.className = "cartaoCliente";

        card.innerHTML = `
            <div class="imagemCartao"></div>
            <div class="corpoCartao">
                <h3></h3>
                <p class="descricaoCartao"></p>
                <div class="rodapeCartao">
                    <span class="precoCartao"></span>
                    <button type="button" class="botaoAdicionar">+</button>
                </div>
            </div>
        `;

        // Sem descrição, mostra a quantidade de peças
        let descricao = produto.descricao || "";
        if (!descricao && produto.pecas) {
            descricao = produto.pecas + " peças";
        }

        card.querySelector(".imagemCartao").textContent = produto.icone || "🍱";
        card.querySelector("h3").textContent = produto.nome;
        card.querySelector(".descricaoCartao").textContent = descricao;
        card.querySelector(".precoCartao").textContent = "R$ " + produto.preco.toFixed(2);

        const botaoAdicionar = card.querySelector(".botaoAdicionar");

        botaoAdicionar.addEventListener("click", function () {
            adicionarAoCarrinho(produto);

            // Confirmação rápida no próprio botão
            botaoAdicionar.textContent = "✓";
            setTimeout(function () {
                botaoAdicionar.textContent = "+";
            }, 800);
        });

        listaDeProdutos.appendChild(card);
    });
}


// ========================================
// FILTRAR E DESENHAR
// ========================================

function desenharProdutos(lista) {
    if (modoAdmin) {
        desenharProdutosAdmin(lista);
    } else {
        desenharProdutosCliente(lista);
    }
}

function aplicarFiltros() {
    const produtosFiltrados = produtos.filter(function (produto) {
        const bateCategoria =
            normalizarCategoria(produto.categoria) === categoriaAtual;

        const bateTexto = produto.nome
            .toLowerCase()
            .includes(textoBuscaAtual.toLowerCase());

        return bateCategoria && bateTexto;
    });

    desenharProdutos(produtosFiltrados);
}


// ========================================
// CARREGAR PRODUTOS DO SERVIDOR
// ========================================

async function carregarProdutos() {
    // O administrador vê todos; o cliente só vê os disponíveis
    const caminho = modoAdmin ? "/admin/produtos" : "/produtos";

    try {
        const resposta = await fetch(API_CARDAPIO + caminho);

        if (!resposta.ok) {
            throw new Error("Erro HTTP: " + resposta.status);
        }

        const dados = await resposta.json();

        if (!dados.sucesso) {
            throw new Error(dados.erro || "Não foi possível carregar os produtos.");
        }

        produtos = dados.produtos.map(function (produto) {
            return { ...produto, preco: Number(produto.preco) };
        });

        aplicarFiltros();

    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);
        listaDeProdutos.innerHTML = "<p>Não foi possível carregar os produtos.</p>";
    }
}

// Nome usado pelo arquivo cardapio-admin-novo-produto.js
function carregarProdutosAdmin() {
    return carregarProdutos();
}


// ========================================
// BUSCA E CATEGORIAS
// ========================================

campoBusca.addEventListener("input", function () {
    textoBuscaAtual = campoBusca.value;
    aplicarFiltros();
});

botoesCategoria.forEach(function (botao) {
    botao.addEventListener("click", function () {
        botoesCategoria.forEach(function (b) {
            b.classList.remove("ativo");
        });

        botao.classList.add("ativo");
        categoriaAtual = normalizarCategoria(botao.textContent);
        aplicarFiltros();
    });
});


if (!modoAdmin) {
    injetarEstiloCliente();
    listaDeProdutos.classList.add("modoCliente");
}

carregarProdutos();