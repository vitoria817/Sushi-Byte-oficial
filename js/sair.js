// Script comum das telas do administrador:
// botão de sair, nome de quem fez login e permissão por cargo

function sairDoSistema(evento){
    evento.preventDefault();

    sessionStorage.removeItem("usuarioNome");
    sessionStorage.removeItem("usuarioCargo");

    window.location.href = "selecao-acesso.html";
}

// mostra o nome, a inicial e o cargo de quem logou no menu lateral
function mostrarUsuario(){
    const nome = sessionStorage.getItem("usuarioNome");
    const cargo = sessionStorage.getItem("usuarioCargo");
    if(!nome) return;

    const campoNome = document.getElementById("nomeGerente");
    const campoCargo = document.querySelector("aside .menu-lateral-dados small");
    const avatar = document.querySelector("aside .user-avatar");

    if(campoNome) campoNome.textContent = nome;
    if(campoCargo) campoCargo.textContent = cargo === "gerente" ? "Gerente" : "Funcionário";
    if(avatar) avatar.textContent = nome.trim().charAt(0).toUpperCase() || "G";
}

// so o gerente acessa a parte de Funcionarios
function aplicarPermissao(){
    const cargo = sessionStorage.getItem("usuarioCargo");
    if(cargo === "gerente") return;

    // tira o link do menu
    document.querySelectorAll("aside a[href*='#funcionarios'], aside a[data-target='funcionarios']").forEach(function(link){
        link.style.display = "none";
    });

    // na tela de relatorios, esconde a aba e abre a cozinha
    const telaFuncionarios = document.getElementById("view-funcionarios");
    if(telaFuncionarios){
        telaFuncionarios.style.display = "none";

        const abaCozinha = document.querySelector("aside .nav-item[data-target='cozinha']");
        if(abaCozinha) abaCozinha.click();
    }
}

document.addEventListener("DOMContentLoaded", function(){
    const botoes = document.querySelectorAll("#sairBtn, .logout, .logout-button");

    botoes.forEach(function(botao){
        botao.addEventListener("click", sairDoSistema);
    });

    mostrarUsuario();
    aplicarPermissao();
});