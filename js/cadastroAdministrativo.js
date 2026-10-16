const botaoGerente = document.getElementById("Gerente");
const botaoFuncionario = document.getElementById("Funcionario");

let cargoSelecionado = "gerente";

botaoGerente.addEventListener("click", function () {
    cargoSelecionado = "gerente";
    botaoGerente.classList.add("selecionado");
    botaoFuncionario.classList.remove("selecionado");
});

botaoFuncionario.addEventListener("click", function () {
    cargoSelecionado = "funcionario";
    botaoFuncionario.classList.add("selecionado");
    botaoGerente.classList.remove("selecionado");
});

class cadastroAdministrador {
    #emailAdministrador;
    #senhaAdministrador;
    #cargoAdministrador;


    constructor(senhaAdministrador, emailAdministrador, cargoAdministrador) {
        this.#senhaAdministrador = senhaAdministrador;
        this.#emailAdministrador = emailAdministrador;
        this.#cargoAdministrador = cargoAdministrador;

    }

    validar() {

        if (this.#senhaAdministrador === "") {
            alert("Digite sua Senha");
            return false;

        } else if (this.#emailAdministrador === "") {
            alert("Digite seu Email");
            return false;

        } else if (this.#senhaAdministrador.length < 3) {//colocar a senha do banco ligada aqui
            alert("Senha deve ter mais de 3 caracteres");
            return false;

        } else {
            fetch("http://localhost:3000/login-administrativo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: this.#emailAdministrador,
                    senha: this.#senhaAdministrador,
                    cargo: this.#cargoAdministrador
                })
            })
                .then(resposta => resposta.json())
                .then(dados => {
                    if (dados.sucesso) {
                        if (dados.cargo !== "gerente") {
                            alert("O Dashboard é exclusivo para gerente.");
                            return;
                        }

                        sessionStorage.setItem("usuarioNome", dados.nome || "Gerente");
                        sessionStorage.setItem("usuarioCargo", dados.cargo);
                        window.location.href = "Dashboard.html";
                    } else {
                        alert("Erro ao entrar: " + dados.erro);
                    }
                })
                .catch(erro => alert("Não foi possível conectar ao servidor"));
        }
    }
}
const senhaAdministrador = document.getElementById("DigiteSenha");
const emailAdministrador = document.getElementById("DigiteEmail");
const EntrarSistema = document.getElementById("EntrarSistema");


EntrarSistema.addEventListener("click", function () {

    const AdministradorCadastro = new cadastroAdministrador(
        senhaAdministrador.value,
        emailAdministrador.value,
        cargoSelecionado
    );

    AdministradorCadastro.validar();
});