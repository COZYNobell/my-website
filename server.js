const express = require('express');
const axios = require('axios');
require('dotenv').config();
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');
const { SNSClient, SubscribeCommand } = require('@aws-sdk/client-sns');

const {
  register,
  httpRequestDurationMicroseconds,
  httpRequestCounter,
  usersRegisteredCounter
} = require('./metrics');

const app = express();
const port = process.env.PORT || 3000;
const IS_DEV = process.env.NODE_ENV !== 'production';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

async function initializeDatabase() {
  let conn;
  try {
    conn = await dbPool.getConnection();
    console.log('✅ DB 연결 성공');
    const dbName = process.env.DB_NAME;
    await conn.query(`CREATE DATABASE IF NOT EXISTS \\`${dbName}\\``);
    await conn.query(`USE \\`${dbName}\\``);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        location_name TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ 테이블 준비 완료');
  } catch (err) {
    console.error('DB 초기화 실패:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
}
initializeDatabase();
// --- DB 초기화 ---
async function initializeDatabase() {
    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log(`MySQL 서버 (${process.env.DB_HOST})에 성공적으로 연결되었습니다.`);

        const dbName = process.env.DB_NAME;
        if (!dbName) throw new Error("DB_NAME 환경변수가 설정되지 않았습니다.");

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await connection.query(`USE \`${dbName}\`;`);

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
                favorite_id INTEGER NOT NULL,
                condition_type VARCHAR(50) NOT NULL,
                condition_value VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (favorite_id) REFERENCES favorites(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_favorite_condition (user_id, favorite_id, condition_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("✅ 모든 테이블이 성공적으로 준비되었습니다.");
    } catch (error) {
        console.error("🔴 데이터베이스 초기화 중 오류:", error.message);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}
initializeDatabase();

// --- 미들웨어 설정 ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✨ Prometheus 메트릭 측정용 미들웨어
app.use((req, res, next) => {
    const end = httpRequestDurationMicroseconds.startTimer();
    res.on('finish', () => {
        let route = req.route ? req.route.path : req.path;
        if (route === '/') route = '/';
        route = route.replace(/\/\d+$/, '/:id');
        end({ method: req.method, route, status_code: res.statusCode });
    });
    next();
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: !IS_DEVELOPMENT,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// 로그인 여부 체크 미들웨어
function ensureAuthenticated(req, res, next) {
    if (req.session.isAuthenticated && req.session.user) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ message: '로그인이 필요합니다.', redirectTo: '/login.html' });
    return res.redirect(`/login.html?message=${encodeURIComponent('로그인이 필요합니다.')}`);
}
// --- HTML 페이지 라우트 ---
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard.html');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard.html', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/subscribe', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'subscribe.html')));

// 🔐 인증 라우트
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.redirect(`/signup.html?error=${encodeURIComponent('이메일과 비밀번호를 입력하세요.')}`);
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const [rows] = await connection.query("SELECT id FROM users WHERE email = ?", [email]);
        if (rows.length > 0) return res.redirect(`/signup.html?error=${encodeURIComponent('이미 존재하는 이메일입니다.')}`);
        const hashed = await bcrypt.hash(password, 10);
        await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashed]);
        usersRegisteredCounter.inc(); // 🎯 Prometheus 카운터 증가
        if (process.env.SNS_TOPIC_ARN) {
            await snsClient.send(new SubscribeCommand({ Protocol: 'email', TopicArn: process.env.SNS_TOPIC_ARN, Endpoint: email }));
        }
        return res.redirect(`/login.html?signup=success&email=${encodeURIComponent(email)}`);
    } catch (err) {
        console.error("회원가입 오류:", err);
        return res.redirect(`/signup.html?error=${encodeURIComponent('서버 오류가 발생했습니다.')}`);
    } finally {
        if (connection) connection.release();
    }
});
// 🔐 로그인 처리
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const [rows] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
        if (rows.length === 0) return res.redirect(`/login.html?error=${encodeURIComponent('존재하지 않는 계정입니다.')}`);
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.redirect(`/login.html?error=${encodeURIComponent('비밀번호가 일치하지 않습니다.')}`);
        req.session.user = { id: user.id, email: user.email };
        req.session.isAuthenticated = true;
        res.redirect('/dashboard.html');
    } catch (err) {
        console.error("로그인 오류:", err);
        res.redirect(`/login.html?error=${encodeURIComponent('서버 오류가 발생했습니다.')}`);
    } finally {
        if (connection) connection.release();
    }
});

// 🔓 로그아웃
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// ⭐ 즐겨찾기
app.post('/api/favorites', ensureAuthenticated, async (req, res) => {
    const { location_name, latitude, longitude } = req.body;
    if (!location_name || !latitude || !longitude) {
        return res.status(400).json({ message: '모든 정보가 필요합니다.' });
    }
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query("INSERT INTO favorites (user_id, location_name, latitude, longitude) VALUES (?, ?, ?, ?)", [
            req.session.user.id,
            location_name,
            latitude,
            longitude
        ]);
        res.status(201).json({ message: '즐겨찾기가 추가되었습니다.' });
    } catch (err) {
        console.error("즐겨찾기 추가 오류:", err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    } finally {
        if (connection) connection.release();
    }
});
app.get('/api/favorites', ensureAuthenticated, async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.query("SELECT * FROM favorites WHERE user_id = ?", [req.session.user.id]);
        res.json(rows);
    } catch (err) {
        console.error("즐겨찾기 목록 오류:", err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/favorites/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query("DELETE FROM favorites WHERE id = ? AND user_id = ?", [id, req.session.user.id]);
        res.json({ message: '삭제되었습니다.' });
    } catch (err) {
        console.error("즐겨찾기 삭제 오류:", err);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    } finally {
        if (connection) connection.release();
    }
});

// 🌤 날씨 정보 API
app.get('/api/weather', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ message: '위도와 경도가 필요합니다.' });

    const apiKey = process.env.OPENWEATHER_API_KEY;
    try {
        const [today, forecast] = await Promise.all([
            axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`),
            axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`)
        ]);
        res.json({ today: today.data, forecast: forecast.data });
    } catch (err) {
        console.error("날씨 데이터 오류:", err.response?.data || err.message);
        res.status(500).json({ message: '날씨 정보를 가져오지 못했습니다.' });
    }
});

// 📈 Prometheus 메트릭 수집
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        console.error("메트릭 처리 오류:", err);
        res.status(500).end("메트릭 오류");
    }
});

// 🧪 헬스 체크
app.get('/healthz', (req, res) => {
    res.status(200).send("OK");
});

// 🧪 테스트용 회원가입 카운터 수동 증가
app.get('/api/test/increment-signup', (req, res) => {
    usersRegisteredCounter.inc();
    res.send('✅ users_registered_total 카운터가 수동으로 1 증가했습니다.');
});

// 🚀 서버 시작
app.listen(port, () => {
    console.log(`✅ 서버 실행 중: http://localhost:${port}`);
});
