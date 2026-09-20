const API_URL = '/api';
let currentUser = null;
let allUsersList = [];
let openCommentSections = new Set();

document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showAppPage();
  } else {
    showLoginPage();
  }
});

function showLoginPage() {
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('registerView').classList.add('hidden');
  document.getElementById('appView').classList.add('hidden');
  document.getElementById('loginError').innerText = '';
}

function showRegisterPage() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('registerView').classList.remove('hidden');
  document.getElementById('appView').classList.add('hidden');
  document.getElementById('registerError').innerText = '';
}

function showAppPage() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('registerView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');

  loadProfileStats();
  loadUsers();
  loadPosts();
}

async function loadProfileStats() {
  try {
    const res = await fetch(`${API_URL}/users/${currentUser.id}?currentUserId=${currentUser.id}`);
    const data = await res.json();

    document.getElementById('profileName').innerText = data.name || currentUser.username;
    document.getElementById('profileHandle').innerText = `@${data.username}`;

    const avatarText = document.getElementById('profileAvatar');
    const avatarImg = document.getElementById('profileImage');
    const removeBtn = document.getElementById('removeAvatarBtn');

    if (data.avatar) {
      avatarImg.src = data.avatar;
      avatarImg.classList.remove('hidden');
      avatarText.classList.add('hidden');
      removeBtn.classList.remove('hidden');
    } else {
      avatarText.innerText = (data.name || data.username).charAt(0).toUpperCase();
      avatarText.classList.remove('hidden');
      avatarImg.classList.add('hidden');
      removeBtn.classList.add('hidden');
    }

    document.getElementById('postsCount').innerText = data.postsCount || 0;
    document.getElementById('followersCount').innerText = data.followersCount || 0;
    document.getElementById('followingCount').innerText = data.followingCount || 0;
  } catch (err) {
    console.error('Error loading profile stats:', err);
  }
}

function triggerProfileUpload() {
  document.getElementById('profilePicInput').click();
}

function uploadProfilePicture(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Image = e.target.result;

    await fetch(`${API_URL}/users/${currentUser.id}/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: base64Image })
    });

    loadProfileStats();
  };
  reader.readAsDataURL(file);
}

async function removeProfilePicture() {
  await fetch(`${API_URL}/users/${currentUser.id}/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar: null })
  });
  loadProfileStats();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentUser = data.user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    showAppPage();
  } catch (err) {
    document.getElementById('loginError').innerText = err.message;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    alert('Registration successful! Please login.');
    showLoginPage();
  } catch (err) {
    document.getElementById('registerError').innerText = err.message;
  }
}

function logout() {
  localStorage.removeItem('currentUser');
  currentUser = null;
  showLoginPage();
}

/* Header Search & Suggestions */
function toggleSearchDropdown() {
  const dropdown = document.getElementById('searchDropdown');
  dropdown.classList.toggle('hidden');
  if (!dropdown.classList.contains('hidden')) {
    document.getElementById('headerSearchInput').focus();
    filterSuggestions();
  }
}

