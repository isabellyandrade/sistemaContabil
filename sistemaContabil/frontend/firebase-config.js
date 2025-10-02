
// Importa as funções que vamos precisar do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCXBjBou4925CW7AsDEGGQByFS0cvMd9js",
    authDomain: "contabilisa-4be6e.firebaseapp.com",
    databaseURL: "https://contabilisa-4be6e-default-rtdb.firebaseio.com",
    projectId: "contabilisa-4be6e",
    storageBucket: "contabilisa-4be6e.firebasestorage.app",
    messagingSenderId: "981510488911",
    appId: "1:981510488911:web:59321298dff5e4eff4bb3a",
    measurementId: "G-J14D46FR7E"
  };

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta o serviço de autenticação para usarmos em outros arquivos
export const auth = getAuth(app);