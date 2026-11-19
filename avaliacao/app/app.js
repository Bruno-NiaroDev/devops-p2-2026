// URL da API na VM2 (definida em config.js, gerado pelo Ansible)
const API_URL = (window.API_URL || "http://localhost:3000").replace(/\/$/, "");

const mensagem = document.getElementById("mensagem");

function mostrar(texto, erro = false) {
  mensagem.textContent = texto;
  mensagem.className = erro ? "erro" : "ok";
}

// Pagina de cadastro: envia POST /curso
const form = document.getElementById("form-curso");
if (form) {
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const curso = {
      nome: form.nome.value,
      instrutor: form.instrutor.value,
      preco: parseFloat(form.preco.value),
      vagas: parseInt(form.vagas.value, 10),
    };

    try {
      const resposta = await fetch(`${API_URL}/curso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(curso),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        mostrar((dados.erros || [dados.erro]).join("; "), true);
        return;
      }
      mostrar(`Curso "${dados.nome}" cadastrado com ID ${dados.id}.`);
      form.reset();
    } catch (erro) {
      mostrar(`Falha ao acessar a API: ${erro.message}`, true);
    }
  });
}

// Pagina de listagem: consome GET /cursos
const lista = document.getElementById("lista-cursos");
if (lista) {
  const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  fetch(`${API_URL}/cursos`)
    .then((resposta) => {
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      return resposta.json();
    })
    .then((cursos) => {
      lista.innerHTML = "";
      if (cursos.length === 0) {
        lista.innerHTML = '<tr><td colspan="5">Nenhum curso cadastrado.</td></tr>';
        return;
      }
      for (const c of cursos) {
        const tr = document.createElement("tr");
        for (const valor of [c.id, c.nome, c.instrutor, reais.format(c.preco), c.vagas]) {
          const td = document.createElement("td");
          td.textContent = valor;
          tr.appendChild(td);
        }
        lista.appendChild(tr);
      }
    })
    .catch((erro) => {
      lista.innerHTML = "";
      mostrar(`Falha ao acessar a API: ${erro.message}`, true);
    });
}
