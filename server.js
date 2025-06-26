// 📄 파일명: server.js
// ✅ 버전: v5 (최종 복원 및 개선)
// ✅ 설명: 이전에 생략되었던 모든 API 로직을 포함하고, metrics.js 모듈을 사용하도록 수정한 최종 완성본입니다.
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

// ✨ 요청 시간을 측정하는 미들웨어 (metrics.js의 변수 사용)
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
    cookie: { secure: !IS_DEVELOPMENT, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

function ensureAuthenticated(req, res, next) {
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

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.redirect(`/login.html?error=${encodeURIComponent('이메일과 비밀번호를 모두 입력해주세요.')}`);
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const [users] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
        if (users.length === 0) return res.redirect(`/login.html?error=${encodeURIComponent('이메일 또는 비밀번호가 일치하지 않습니다.')}`);
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.session.user = { id: user.id, email: user.email };
            req.session.isAuthenticated = true; 
            console.log('사용자 로그인 성공:', req.session.user);
            res.redirect('/dashboard.html'); 
        } else {
            return res.redirect(`/login.html?error=${encodeURIComponent('이메일 또는 비밀번호가 일치하지 않습니다.')}`);
        }
    } catch (error) {
        console.error("로그인 오류:", error.message, error.stack);
        res.redirect(`/login.html?error=${encodeURIComponent('서버 오류가 발생했습니다.')}`);
    } finally { if (connection) connection.release(); }
});

app.get('/logout', (req, res) => {
    if (req.session.user) {
        const userEmail = req.session.user.email; 
        req.session.destroy(err => { 
            if (err) console.error('세션 파기 오류:', err);
            console.log(`사용자 (${userEmail}) 로그아웃 성공`);
            res.redirect('/?logout=success'); 
        });
    } else { res.redirect('/'); }
});

// --- 기능 API 라우트 ---
app.get('/api/current-user', ensureAuthenticated, (req, res) => res.json({ loggedIn: true, user: req.session.user }));

app.post('/api/favorites', ensureAuthenticated, async (req, res) => {
    let connection; 
    try {
        connection = await dbPool.getConnection(); 
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const { location_name, latitude, longitude } = req.body;  
        const userId = req.session.user.id; 
        if (!location_name || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: '장소 이름, 위도, 경도가 모두 필요합니다.' });
        }
        const sql = `INSERT INTO favorites (user_id, location_name, latitude, longitude) VALUES (?, ?, ?, ?)`;
        const params = [userId, location_name, latitude, longitude];
        const [result] = await connection.query(sql, params);
        res.status(201).json({ 
            message: '즐겨찾기에 추가되었습니다.', 
            favorite: { id: result.insertId, user_id: userId, location_name, latitude, longitude } 
        });
    } catch (error) { 
        console.error("즐겨찾기 추가 중 DB 오류:", error.message, error.stack); 
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: '이미 즐겨찾기에 추가된 장소일 수 있습니다.' }); 
        }
        return res.status(500).json({ message: `즐겨찾기 추가 중 서버 오류가 발생했습니다: ${error.message}` });
    } finally { if (connection) connection.release(); }
});

app.get('/api/favorites', ensureAuthenticated, async (req, res) => {
    let connection; 
    try {
        connection = await dbPool.getConnection(); 
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const userId = req.session.user.id;
        const sql = `SELECT id, location_name, latitude, longitude, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC`;
        const [rows] = await connection.query(sql, [userId]);
        res.json(rows);
    } catch (error) { 
        console.error("즐겨찾기 조회 중 DB 오류:", error.message, error.stack); 
        return res.status(500).json({ message: `즐겨찾기 목록을 불러오는 중 오류가 발생했습니다: ${error.message}` });
    } finally { if (connection) connection.release(); }
});

app.delete('/api/favorites/:id', ensureAuthenticated, async (req, res) => {
    let connection; 
    try {
        connection = await dbPool.getConnection(); 
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const favoriteId = req.params.id;  
        const userId = req.session.user.id; 
        const sql = `DELETE FROM favorites WHERE id = ? AND user_id = ?`;
        const params = [favoriteId, userId];
        const [result] = await connection.query(sql, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '해당 즐겨찾기를 찾을 수 없거나 삭제할 권한이 없습니다.' });
        }
        res.json({ message: '즐겨찾기에서 삭제되었습니다.', favoriteId: parseInt(favoriteId) });
    } catch (error) { 
        console.error("즐겨찾기 삭제 중 DB 오류:", error.message, error.stack); 
        return res.status(500).json({ message: `즐겨찾기 삭제 중 오류가 발생했습니다: ${error.message}` });
    } finally { if (connection) connection.release(); }
});

app.post('/api/weather-subscriptions', ensureAuthenticated, async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const { favorite_id, condition_type, condition_value } = req.body;
        const userId = req.session.user.id;
        if (favorite_id === undefined || !condition_type) {
            return res.status(400).json({ message: '즐겨찾기 ID와 날씨 조건 종류는 필수입니다.' });
        }
        const sql = `INSERT INTO weather_subscriptions (user_id, favorite_id, condition_type, condition_value) VALUES (?, ?, ?, ?)`;
        const params = [userId, favorite_id, condition_type, condition_value || null];
        const [result] = await connection.query(sql, params);
        res.status(201).json({ message: '날씨 구독 정보가 성공적으로 저장되었습니다.' });
    } catch (error) {
        console.error("날씨 구독 추가 중 DB 오류:", error.message, error.stack);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: '이미 해당 즐겨찾기에 동일한 조건으로 구독되어 있습니다.' });
        }
        return res.status(500).json({ message: `날씨 구독 추가 중 서버 오류가 발생했습니다: ${error.message}` });
    } finally { if (connection) connection.release(); }
});

