// server.js

const express = require('express');
const axios = require('axios');
require('dotenv').config();
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

console.log("애플리케이션 시작 - .env 파일 로드");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD (존재 여부만):", process.env.DB_PASSWORD ? "설정됨" : "설정 안됨");
console.log("DB_NAME:", process.env.DB_NAME);
console.log("SESSION_SECRET (존재 여부만):", process.env.SESSION_SECRET ? "설정됨" : "설정 안됨");
console.log("OPENWEATHERMAP_API_KEY (존재 여부만):", process.env.OPENWEATHERMAP_API_KEY ? "설정됨" : "설정 안됨");
console.log("Maps_API_KEY (존재 여부만):", process.env.Maps_API_KEY ? "설정됨" : "설정 안됨");
console.log("NODE_ENV:", process.env.NODE_ENV);

const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initializeDatabase() {
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${process.env.DB_NAME}\`;`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        location_name TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS weather_subscriptions (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        location_name VARCHAR(255) NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        condition_type VARCHAR(50) NOT NULL,
        condition_value VARCHAR(50) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("✅ DB 및 테이블 초기화 완료");
  } catch (error) {
    console.error("❌ DB 초기화 중 오류:", error.message);
  } finally {
    if (connection) connection.release();
  }
}

initializeDatabase();

const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

function ensureAuthenticated(req, res, next) {
  if (req.session.isAuthenticated && req.session.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ message: '로그인이 필요합니다.' });
  return res.redirect(`/login?message=${encodeURIComponent('로그인이 필요합니다.')}`);
}

// HTML routes
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard.html', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/subscribe', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'subscribe.html')));

// Auth routes
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send('이메일과 비밀번호를 입력해주세요.');
  const conn = await dbPool.getConnection();
  try {
    await conn.query(`USE \`${process.env.DB_NAME}\`;`);
    const [existing] = await conn.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(409).send('이미 가입된 이메일입니다.');
    const hashed = await bcrypt.hash(password, 10);
    await conn.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashed]);
    res.redirect('/login');
  } catch (err) {
    res.status(500).send(`회원가입 오류: ${err.message}`);
  } finally {
    conn.release();
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const conn = await dbPool.getConnection();
  try {
    await conn.query(`USE \`${process.env.DB_NAME}\`;`);
    const [users] = await conn.query("SELECT * FROM users WHERE email = ?", [email]);
    if (!users.length || !(await bcrypt.compare(password, users[0].password))) {
      return res.status(401).send('이메일 또는 비밀번호가 일치하지 않습니다.');
    }
    req.session.user = { id: users[0].id, email: users[0].email };
    req.session.isAuthenticated = true;
    res.redirect('/dashboard.html');
  } catch (err) {
    res.status(500).send(`로그인 오류: ${err.message}`);
  } finally {
    conn.release();
  }
});

app.get('/logout', (req, res) => {
  if (req.session) req.session.destroy(() => res.redirect('/'));
  else res.redirect('/');
});

app.get('/', (req, res) => {
  const email = req.session?.user?.email || '방문자';
  const authLinks = req.session?.user ? `<a href="/logout">로그아웃</a>` : `<a href="/login">로그인</a> | <a href="/signup">회원가입</a>`;
  res.send(`<h1>나의 멋진 웹사이트</h1><p>${email}님 환영합니다.</p>${authLinks}`);
});

// API 추가 라우트들
app.get('/api/current-user', (req, res) => {
  if (req.session?.user) return res.json(req.session.user);
  res.status(401).json({ message: '로그인이 필요합니다.' });
});

app.get('/api/favorites', ensureAuthenticated, async (req, res) => {
  const conn = await dbPool.getConnection();
  try {
    await conn.query(`USE \`${process.env.DB_NAME}\`;`);
    const [results] = await conn.query("SELECT * FROM favorites WHERE user_id = ?", [req.session.user.id]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/weather-by-coords', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
      params: { lat, lon, appid: OPENWEATHERMAP_API_KEY, units: 'metric', lang: 'kr' }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/weather-forecast', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/forecast`, {
      params: { lat, lon, appid: OPENWEATHERMAP_API_KEY, units: 'metric', lang: 'kr' }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`🌐 http://localhost:${port} 에서 서버 실행 중`);
});
