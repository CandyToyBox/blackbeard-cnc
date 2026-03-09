const galleryGrid = document.getElementById('gallery-grid');
const galleryStatus = document.getElementById('gallery-status');
const quoteForm = document.getElementById('quote-form');
const formStatus = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');
const fileInput = document.getElementById('file-input');
const fileHelp = document.getElementById('file-help');

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedMimePrefixes = ['image/'];
const allowedMimeExact = [
  'application/pdf',
  'application/dxf',
  'image/vnd.dxf',
  'application/x-dxf',
  'application/x-autocad'
];
const allowedExtensions = ['.pdf', '.dxf'];

function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatFileBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedFile(file) {
  if (allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix))) {
    return true;
  }

  if (allowedMimeExact.includes(file.type)) {
    return true;
  }

  const lowered = file.name.toLowerCase();
  return allowedExtensions.some((ext) => lowered.endsWith(ext));
}

function updateFileHelp() {
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    fileHelp.textContent = 'No files selected.';
    return;
  }

  const summary = files.map((f) => `${f.name} (${formatFileBytes(f.size)})`).join(', ');
  fileHelp.textContent = summary;
}

function setFormStatus(message, type = '') {
  formStatus.textContent = message;
  formStatus.className = `status ${type}`.trim();
}

function renderGallery(photos) {
  if (!photos.length) {
    galleryGrid.innerHTML = '<p class="muted">No photos available yet.</p>';
    return;
  }

  galleryGrid.innerHTML = photos
    .map(
      (photo) => `
        <article class="panel photo-card">
          <figure>
            <img loading="lazy" src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.alt || photo.title || 'Blackbeard CNC project photo')}" onerror="this.closest('article').classList.add('image-failed'); this.alt='Image unavailable';" />
            <figcaption>
              <div class="photo-title">${escapeHtml(photo.title || 'Custom Project')}</div>
              <div class="photo-meta">${escapeHtml(photo.category || 'General')}</div>
            </figcaption>
          </figure>
        </article>
      `
    )
    .join('');
}

async function loadGallery() {
  try {
    galleryStatus.textContent = 'Loading gallery...';
    const response = await fetch('/api/admin-photos');
    if (!response.ok) {
      throw new Error('Photo API unavailable');
    }

    const payload = await response.json();
    renderGallery(payload.photos || []);
    galleryStatus.textContent = `${(payload.photos || []).length} photos loaded.`;
  } catch (error) {
    console.error(error);
    galleryStatus.textContent = 'Could not load live gallery. Showing starter photos.';

    const fallback = await fetch('/data/seed-photos.json').then((res) => res.json());
    renderGallery(fallback);
  }
}

function validateForm(formData, files) {
  const requiredFields = ['name', 'phone', 'email', 'requestType', 'projectDescription'];
  for (const key of requiredFields) {
    if (!String(formData.get(key) || '').trim()) {
      return `Please complete the required field: ${key}.`;
    }
  }

  if (files.length > MAX_FILES) {
    return `Please upload no more than ${MAX_FILES} files.`;
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} exceeds the 10MB per-file limit.`;
    }

    if (!isAllowedFile(file)) {
      return `${file.name} is not an accepted format. Use image, PDF, or DXF files.`;
    }
  }

  return null;
}

async function submitRequest(event) {
  event.preventDefault();
  setFormStatus('');

  const formData = new FormData(quoteForm);
  const files = Array.from(fileInput.files || []);

  const error = validateForm(formData, files);
  if (error) {
    setFormStatus(error, 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  try {
    const response = await fetch('/api/submit-request', {
      method: 'POST',
      body: formData
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Submission failed.');
    }

    quoteForm.reset();
    updateFileHelp();
    setFormStatus('Request sent successfully. Blackbeard CNC will follow up soon.', 'success');
  } catch (err) {
    setFormStatus(err.message || 'Unable to send request at this time.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Request';
  }
}

fileInput.addEventListener('change', updateFileHelp);
quoteForm.addEventListener('submit', submitRequest);
loadGallery();
