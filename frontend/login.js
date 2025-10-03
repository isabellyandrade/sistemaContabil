// Importa o 'auth' do nosso arquivo de configuração
import { auth } from './firebase-config.js';
// Importa as funções de login do Firebase
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

const btnLoginGoogle = document.getElementById('login-google');

// Checa se o usuário JÁ ESTÁ LOGADO quando ele visita a página de login
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se já está logado, não tem por que ficar aqui. Redireciona para a página principal.
        console.log("Usuário já logado, redirecionando para o app...", user.displayName);
        window.location.href = 'index.html';
    }
});

// Adiciona a funcionalidade de clique para o botão de login
if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();

        signInWithPopup(auth, provider)
            .then((result) => {
                // Login com Google foi bem-sucedido
                const user = result.user;
                console.log("Login com Google bem-sucedido!", user);
                // Redireciona para a página principal do sistema
                window.location.href = 'index.html';
            })
            .catch((error) => {
                // Lida com erros que podem acontecer durante o login
                console.error("Erro no login com Google:", error);
                alert("Ocorreu um erro ao tentar fazer o login. Tente novamente.");
            });
    });
}