const API = "http://localhost:3000";

const listaEstoque = document.getElementById("listaEstoque");
const totalNormal = document.getElementById("totalNormal");
const totalBaixo = document.getElementById("totalBaixo");
const totalCritico = document.getElementById("totalCritico");
const mensagem = document.getElementById("mensagem");

// Define o status do ingrediente comparando com o mínimo
function classificar(quantidade, minimo) {
    if (quantidade <= minimo * 0.5) return { texto: "Crítico", classe: "critico" };
    if (quantidade < minimo) return { texto: "Baixo", classe: "baixo" };
    return { texto: "Normal", classe: "normal" };
}

// Transforma o texto digitado em número (aceita vírgula). Se for inválido, gera erro
function lerNumero(texto, rotulo) {
    const valor = Number(String(texto).replace(",", "."));

    if (texto === "" || !Number.isFinite(valor) || valor < 0) {
        throw new Error("Confira " + rotulo + ": digite um número igual ou maior que zero.");
    }
    return valor;
}

// Envia uma alteração de estoque para o servidor
async function enviarAoServidor(url, metodo, corpo) {
    const resposta = await fetch(API + url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo)
    });

    const dados = await resposta.json();

    if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Não foi possível salvar no estoque.");
    }
}

// ----- Formulário (janela no meio da tela) -----

// Cria um campo de texto com o rótulo em cima
function criarCampo(campo) {
    const grupo = document.createElement("label");
    grupo.style.cssText = "display:block; margin-bottom:14px; color:#cbd5e1; font-size:14px;";
    grupo.textContent = campo.rotulo;

    const entrada = document.createElement("input");
    entrada.type = "text";
    entrada.value = campo.valor || "";
    entrada.style.cssText =
        "display:block; width:100%; margin-top:6px; padding:12px; border-radius:10px;" +
        "border:1px solid #334155; background:#0f172a; color:#fff; font-size:16px; box-sizing:border-box;";

    grupo.appendChild(entrada);
    return { grupo: grupo, entrada: entrada };
}

// Abre o formulário. "aoSalvar" recebe os valores digitados e pode gerar erro
function abrirFormulario(titulo, campos, aoSalvar) {
    const fundo = document.createElement("div");
    fundo.style.cssText =
        "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,.7);" +
        "display:flex; align-items:center; justify-content:center; z-index:1000;";

    const caixa = document.createElement("form");
    caixa.style.cssText =
        "background:#111827; border:1px solid #1f2937; border-radius:16px;" +
        "padding:24px; width:420px; max-width:90vw;";

    const cabecalho = document.createElement("h2");
    cabecalho.textContent = titulo;
    cabecalho.style.cssText = "margin:0 0 18px; color:#fff;";
    caixa.appendChild(cabecalho);

    const entradas = {};
    campos.forEach(function (campo) {
        const item = criarCampo(campo);
        entradas[campo.nome] = item.entrada;
        caixa.appendChild(item.grupo);
    });

    const aviso = document.createElement("p");
    aviso.style.cssText = "min-height:20px; color:#f87171; margin:0 0 12px; font-size:14px;";
    caixa.appendChild(aviso);

    const botoes = document.createElement("div");
    botoes.style.cssText = "display:flex; justify-content:flex-end; gap:10px;";

    const cancelar = document.createElement("button");
    cancelar.type = "button";
    cancelar.textContent = "Cancelar";
    cancelar.style.cssText =
        "padding:10px 18px; border-radius:10px; border:1px solid #334155;" +
        "background:transparent; color:#cbd5e1; cursor:pointer;";

    const salvar = document.createElement("button");
    salvar.type = "submit";
    salvar.textContent = "Salvar";
    salvar.style.cssText =
        "padding:10px 18px; border-radius:10px; border:none;" +
        "background:#e60012; color:#fff; font-weight:700; cursor:pointer;";

    botoes.append(cancelar, salvar);
    caixa.appendChild(botoes);

    function fechar() {
        fundo.remove();
    }

    cancelar.addEventListener("click", fechar);

    fundo.addEventListener("click", function (evento) {
        if (evento.target === fundo) fechar();
    });

    caixa.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const valores = {};
        campos.forEach(function (campo) {
            valores[campo.nome] = entradas[campo.nome].value.trim();
        });

        salvar.disabled = true;
        aviso.style.color = "#94a3b8";
        aviso.textContent = "Salvando...";

        try {
            await aoSalvar(valores);
            fechar();
        } catch (erro) {
            console.error(erro);
            aviso.style.color = "#f87171";
            aviso.textContent = erro.message;
            salvar.disabled = false;
        }
    });

    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    entradas[campos[0].nome].focus();
}

// ----- Ações -----

