const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Disponibiliza as páginas HTML, CSS, JavaScript e imagens do projeto.
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'selecao-acesso.html'));
});

function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;

    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;

    return true;
}

app.post('/clientes', async (req, res) => {
  const { nome, cpf, mesa } = req.body;

  if (!validarCPF(cpf)) {
    return res.status(400).json({ sucesso: false, erro: "CPF inválido" });
  }

  try {
    const resultado = await pool.query(
      'INSERT INTO clientes (nome, cpf, mesa) VALUES ($1, $2, $3) RETURNING id',
      [nome, cpf, mesa]
    );
    res.json({ sucesso: true, id: resultado.rows[0].id });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

app.post('/login-administrativo', async (req, res) => {
  const { email, senha, cargo } = req.body;
  try {
    const resultado = await pool.query('SELECT * FROM funcionarios WHERE email = $1', [email]);
    if (resultado.rows.length === 0) {
      return res.status(401).json({ sucesso: false, erro: "Email não encontrado" });
    }
    const funcionario = resultado.rows[0];
    if (funcionario.senha !== senha) {
      return res.status(401).json({ sucesso: false, erro: "Senha incorreta" });
    }
    if (funcionario.cargo !== cargo) {
      return res.status(401).json({ sucesso: false, erro: "Cargo não confere com o cadastro" });
    }
    res.json({ sucesso: true, nome: funcionario.nome, cargo: funcionario.cargo });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

app.post('/pedidos', async (req, res) => {
  const { clienteId, itens, subtotal, taxaServico, total } = req.body;
  if (!clienteId || !Array.isArray(itens) || itens.length === 0) {
  return res.status(400).json({
    sucesso: false,
    erro: "Pedido inválido ou carrinho vazio."
  });
}
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pedidoResult = await client.query(
      `INSERT INTO pedidos (id_cliente, status, subtotal, taxa_servico, total, tempo_estimado_min, tempo_estimado_max)
       VALUES ($1, 'recebido', $2, $3, $4, 34, 44) RETURNING id`,
      [clienteId, subtotal, taxaServico, total]
    );
    const pedidoId = pedidoResult.rows[0].id;

    for (const item of itens) {
      await client.query(
        'INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario) VALUES ($1,$2,$3,$4)',
        [pedidoId, item.id, item.quantidade, item.preco]
      );
    }

    await client.query(
      "INSERT INTO historico_status_pedido (id_pedido, status) VALUES ($1, 'recebido')",
      [pedidoId]
    );

    await client.query('COMMIT');
    res.json({ sucesso: true, pedidoId: pedidoId });
  } catch (erro) {
    await client.query('ROLLBACK');
    res.status(500).json({ sucesso: false, erro: erro.message });
  } finally {
    client.release();
  }
});

app.get('/pedidos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pedido = await pool.query('SELECT * FROM pedidos WHERE id = $1', [id]);
    if (pedido.rows.length === 0) {
      return res.status(404).json({ sucesso: false, erro: "Pedido não encontrado" });
    }
    res.json({ sucesso: true, pedido: pedido.rows[0] });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

app.get('/clientes/:id/historico', async (req, res) => {
  const { id } = req.params;
  try {
    const pedidos = await pool.query(
      `SELECT p.id, p.data_pedido, p.status, p.total, a.nota
       FROM pedidos p
       LEFT JOIN avaliacoes a ON a.id_pedido = p.id
       WHERE p.id_cliente = $1
       ORDER BY p.data_pedido DESC`,
      [id]
    );

    const resultado = [];
    for (const pedido of pedidos.rows) {
      const itens = await pool.query(
        `SELECT pr.nome, ip.quantidade, ip.preco_unitario
         FROM itens_pedido ip
         JOIN produtos pr ON pr.id = ip.id_produto
         WHERE ip.id_pedido = $1`,
        [pedido.id]
      );
      resultado.push({ ...pedido, itens: itens.rows });
    }

    res.json({ sucesso: true, pedidos: resultado });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});


// =========================
// DASHBOARD (GERENTE)
// =========================

// Indicadores do dia. Considera "conta_fechada" como pedido finalizado.
app.get('/dashboard/resumo', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        COALESCE(SUM(total) FILTER (WHERE status = 'conta_fechada'), 0) AS faturamento_dia,
        COUNT(*) AS pedidos_dia,
        COUNT(*) FILTER (WHERE status = 'conta_fechada') AS pedidos_finalizados,
        COALESCE(
          AVG(total) FILTER (WHERE status = 'conta_fechada'),
          0
        ) AS ticket_medio
      FROM pedidos
      WHERE data_pedido >= CURRENT_DATE
        AND data_pedido < CURRENT_DATE + INTERVAL '1 day'
    `);

    res.json({ sucesso: true, ...resultado.rows[0] });
  } catch (erro) {
    console.error('Erro ao consultar resumo do dashboard:', erro);
    res.status(500).json({ sucesso: false, erro: 'Não foi possível carregar os indicadores.' });
  }
});

// Top 5 produtos por quantidade vendida nos últimos 30 dias.
app.get('/dashboard/produtos-mais-vendidos', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        pr.id,
        pr.nome,
        COALESCE(SUM(ip.quantidade), 0)::int AS quantidade_vendida
      FROM itens_pedido ip
      JOIN pedidos pe ON pe.id = ip.id_pedido
      JOIN produtos pr ON pr.id = ip.id_produto
      WHERE pe.data_pedido >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY pr.id, pr.nome
      ORDER BY quantidade_vendida DESC, pr.nome ASC
      LIMIT 5
    `);

    res.json({ sucesso: true, produtos: resultado.rows });
  } catch (erro) {
    console.error('Erro ao consultar produtos mais vendidos:', erro);
    res.status(500).json({ sucesso: false, erro: 'Não foi possível carregar os produtos mais vendidos.' });
  }
});

// Quantidade de pedidos por hora no dia atual.
app.get('/dashboard/pedidos-por-hora', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM data_pedido)::int AS hora,
        COUNT(*)::int AS quantidade
      FROM pedidos
      WHERE data_pedido >= CURRENT_DATE
        AND data_pedido < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY EXTRACT(HOUR FROM data_pedido)
      ORDER BY hora
    `);

    res.json({ sucesso: true, pedidos: resultado.rows });
  } catch (erro) {
    console.error('Erro ao consultar pedidos por hora:', erro);
    res.status(500).json({ sucesso: false, erro: 'Não foi possível carregar os pedidos por hora.' });
  }
});

// Ingredientes cuja quantidade está abaixo do mínimo cadastrado.
app.get('/dashboard/estoque-baixo', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        i.id,
        i.nome,
        e.quantidade,
        e.quantidade_minima
      FROM estoque e
      JOIN ingredientes i ON i.id = e.id_ingrediente
      WHERE e.quantidade < e.quantidade_minima
      ORDER BY (e.quantidade_minima - e.quantidade) DESC, i.nome ASC
    `);

    res.json({ sucesso: true, itens: resultado.rows });
  } catch (erro) {
    console.error('Erro ao consultar estoque baixo:', erro);
    res.status(500).json({ sucesso: false, erro: 'Não foi possível carregar os alertas de estoque.' });
  }
});


 // Listar todos os ingredientes do estoque.