app.get('/api/weather-subscriptions', ensureAuthenticated, async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const userId = req.session.user.id;
        const sql = `SELECT ws.id, f.location_name, ws.condition_type, ws.condition_value, ws.is_active FROM weather_subscriptions ws JOIN favorites f ON ws.favorite_id = f.id WHERE ws.user_id = ? ORDER BY ws.created_at DESC`;
        const [subscriptions] = await connection.query(sql, [userId]);
        res.json(subscriptions);
    } catch (error) {
        console.error("날씨 구독 목록 조회 중 DB 오류:", error.message, error.stack);
        res.status(500).json({ message: `날씨 구독 목록을 불러오는 중 오류가 발생했습니다.` });
    } finally { if (connection) connection.release(); }
});

app.delete('/api/weather-subscriptions/:id', ensureAuthenticated, async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query(`USE \`${process.env.DB_NAME}\``);
        const subscriptionId = req.params.id;
        const userId = req.session.user.id;
        const sql = `DELETE FROM weather_subscriptions WHERE id = ? AND user_id = ?`;
        const [result] = await connection.query(sql, [subscriptionId, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '해당 날씨 구독 정보를 찾을 수 없거나 삭제할 권한이 없습니다.' });
        }
        res.json({ message: '날씨 구독이 성공적으로 취소되었습니다.', subscriptionId: parseInt(subscriptionId) });
    } catch (error) {
        console.error("날씨 구독 취소 중 DB 오류:", error.message, error.stack);
        res.status(500).json({ message: `날씨 구독 취소 중 오류가 발생했습니다.` });
    } finally { if (connection) connection.release(); }
});

app.get('/api/weather-by-coords', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ message: '위도(lat)와 경도(lon) 파라미터가 필요합니다.' });
    const apiKey = process.env.OPENWEATHERMAP_API_KEY_SECRET || process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) return res.status(500).json({ message: '서버에 날씨 API 키가 설정되지 않았습니다.' });
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;
    try {
        const response = await axios.get(weatherUrl);
        const weatherData = response.data;
        res.json({ 
            description: weatherData.weather[0].description, 
            temperature: weatherData.main.temp, 
            feels_like: weatherData.main.feels_like, 
            humidity: weatherData.main.humidity, 
            cityName: weatherData.name, 
            icon: weatherData.weather[0].icon 
        });
    } catch (error) { 
        console.error('❌ 좌표 기반 날씨 정보 가져오기 실패:', error.message); 
        res.status(500).json({ message: '날씨 정보를 가져오는 데 실패했습니다.' }); 
    }
});

app.get('/api/weather-forecast', async (req, res) => {
    const { lat, lon } = req.query;
    const apiKey = process.env.OPENWEATHERMAP_API_KEY_SECRET || process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) return res.status(500).json({ message: '서버에 날씨 API 키가 설정되지 않았습니다.' });
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;
    try {
        const response = await axios.get(forecastUrl);
        const forecastData = response.data;
        const dailyForecasts = {};
        forecastData.list.forEach(item => { 
            const date = item.dt_txt.split(' ')[0]; 
            if (!dailyForecasts[date]) dailyForecasts[date] = { temps: [], weather_descriptions: [], icons: [] };
            dailyForecasts[date].temps.push(item.main.temp); 
            dailyForecasts[date].weather_descriptions.push(item.weather[0].description); 
            dailyForecasts[date].icons.push(item.weather[0].icon); 
        });
        const processedForecast = []; 
        Object.keys(dailyForecasts).slice(1, 4).forEach(date => {
            const dayData = dailyForecasts[date];
            processedForecast.push({
                date: date,
                temp_min: Math.min(...dayData.temps).toFixed(1),
                temp_max: Math.max(...dayData.temps).toFixed(1),
                description: dayData.weather_descriptions[Math.floor(dayData.weather_descriptions.length / 2)],
                icon: dayData.icons[Math.floor(dayData.icons.length / 2)].replace('n', 'd')
            });
        });
        res.json({ cityName: forecastData.city.name, forecast: processedForecast });
    } catch (error) { 
        console.error('❌ 날씨 예보 정보 가져오기 실패:', error.message); 
        res.status(500).json({ message: '날씨 예보 정보를 가져오는 데 실패했습니다.' }); 
    }
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

// ✨ 테스트용 임시 API 엔드포인트 ✨
app.get('/api/test/increment-signup', (req, res) => {
    usersRegisteredCounter.inc();
    console.log('✅ [Test] users_registered_total 메트릭이 1 증가했습니다.');
    res.status(200).send('OK: User registration counter incremented by 1.');
});

// 서버 실행
app.listen(port, () => {
  console.log(`✅ 서버가 성공적으로 실행되었습니다. http://localhost:${port}`);
});