function novoIngrediente() {
    abrirFormulario(
        "Novo ingrediente",
        [
            { nome: "nome", rotulo: "Nome do ingrediente" },
            { nome: "quantidade", rotulo: "Quantidade em estoque" },
            { nome: "minimo", rotulo: "Quantidade mínima (abaixo disso o estoque fica baixo)" }
        ],
        async function (valores) {
            if (valores.nome === "") {
                throw new Error("Digite o nome do ingrediente.");
            }

            await enviarAoServidor("/admin/estoque", "POST", {
                nome: valores.nome,
                quantidade: lerNumero(valores.quantidade, "a quantidade"),
                quantidade_minima: lerNumero(valores.minimo, "o mínimo")
            });

            await carregarEstoque();
            mensagem.textContent = valores.nome + " cadastrado no estoque.";
        }
    );
}

function editarIngrediente(item) {
    abrirFormulario(
        "Editar " + item.nome,
        [
            { nome: "quantidade", rotulo: "Quantidade em estoque", valor: String(item.quantidade) },
            { nome: "minimo", rotulo: "Quantidade mínima", valor: String(item.minimo) }
        ],
        async function (valores) {
            await enviarAoServidor("/admin/estoque/" + item.id, "PATCH", {
                quantidade: lerNumero(valores.quantidade, "a quantidade"),
                quantidade_minima: lerNumero(valores.minimo, "o mínimo")
            });

            await carregarEstoque();
            mensagem.textContent = item.nome + " atualizado com sucesso.";
        }
    );
}

// ----- Tela -----

// Coloca o botão "+ Novo ingrediente" acima da tabela
function criarBotaoNovoIngrediente() {
    const tabela = listaEstoque.closest("table");
    if (!tabela) return;

    const barra = document.createElement("div");
    barra.style.cssText = "display:flex; justify-content:flex-end; margin-bottom:16px;";

    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "+ Novo ingrediente";
    botao.style.cssText =
        "background:#e60012; color:#fff; border:none; border-radius:10px;" +
        "padding:12px 20px; font-weight:700; cursor:pointer;";
    botao.addEventListener("click", novoIngrediente);

    barra.appendChild(botao);
    tabela.parentElement.insertAdjacentElement("beforebegin", barra);
}

function criarLinha(item) {
    const quantidade = Number(item.quantidade) || 0;
    const minimo = Number(item.quantidade_minima) || 0;
    const status = classificar(quantidade, minimo);

    const linha = document.createElement("tr");

    const nome = document.createElement("td");
    nome.textContent = item.nome;

    const quantidadeTd = document.createElement("td");
    quantidadeTd.textContent = quantidade.toLocaleString("pt-BR");

    const minimoTd = document.createElement("td");
    minimoTd.textContent = minimo.toLocaleString("pt-BR");

    const statusTd = document.createElement("td");
    const etiqueta = document.createElement("span");
    etiqueta.className = "status " + status.classe;
    etiqueta.textContent = status.texto;
    statusTd.appendChild(etiqueta);

    const acoesTd = document.createElement("td");
    acoesTd.className = "actions-heading";

    const botaoEditar = document.createElement("button");
    botaoEditar.type = "button";
    botaoEditar.className = "btn-atualizar";
    botaoEditar.textContent = "Editar";
    botaoEditar.addEventListener("click", function () {
        editarIngrediente({ id: item.id, nome: item.nome, quantidade: quantidade, minimo: minimo });
    });
    acoesTd.appendChild(botaoEditar);

    linha.append(nome, quantidadeTd, minimoTd, statusTd, acoesTd);
    return { linha: linha, classe: status.classe };
}

async function carregarEstoque() {
    try {
        const resposta = await fetch(API + "/admin/estoque");
        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            throw new Error(dados.erro || "Não foi possível carregar o estoque.");
        }

        const itens = dados.itens || [];
        const contagem = { normal: 0, baixo: 0, critico: 0 };

        listaEstoque.innerHTML = "";

        if (itens.length === 0) {
            listaEstoque.innerHTML =
                '<tr><td colspan="5" class="loading">Nenhum ingrediente cadastrado. Clique em "+ Novo ingrediente".</td></tr>';
        }

        itens.forEach(function (item) {
            const resultado = criarLinha(item);
            contagem[resultado.classe]++;
            listaEstoque.appendChild(resultado.linha);
        });

        totalNormal.textContent = contagem.normal;
        totalBaixo.textContent = contagem.baixo;
        totalCritico.textContent = contagem.critico;

        mensagem.textContent = "Estoque carregado com sucesso.";
    } catch (erro) {
        console.error("Erro ao carregar estoque:", erro);

        listaEstoque.innerHTML =
            '<tr><td colspan="5" class="loading">Não foi possível carregar os ingredientes.</td></tr>';

        mensagem.textContent = "Confira se o servidor está ligado e se a rota do estoque está funcionando.";
    }
}

criarBotaoNovoIngrediente();
carregarEstoque();