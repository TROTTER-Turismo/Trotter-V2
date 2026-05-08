import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile, 
    onAuthStateChanged, 
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const CURRENT_USER_KEY = 'trotter_current_user';

// Helper para mensagens
function showMessage(text, type) {
    const msgEl = document.getElementById('auth-message');
    if (msgEl) {
        msgEl.textContent = text;
        msgEl.className = 'message ' + type;
    }
}

// Observador de estado de autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuário logado
        const userData = {
            uid: user.uid,
            name: user.displayName || 'Viajante',
            email: user.email
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userData));
        
        // Se estiver na página de login ou registro, vai para home
        if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('register.html') || window.location.pathname === '/') {
            const isRoot = !window.location.pathname.includes('pages/');
            window.location.href = isRoot ? 'pages/home.html' : 'home.html';
        }
    } else {
        // Usuário deslogado
        localStorage.removeItem(CURRENT_USER_KEY);
        // Se não estiver em login/registro, volta para login
        if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('register.html') && window.location.pathname !== '/') {
            const isRoot = !window.location.pathname.includes('pages/');
            window.location.href = isRoot ? 'index.html' : '../index.html';
        }
    }
});

// Login com E-mail e Senha
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            showMessage('Login realizado com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            showMessage('Erro ao entrar: Verifique suas credenciais.', 'error');
        }
    });
}

// Registro de Novo Usuário
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (password !== confirmPassword) {
            showMessage('As senhas não coincidem.', 'error');
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Atualizar perfil com nome
            await updateProfile(user, { displayName: name });

            // Salvar no Firestore
            await setDoc(doc(db, "usuarios", user.uid), {
                nome: name,
                email: email,
                criadoEm: new Date().toISOString()
            });

            showMessage('Conta criada com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            showMessage('Erro ao criar conta: ' + error.message, 'error');
        }
    });
}

// Login com Google
const googleBtn = document.getElementById('btn-google');
if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Salvar/Atualizar no Firestore
            await setDoc(doc(db, "usuarios", user.uid), {
                nome: user.displayName,
                email: user.email,
                ultimoLogin: new Date().toISOString()
            }, { merge: true });

        } catch (error) {
            console.error(error);
            showMessage('Erro no login com Google.', 'error');
        }
    });
}

// Função de Logout Global
window.logout = async function() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
};