app.get('/admin/estoque', async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                i.id,
                i.nome,
                e.quantidade,
                e.quantidade_minima
            FROM estoque e
            JOIN ingredientes i ON i.id = e.id_ingrediente
            ORDER BY i.nome ASC
        `);

        res.json({
            sucesso: true,
            itens: resultado.rows
        });
    } catch (erro) {
        console.error('Erro ao consultar estoque:', erro);
        res.status(500).json({
            sucesso: false,
            erro: 'Não foi possível carregar o estoque.'
        });
    }
});

// =========================
// PEDIDOS ADMINISTRATIVOS
// =========================

app.get('/admin/pedidos', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        p.id,
        p.data_pedido,
        p.status,
        p.subtotal,
        p.taxa_servico,
        p.total,
        p.tempo_estimado_min,
        p.tempo_estimado_max,
        c.nome AS nome_cliente,
        c.mesa
      FROM pedidos p
      JOIN clientes c ON c.id = p.id_cliente
      ORDER BY p.data_pedido DESC
    `);

    res.json({
      sucesso: true,
      pedidos: resultado.rows
    });
  } catch (erro) {
    console.error('Erro ao consultar pedidos:', erro);

    res.status(500).json({
      sucesso: false,
      erro: 'Não foi possível carregar os pedidos.'
    });
  }
});

