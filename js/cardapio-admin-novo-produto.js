// ========================================
// NOVO PRODUTO (cardápio administrativo)
// ========================================

const botaoNovoProduto = document.getElementById("botaoNovoProduto");
const fundoModalProduto = document.getElementById("fundoModalProduto");
const formNovoProduto = document.getElementById("formNovoProduto");
const botaoCancelarProduto = document.getElementById("cancelarNovoProduto");
const botaoSalvarProduto = document.getElementById("salvarNovoProduto");
const mensagemNovoProduto = document.getElementById("mensagemNovoProduto");

function abrirModalProduto() {
    formNovoProduto.reset();
    mensagemNovoProduto.textContent = "";
    fundoModalProduto.classList.add("aberto");
    document.getElementById("novoProdutoNome").focus();
}

function fecharModalProduto() {
    fundoModalProduto.classList.remove("aberto");
}

botaoNovoProduto.addEventListener("click", abrirModalProduto);
botaoCancelarProduto.addEventListener("click", fecharModalProduto);

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

    botaoSalvarProduto.disabled = true;
    mensagemNovoProduto.textContent = "Salvando...";

    try {
        const resposta = await fetch("http://localhost:3001/admin/produtos", {
    method: "POST",
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
    throw new Error("Resposta não é JSON (status " + resposta.status + ") em " + resposta.url);
}

const dados = await resposta.json();

if (!resposta.ok || !dados.sucesso) {
    throw new Error(dados.erro || "Não foi possível criar o produto.");
}

        fecharModalProduto();

        // Mostra a categoria do produto criado e recarrega a lista do banco
        categoriaAtual = normalizarCategoria(categoria);
        botoesCategoria.forEach(function (b) {
            b.classList.toggle(
                "ativo",
                normalizarCategoria(b.textContent) === categoriaAtual
            );
        });
        campoBusca.value = "";
        textoBuscaAtual = "";

        await carregarProdutosAdmin();

        alert("Produto criado com sucesso! Ele já aparece no cardápio do cliente.");

    } catch (erro) {
        console.error("Erro ao criar produto:", erro);
        mensagemNovoProduto.textContent = "Erro: " + erro.message;
    } finally {
        botaoSalvarProduto.disabled = false;
    }
});