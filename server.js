const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./social.db', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    avatar TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    content TEXT,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    UNIQUE(post_id, user_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER,
    following_id INTEGER,
    PRIMARY KEY(follower_id, following_id)
  )`);

  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (row && row.count === 0) {
      console.log("Seeding initial 3 user profiles...");
      const stmt = db.prepare("INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)");
      stmt.run("Alex Turner", "alex_t", "alex@gmail.com", "123456");
      stmt.run("Sarah Jenkins", "sarah_j", "sarah@gmail.com", "123456");
      stmt.run("David Chen", "david_c", "david@gmail.com", "123456");
      stmt.finalize();

      const postStmt = db.prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)");
      postStmt.run(1, "Just launched my new web design journal! What do you guys think? 🎨");
      postStmt.run(2, "Morning walk in the park. Nature is so peaceful today. 🌿");
      postStmt.run(3, "JavaScript async/await is so much cleaner than promise chaining! 💻");
      postStmt.finalize();

      const commentStmt = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)");
      commentStmt.run(1, 2, "Looks super clean Alex!");
      commentStmt.run(2, 3, "Great morning view!");
      commentStmt.run(3, 1, "Totally agree David!");
      commentStmt.finalize();
    }
  });
});

// API Routes
app.post('/api/users/:id/avatar', (req, res) => {
  const userId = req.params.id;
  const { avatar } = req.body; // Can be base64 string or null

  db.run("UPDATE users SET avatar = ? WHERE id = ?", [avatar, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Avatar updated successfully" });
  });
});

app.post('/api/register', (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const query = "INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)";
  db.run(query, [name, username, email, password], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: "Username or Email already exists" });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "Registration successful!", userId: this.lastID });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and Password are required" });
  }

  const query = "SELECT id, name, username, email FROM users WHERE email = ? AND password = ?";
  db.get(query, [email, password], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    
    res.json({ message: "Login successful", user });
  });
});

app.get('/api/users', (req, res) => {
  db.all("SELECT id, name, username, email FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/users/:id/posts', (req, res) => {
  const userId = req.params.id;
  const currentUserId = req.query.currentUserId || 1;

  const query = `
    SELECT 
      posts.id, 
      posts.content, 
      posts.created_at,
      users.id as author_id,
      users.username as author_name,
      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) as likes_count,
      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) as user_liked
    FROM posts 
    JOIN users ON posts.user_id = users.id 
    WHERE posts.user_id = ?
    ORDER BY posts.created_at DESC
  `;

  db.all(query, [currentUserId, userId], (err, posts) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id`, [], (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });

      const postsWithComments = posts.map(post => ({
        ...post,
        comments: comments.filter(c => c.post_id === post.id)
      }));

      res.json(postsWithComments);
    });
  });
});

app.get('/api/posts', (req, res) => {
  const currentUserId = req.query.currentUserId || 1;

  const query = `
    SELECT 
      posts.id, 
      posts.content, 
      posts.created_at,
      users.id as author_id,
      users.username as author_name,
      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) as likes_count,
      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) as user_liked
    FROM posts 
    JOIN users ON posts.user_id = users.id 
    ORDER BY posts.created_at DESC
  `;

  db.all(query, [currentUserId], (err, posts) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id`, [], (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });

      const postsWithComments = posts.map(post => ({
        ...post,
        comments: comments.filter(c => c.post_id === post.id)
      }));

      res.json(postsWithComments);
    });
  });
});

app.post('/api/posts', (req, res) => {
  const { user_id, content } = req.body;
  db.run("INSERT INTO posts (user_id, content) VALUES (?, ?)", [user_id, content], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, user_id, content });
  });
});

app.delete('/api/posts/:id', (req, res) => {
  const postId = req.params.id;
  const { user_id } = req.body;

  db.get("SELECT user_id FROM posts WHERE id = ?", [postId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Post not found" });

    if (String(row.user_id) === String(user_id)) {
      db.run("DELETE FROM comments WHERE post_id = ?", [postId]);
      db.run("DELETE FROM likes WHERE post_id = ?", [postId]);
      db.run("DELETE FROM posts WHERE id = ?", [postId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Post deleted successfully" });
      });
    } else {
      res.status(403).json({ error: "Permission denied" });
    }
  });
});

app.post('/api/posts/:id/like', (req, res) => {
  const postId = req.params.id;
  const { user_id } = req.body;

  db.get("SELECT * FROM likes WHERE post_id = ? AND user_id = ?", [postId, user_id], (err, row) => {
    if (row) {
      db.run("DELETE FROM likes WHERE post_id = ? AND user_id = ?", [postId, user_id], () => res.json({ liked: false }));
    } else {
      db.run("INSERT INTO likes (post_id, user_id) VALUES (?, ?)", [postId, user_id], () => res.json({ liked: true }));
    }
  });
});

app.post('/api/posts/:id/comment', (req, res) => {
  const postId = req.params.id;
  const { user_id, content } = req.body;

  db.run("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)", [postId, user_id, content], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, post_id: postId, user_id, content });
  });
});

app.delete('/api/comments/:id', (req, res) => {
  const commentId = req.params.id;
  const { user_id } = req.body;

  const query = `
    SELECT comments.user_id as comment_owner, posts.user_id as post_owner 
    FROM comments 
    JOIN posts ON comments.post_id = posts.id 
    WHERE comments.id = ?
  `;

  db.get(query, [commentId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Comment not found" });

    if (String(row.comment_owner) === String(user_id) || String(row.post_owner) === String(user_id)) {
      db.run("DELETE FROM comments WHERE id = ?", [commentId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Comment deleted successfully" });
      });
    } else {
      res.status(403).json({ error: "Permission denied" });
    }
  });
});

app.post('/api/users/:id/follow', (req, res) => {
  const followingId = req.params.id;
  const { follower_id } = req.body;

  db.get("SELECT * FROM follows WHERE follower_id = ? AND following_id = ?", [follower_id, followingId], (err, row) => {
    if (row) {
      db.run("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", [follower_id, followingId], () => res.json({ following: false }));
    } else {
      db.run("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)", [follower_id, followingId], () => res.json({ following: true }));
    }
  });
});

app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const currentUserId = req.query.currentUserId || 1;

  db.get("SELECT id, name, username, email, avatar FROM users WHERE id = ?", [userId], (err, user) => {
    if (!user) return res.status(404).json({ error: "User not found" });

    db.get("SELECT COUNT(*) as pCount FROM posts WHERE user_id = ?", [userId], (err, pRow) => {
      db.get("SELECT COUNT(*) as fCount FROM follows WHERE following_id = ?", [userId], (err, fRow) => {
        db.get("SELECT COUNT(*) as fgCount FROM follows WHERE follower_id = ?", [userId], (err, fgRow) => {
          db.get("SELECT COUNT(*) as is_following FROM follows WHERE follower_id = ? AND following_id = ?", [currentUserId, userId], (err, isFRow) => {
            res.json({
              ...user,
              postsCount: pRow ? pRow.pCount : 0,
              followersCount: fRow ? fRow.fCount : 0,
              followingCount: fgRow ? fgRow.fgCount : 0,
              isFollowing: isFRow ? isFRow.is_following > 0 : false
            });
          });
        });
      });
    });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));