document.addEventListener('DOMContentLoaded', () => {
    const userData = localStorage.getItem('trotter_current_user');
    const userNameEl = document.getElementById('user-name');

    if (userData && userNameEl) {
        try {
            const currentUser = JSON.parse(userData);
            if (currentUser.name) {
                userNameEl.textContent = `Olá, ${currentUser.name.split(' ')[0]}`;
                console.log("✅ Nome exibido:", currentUser.name);
            }
        } catch (e) {
            console.error("❌ Erro ao ler dados do usuário", e);
        }
    } else {
        console.warn("⚠️ Elemento #user-name não encontrado ou usuário deslogado.");
    }

    const modal = document.getElementById('profile-modal');
    const userNameBtn = document.getElementById('user-name');
    const closeModal = document.querySelector('.close-modal');
    userNameBtn.addEventListener('click', () => {
        const userAuth = firebase.auth().currentUser;
        const localUser = JSON.parse(localStorage.getItem('trotter_current_user'));

        if (userAuth || localUser) {
            document.getElementById('edit-name').value = userAuth?.displayName || localUser?.name || "";
            document.getElementById('edit-email').value = userAuth?.email || localUser?.email || "";

            modal.style.display = 'block';
        } else {
            alert("Faça login para editar seu perfil.");
        }
    });
    closeModal.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => { if (event.target == modal) modal.style.display = 'none'; };
    document.getElementById('btn-update-name').addEventListener('click', async () => {
        const newName = document.getElementById('edit-name').value;
        const user = firebase.auth().currentUser;
        if (!newName) return alert("Digite um nome válido.");
        try {
            await user.updateProfile({ displayName: newName });
            await firebase.firestore().collection('users').doc(user.uid).update({
                name: newName
            });
            const localData = JSON.parse(localStorage.getItem('trotter_current_user'));
            localData.name = newName;
            localStorage.setItem('trotter_current_user', JSON.stringify(localData));
            userNameBtn.textContent = `Olá, ${newName.split(' ')[0]}`;
            alert("Nome atualizado com sucesso!");
            modal.style.display = 'none';
        } catch (error) {
            alert("Erro ao atualizar nome: " + error.message);
        }
    });

    document.getElementById('btn-update-email').addEventListener('click', async () => {
        const newEmail = document.getElementById('edit-email').value;
        const user = firebase.auth().currentUser;
        try {
            await user.verifyBeforeUpdateEmail(newEmail);
            alert(`Enviamos um e-mail de confirmação para ${newEmail}. A alteração só será concluída após a validação.`);
            modal.style.display = 'none';
        } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
                alert("Por segurança, saia e faça login novamente antes de alterar o e-mail.");
            } else {
                alert(error.message);
            }
        }
    });
    document.getElementById('btn-update-password').addEventListener('click', async () => {
        const user = firebase.auth().currentUser;
        try {
            await firebase.auth().sendPasswordResetEmail(user.email);
            alert("Link de redefinição de senha enviado para seu e-mail!");
            modal.style.display = 'none';
        } catch (error) {
            alert(error.message);
        }
    });
});

function renderPlaces(places, container) {
    container.innerHTML = '';
    if (places.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhum lugar encontrado nesta região.</p>';
        return;
    }
    places.forEach(place => {
        const card = document.createElement('div');
        card.className = 'place-card';
        card.innerHTML = `
            <div class="place-img" style="background-image: url('${place.image}')">
                <span class="place-tag">${place.category}</span>
            </div>
            <div class="place-info">
                <h3>${place.name}</h3>
                <p class="place-location"><i class="fas fa-map-marker-alt"></i> ${place.address}</p>
                <div class="place-footer">
                    <span class="rating"><i class="fas fa-star"></i> ${place.rating}</span>
                    <button class="btn-primary" onclick="window.location.href='map.html?id=${place.id}'" style="padding: 5px 15px; font-size: 0.8rem;">Ver no Mapa</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}
