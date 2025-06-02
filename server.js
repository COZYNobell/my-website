// 1. 필요한 모듈 가져오기
const express = require('express');
const axios = require('axios');
require('dotenv').config(); 
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');

// 2. Express 앱 생성 및 포트 설정
const app = express();
const port = process.env.PORT || 3000;

// 환경 변수 로드 확인 로그
console.log("애플리케이션 시작 - .env 파일 로드");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD (존재 여부만):", process.env.DB_PASSWORD ? "설정됨" : "설정 안됨");
console.log("DB_NAME:", process.env.DB_NAME);
console.log("SESSION_SECRET (존재 여부만):", process.env.SESSION_SECRET ? "설정됨" : "설정 안됨");
console.log("OPENWEATHERMAP_API_KEY (존재 여부만):", process.env.OPENWEATHERMAP_API_KEY ? "설정됨" : "설정 안됨");
console.log("Maps_API_KEY (존재 여부만):", process.env.Maps_API_KEY ? "설정됨" : "설정 안됨");
console.log("NODE_ENV:", process.env.NODE_ENV);

// MySQL Connection Pool 설정
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// DB 초기화
async function initializeDatabase() {
  let connection;
  try {
    connection = await dbPool.getConnection();
    const dbNameToUse = process.env.DB_NAME;
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbNameToUse}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbNameToUse}\`;`);
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
    console.log(`✅ '${dbNameToUse}' DB 및 테이블 초기화 완료`);
  } catch (error) {
    console.error("DB 초기화 오류:", error.message);
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
  secret: process.env.SESSION_SECRET || 'default_secret',
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
  if (req.path.startsWith('/api/')) {
    res.status(401).json({ message: '로그인이 필요합니다.', redirectTo: '/login', status: 401 });
  } else {
    res.redirect('/login?message=' + encodeURIComponent('로그인이 필요합니다.'));
  }
}

// HTML 페이지 라우트
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard.html', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/subscribe', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'subscribe.html')));

// 인증
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\``);
    const [existing] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(409).send("이미 가입된 이메일입니다.");
    const hash = await bcrypt.hash(password, 10);
    await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hash]);
    res.redirect(`/login?signup=success&email=${encodeURIComponent(email)}`);
  } catch (err) {
    res.status(500).send("회원가입 중 오류 발생");
  } finally {
    if (connection) connection.release();
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\``);
    const [users] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (!users.length || !(await bcrypt.compare(password, users[0].password))) {
      return res.status(401).send("이메일 또는 비밀번호가 일치하지 않습니다.");
    }
    req.session.user = { id: users[0].id, email: users[0].email };
    req.session.isAuthenticated = true;
    res.redirect('/dashboard.html');
  } catch (err) {
    res.status(500).send("로그인 오류");
  } finally {
    if (connection) connection.release();
  }
});

app.get('/logout', (req, res, next) => {
  if (req.session.user) {
    req.session.destroy(err => {
      if (err) return next(err);
      res.redirect('/'); // ✅ 홈화면으로 리디렉션
    });
  } else {
    res.redirect('/');
  }
});

app.get('/api/current-user', ensureAuthenticated, (req, res) => {
  res.json({ loggedIn: true, user: req.session.user });
});

// 즐겨찾기 API
app.post('/api/favorites', ensureAuthenticated, async (req, res) => {
  const { location_name, latitude, longitude } = req.body;
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\``);
    const sql = "INSERT INTO favorites (user_id, location_name, latitude, longitude) VALUES (?, ?, ?, ?)";
    const [result] = await connection.query(sql, [req.session.user.id, location_name, latitude, longitude]);
    res.status(201).json({ message: '추가됨', favorite: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ message: 'DB 오류: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/favorites', ensureAuthenticated, async (req, res) => {
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\``);
    const [rows] = await connection.query("SELECT * FROM favorites WHERE user_id = ?", [req.session.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'DB 오류: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
});

app.delete('/api/favorites/:id', ensureAuthenticated, async (req, res) => {
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\``);
    const [result] = await connection.query("DELETE FROM favorites WHERE id = ? AND user_id = ?", [req.params.id, req.session.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '삭제 대상 없음' });
    }
    res.json({ message: '삭제됨' });
  } catch (err) {
    res.status(500).json({ message: 'DB 오류: ' + err.message });
  } finally {
    if (connection) connection.release();
  }
});

// ✅ 오늘 날씨 정보 API
app.get('/api/weather-by-coords', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ message: '좌표 필요' });
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
    const response = await axios.get(url);
    const data = response.data;
    res.json({
      cityName: data.name,
      temperature: data.main.temp,
      feels_like: data.main.feels_like,
      humidity: data.main.humidity,
      description: data.weather[0].description,
      icon: data.weather[0].icon
    });
  } catch (err) {
    console.error('날씨 API 오류:', err.message);
    res.status(500).json({ message: '날씨 요청 실패' });
  }
});

// ✅ 예보 API
app.get('/api/weather-forecast', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ message: '좌표 필요' });
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
    const response = await axios.get(url);
    const list = response.data.list;
    const filtered = list.filter(item => item.dt_txt.includes('12:00:00')).slice(0, 2);
    const forecast = filtered.map(item => ({
      date: item.dt_txt.split(' ')[0],
      temp_min: item.main.temp_min,
      temp_max: item.main.temp_max,
      description: item.weather[0].description,
      icon: item.weather[0].icon
    }));
    res.json({ cityName: response.data.city.name, forecast });
  } catch (err) {
    console.error('예보 API 오류:', err.message);
    res.status(500).json({ message: '예보 요청 실패' });
  }
});

// 홈페이지
app.get('/', (req, res) => {
  const email = req.session.user?.email || '방문자';
  const auth = req.session.user
    ? `<a href="/logout">로그아웃</a> | <span>${email}님 환영합니다!</span>`
    : `<a href="/signup">회원가입</a> | <a href="/login">로그인</a>`;
  const links = req.session.user
    ? `<p><a href="/dashboard.html">대시보드</a></p><p><a href="/subscribe">날씨 구독</a></p>`
    : `<p><a href="/dashboard.html">대시보드 보기</a> (로그인 필요)</p><p><a href="/subscribe">구독 설정</a> (로그인 필요)</p>`;
  res.send(`<h1>날씨 지도 앱</h1><p>안녕하세요, ${email}님!</p>${links}<hr>${auth}`);
});

app.listen(port, () => {
  console.log(`🌍 서버 실행됨: http://localhost:${port}`);
});
