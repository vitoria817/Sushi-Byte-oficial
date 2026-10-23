// Formulário de produto (cardápio administrativo): serve para criar e para editar

const botaoNovoProduto = document.getElementById("botaoNovoProduto");
const fundoModalProduto = document.getElementById("fundoModalProduto");
const formNovoProduto = document.getElementById("formNovoProduto");
const botaoCancelarProduto = document.getElementById("cancelarNovoProduto");
const botaoSalvarProduto = document.getElementById("salvarNovoProduto");
const mensagemNovoProduto = document.getElementById("mensagemNovoProduto");

// Guarda o produto que está sendo editado (null = criando um novo)
let produtoEmEdicao = null;

function mudarTituloModal(texto) {
    const titulo = fundoModalProduto.querySelector("h2, h3");
    if (titulo) titulo.textContent = texto;
}

function abrirModalProduto() {
    produtoEmEdicao = null;
    formNovoProduto.reset();
    mensagemNovoProduto.textContent = "";
    mudarTituloModal("Novo produto");
    fundoModalProduto.classList.add("aberto");
    document.getElementById("novoProdutoNome").focus();
}

// Chamada pelo botão "Editar" do cardápio
function abrirModalEdicao(produto) {
    produtoEmEdicao = produto;
    formNovoProduto.reset();
    mensagemNovoProduto.textContent = "";
    mudarTituloModal("Editar produto");

    document.getElementById("novoProdutoNome").value = produto.nome || "";
    document.getElementById("novoProdutoDescricao").value = produto.descricao || "";
    document.getElementById("novoProdutoCategoria").value = produto.categoria || "";
    document.getElementById("novoProdutoIcone").value = produto.icone || "";
    document.getElementById("novoProdutoPecas").value = produto.pecas || "";
    document.getElementById("novoProdutoPreco").value = String(produto.preco).replace(".", ",");

    fundoModalProduto.classList.add("aberto");
    document.getElementById("novoProdutoNome").focus();
}

function fecharModalProduto() {
    fundoModalProduto.classList.remove("aberto");
}

botaoNovoProduto.addEventListener("click", abrirModalProduto);
botaoCancelarProduto.addEventListener("click", fecharModalProduto);

// Fecha o modal ao clicar fora da caixa
fundoModalProduto.addEventListener("click", function (evento) {
    if (evento.target === fundoModalProduto) fecharModalProduto();
});

formNovoProduto.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const nome = document.getElementById("novoProdutoNome").value.trim();
    const descricao = document.getElementById("novoProdutoDescricao").value.trim();
    const categoria = document.getElementById("novoProdutoCategoria").value;
    const icone = document.getElementById("novoProdutoIcone").value.trim();
    const pecasTexto = document.getElementById("novoProdutoPecas").value.trim();
    const preco = Number(
        document.getElementById("novoProdutoPreco").value.trim().replace(",", ".")
    );

    if (!nome || !categoria || !Number.isFinite(preco) || preco < 0) {
        mensagemNovoProduto.textContent = "Confira o nome, a categoria e o preço.";
        return;
    }

    // Editando usa PUT no produto; criando usa POST
    const editando = produtoEmEdicao !== null;
    const url = editando
        ? "http://localhost:3000/admin/produtos/" + produtoEmEdicao.id
        : "http://localhost:3000/admin/produtos";

    botaoSalvarProduto.disabled = true;
    mensagemNovoProduto.textContent = "Salvando...";

    try {
        const resposta = await fetch(url, {
            method: editando ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nome: nome,
                descricao: descricao,
                preco: preco,
                categoria: categoria,
                icone: icone,
                pecas: pecasTexto === "" ? null : Number(pecasTexto)
            })
        });

        const tipoConteudo = resposta.headers.get("content-type") || "";

        if (!tipoConteudo.includes("application/json")) {
            throw new Error("O servidor não respondeu JSON (status " + resposta.status + ")");
        }

        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            throw new Error(dados.erro || "Não foi possível salvar o produto.");
        }

        fecharModalProduto();

        // Mostra a categoria do produto salvo e recarrega a lista do banco
        categoriaAtual = normalizarCategoria(categoria);
        botoesCategoria.forEach(function (botao) {
            botao.classList.toggle(
                "ativo",
                normalizarCategoria(botao.textContent) === categoriaAtual
            );
        });
        campoBusca.value = "";
        textoBuscaAtual = "";

        await carregarProdutosAdmin();

        if (editando) {
            alert("Produto atualizado com sucesso!");
        } else {
            alert("Produto criado com sucesso! Ele já aparece no cardápio do cliente.");
        }

        produtoEmEdicao = null;

    } catch (erro) {
        console.error("Erro ao salvar produto:", erro);
        mensagemNovoProduto.textContent = "Erro: " + erro.message;
    } finally {
        botaoSalvarProduto.disabled = false;
    }
});