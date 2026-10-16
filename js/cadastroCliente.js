class cadastroCliente {
    #nomeCliente;
    #cpfCliente;
    #mesaCliente;

    constructor(nomeCliente, cpfCliente, mesaCliente) {
        this.#nomeCliente = nomeCliente;
        this.#cpfCliente = cpfCliente;
        this.#mesaCliente = mesaCliente;
    }

    validar() {
        if (this.#nomeCliente === "") {
            alert("Digite seu Nome");
            return false;

        } else if (this.#cpfCliente === "") {
            alert("Digite seu CPF");
            return false;

        } else if (this.#cpfCliente.length !== 11) {
            alert("O CPF deve ter 11 dígitos");
            return false;

        } else if (this.#mesaCliente === "") {
            alert("Digite o número da sua mesa");
            return false;

        } else {
            fetch("http://localhost:3000/clientes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nome: this.#nomeCliente,
                    cpf: this.#cpfCliente,
                    mesa: this.#mesaCliente
                })
            })
            .then(resposta => resposta.json())
            .then(dados => {
                if (dados.sucesso) {
                    localStorage.setItem("clienteId", dados.id);
                    window.location.href = "cardapio.html";
                } else {
                    alert("Erro ao cadastrar: " + dados.erro);
                }
            })
            .catch(erro => alert("Não foi possível conectar ao servidor"));
        }
    }
}

const nomeCliente = document.getElementById("DigiteSeuNome");
const CpfCliente = document.getElementById("inputCpf");
const mesaCliente = document.getElementById("inputMesa");
const entrarCardapio = document.getElementById("entrarCardapio");

entrarCardapio.addEventListener("click", function () {
    const cliente = new cadastroCliente(
        nomeCliente.value,
        CpfCliente.value,
        mesaCliente.value
    );
    cliente.validar();
});