// EDITAR PRODUTO
app.put('/admin/produtos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, descricao, preco, categoria } = req.body;

    if (
        !nome?.trim() ||
        !categoria?.trim() ||
        descricao == null ||
        preco === '' ||
        preco == null ||
        !Number.isFinite(Number(preco)) ||
        Number(preco) < 0
    ) {
        return res.status(400).json({
            sucesso: false,
            erro: 'Preencha os dados corretamente.'
        });
    }

    try {
        const resultado = await pool.query(
            `UPDATE produtos
             SET nome = $1,
                 descricao = $2,
                 preco = $3,
                 categoria = $4
             WHERE id = $5
             RETURNING id`,
            [nome.trim(), descricao.trim(), Number(preco), categoria.trim(), id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                sucesso: false,
                erro: 'Produto não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Produto atualizado com sucesso!'
        });
    } catch (erro) {
        console.error('Erro ao editar produto:', erro);
        res.status(500).json({
            sucesso: false,
            erro: 'Não foi possível editar o produto.'
        });
    }
});

// ATIVAR OU DESATIVAR PRODUTO MANUALMENTE
app.patch('/admin/produtos/:id/disponibilidade', async (req, res) => {
    const { id } = req.params;
    const { disponivel } = req.body;

    if (typeof disponivel !== 'boolean') {
        return res.status(400).json({
            sucesso: false,
            erro: 'Informe se o produto está disponível.'
        });
    }

    try {
        const resultado = await pool.query(
            `UPDATE produtos
             SET disponivel = $1
             WHERE id = $2
             RETURNING id`,
            [disponivel, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                sucesso: false,
                erro: 'Produto não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: disponivel
                ? 'Produto ativado manualmente.'
                : 'Produto desativado manualmente.'
        });
    } catch (erro) {
        console.error('Erro ao alterar disponibilidade:', erro);
        res.status(500).json({
            sucesso: false,
            erro: 'Não foi possível alterar a disponibilidade.'
        });
    }
});

// =========================
// PRODUTOS E DISPONIBILIDADE
// =========================

const consultaProdutosSQL = `
  SELECT
    p.id,
    p.nome,
    p.descricao,
    p.preco,
    p.categoria,
    p.pecas,
    p.icone,
    p.disponivel AS disponivel_manual,
    (
      p.disponivel = TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM produto_ingrediente pi
        LEFT JOIN estoque e
          ON e.id_ingrediente = pi.id_ingrediente
        WHERE pi.id_produto = p.id
          AND (
            e.id IS NULL
            OR e.quantidade < pi.quantidade
          )
      )
    ) AS disponivel_venda
  FROM produtos p
  ORDER BY p.id;
`;

// Produtos para o cardápio do cliente
app.get('/produtos', async (req, res) => {
  try {
    const resultado = await pool.query(consultaProdutosSQL);

    res.json({
      sucesso: true,
      produtos: resultado.rows
    });
  } catch (erro) {
    console.error('Erro ao consultar produtos:', erro);

    res.status(500).json({
      sucesso: false,
      erro: 'Não foi possível carregar os produtos.'
    });
  }
});

// Produtos para o painel administrativo
app.get('/admin/produtos', async (req, res) => {
  try {
    const resultado = await pool.query(consultaProdutosSQL);

    res.json({
      sucesso: true,
      produtos: resultado.rows
    });
  } catch (erro) {
    console.error('Erro ao consultar produtos administrativos:', erro);

    res.status(500).json({
      sucesso: false,
      erro: 'Não foi possível carregar os produtos.'
    });
  }
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});