async function loadUsers() {
  try {
    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();

    allUsersList = [];
    for (const u of users) {
      if (String(u.id) === String(currentUser.id)) continue;

      const profileRes = await fetch(`${API_URL}/users/${u.id}?currentUserId=${currentUser.id}`);
      const profile = await profileRes.json();
      allUsersList.push(profile);
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

function filterSuggestions() {
  const query = document.getElementById('headerSearchInput').value.toLowerCase();
  const suggestionsList = document.getElementById('suggestionsList');
  suggestionsList.innerHTML = '';

  const filtered = allUsersList.filter(u => 
    (u.name && u.name.toLowerCase().includes(query)) || 
    u.username.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    suggestionsList.innerHTML = '<p style="color:#65676b; font-size:0.85rem; padding: 8px;">No users found.</p>';
    return;
  }

  filtered.forEach(user => {
    suggestionsList.innerHTML += `
      <div class="suggestion-item">
        <div class="suggestion-info" onclick="selectSuggestedUser(${user.id})">
          <strong>${user.name || user.username}</strong>
          <small>@${user.username}</small>
        </div>
        <button class="${user.isFollowing ? 'secondary' : ''}" style="font-size:0.75rem; padding: 4px 8px;" onclick="toggleFollow(${user.id})">
          ${user.isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      </div>
    `;
  });
}

function selectSuggestedUser(userId) {
  document.getElementById('searchDropdown').classList.add('hidden');
  openProfileModal(userId);
}

async function openProfileModal(userId) {
  try {
    const res = await fetch(`${API_URL}/users/${userId}?currentUserId=${currentUser.id}`);
    const profile = await res.json();

    document.getElementById('modalName').innerText = profile.name || profile.username;
    document.getElementById('modalHandle').innerText = `@${profile.username}`;

    const avatarText = document.getElementById('modalAvatar');
    const avatarImg = document.getElementById('modalImage');

    if (profile.avatar) {
      avatarImg.src = profile.avatar;
      avatarImg.classList.remove('hidden');
      avatarText.classList.add('hidden');
    } else {
      avatarText.innerText = (profile.name || profile.username).charAt(0).toUpperCase();
      avatarText.classList.remove('hidden');
      avatarImg.classList.add('hidden');
    }

    document.getElementById('modalPostsCount').innerText = profile.postsCount || 0;
    document.getElementById('modalFollowersCount').innerText = profile.followersCount || 0;
    document.getElementById('modalFollowingCount').innerText = profile.followingCount || 0;

    const followBtn = document.getElementById('modalFollowBtn');
    followBtn.innerText = profile.isFollowing ? 'Unfollow' : 'Follow';
    followBtn.className = profile.isFollowing ? 'follow-modal-btn secondary' : 'follow-modal-btn';
    followBtn.onclick = async () => {
      await toggleFollow(profile.id);
      openProfileModal(profile.id);
    };

    const postsRes = await fetch(`${API_URL}/users/${userId}/posts?currentUserId=${currentUser.id}`);
    const posts = await postsRes.json();

    const postsContainer = document.getElementById('modalUserPosts');
    postsContainer.innerHTML = renderPostsHTML(posts);

    document.getElementById('profileModal').classList.remove('hidden');
  } catch (err) {
    console.error('Error opening profile modal:', err);
  }
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.add('hidden');
}

function renderPostsHTML(posts) {
  if (posts.length === 0) {
    return '<p style="color:#65676b; font-size:0.9rem; text-align:center; padding: 10px;">No posts yet.</p>';
  }

  return posts.map(post => {
    const isCommentsVisible = openCommentSections.has(post.id);
    const isPostOwner = String(post.author_id) === String(currentUser.id);

    return `
    <div class="card">
      <div class="post-top-row">
        <div class="post-header">@${post.author_name}</div>
        ${isPostOwner ? `<button class="delete-post-btn" onclick="deletePost(${post.id})" title="Delete Post">🗑️</button>` : ''}
      </div>
      <p>${post.content}</p>
      
      <div class="post-actions-row">
        <div class="action-item">
          <button class="icon-btn" onclick="toggleLike(${post.id})">❤️</button>
          <span class="action-count">${post.likes_count}</span>
        </div>

        <div class="action-item">
          <button class="icon-btn" onclick="toggleComments(${post.id})">💬</button>
          <span class="action-count">${post.comments.length}</span>
        </div>
      </div>

      <div class="comments-section ${isCommentsVisible ? '' : 'hidden'}" id="comments-section-${post.id}">
        <strong>Comments:</strong>
        <div id="comments-${post.id}">
          ${post.comments.map(c => {
            const canDeleteComment = isPostOwner || String(c.user_id) === String(currentUser.id);
            return `
              <div class="comment">
                <span><b>@${c.username}:</b> ${c.content}</span>${canDeleteComment ? `<button class="delete-comment-btn" onclick="deleteComment(${c.id})">✕</button>` : ''}
              </div>
            `;
          }).join('')}
        </div>
        <div class="comment-input">
          <input type="text" id="input-comment-${post.id}" placeholder="Write a comment...">
          <button onclick="addComment(${post.id})">Send</button>
        </div>
      </div>
    </div>
  `}).join('');
}

async function loadPosts() {
  try {
    // Load your journal posts (left side)
    const myPostsRes = await fetch(`${API_URL}/users/${currentUser.id}/posts?currentUserId=${currentUser.id}`);
    const myPosts = await myPostsRes.json();
    document.getElementById('userJournalPosts').innerHTML = renderPostsHTML(myPosts);

    // Load other users' posts (right feed)
    const allPostsRes = await fetch(`${API_URL}/posts?currentUserId=${currentUser.id}`);
    const allPosts = await allPostsRes.json();
    const otherPosts = allPosts.filter(p => String(p.author_id) !== String(currentUser.id));
    
    document.getElementById('otherPostsFeed').innerHTML = renderPostsHTML(otherPosts);
  } catch (err) {
    console.error('Error loading posts:', err);
  }
}

function toggleComments(postId) {
  if (openCommentSections.has(postId)) {
    openCommentSections.delete(postId);
  } else {
    openCommentSections.add(postId);
  }
  
  const section = document.getElementById(`comments-section-${postId}`);
  if (section) section.classList.toggle('hidden');
}

async function createPost() {
  const content = document.getElementById('postContent').value;
  if (!content.trim()) return;

  await fetch(`${API_URL}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser.id, content })
  });

  document.getElementById('postContent').value = '';
  await loadPosts();
  await loadProfileStats();
}

async function deletePost(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;

  try {
    const res = await fetch(`${API_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id })
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to delete post");
      return;
    }

    await loadPosts();
    await loadProfileStats();
  } catch (err) {
    console.error("Error deleting post:", err);
  }
}

async function toggleLike(postId) {
  await fetch(`${API_URL}/posts/${postId}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser.id })
  });
  await loadPosts();
}

async function addComment(postId) {
  const input = document.getElementById(`input-comment-${postId}`);
  const content = input.value;
  if (!content.trim()) return;

  await fetch(`${API_URL}/posts/${postId}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser.id, content })
  });

  openCommentSections.add(postId);
  input.value = '';
  await loadPosts();
}

async function deleteComment(commentId) {
  try {
    const res = await fetch(`${API_URL}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id })
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to delete comment");
      return;
    }

    await loadPosts();
  } catch (err) {
    console.error("Error deleting comment:", err);
  }
}

async function toggleFollow(userId) {
  await fetch(`${API_URL}/users/${userId}/follow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ follower_id: currentUser.id })
  });
  await loadUsers();
  await loadProfileStats();
  filterSuggestions();
}