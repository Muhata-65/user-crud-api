const form = document.querySelector('#user-form');
const nameInput = document.querySelector('#name');
const emailInput = document.querySelector('#email');
const submitLabel = document.querySelector('#submit-label');
const cancelEditButton = document.querySelector('#cancel-edit');
const userList = document.querySelector('#user-list');
const userCount = document.querySelector('#user-count');
const resultCount = document.querySelector('#result-count');
const searchInput = document.querySelector('#search');
const refreshButton = document.querySelector('#refresh-button');
const emptyState = document.querySelector('#empty-state');
const jsonData = document.querySelector('#json-data');
const notice = document.querySelector('#notice');

const avatarColors = [
  ['#edf2e8', '#5b775a'],
  ['#f5eee5', '#99724f'],
  ['#eaf0f3', '#5d7d8c'],
  ['#f4eaf0', '#936b81'],
  ['#f0eee6', '#827548']
];
let users = [];
let editingId = null;
let noticeTimeout;

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.error) message = body.error;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function showNotice(message, type = 'error') {
  window.clearTimeout(noticeTimeout);
  notice.textContent = message;
  notice.classList.toggle('success', type === 'success');
  notice.hidden = false;
  noticeTimeout = window.setTimeout(() => {
    notice.hidden = true;
  }, 4500);
}

function actionButton(label, icon, className, onClick, description) {
  const button = document.createElement('button');
  button.className = `row-action ${className}`;
  button.type = 'button';
  button.setAttribute('aria-label', `${label} ${description}`);
  button.title = `${label} ${description}`;
  button.textContent = icon;
  button.addEventListener('click', onClick);
  return button;
}

function renderUsers() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const filteredUsers = users.filter((user) => (
    user.name.toLocaleLowerCase().includes(query) ||
    user.email.toLocaleLowerCase().includes(query)
  ));

  userList.replaceChildren();
  userCount.textContent = String(users.length).padStart(2, '0');
  resultCount.textContent = query
    ? `${filteredUsers.length} of ${users.length}`
    : `${users.length} ${users.length === 1 ? 'person' : 'people'}`;
  emptyState.hidden = filteredUsers.length !== 0;

  for (const [index, user] of filteredUsers.entries()) {
    const row = document.createElement('tr');
    const personCell = document.createElement('td');
    const person = document.createElement('div');
    person.className = 'person-cell';

    const avatar = document.createElement('span');
    const [background, color] = avatarColors[index % avatarColors.length];
    avatar.className = 'avatar';
    avatar.style.setProperty('--avatar-bg', background);
    avatar.style.setProperty('--avatar-color', color);
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = initials(user.name);

    const name = document.createElement('span');
    name.textContent = user.name;
    person.append(avatar, name);
    personCell.append(person);

    const emailCell = document.createElement('td');
    emailCell.textContent = user.email;

    const actionsCell = document.createElement('td');
    const actions = document.createElement('span');
    actions.className = 'row-actions';
    actions.append(
      actionButton('Edit', '↗', '', () => beginEdit(user), user.name),
      actionButton('Delete', '×', 'delete', () => deleteUser(user), user.name)
    );
    actionsCell.append(actions);
    row.append(personCell, emailCell, actionsCell);
    userList.append(row);
  }

  jsonData.textContent = JSON.stringify(users, null, 2);
}

async function loadUsers() {
  refreshButton.disabled = true;
  try {
    users = await request('/api/users');
    renderUsers();
  } catch (error) {
    showNotice(error.message);
    jsonData.textContent = 'Unable to load user data.';
  } finally {
    refreshButton.disabled = false;
  }
}

function resetForm() {
  editingId = null;
  form.reset();
  submitLabel.textContent = 'Add to directory';
  cancelEditButton.hidden = true;
  document.querySelector('#form-title').textContent = 'Add someone new';
}

function beginEdit(user) {
  editingId = user.id;
  nameInput.value = user.name;
  emailInput.value = user.email;
  submitLabel.textContent = 'Save changes';
  cancelEditButton.hidden = false;
  document.querySelector('#form-title').textContent = 'Edit this person';
  nameInput.focus();
  document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function deleteUser(user) {
  if (!window.confirm(`Remove ${user.name} from your directory?`)) return;

  try {
    await request(`/api/users/${user.id}`, { method: 'DELETE' });
    if (editingId === user.id) resetForm();
    await loadUsers();
    showNotice(`${user.name} was removed from your directory.`, 'success');
  } catch (error) {
    showNotice(error.message);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: nameInput.value.trim(),
    email: emailInput.value.trim()
  };
  const isEditing = editingId !== null;

  try {
    await request(
      isEditing ? `/api/users/${editingId}` : '/api/users',
      {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      }
    );
    resetForm();
    await loadUsers();
    showNotice(isEditing ? 'Your changes have been saved.' : 'A new person has been added.', 'success');
  } catch (error) {
    showNotice(error.message);
  }
});

cancelEditButton.addEventListener('click', resetForm);
refreshButton.addEventListener('click', loadUsers);
searchInput.addEventListener('input', renderUsers);

document.addEventListener('keydown', (event) => {
  if (
    event.key === '/' &&
    !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
  ) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && editingId !== null) resetForm();
});

loadUsers();
