const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT || 3000);

// Origem permitida no CORS (endereco da aplicacao web na VM1).
// Pode receber varias origens separadas por virgula.
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const pool = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "cursos",
  password: process.env.DB_PASSWORD || "cursos123",
  database: process.env.DB_NAME || "cursos",
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
});

const app = express();

// CORS: somente a origem da VM1, metodos GET/POST e preflight OPTIONS
const corsOptions = {
  origin: CORS_ORIGIN,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

// POST /curso -> cadastra um curso
app.post("/curso", async (req, res) => {
  const { nome, instrutor, preco, vagas } = req.body || {};

  const precoNum = Number(preco);
  const vagasNum = Number(vagas);
  const erros = [];
  if (typeof nome !== "string" || !nome.trim()) erros.push("nome é obrigatório (texto)");
  if (typeof instrutor !== "string" || !instrutor.trim()) erros.push("instrutor é obrigatório (texto)");
  if (preco === undefined || preco === "" || !Number.isFinite(precoNum) || precoNum < 0)
    erros.push("preco deve ser um número decimal >= 0");
  if (vagas === undefined || vagas === "" || !Number.isInteger(vagasNum) || vagasNum < 0)
    erros.push("vagas deve ser um número inteiro >= 0");
  if (erros.length) return res.status(400).json({ erros });

  try {
    const [resultado] = await pool.execute(
      "INSERT INTO cursos (nome, instrutor, preco, vagas) VALUES (?, ?, ?, ?)",
      [nome.trim(), instrutor.trim(), precoNum, vagasNum]
    );
    const [linhas] = await pool.execute("SELECT * FROM cursos WHERE id = ?", [resultado.insertId]);
    res.status(201).json(linhas[0]);
  } catch (erro) {
    console.error("Erro ao cadastrar curso:", erro.message);
    res.status(500).json({ erro: "Erro ao cadastrar curso" });
  }
});

// GET /cursos -> lista todos os cursos
app.get("/cursos", async (req, res) => {
  try {
    const [linhas] = await pool.query("SELECT * FROM cursos ORDER BY id");
    res.json(linhas);
  } catch (erro) {
    console.error("Erro ao listar cursos:", erro.message);
    res.status(500).json({ erro: "Erro ao listar cursos" });
  }
});

// Cria a tabela (com novas tentativas enquanto o MySQL inicializa)
async function prepararBanco(tentativas = 30) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cursos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(255) NOT NULL,
          instrutor VARCHAR(255) NOT NULL,
          preco DECIMAL(10,2) NOT NULL,
          vagas INT NOT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
      console.log("Banco pronto.");
      return;
    } catch (erro) {
      console.log(`Aguardando MySQL (${i}/${tentativas}): ${erro.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("MySQL indisponível");
}

prepararBanco()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API ouvindo na porta ${PORT}. CORS liberado para: ${CORS_ORIGIN.join(", ")}`);
    });
  })
  .catch((erro) => {
    console.error(erro.message);
    process.exit(1);
  });
