// 📄 파일명: server.js
// ✅ 버전: v4 (테스트 API 추가)
// ✅ 설명: 메트릭 값의 변화를 테스트하기 위한 임시 API 엔드포인트를 추가했습니다.
// 🕒 날짜: 2025-06-25

// 1. 필요한 모듈 가져오기
const express = require('express');
const axios = require('axios');
require('dotenv').config();
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');
const { SNSClient, SubscribeCommand } = require("@aws-sdk/client-sns");

// ✨ 우리가 만든 metrics.js 모듈을 가져옵니다.
const { register, httpRequestDurationMicroseconds, usersRegisteredCounter } = require('./metrics');

// 2. Express 앱 생성 및 포트 설정
const app = express();
const port = process.env.PORT || 3000;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// --- AWS 클라이언트 및 DB 풀 초기화 ---
const snsClient = new SNSClient({ region: process.env.AWS_REGION || "ap-northeast-2" });
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 데이터베이스 초기화 함수
async function initializeDatabase() {
    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log(`MySQL 서버 (${process.env.DB_HOST})에 성공적으로 연결되었습니다.`);
        const dbNameToUse = process.env.DB_NAME;
        if (!dbNameToUse) throw new Error("DB_NAME 환경 변수가 설정되지 않았습니다!");

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbNameToUse}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await connection.query(`USE \`${dbNameToUse}\`;`);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTO_INCREMENT, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        console.log("🟢 users 테이블 준비 완료.");

        await connection.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTO_INCREMENT, user_id INTEGER NOT NULL, location_name TEXT NOT NULL, latitude DECIMAL(10, 8) NOT NULL, longitude DECIMAL(11, 8) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        console.log("🟢 favorites 테이블 준비 완료.");

        await connection.query(`
            CREATE TABLE IF NOT EXISTS weather_subscriptions (
                id INTEGER PRIMARY KEY AUTO_INCREMENT, user_id INTEGER NOT NULL, favorite_id INTEGER NOT NULL, condition_type VARCHAR(50) NOT NULL, condition_value VARCHAR(50) NULL, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (favorite_id) REFERENCES favorites(id) ON DELETE CASCADE, UNIQUE KEY unique_user_favorite_condition (user_id, favorite_id, condition_type) 
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        console.log("🟢 weather_subscriptions 테이블 준비 완료.");
        
        console.log(`✅ 데이터베이스 '${dbNameToUse}' 및 모든 테이블이 성공적으로 준비되었습니다.`);
    } catch (error) {
        console.error("🔴 데이터베이스 초기화 중 심각한 오류 발생:", error.message);
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

app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    let route = req.route ? req.route.path : req.path;
    if (route === '/') route = '/';
    route = route.replace(/\/\d+/g, '/:id');
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: !IS_DEVELOPMENT, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

function ensureAuthenticated(req, res, next) {
    if (IS_DEVELOPMENT) console.log(`[DEBUG] Path: ${req.path}, Authenticated: ${req.session.isAuthenticated}`);
    if (req.session.isAuthenticated && req.session.user) return next(); 
    if (req.path.startsWith('/api/')) return res.status(401).json({ message: '로그인이 필요합니다.', redirectTo: '/login.html' });
    res.redirect(`/login.html?message=${encodeURIComponent('로그인이 필요합니다.')}`); 
}

// --- HTML 페이지 라우트 ---
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard.html', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/subscribe', ensureAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'subscribe.html')));
app.get('/', (req, res) => {
    if (req.session.isAuthenticated && req.session.user) {
        res.redirect('/dashboard.html');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// --- 인증 API 라우트 ---
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.redirect(`/signup.html?error=${encodeURIComponent('이메일과 비밀번호를 모두 입력해주세요.')}`);
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const [existingUsers] = await connection.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.redirect(`/signup.html?error=${encodeURIComponent('이미 가입된 이메일입니다.')}`);
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword]);
        
        usersRegisteredCounter.inc(); 
        
        console.log(`새 사용자 가입됨: ${email}`);
        if (process.env.SNS_TOPIC_ARN) {
            await snsClient.send(new SubscribeCommand({ Protocol: "email", TopicArn: process.env.SNS_TOPIC_ARN, Endpoint: email }));
            console.log("📧 SNS 구독 요청 완료:", email);
        }
        res.redirect(`/login.html?signup=success&email=${encodeURIComponent(email)}`); 
    } catch (error) {
        console.error("회원가입 오류:", error.message, error.stack);
        res.redirect(`/signup.html?error=${encodeURIComponent('서버 오류가 발생했습니다.')}`);
    } finally { if (connection) connection.release(); }
});

// --- 나머지 모든 API 라우트 핸들러들 ... ---

// --- ✨ 테스트용 임시 API 엔드포인트 ✨ ---
app.get('/api/test/increment-signup', (req, res) => {
  usersRegisteredCounter.inc();
  console.log('✅ [Test] users_registered_total 메트릭이 1 증가했습니다.');
  res.status(200).send('OK: User registration counter incremented by 1.');
});


// --- 헬스 체크 및 메트릭 라우트 ---
app.get('/healthz', async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query('SELECT 1');
        res.status(200).json({ status: 'ok', message: 'Application is healthy' });
    } catch (error) {
        console.error("🔴 헬스 체크 실패:", error.message);
        res.status(503).json({ status: 'error', message: 'Application is unhealthy', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    console.error("Error serving /metrics:", ex);
    res.status(500).end(ex.message || ex.toString());
  }
});

// 서버 실행
app.listen(port, () => {
  console.log(`✅ 서버가 성공적으로 실행되었습니다. http://localhost:${port}`);
});
