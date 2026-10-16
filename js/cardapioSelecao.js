
// ========================================
// PRODUTOS DO BANCO DE DADOS
// ========================================

let produtos = [];

const listaDeProdutos = document.getElementById("listaDeProdutos");
const campoBusca = document.getElementById("BuscarItem");

const botoesCategoria = document.querySelectorAll(
    ".opcoesDoCardapio button"
);

let categoriaAtual = "combinados";
let textoBuscaAtual = "";


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
// ADICIONAR AO CARRINHO
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
// DESENHAR PRODUTOS
// ========================================

function desenharProdutos(lista) {
    listaDeProdutos.innerHTML = "";

    if (lista.length === 0) {
        listaDeProdutos.innerHTML =
            "<p>Nenhum produto encontrado nesta categoria.</p>";
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
                <button
                    type="button"
                    class="botaoEditarProduto">
                    <i class="fa-solid fa-pen"></i>
                    Editar
                </button>

                <button
                    type="button"
                    class="botaoDisponivelProduto">
                    <i class="fa-solid fa-circle-check"></i>
                    ${produto.disponivel_manual === true
                ? "Disponível"
                : "Indisponível"}
                </button>
            </div>

            <p class="estadoEstoque"></p>
        `;

        // Informações do produto
        card.querySelector("h3").textContent =
            `${produto.icone || "🍣"} ${produto.nome}`;

        card.querySelector(".descricaoProduto").textContent =
            produto.descricao || "";

        card.querySelector(".precoProduto").textContent =
            `R$ ${produto.preco.toFixed(2).replace(".", ",")}`;

        const botaoEditar = card.querySelector(
            ".botaoEditarProduto"
        );

        const botaoDisponivel = card.querySelector(
            ".botaoDisponivelProduto"
        );

        const estadoEstoque = card.querySelector(
            ".estadoEstoque"
        );

        // Verificar disponibilidade para venda
        if (
            produto.disponivel_manual === true &&
            produto.disponivel_venda !== true
        ) {
            estadoEstoque.textContent =
                "Indisponível para venda: verifique o estoque.";

            estadoEstoque.style.color = "#fbbf24";
        }

        if (produto.disponivel_manual !== true) {
            botaoDisponivel.classList.add("indisponivel");
        }


        // ========================================
        // BOTÃO EDITAR
        // ========================================


        botaoEditar.addEventListener("click", async function () {
            const nome = prompt("Nome do produto:", produto.nome);
            if (nome === null) return;

            const descricao = prompt(
                "Descrição do produto:",
                produto.descricao || ""
            );
            if (descricao === null) return;

            const precoTexto = prompt(
                "Preço do produto (ex.: 46,00):",
                String(produto.preco).replace(".", ",")
            );
            if (precoTexto === null) return;

            const categoria = prompt(
                "Categoria do produto:",
                produto.categoria
            );
            if (categoria === null) return;

            // Aceita valores como 46,00 ou 46.00
            const preco = Number(
                precoTexto.trim().replace(",", ".")
            );

            if (
                !nome.trim() ||
                !categoria.trim() ||
                precoTexto.trim() === "" ||
                !Number.isFinite(preco) ||
                preco < 0
            ) {
                alert("Confira o nome, a categoria e o preço.");
                return;
            }

            try {
                const resposta = await fetch(
                    `http://localhost:3000/admin/produtos/${produto.id}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            nome: nome.trim(),
                            descricao: descricao.trim(),
                            preco: preco,
                            categoria: categoria.trim()
                        })
                    }
                );

                const dados = await resposta.json();

                if (!resposta.ok || !dados.sucesso) {
                    throw new Error(
                        dados.erro || "Não foi possível editar o produto."
                    );
                }

                // Atualiza os produtos usando os dados do banco
                await carregarProdutosAdmin();

                alert("Produto atualizado com sucesso!");

            } catch (erro) {
                console.error("Erro ao editar produto:", erro);
                alert("Erro ao editar: " + erro.message);
            }
        });


        // ========================================
        // BOTÃO DISPONIBILIDADE
        // ========================================

        botaoDisponivel.addEventListener(
            "click",
            async function () {
                const novoEstado =
                    produto.disponivel_manual !== true;

                try {
                    const resposta = await fetch(
                        `http://localhost:3000/admin/produtos/${produto.id}/disponibilidade`,
                        {
                            method: "PATCH",

                            headers: {
                                "Content-Type": "application/json"
                            },

                            body: JSON.stringify({
                                disponivel: novoEstado
                            })
                        }
                    );

                    const dados = await resposta.json();

                    if (!resposta.ok || !dados.sucesso) {
                        throw new Error(
                            dados.erro ||
                            "Não foi possível alterar a disponibilidade."
                        );
                    }

                    await carregarProdutosAdmin();

                } catch (erro) {
                    console.error(
                        "Erro ao alterar disponibilidade:",
                        erro
                    );

                    alert(
                        "Não foi possível alterar a disponibilidade. " +
                        "Confira se a rota PATCH está configurada no servidor."
                    );
                }
            }
        );

        listaDeProdutos.appendChild(card);
    });
}


// ========================================
// FILTRAR PRODUTOS
// ========================================

function aplicarFiltros() {
    const produtosFiltrados = produtos.filter(
        function (produto) {
            const bateCategoria =
                normalizarCategoria(produto.categoria) ===
                categoriaAtual;

            const bateTexto = produto.nome
                .toLowerCase()
                .includes(textoBuscaAtual.toLowerCase());

            return bateCategoria && bateTexto;
        }
    );

    desenharProdutos(produtosFiltrados);
}


// ========================================
// CARREGAR PRODUTOS DO SERVIDOR
// ========================================

async function carregarProdutosAdmin() {
    try {
        const resposta = await fetch(
            "http://localhost:3000/admin/produtos"
        );

        if (!resposta.ok) {
            throw new Error(
                "Erro HTTP: " + resposta.status
            );
        }

        const dados = await resposta.json();

        if (!dados.sucesso) {
            throw new Error(
                dados.erro ||
                "Não foi possível carregar os produtos."
            );
        }

        produtos = dados.produtos.map(
            function (produto) {
                return {
                    ...produto,
                    preco: Number(produto.preco)
                };
            }
        );

        aplicarFiltros();

    } catch (erro) {
        console.error(
            "Erro ao carregar produtos:",
            erro
        );

        listaDeProdutos.innerHTML =
            "<p>Não foi possível carregar os produtos.</p>";
    }
}


// ========================================
// CAMPO DE BUSCA
// ========================================

campoBusca.addEventListener("input", function () {
    textoBuscaAtual = campoBusca.value;
    aplicarFiltros();
});


// ========================================
// BOTÕES DE CATEGORIA
// ========================================

botoesCategoria.forEach(function (botao) {
    botao.addEventListener("click", function () {
        botoesCategoria.forEach(function (b) {
            b.classList.remove("ativo");
        });

        botao.classList.add("ativo");

        categoriaAtual = normalizarCategoria(
            botao.textContent
        );

        aplicarFiltros();
    });
});


// ========================================
// INICIAR CARDÁPIO ADMINISTRATIVO
// ========================================

carregarProdutosAdmin();
