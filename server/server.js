const express = require("express");
const cors = require("cors");
const pool = require("./db");

//deixa o banco no horario de brasilia 
pool.on("connect", function(client){
    client.query("SET TIME ZONE 'America/Sao_Paulo'");
});

const app = express();
const PORTA = 3000;

app.use(cors());
app.use(express.json());


//função para verificar cpf 

function cpfValido(cpf){
    cpf = String(cpf || "").replace(/\D/g, "");

    if(cpf.length !== 11) return false;
    if(/^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for(let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
    let digito1 = (soma * 10) % 11;
    if(digito1 === 10) digito1 = 0;
    if(digito1 !== Number(cpf[9])) return false;

    soma = 0;
    for(let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
    let digito2 = (soma * 10) % 11;
    if(digito2 === 10) digito2 = 0;

    return digito2 === Number(cpf[10]);
}

// mostra o erro real, ajuda a achar o problema
function erroServidor(res, erro, mensagem){
    console.error(mensagem, erro);
    res.status(500).json({ sucesso: false, erro: mensagem + ": " + erro.message });
}

function erroDeNegocio(mensagem){
    const erro = new Error(mensagem);
    erro.negocio = true;
    return erro;
}

// produto so vende se o estoque cobre os ingredientes (tabela produtos com apelido p)
const ESTOQUE_OK = `NOT EXISTS (
    SELECT 1
      FROM produto_ingrediente pi
      JOIN estoque e ON e.id_ingrediente = pi.id_ingrediente
     WHERE pi.id_produto = p.id
       AND e.quantidade < pi.quantidade
)`;

const STATUS_PEDIDO = ["recebido", "em_preparo", "pronto", "entregue", "conta_fechada"];
const FORMAS_PAGAMENTO = ["pix", "credito", "debito", "dinheiro"];
const CARGOS = ["gerente", "funcionario", "cozinha"];
const STATUS_FUNCIONARIO = ["ativo", "inativo"];

// confere se existe outro gerente ativo alem desse (pra ninguem ficar sem acesso)
async function restaOutroGerente(id){
    const resultado = await pool.query(
        `SELECT COUNT(*)::int AS total
           FROM funcionarios
          WHERE LOWER(cargo) = 'gerente'
            AND status = 'ativo'
            AND id <> $1`,
        [id]
    );
    return resultado.rows[0].total > 0;
}


// ---------- cpf e clientes ----------

app.post("/api/cpf/validar", function(req, res){
    if(!cpfValido(req.body.cpf)){
        return res.status(400).json({ sucesso: false, erro: "CPF inválido" });
    }
    res.json({ sucesso: true });
});

app.post("/clientes", async function(req, res){
    const nome = String(req.body.nome || "").trim();
    const mesa = Number(req.body.mesa);
    const cpf = String(req.body.cpf || "").replace(/\D/g, "");

    if(!nome){
        return res.status(400).json({ sucesso: false, erro: "Informe o nome" });
    }

    if(!Number.isInteger(mesa) || mesa <= 0){
        return res.status(400).json({ sucesso: false, erro: "Informe um número de mesa válido" });
    }

    if(!cpfValido(cpf)){
        return res.status(400).json({ sucesso: false, erro: "CPF inválido" });
    }

    try{
        // se o cpf ja existe o cliente ja veio antes: so atualiza nome e mesa dele aqui
        const existente = await pool.query("SELECT id FROM clientes WHERE cpf = $1", [cpf]);

        if(existente.rowCount > 0){
            const id = existente.rows[0].id;
            await pool.query("UPDATE clientes SET nome = $1, mesa = $2 WHERE id = $3", [nome, mesa, id]);

            // em quantos dias diferentes ele ja fez pedido antes de hoje
            const anteriores = await pool.query(
                `SELECT COUNT(DISTINCT data_pedido::date)::int AS dias
                   FROM pedidos
                  WHERE id_cliente = $1
                    AND data_pedido::date < CURRENT_DATE`,
                [id]
            );

            return res.json({
                sucesso: true,
                id: id,
                nome: nome,
                jaCadastrado: true,
                visitas: anteriores.rows[0].dias + 1
            });
        }

        const novo = await pool.query(
            "INSERT INTO clientes (nome, cpf, mesa) VALUES ($1, $2, $3) RETURNING id",
            [nome, cpf, mesa]
        );
        res.json({ sucesso: true, id: novo.rows[0].id, nome: nome, jaCadastrado: false, visitas: 1 });
    }catch(erro){
        erroServidor(res, erro, "Erro ao cadastrar cliente");
    }
});

app.get("/clientes/:id/historico", async function(req, res){
    const clienteId = Number(req.params.id);

    try{
        const pedidos = await pool.query(
            `SELECT p.id, p.status, p.total, p.data_pedido, a.nota
               FROM pedidos p
               LEFT JOIN avaliacoes a ON a.id_pedido = p.id
              WHERE p.id_cliente = $1
              ORDER BY p.data_pedido DESC`,
            [clienteId]
        );

        const ids = pedidos.rows.map(function(p){ return p.id; });
        let itens = [];

        if(ids.length > 0){
            const consulta = await pool.query(
                `SELECT i.id_pedido, pr.nome, i.quantidade, i.preco_unitario
                   FROM itens_pedido i
                   JOIN produtos pr ON pr.id = i.id_produto
                  WHERE i.id_pedido = ANY($1)`,
                [ids]
            );
            itens = consulta.rows;
        }

        // junta os itens dentro de cada pedido
        const resultado = pedidos.rows.map(function(pedido){
            return {
                ...pedido,
                itens: itens
                    .filter(function(item){ return item.id_pedido === pedido.id; })
                    .map(function(item){
                        return {
                            nome: item.nome,
                            quantidade: item.quantidade,
                            preco_unitario: Number(item.preco_unitario)
                        };
                    })
            };
        });

        res.json({ sucesso: true, pedidos: resultado });
    }catch(erro){
        erroServidor(res, erro, "Erro ao buscar histórico");
    }
});


//login do administrativo

app.post("/login-administrativo", async function(req, res){
    const { email, senha, cargo } = req.body;

    try{
        const resultado = await pool.query(
            `SELECT nome, cargo
               FROM funcionarios
              WHERE email = $1
                AND senha = $2
                AND cargo = $3
                AND status = 'ativo'`,
            [email, senha, cargo]
        );

        if(resultado.rowCount === 0){
            return res.status(401).json({ sucesso: false, erro: "Email, senha ou cargo incorretos" });
        }

        res.json({
            sucesso: true,
            nome: resultado.rows[0].nome,
            cargo: resultado.rows[0].cargo
        });
    }catch(erro){
        erroServidor(res, erro, "Erro ao fazer login");
    }
});


//cardapio do cliente 

app.get("/produtos", async function(req, res){
    try{
        const resultado = await pool.query(
            `SELECT p.id, p.nome, p.descricao, p.preco, p.categoria, p.icone, p.pecas
               FROM produtos p
              WHERE p.disponivel = true
                AND ${ESTOQUE_OK}
              ORDER BY p.id`
        );
        res.json({ sucesso: true, produtos: resultado.rows });
    }catch(erro){
        erroServidor(res, erro, "Erro ao carregar o cardápio");
    }
});


//pedidos

app.post("/pedidos", async function(req, res){
    const { clienteId, itens } = req.body;

    if(!clienteId || !Array.isArray(itens) || itens.length === 0){
        return res.status(400).json({ sucesso: false, erro: "Pedido vazio ou sem cliente" });
    }

    const conexao = await pool.connect();

    try{
        await conexao.query("BEGIN");

        // o preco vem do banco, nao do navegador
        let subtotal = 0;
        const linhas = [];

        for(const item of itens){
            const quantidade = Number(item.quantidade);

            if(!Number.isInteger(quantidade) || quantidade <= 0){
                throw erroDeNegocio("Quantidade inválida");
            }

            const produto = await conexao.query(
                `SELECT p.id, p.nome, p.preco, p.disponivel,
                        ${ESTOQUE_OK} AS estoque_ok
                   FROM produtos p
                  WHERE p.id = $1`,
                [item.id]
            );

            if(produto.rowCount === 0){
                throw erroDeNegocio("Produto não encontrado");
            }

            const dados = produto.rows[0];

            if(!dados.disponivel || !dados.estoque_ok){
                throw erroDeNegocio(dados.nome + " está indisponível no momento");
            }

            const preco = Number(dados.preco);
            subtotal += preco * quantidade;
            linhas.push({ produtoId: dados.id, quantidade: quantidade, preco: preco });
        }

        const taxaServico = subtotal * 0.10;
        const total = subtotal + taxaServico;

        const pedido = await conexao.query(
            `INSERT INTO pedidos
                (id_cliente, status, subtotal, taxa_servico, total, tempo_estimado_min, tempo_estimado_max)
             VALUES ($1, 'recebido', $2, $3, $4, 20, 30)
          RETURNING id`,
            [clienteId, subtotal, taxaServico, total]
        );

        const pedidoId = pedido.rows[0].id;

        for(const linha of linhas){
            await conexao.query(
                `INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario)
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, linha.produtoId, linha.quantidade, linha.preco]
            );
        }

        // primeiro registro da timeline
        await conexao.query(
            "INSERT INTO historico_status_pedido (id_pedido, status) VALUES ($1, 'recebido')",
            [pedidoId]
        );

        await conexao.query("COMMIT");
        res.json({ sucesso: true, pedidoId: pedidoId });

    }catch(erro){
        await conexao.query("ROLLBACK");

        if(erro.negocio){
            return res.status(400).json({ sucesso: false, erro: erro.message });
        }

        // 23503 = cliente nao existe
        if(erro.code === "23503"){
            return res.status(400).json({ sucesso: false, erro: "Cliente não encontrado. Faça o cadastro de novo." });
        }

        erroServidor(res, erro, "Erro ao registrar o pedido");
    }finally{
        conexao.release();
    }
});

app.get("/pedidos/:id", async function(req, res){
    try{
        const resultado = await pool.query(
            `SELECT id, status, total, tempo_estimado_min, tempo_estimado_max
               FROM pedidos
              WHERE id = $1`,
            [Number(req.params.id)]
        );

        if(resultado.rowCount === 0){
            return res.status(404).json({ sucesso: false, erro: "Pedido não encontrado" });
        }

        res.json({ sucesso: true, pedido: resultado.rows[0] });
    }catch(erro){
        erroServidor(res, erro, "Erro ao buscar o pedido");
    }
});


// ---------- admin: produtos ----------

app.get("/admin/produtos", async function(req, res){
    try{
        // disponivel_manual = chave do gerente
        // disponivel_venda = chave ligada e estoque suficiente
        const resultado = await pool.query(
            `SELECT p.id, p.nome, p.descricao, p.preco, p.categoria, p.icone, p.pecas,
                    p.disponivel AS disponivel_manual,
                    (p.disponivel AND ${ESTOQUE_OK}) AS disponivel_venda
               FROM produtos p
              ORDER BY p.id`
        );
        res.json({ sucesso: true, produtos: resultado.rows });
    }catch(erro){
        erroServidor(res, erro, "Erro ao listar produtos");
    }
});

app.post("/admin/produtos", async function(req, res){
    const { nome, descricao, preco, categoria, icone, pecas } = req.body;

    if(!nome || !categoria || !Number.isFinite(Number(preco)) || Number(preco) < 0){
        return res.status(400).json({ sucesso: false, erro: "Confira nome, categoria e preço" });
    }

    try{
        const resultado = await pool.query(
            `INSERT INTO produtos (nome, descricao, preco, categoria, icone, pecas, disponivel)
             VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING id`,
            [nome, descricao || "", Number(preco), categoria, icone || null, pecas || null]
        );
        res.json({ sucesso: true, id: resultado.rows[0].id });
    }catch(erro){
        erroServidor(res, erro, "Erro ao criar produto");
    }
});

app.put("/admin/produtos/:id", async function(req, res){
    const { nome, descricao, preco, categoria, icone, pecas } = req.body;

    if(!nome || !categoria || !Number.isFinite(Number(preco)) || Number(preco) < 0){
        return res.status(400).json({ sucesso: false, erro: "Confira nome, categoria e preço" });
    }

    try{
        const resultado = await pool.query(
            `UPDATE produtos
                SET nome = $1, descricao = $2, preco = $3, categoria = $4,
                    icone = $5, pecas = $6
              WHERE id = $7`,
            [nome, descricao || "", Number(preco), categoria,
             icone || null, pecas || null, Number(req.params.id)]
        );

        if(resultado.rowCount === 0){
            return res.status(404).json({ sucesso: false, erro: "Produto não encontrado" });
        }
        res.json({ sucesso: true });
    }catch(erro){
        erroServidor(res, erro, "Erro ao editar produto");
    }
});

app.patch("/admin/produtos/:id/disponibilidade", async function(req, res){
    if(typeof req.body.disponivel !== "boolean"){
        return res.status(400).json({ sucesso: false, erro: "Valor de disponibilidade inválido" });
    }

    try{
        const resultado = await pool.query(
            "UPDATE produtos SET disponivel = $1 WHERE id = $2",
            [req.body.disponivel, Number(req.params.id)]
        );

        if(resultado.rowCount === 0){
            return res.status(404).json({ sucesso: false, erro: "Produto não encontrado" });
        }
        res.json({ sucesso: true });
    }catch(erro){
        erroServidor(res, erro, "Erro ao alterar disponibilidade");
    }
});


//adm parte do estoque manual

app.get("/admin/estoque", async function(req, res){
    try{
        const resultado = await pool.query(
            `SELECT e.id, i.nome, e.quantidade, e.quantidade_minima
               FROM estoque e
               JOIN ingredientes i ON i.id = e.id_ingrediente
              ORDER BY i.nome`
        );
        res.json({ sucesso: true, itens: resultado.rows });
    }catch(erro){
        erroServidor(res, erro, "Erro ao carregar o estoque");
    }
});

//cadastra ingrediente novo com quantidade e minimo
app.post("/admin/estoque", async function(req, res){
    const nome = String(req.body.nome || "").trim();
    const quantidade = Number(req.body.quantidade);
    const minimo = Number(req.body.quantidade_minima);

    if(!nome || !Number.isFinite(quantidade) || quantidade < 0 ||
       !Number.isFinite(minimo) || minimo < 0){
        return res.status(400).json({ sucesso: false, erro: "Confira o nome, a quantidade e o mínimo" });
    }

    try{
    //se o nome ja existe reaproveita o ingrediente
        const ingrediente = await pool.query(
            `INSERT INTO ingredientes (nome)
             VALUES ($1)
             ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
             RETURNING id`,
            [nome]
        );

        const novo = await pool.query(
            `INSERT INTO estoque (id_ingrediente, quantidade, quantidade_minima)
             VALUES ($1, $2, $3)
          RETURNING id`,
            [ingrediente.rows[0].id, quantidade, minimo]
        );

        res.json({ sucesso: true, id: novo.rows[0].id });
    }catch(erro){
        // 23505 = ja esta no estoque
        if(erro.code === "23505"){
            return res.status(400).json({ sucesso: false, erro: "Esse ingrediente já está no estoque" });
        }
        erroServidor(res, erro, "Erro ao cadastrar ingrediente");
    }
});

// atualiza quantidade e/ou minimo
app.patch("/admin/estoque/:id", async function(req, res){
    const id = Number(req.params.id);
    const temQuantidade = req.body.quantidade !== undefined;
    const temMinimo = req.body.quantidade_minima !== undefined;
    const quantidade = temQuantidade ? Number(req.body.quantidade) : null;
    const minimo = temMinimo ? Number(req.body.quantidade_minima) : null;

    if(!Number.isInteger(id) || (!temQuantidade && !temMinimo)){
        return res.status(400).json({ sucesso: false, erro: "Dados inválidos" });
    }

    if(temQuantidade && (!Number.isFinite(quantidade) || quantidade < 0)){
        return res.status(400).json({ sucesso: false, erro: "Quantidade inválida" });
    }

    if(temMinimo && (!Number.isFinite(minimo) || minimo < 0)){
        return res.status(400).json({ sucesso: false, erro: "Mínimo inválido" });
    }

    try{
        const resultado = await pool.query(
            `UPDATE estoque
                SET quantidade = COALESCE($1, quantidade),
                    quantidade_minima = COALESCE($2, quantidade_minima)
              WHERE id = $3
          RETURNING id, quantidade, quantidade_minima`,
            [quantidade, minimo, id]
        );

        if(resultado.rowCount === 0){
            return res.status(404).json({ sucesso: false, erro: "Ingrediente não encontrado" });
        }
        res.json({ sucesso: true, item: resultado.rows[0] });
    }catch(erro){
        erroServidor(res, erro, "Erro ao atualizar o estoque");
    }
});


//funcionarios

app.get("/admin/funcionarios", async function(req, res){
    try{
        const resultado = await pool.query(
            `SELECT id, nome, email, telefone, cargo, status
               FROM funcionarios
              ORDER BY nome`
        );
        res.json({ sucesso: true, funcionarios: resultado.rows });
    }catch(erro){
        erroServidor(res, erro, "Erro ao listar funcionários");
    }
});

app.post("/admin/funcionarios", async function(req, res){
    const nome = String(req.body.nome || "").trim();
    const email = String(req.body.email || "").trim();
    const senha = String(req.body.senha || "");
    const telefone = String(req.body.telefone || "").trim();
    const cargo = req.body.cargo;
    const status = req.body.status || "ativo";

    if(!nome || !email || !senha){
        return res.status(400).json({ sucesso: false, erro: "Informe nome, email e senha" });
    }

    if(!CARGOS.includes(cargo) || !STATUS_FUNCIONARIO.includes(status)){
        return res.status(400).json({ sucesso: false, erro: "Cargo ou status inválido" });
    }

    try{
        const resultado = await pool.query(
            `INSERT INTO funcionarios (nome, email, senha, cargo, status, telefone)
             VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id`,
            [nome, email, senha, cargo, status, telefone || null]
        );
        res.json({ sucesso: true, id: resultado.rows[0].id });
    }catch(erro){
        // 23505 = email repetido
        if(erro.code === "23505"){
            return res.status(400).json({ sucesso: false, erro: "Já existe um funcionário com esse email" });
        }
        erroServidor(res, erro, "Erro ao cadastrar funcionário");
    }
});

app.put("/admin/funcionarios/:id", async function(req, res){
    const id = Number(req.params.id);
    const nome = String(req.body.nome || "").trim();
    const email = String(req.body.email || "").trim();
    const senha = String(req.body.senha || "");
    const telefone = String(req.body.telefone || "").trim();
    const cargo = req.body.cargo;
    const status = req.body.status || "ativo";

    if(!Number.isInteger(id) || !nome || !email){
        return res.status(400).json({ sucesso: false, erro: "Informe nome e email" });
    }

    if(!CARGOS.includes(cargo) || !STATUS_FUNCIONARIO.includes(status)){
        return res.status(400).json({ sucesso: false, erro: "Cargo ou status inválido" });
    }

    try{
        const atual = await pool.query("SELECT cargo, status FROM funcionarios WHERE id = $1", [id]);

        if(atual.rowCount === 0){
            return res.status(404).json({ sucesso: false, erro: "Funcionário não encontrado" });
        }

        // nao deixa o unico gerente ativo virar outro cargo ou ficar inativo
        const eraGerente = String(atual.rows[0].cargo).toLowerCase() === "gerente" && atual.rows[0].status === "ativo";

        if(eraGerente && (cargo !== "gerente" || status !== "ativo") && !(await restaOutroGerente(id))){
            return res.status(400).json({ sucesso: false, erro: "Precisa existir pelo menos um gerente ativo" });
        }

        // senha em branco = mantem a senha que ja existe
        await pool.query(
            `UPDATE funcionarios
                SET nome = $1, email = $2, cargo = $3, status = $4, telefone = $5,
                    senha = COALESCE($6, senha)
              WHERE id = $7`,
            [nome, email, cargo, status, telefone || null, senha ? senha : null, id]
        );

        res.json({ sucesso: true });
    }catch(erro){
        if(erro.code === "23505"){
            return res.status(400).json({ sucesso: false, erro: "Já existe um funcionário com esse email" });
        }
        erroServidor(res, erro, "Erro ao editar funcionário");
    }
});

app.delete("/admin/funcionarios/:id", async function(req, res){
    const id = Number(req.params.id);

    if(!Number.isInteger(id)){
        return res.status(400).json({ sucesso: false, erro: "Funcionário inválido" });
    }

    try{
        const atual = await pool.query("SELECT cargo, status FROM funcionarios WHERE id = $1", [id]);

        if(atual.rowCount === 0){
            return res.status(404).json({ sucesso: false, erro: "Funcionário não encontrado" });
        }

        const eraGerente = String(atual.rows[0].cargo).toLowerCase() === "gerente" && atual.rows[0].status === "ativo";

        if(eraGerente && !(await restaOutroGerente(id))){
            return res.status(400).json({ sucesso: false, erro: "Precisa existir pelo menos um gerente ativo" });
        }

        await pool.query("DELETE FROM funcionarios WHERE id = $1", [id]);
        res.json({ sucesso: true });
    }catch(erro){
        erroServidor(res, erro, "Erro ao excluir funcionário");
    }
});


//cozinha

// pedidos que ainda estao na cozinha
app.get("/admin/pedidos/cozinha", async function(req, res){
    try{
        const pedidos = await pool.query(
            `SELECT p.id, p.status, p.data_pedido, c.mesa
               FROM pedidos p
               JOIN clientes c ON c.id = p.id_cliente
              WHERE p.status IN ('recebido', 'em_preparo', 'pronto')
              ORDER BY p.data_pedido`
        );

        const ids = pedidos.rows.map(function(p){ return p.id; });
        let itens = [];

        if(ids.length > 0){
            const consulta = await pool.query(
                `SELECT i.id_pedido, pr.nome, i.quantidade
                   FROM itens_pedido i
                   JOIN produtos pr ON pr.id = i.id_produto
                  WHERE i.id_pedido = ANY($1)
                  ORDER BY i.id`,
                [ids]
            );
            itens = consulta.rows;
        }

        const resultado = pedidos.rows.map(function(pedido){
            return {
                id: pedido.id,
                mesa: pedido.mesa,
                status: pedido.status,
                data_pedido: pedido.data_pedido,
                itens: itens
                    .filter(function(item){ return item.id_pedido === pedido.id; })
                    .map(function(item){ return item.quantidade + "x " + item.nome; })
            };
        });

        res.json({ sucesso: true, pedidos: resultado });
    }catch(erro){
        erroServidor(res, erro, "Erro ao carregar os pedidos da cozinha");
    }
});

// muda o status e guarda no historico do cliente
app.patch("/admin/pedidos/:id/status", async function(req, res){
    const id = Number(req.params.id);
    const status = req.body.status;

    if(!Number.isInteger(id) || !STATUS_PEDIDO.includes(status)){
        return res.status(400).json({ sucesso: false, erro: "Pedido ou status inválido" });
    }

    const conexao = await pool.connect();

    try{
        await conexao.query("BEGIN");

        const atualizado = await conexao.query(
            "UPDATE pedidos SET status = $1 WHERE id = $2",
            [status, id]
        );

        if(atualizado.rowCount === 0){
            await conexao.query("ROLLBACK");
            return res.status(404).json({ sucesso: false, erro: "Pedido não encontrado" });
        }

        await conexao.query(
            "INSERT INTO historico_status_pedido (id_pedido, status) VALUES ($1, $2)",
            [id, status]
        );

        await conexao.query("COMMIT");
        res.json({ sucesso: true });
    }catch(erro){
        await conexao.query("ROLLBACK");
        erroServidor(res, erro, "Erro ao atualizar o status do pedido");
    }finally{
        conexao.release();
    }
});


//lista de pedidos (tela Pedidos do admin)

app.get("/admin/pedidos", async function(req, res){
    try{
        const resultado = await pool.query(
            `SELECT p.id, p.id_cliente, c.nome AS nome_cliente, c.mesa,
                    p.data_pedido, p.total, p.status, p.forma_pagamento
               FROM pedidos p
               JOIN clientes c ON c.id = p.id_cliente
              ORDER BY p.data_pedido DESC`
        );
        res.json({ sucesso: true, pedidos: resultado.rows });
    }catch(erro){
        erroServidor(res, erro, "Erro ao listar os pedidos");
    }
});


//fechar conta (o cliente paga no caixa, o funcionario registra a forma de pagamento)

app.post("/admin/clientes/:id/fechar-conta", async function(req, res){
    const clienteId = Number(req.params.id);
    const forma = req.body.forma_pagamento;

    if(!Number.isInteger(clienteId) || !FORMAS_PAGAMENTO.includes(forma)){
        return res.status(400).json({ sucesso: false, erro: "Cliente ou forma de pagamento inválidos" });
    }

    const conexao = await pool.connect();

    try{
        await conexao.query("BEGIN");

        // pedidos desse cliente que ainda nao foram pagos
        const abertos = await conexao.query(
            `SELECT id, status, total
               FROM pedidos
              WHERE id_cliente = $1
                AND status NOT IN ('conta_fechada', 'cancelado')
                FOR UPDATE`,
            [clienteId]
        );

        if(abertos.rowCount === 0){
            throw erroDeNegocio("Esse cliente não tem conta aberta");
        }

        // so fecha a conta quando tudo ja foi entregue na mesa
        // (se fechasse antes, o pedido sumia da cozinha sem ser feito)
        const aindaNaCozinha = abertos.rows.some(function(p){
            return p.status !== "entregue";
        });

        if(aindaNaCozinha){
            throw erroDeNegocio("Ainda há pedidos na cozinha ou a caminho da mesa");
        }

        const ids = abertos.rows.map(function(p){ return p.id; });
        const total = abertos.rows.reduce(function(soma, p){
            return soma + Number(p.total);
        }, 0);

        await conexao.query(
            `UPDATE pedidos
                SET status = 'conta_fechada',
                    forma_pagamento = $1,
                    data_pagamento = NOW()
              WHERE id = ANY($2)`,
            [forma, ids]
        );

        // registra na timeline de cada pedido
        await conexao.query(
            `INSERT INTO historico_status_pedido (id_pedido, status)
             SELECT unnest($1::int[]), 'conta_fechada'`,
            [ids]
        );

        await conexao.query("COMMIT");
        res.json({ sucesso: true, total: total, pedidos: ids.length });
    }catch(erro){
        await conexao.query("ROLLBACK");

        if(erro.negocio){
            return res.status(400).json({ sucesso: false, erro: erro.message });
        }
        erroServidor(res, erro, "Erro ao fechar a conta");
    }finally{
        conexao.release();
    }
});


//relatorios

app.get("/admin/relatorios", async function(req, res){
    try{
        const totais = await pool.query(
            `SELECT COUNT(*)::int AS total_pedidos,
                    COALESCE(SUM(total), 0) AS faturamento,
                    COUNT(*) FILTER (WHERE data_pedido::date = CURRENT_DATE)::int AS pedidos_hoje,
                    COUNT(*) FILTER (WHERE data_pedido >= date_trunc('week', CURRENT_DATE))::int AS pedidos_semana,
                    COUNT(*) FILTER (WHERE data_pedido >= date_trunc('month', CURRENT_DATE))::int AS pedidos_mes
               FROM pedidos`
        );

        const maisVendidos = await pool.query(
            `SELECT p.nome, SUM(i.quantidade)::int AS quantidade
               FROM itens_pedido i
               JOIN produtos p ON p.id = i.id_produto
              GROUP BY p.nome
              ORDER BY quantidade DESC
              LIMIT 5`
        );

        // quantos pedidos foram pagos em cada forma de pagamento
        const formas = await pool.query(
            `SELECT forma_pagamento, COUNT(*)::int AS quantidade
               FROM pedidos
              WHERE forma_pagamento IS NOT NULL
              GROUP BY forma_pagamento`
        );

        const pagamentos = { pix: 0, credito: 0, debito: 0, dinheiro: 0 };
        formas.rows.forEach(function(registro){
            pagamentos[registro.forma_pagamento] = registro.quantidade;
        });

        const linha = totais.rows[0];
        const faturamento = Number(linha.faturamento);

        res.json({
            sucesso: true,
            total_pedidos: linha.total_pedidos,
            faturamento: faturamento,
            ticket_medio: linha.total_pedidos > 0 ? faturamento / linha.total_pedidos : 0,
            pedidos_hoje: linha.pedidos_hoje,
            pedidos_semana: linha.pedidos_semana,
            pedidos_mes: linha.pedidos_mes,
            produtos: maisVendidos.rows,
            pagamentos: pagamentos
        });
    }catch(erro){
        erroServidor(res, erro, "Erro ao montar os relatórios");
    }
});


//dashboard

app.get("/dashboard/resumo", async function(req, res){
    try{
        // pedidos feitos hoje
        const feitos = await pool.query(
            `SELECT COUNT(*)::int AS total
               FROM pedidos
              WHERE data_pedido::date = CURRENT_DATE`
        );

        // faturamento = so o que foi pago hoje (conta fechada no caixa)
        const pagos = await pool.query(
            `SELECT COALESCE(SUM(total), 0) AS faturamento,
                    COUNT(*)::int AS total
               FROM pedidos
              WHERE status = 'conta_fechada'
                AND data_pagamento::date = CURRENT_DATE`
        );

        const faturamento = Number(pagos.rows[0].faturamento);
        const quantidadePagos = pagos.rows[0].total;

        res.json({
            sucesso: true,
            faturamento_dia: faturamento,
            pedidos_dia: feitos.rows[0].total,
            ticket_medio: quantidadePagos > 0 ? faturamento / quantidadePagos : 0
        });
    }catch(erro){
        erroServidor(res, erro, "Erro ao montar o resumo");
    }
});

app.get("/dashboard/produtos-mais-vendidos", async function(req, res){
    try{
        const resultado = await pool.query(
            `SELECT p.nome, SUM(i.quantidade)::int AS quantidade_vendida
               FROM itens_pedido i
               JOIN produtos p ON p.id = i.id_produto
              GROUP BY p.nome
              ORDER BY quantidade_vendida DESC
              LIMIT 5`
        );
        res.json({ sucesso: true, produtos: resultado.rows });
    }catch(erro){
        erroServidor(res, erro, "Erro ao buscar produtos mais vendidos");
    }
});

app.get("/dashboard/pedidos-por-hora", async function(req, res){
    try{
        const resultado = await pool.query(
            `SELECT EXTRACT(HOUR FROM data_pedido)::int AS hora,
                    COUNT(*)::int AS quantidade
               FROM pedidos
              WHERE data_pedido::date = CURRENT_DATE
              GROUP BY hora
              ORDER BY hora`
        );
        res.json({ sucesso: true, pedidos: resultado.rows });
    }catch(erro){
        erroServidor(res, erro, "Erro ao buscar pedidos por hora");
    }
});

app.get("/dashboard/estoque-baixo", async function(req, res){
    try{
        const resultado = await pool.query(
            `SELECT i.nome, e.quantidade, e.quantidade_minima
               FROM estoque e
               JOIN ingredientes i ON i.id = e.id_ingrediente
              WHERE e.quantidade < e.quantidade_minima
              ORDER BY i.nome`
        );
        res.json({ sucesso: true, itens: resultado.rows });
    }catch(erro){
        erroServidor(res, erro, "Erro ao buscar estoque baixo");
    }
});


app.listen(PORTA, function(){
    console.log("Servidor rodando em http://localhost:" + PORTA);
});