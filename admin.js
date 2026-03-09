const loginForm = document.getElementById('login-form');
const passcodeInput = document.getElementById('passcode');
const authStatus = document.getElementById('auth-status');
const adminTools = document.getElementById('admin-tools');
const managerPanel = document.getElementById('manager-panel');
const uploadForm = document.getElementById('upload-form');
const uploadStatus = document.getElementById('upload-status');
const photosList = document.getElementById('photos-list');
const managerStatus = document.getElementById('manager-status');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');

function setAuthState(isAuthenticated) {
  loginForm.classList.toggle('hidden', isAuthenticated);
  adminTools.classList.toggle('hidden', !isAuthenticated);
  managerPanel.classList.toggle('hidden', !isAuthenticated);
}

function setMessage(el, message, type = '') {
  el.textContent = message;
  el.className = `${el.className.split(' ')[0]} ${type}`.trim();
}

async function login(event) {
  event.preventDefault();
  setMessage(authStatus, 'Signing in...');

  try {
    const response = await fetch('/api/admin-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: passcodeInput.value })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Login failed');
    }

    passcodeInput.value = '';
    setAuthState(true);
    setMessage(authStatus, 'Logged in.', 'success');
    await loadPhotos();
  } catch (error) {
    setMessage(authStatus, error.message || 'Unable to login.', 'error');
  }
}

async function logout() {
  await fetch('/api/admin-auth/logout', { method: 'POST' });
  setAuthState(false);
  setMessage(authStatus, 'Logged out.');
  photosList.innerHTML = '';
}

function renderPhotoCard(photo) {
  const isSeed = photo.source === 'seed';
  const article = document.createElement('article');
  article.className = 'panel admin-card';

  article.innerHTML = `
    <img class="admin-thumb" src="${photo.url}" alt="${photo.alt || photo.title}" />
    <form class="admin-update-form form-grid" data-id="${photo.id}">
      <label>
        Title
        <input name="title" value="${photo.title || ''}" ${isSeed ? 'readonly' : ''} />
      </label>
      <label>
        Category
        <input name="category" value="${photo.category || ''}" ${isSeed ? 'readonly' : ''} />
      </label>
      <label>
        Alt text
        <input name="alt" value="${photo.alt || ''}" ${isSeed ? 'readonly' : ''} />
      </label>
      <div class="row-actions">
        ${isSeed ? '<span class="muted">Starter photo (read-only)</span>' : '<button class="button" type="submit">Save</button><button class="button" type="button" data-action="delete">Delete</button>'}
      </div>
      <p class="status"></p>
    </form>
  `;

  if (!isSeed) {
    const form = article.querySelector('.admin-update-form');
    const statusEl = form.querySelector('.status');
    const deleteBtn = form.querySelector('[data-action="delete"]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(form).entries());

      statusEl.textContent = 'Saving...';
      try {
        const response = await fetch(`/api/admin-photos/${photo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Update failed');

        statusEl.textContent = 'Saved.';
        statusEl.className = 'status success';
      } catch (error) {
        statusEl.textContent = error.message || 'Unable to save.';
        statusEl.className = 'status error';
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm('Delete this photo?')) {
        return;
      }

      statusEl.textContent = 'Deleting...';
      try {
        const response = await fetch(`/api/admin-photos/${photo.id}`, { method: 'DELETE' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Delete failed');

        await loadPhotos();
      } catch (error) {
        statusEl.textContent = error.message || 'Unable to delete.';
        statusEl.className = 'status error';
      }
    });
  }

  return article;
}

async function loadPhotos() {
  managerStatus.textContent = 'Loading photos...';

  try {
    const response = await fetch('/api/admin-photos?admin=1', { credentials: 'include' });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Could not load photos');
    }

    photosList.innerHTML = '';
    for (const photo of payload.photos || []) {
      photosList.appendChild(renderPhotoCard(photo));
    }

    managerStatus.textContent = `${(payload.photos || []).length} photos loaded.`;
  } catch (error) {
    managerStatus.textContent = error.message || 'Unable to load photos.';
  }
}

async function uploadPhoto(event) {
  event.preventDefault();
  setMessage(uploadStatus, 'Uploading...');

  const data = new FormData(uploadForm);

  try {
    const response = await fetch('/api/admin-photos', {
      method: 'POST',
      body: data
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Upload failed');
    }

    uploadForm.reset();
    setMessage(uploadStatus, 'Photo uploaded.', 'success');
    await loadPhotos();
  } catch (error) {
    setMessage(uploadStatus, error.message || 'Unable to upload.', 'error');
  }
}

async function checkSession() {
  try {
    const response = await fetch('/api/admin-photos?admin=1', { credentials: 'include' });
    if (response.status === 401) {
      setAuthState(false);
      return;
    }

    const payload = await response.json();
    if (!response.ok) {
      setAuthState(false);
      return;
    }

    setAuthState(true);
    photosList.innerHTML = '';
    for (const photo of payload.photos || []) {
      photosList.appendChild(renderPhotoCard(photo));
    }
    managerStatus.textContent = `${(payload.photos || []).length} photos loaded.`;
  } catch {
    setAuthState(false);
  }
}

loginForm.addEventListener('submit', login);
uploadForm.addEventListener('submit', uploadPhoto);
refreshBtn.addEventListener('click', loadPhotos);
logoutBtn.addEventListener('click', logout);

checkSession();
