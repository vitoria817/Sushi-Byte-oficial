
const listaEstoque = document.getElementById("listaEstoque");
const totalNormal = document.getElementById("totalNormal");
const totalBaixo = document.getElementById("totalBaixo");
const totalCritico = document.getElementById("totalCritico");
const mensagem = document.getElementById("mensagem");

async function carregarEstoque() {
    try {
        const resposta = await fetch("http://localhost:3000/admin/estoque");
        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            throw new Error(dados.erro || "Não foi possível carregar o estoque.");
        }

        const itens = dados.itens || [];

        let normais = 0;
        let baixos = 0;
        let criticos = 0;

        listaEstoque.innerHTML = "";

        if (itens.length === 0) {
            listaEstoque.innerHTML = `
                <tr>
                    <td colspan="5" class="loading">
                        Nenhum ingrediente cadastrado no estoque.
                    </td>
                </tr>
            `;
        }

        itens.forEach((item) => {
            const quantidade = Number(item.quantidade) || 0;
            const minimo = Number(item.quantidade_minima) || 0;

            let status;
            let classe;

            if (quantidade <= minimo * 0.5) {
                status = "Crítico";
                classe = "critico";
                criticos++;
            } else if (quantidade < minimo) {
                status = "Baixo";
                classe = "baixo";
                baixos++;
            } else {
                status = "Normal";
                classe = "normal";
                normais++;
            }

            const linha = document.createElement("tr");

            const nome = document.createElement("td");
            nome.textContent = item.nome;

            const quantidadeTd = document.createElement("td");
            quantidadeTd.textContent = quantidade.toLocaleString("pt-BR");

            const minimoTd = document.createElement("td");
            minimoTd.textContent = minimo.toLocaleString("pt-BR");

            const statusTd = document.createElement("td");
            const etiqueta = document.createElement("span");
            etiqueta.className = `status ${classe}`;
            etiqueta.textContent = status;
            statusTd.appendChild(etiqueta);


            const acoesTd = document.createElement("td");
            acoesTd.className = "actions-heading";

            const botaoAtualizar = document.createElement("button");
            botaoAtualizar.type = "button";
            botaoAtualizar.className = "btn-atualizar";
            botaoAtualizar.textContent = "Atualizar";

            botaoAtualizar.addEventListener("click", () => {
                const novaQuantidade = prompt(
                    `Quantidade atual de ${item.nome}: ${quantidade}\nDigite a nova quantidade:`
                );

                if (novaQuantidade === null || novaQuantidade.trim() === "") {
                    return;
                }

                const valor = Number(novaQuantidade.replace(",", "."));

                if (!Number.isFinite(valor) || valor < 0) {
                    alert("Digite uma quantidade válida, igual ou maior que zero.");
                    return;
                }

                alert("O botão está funcionando visualmente. Ainda precisamos conectar a atualização ao banco de dados.");
            });

            acoesTd.appendChild(botaoAtualizar);


            linha.append(nome, quantidadeTd, minimoTd, statusTd, acoesTd);
            listaEstoque.appendChild(linha);
        });

        totalNormal.textContent = normais;
        totalBaixo.textContent = baixos;
        totalCritico.textContent = criticos;

        mensagem.textContent = "Estoque carregado com sucesso.";
    } catch (erro) {
        console.error("Erro ao carregar estoque:", erro);

        listaEstoque.innerHTML = `
            <tr>
                <td colspan="5" class="loading">
                    Não foi possível carregar os ingredientes.
                </td>
            </tr>
        `;

        mensagem.textContent = "Confira se o servidor está ligado e se a rota do estoque está funcionando.";
    }
}

carregarEstoque();
